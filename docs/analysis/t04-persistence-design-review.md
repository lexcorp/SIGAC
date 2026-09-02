# T-04 — Persistence Design Review

**Spec:** `agenda-to-vale-archivo` v0.2.0  
**Fecha:** 2026-08-30  
**Alcance:** análisis de diseño para T-04 (Persistence de trazabilidad e idempotencia)  
**Estado:** DRAFT — solo lectura; ningún cambio de código ni schema en este documento

---

## 1. Estado actual

### 1.1 Tablas existentes en PostgreSQL (`sigac_demo`)

| Tabla | Propósito | Estado |
|---|---|---|
| `vale_archivo` | Cabecera del Vale Archivo | ✅ existe (migration 0003) |
| `vale_archivo_items` | Ítems del vale | ✅ existe (migration 0003) |
| `vale_archivo_numero_vale_unique` | Constraint UNIQUE sobre `numero_vale` | ✅ existe (migration 0004) |

Todas las demás tablas (`agenda_imports`, `citas`, `expedientes`, etc.) pertenecen a otros bounded contexts.

**Tablas ausentes para T-04:**

- `vale_generation_batch` — identidad de la sesión de generación (ADR-0040 §"Trazabilidad inmutable")
- `vale_generation_trace` — snapshot por Vale generado dentro de la sesión
- `vale_generation_conflict` — evidencia de resoluciones cross-group (ADR-0038)
- `vale_daily_sequence` — contador diario para `VA-YYYYMMDD-NNN` (ADR-0035)

### 1.2 Infraestructura de base de datos disponible

| Componente | Descripción | Útil para T-04 |
|---|---|---|
| `TenantDatabaseRouter.withTransaction()` | Ejecuta trabajo en `BEGIN/COMMIT/ROLLBACK` dentro de la DB del tenant | ✅ Suficiente para la transacción atómica requerida por ADR-0040 |
| `TenantSessionExecutor` | Propaga una `TenantDatabaseSession` ya abierta, evitando conexiones anidadas | ✅ Permite que todos los writes de T-04 compartan la misma conexión |
| `PostgresValeArchivoRepository.save()` | Upsert de vale + items dentro de un `executor.execute()` | ⚠️ Acepta session opcional — puede participar en la transacción externa |
| `PostgresAuditWriter` | Escribe audit en la DB del tenant | ✅ Idem — comparte session |

### 1.3 Application layer disponible

| Componente | Puerto | Descripción |
|---|---|---|
| `GenerateValeBatch` | `ValeBatchUnitOfWork` | Application Service completo (T-02B/T-02C) — orquesta Vale, trace, idempotencia y audit |
| `ValeBatchTransaction` | Interface en `ValeBatchUnitOfWork.ts` | Define los contratos que T-04 debe implementar en Postgres |
| `ValeBatchTraceSnapshot` | — | Snapshot inmutable completo (ADR-0040) incluyendo `resolvedConflicts` (ADR-0038) |

**No existe** ninguna implementación de `ValeBatchUnitOfWork` ni `ValeBatchTransaction` en `packages/platform/database/`. T-04 debe crear `PostgresValeBatchUnitOfWork` que implemente ambos.

### 1.4 Drift entre migrations y código

No existe Drizzle schema para las tablas `vale_archivo` ni `vale_archivo_items` en `packages/platform/database/src/schema/tenant.ts`. Las migrations son SQL puro y los repositories usan `pg.Client` directamente. Esto es consistente con el resto del proyecto (Agenda Preparation y Archive Operations siguen el mismo patrón). **No hay drift** — no se usa Drizzle ORM para estas tablas.

---

## 2. Gaps encontrados

### 2.1 Tabla `vale_generation_batch` (ADR-0040 §identidad idempotente)

**Ausencia:** no existe ninguna tabla que conserve la identidad única de una sesión de generación. El use case `GenerateValeBatch` implementa idempotencia via `findBySource(key)` pero ese método aún es un stub en el fake (`FakeValeBatchUnitOfWork`). La implementación Postgres necesita una tabla donde registrar el batch y consultar replays.

**Identidad aprobada (ADR-0040):**
```
tenant database + agendaDate + sourceImportacionId + generationSnapshotHash
```

### 2.2 Tabla `vale_generation_trace` (ADR-0040 §trazabilidad)

**Ausencia:** `ValeBatchTraceSnapshot` existe como contrato TS (generado en T-02B) pero no tiene tabla física. La relación `Vale → origen de Agenda` no persiste.

### 2.3 Tabla `vale_generation_conflict` (ADR-0038 §resolución)

**Ausencia:** `ValeBatchResolvedConflictSnapshot` existe como parte del trace pero no hay tabla separada. Puede normalizarse dentro de `vale_generation_trace` como JSONB o en tabla separada. Ver §3 para la decisión de diseño.

### 2.4 Numeración `VA-YYYYMMDD-NNN` (ADR-0035)

**Ausencia:** `reserveDailySequence()` existe en `ValeBatchTransaction` (contrato) pero no tiene implementación. Actualmente `vale_archivo.numero_vale` tiene UNIQUE pero no hay contador atómico por fecha y tenant.

**Riesgo sin tabla dedicada:** usar `MAX(numero_vale) + 1` dentro de la misma transacción provoca contención y race conditions bajo concurrencia. Se necesita un mecanismo que garantice secuencias sin gaps bajo transacciones concurrentes.

### 2.5 `PostgresValeBatchUnitOfWork` (infraestructura faltante)

**Ausencia:** ningún archivo en `packages/platform/database/src/vale-archivo/` implementa `ValeBatchUnitOfWork`. Es el principal entregable de T-04.

---

## 3. Propuesta de schema lógico

### 3.1 `vale_daily_sequence`

```sql
CREATE TABLE vale_daily_sequence (
  fecha_solicitud   date    NOT NULL,
  last_sequence     integer NOT NULL DEFAULT 0,
  CONSTRAINT vale_daily_sequence_pkey PRIMARY KEY (fecha_solicitud)
);
```

**Estrategia de numeración atómica:**

```sql
INSERT INTO vale_daily_sequence (fecha_solicitud, last_sequence)
VALUES ($1, 1)
ON CONFLICT (fecha_solicitud)
  DO UPDATE SET last_sequence = vale_daily_sequence.last_sequence + 1
RETURNING last_sequence;
```

Este `INSERT ... ON CONFLICT ... DO UPDATE RETURNING` es atómico en PostgreSQL — no requiere `SELECT FOR UPDATE` ni advisory locks. El número devuelto es el consecutivo reservado para este Vale dentro de la transacción activa.

**Formato final:** `VA-` + `YYYY-MM-DD` (de `fecha_solicitud`) + `-` + `LPAD(last_sequence, 3, '0')`.

**Tenant isolation:** la tabla vive en la database del tenant — hereda el aislamiento de ADR-0034 sin columna `tenant_id`.

### 3.2 `vale_generation_batch`

```sql
CREATE TABLE vale_generation_batch (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_date             date        NOT NULL,
  source_importacion_id   text        NOT NULL,
  source_version          text        NOT NULL,
  generation_snapshot_hash text       NOT NULL,
  actor_id                text        NOT NULL,
  generated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vale_generation_batch_idempotency_uq
    UNIQUE (agenda_date, source_importacion_id, generation_snapshot_hash)
);
CREATE INDEX idx_vale_gen_batch_date ON vale_generation_batch (agenda_date);
```

**Rol:** identidad de la sesión de generación. El constraint UNIQUE implementa la segunda línea de defensa contra duplicados concurrentes (primera línea: `findBySource` antes de mutar). `actor_id` viene de `RequestContext.actor.actorId` — sin PII.

### 3.3 `vale_generation_trace`

```sql
CREATE TABLE vale_generation_trace (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              uuid        NOT NULL
                          REFERENCES vale_generation_batch(id) ON DELETE CASCADE,
  vale_id               uuid        NOT NULL
                          REFERENCES vale_archivo(id) ON DELETE CASCADE,
  numero_vale           text        NOT NULL,
  agenda_date           date        NOT NULL,
  servicio_codigo       text        NOT NULL,
  servicio_nombre       text        NOT NULL,
  medico_numero_empleado text       NOT NULL,
  medico_nombre         text        NOT NULL,
  items                 jsonb       NOT NULL DEFAULT '[]',
    -- [ { valeItemId, expedienteNumero, appointmentReferences: [{folio, servicioCodigo, medicoNumeroEmpleado}] } ]
  resolved_conflicts    jsonb       NOT NULL DEFAULT '[]',
    -- [ { expedienteNumero, ownerValeItemId, ownerGroup, alternatives: [{group, appointmentReferences}] } ]
  CONSTRAINT vale_generation_trace_vale_uq UNIQUE (vale_id)
);
CREATE INDEX idx_vale_gen_trace_batch ON vale_generation_trace (batch_id);
```

**Diseño JSONB para `items` y `resolved_conflicts`:**
- Los arrays de referencias de cita y conflictos son estáticos e inmutables (ADR-0040: "snapshot inmutable"). JSONB es correcto aquí.
- No se necesitan queries de filtrado por campos internos de estos arrays en el slice actual.
- Normalizar en tablas separadas añadiría joins sin beneficio en este slice.

**Sin nombres de pacientes:** `items[].expedienteNumero` es una referencia técnica. `resolved_conflicts` no incluye `pacienteNombre` (validado en T-02C tests). El audit canonizado está en `audit_log`.

---

## 4. Propuesta de migrations

### Migration 0005 — `vale_generation_batch` + `vale_daily_sequence`

```sql
-- 0005_vale_generation_batch.sql
-- T-04 / agenda-to-vale-archivo — batch identity, idempotency and daily sequence

CREATE TABLE "vale_daily_sequence" (
  "fecha_solicitud"   date    NOT NULL,
  "last_sequence"     integer NOT NULL DEFAULT 0,
  CONSTRAINT "vale_daily_sequence_pkey" PRIMARY KEY ("fecha_solicitud")
);

--> statement-breakpoint

CREATE TABLE "vale_generation_batch" (
  "id"                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "agenda_date"               date        NOT NULL,
  "source_importacion_id"     text        NOT NULL,
  "source_version"            text        NOT NULL,
  "generation_snapshot_hash"  text        NOT NULL,
  "actor_id"                  text        NOT NULL,
  "generated_at"              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "vale_generation_batch_idempotency_uq"
    UNIQUE ("agenda_date", "source_importacion_id", "generation_snapshot_hash")
);

--> statement-breakpoint

CREATE INDEX "idx_vale_gen_batch_date" ON "vale_generation_batch" ("agenda_date");
```

### Migration 0006 — `vale_generation_trace`

```sql
-- 0006_vale_generation_trace.sql
-- T-04 / agenda-to-vale-archivo — immutable trace snapshot per generated Vale

CREATE TABLE "vale_generation_trace" (
  "id"                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id"              uuid        NOT NULL,
  "vale_id"               uuid        NOT NULL,
  "numero_vale"           text        NOT NULL,
  "agenda_date"           date        NOT NULL,
  "servicio_codigo"       text        NOT NULL,
  "servicio_nombre"       text        NOT NULL,
  "medico_numero_empleado" text       NOT NULL,
  "medico_nombre"         text        NOT NULL,
  "items"                 jsonb       NOT NULL DEFAULT '[]',
  "resolved_conflicts"    jsonb       NOT NULL DEFAULT '[]',
  CONSTRAINT "vale_generation_trace_batch_fk"
    FOREIGN KEY ("batch_id")
    REFERENCES "vale_generation_batch"("id") ON DELETE CASCADE,
  CONSTRAINT "vale_generation_trace_vale_fk"
    FOREIGN KEY ("vale_id")
    REFERENCES "vale_archivo"("id") ON DELETE CASCADE,
  CONSTRAINT "vale_generation_trace_vale_uq" UNIQUE ("vale_id")
);

--> statement-breakpoint

CREATE INDEX "idx_vale_gen_trace_batch" ON "vale_generation_trace" ("batch_id");
```

Las dos migrations se separan para facilitar rollbacks granulares y para que el constraint FK de `vale_generation_trace → vale_generation_batch` pueda aplicarse independientemente.

---

## 5. Estrategia de transacciones

### 5.1 Flujo transaccional

```
TenantDatabaseRouter.withTransaction(context.tenant, async (session) => {
  // Todos los writes comparten la misma conexión y transacción

  // 1. findBySource → SELECT con FOR SHARE (idempotencia)
  existing = await findBySource(key, session)
  if (existing.length > 0) return ALREADY_GENERATED

  // 2. Por cada grupo:
  //   2a. reserveDailySequence → INSERT ... ON CONFLICT DO UPDATE RETURNING
  //   2b. saveVale            → INSERT vale_archivo + items (via PostgresValeArchivoRepository con session)
  //   2c. appendTraceSnapshot → INSERT vale_generation_trace

  // 3. INSERT vale_generation_batch (al final — confirma el batch completo)

  // 4. auditWriter.append → INSERT audit_log

  // COMMIT (o ROLLBACK automático en excepción)
})
```

**Punto crítico:** `PostgresValeArchivoRepository.save()` acepta un parámetro opcional `session?: TenantDatabaseSession`. El constructor de `TenantSessionExecutor` acepta la session. Por lo tanto, `PostgresValeBatchUnitOfWork` puede instanciar `PostgresValeArchivoRepository(router, session)` dentro del callback de `withTransaction` y todos los writes compartirán la conexión abierta. No se requiere cambiar `PostgresValeArchivoRepository`.

### 5.2 Orden dentro de la transacción

El `INSERT vale_generation_batch` debe ser el **último** write antes del audit, por dos razones:

1. El batch row es la "marca de éxito" de la sesión — si cualquier Vale falla, el batch no queda registrado y el retry puede reimportar correctamente.
2. El UNIQUE constraint del batch actúa como segunda defensa contra concurrencia: dos transacciones que llegan simultáneamente con el mismo hash competirán en este INSERT, y la segunda recibirá un error de constraint que causa ROLLBACK.

### 5.3 `reserveDailySequence` dentro de la transacción

```sql
INSERT INTO vale_daily_sequence (fecha_solicitud, last_sequence)
VALUES ($1, 1)
ON CONFLICT (fecha_solicitud)
  DO UPDATE SET last_sequence = vale_daily_sequence.last_sequence + 1
RETURNING last_sequence;
```

Este `UPSERT RETURNING` es atómico y correcto dentro de una transacción PostgreSQL. Dos transacciones concurrentes para la misma fecha producirán filas con `last_sequence` distintos sin race condition, porque PostgreSQL serializa las modificaciones de la misma fila.

---

## 6. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Sesión no propagada a `PostgresValeArchivoRepository.save()` | Alta | Instanciar el repository con `session` dentro del callback de `withTransaction`; test de integración verifica rollback completo |
| `reserveDailySequence` fuera de transacción | Alta | La llamada debe estar dentro del mismo `withTransaction` callback; nunca llamar antes de abrir la transacción |
| `vale_generation_batch` INSERT falla (constraint) por concurrencia | Media | Error de constraint → ROLLBACK → el cliente recibe error recuperable; puede reintentar con nuevo hash si la Agenda cambió |
| JSONB `items`/`resolved_conflicts` demasiado grande | Baja | Las agendas tienen típicamente <500 citas por día; un grupo tiene <100 ítems; JSONB es adecuado |
| Rollback deja `vale_daily_sequence.last_sequence` incrementado sin Vale asociado | Baja — por diseño | ADR-0035 aprueba gaps en la numeración; el consecutivo nunca se reutiliza |
| FK `vale_generation_trace → vale_archivo` puede fallar si el Vale no se guarda primero | Alta | El orden del §5.2 garantiza que `saveVale` precede a `appendTraceSnapshot` |

---

## 7. Decisiones pendientes

### DP-01 — `findBySource` debe usar `FOR SHARE` o es suficiente el UNIQUE constraint del batch?

**Opciones:**
- A) Solo el UNIQUE constraint en `vale_generation_batch` (insert al final): más simple, el conflicto se detecta tarde.
- B) `SELECT ... FOR SHARE` al inicio + UNIQUE constraint: detecta el replay temprano, evita crear Vales que luego se descartan.

**Recomendación:** opción B — `SELECT ... FOR SHARE` en `findBySource` para replay rápido, más UNIQUE constraint como segunda defensa. El costo de un shared lock es bajo dado que los replays son el caso normal para idempotencia operativa.

### DP-02 — ¿`vale_generation_trace.items` como JSONB o tabla normalizada?

**Decisión:** JSONB en este slice (ver §3.3). No se requiere ADR adicional — es una decisión de implementación dentro de T-04, coherente con el precedente de `resolved_conflicts`.

### DP-03 — ¿El adapter `ValeGenerationAdapter` en `apps/api` debe instanciar `PostgresValeBatchUnitOfWork` directamente o vía factory en `dev-composition-root`?

**Recomendación:** factory en `dev-composition-root` — mismo patrón que todos los módulos existentes.

---

## 8. Recomendación de implementación

**T-04 está lista para implementación sin ADR adicional.** Las decisiones de ADR-0035, ADR-0038 y ADR-0040 cubren todos los aspectos de diseño. DP-01 y DP-02 son decisiones de implementación que el desarrollador puede tomar dentro de T-04 sin escalación.

### Orden de implementación sugerido dentro de T-04

1. **Migrations 0005 + 0006** (`vale_daily_sequence`, `vale_generation_batch`, `vale_generation_trace`)
2. **`PostgresValeBatchUnitOfWork`** en `packages/platform/database/src/vale-archivo/`:
   - implementa `ValeBatchUnitOfWork` via `TenantDatabaseRouter.withTransaction`
   - implementa `ValeBatchTransaction`:
     - `findBySource` — SELECT con FOR SHARE
     - `reserveDailySequence` — UPSERT RETURNING
     - `saveVale` — delega a `PostgresValeArchivoRepository(router, session)`
     - `appendTraceSnapshot` — INSERT `vale_generation_trace`
   - crea el batch row al final (UNIQUE constraint como guard)
3. **Export en `packages/platform/database/src/index.ts`**
4. **Wire en `dev-composition-root.ts`** — instanciar `GenerateValeBatch` con el nuevo UoW
5. **Integration tests** — flujo completo con PostgreSQL real: generación, replay, rollback, tenant isolation

### Estructura de archivos

```
packages/platform/database/src/vale-archivo/
  PostgresValeArchivoRepository.ts        (existente — sin cambios)
  PostgresValeArchivoQueryAdapter.ts      (existente — sin cambios)
  PostgresValeBatchUnitOfWork.ts          (nuevo — T-04)

migrations/tenant/
  0005_vale_generation_batch.sql          (nuevo — T-04)
  0006_vale_generation_trace.sql          (nuevo — T-04)
```

### Validación de ADRs

| ADR | Cubierto por |
|---|---|
| ADR-0035 (`VA-YYYYMMDD-NNN`) | `vale_daily_sequence` + UPSERT RETURNING |
| ADR-0038 (cross-group + resolución) | `vale_generation_trace.resolved_conflicts` JSONB |
| ADR-0040 (snapshot inmutable + atomicidad) | `vale_generation_batch` UNIQUE + `withTransaction` |
| ADR-0034 (sin tenant_id) | Las nuevas tablas no tienen columna `tenant_id` |
