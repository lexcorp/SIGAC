# Physical Schema Decision — Agenda Preparation

**Estado:** APPROVED  
**Fecha:** 2026-08-22  
**Scope:** modelo físico de persistencia para `agenda-preparation v0.1.7`  
**Prerrequisito de:** T-09

## PHY-AP-001 — Principios generales

- Cada tabla existe dentro de la database tenant ya resuelta server-side. No se agrega
  `tenant_id` a ninguna columna; el aislamiento es físico por database.
- Los tipos físicos siguen la convención del repositorio: `uuid` para PK, `text` para
  strings (sin longitud fija), `timestamp with time zone` para instantes, `jsonb` para
  estructuras cerradas y `CHECK` constraints para catálogos (no PostgreSQL ENUM).
- Las enumeraciones se implementan como `text NOT NULL` con `CHECK` de valores. No se
  introducen tipos ENUM de PostgreSQL.
- Las migrations son forward-only, no destructivas y no reescriben migraciones previas.
- Drizzle ORM es el mecanismo de generación de DDL; la decisión documental precede al
  código.

## PHY-AP-002 — Tabla `agenda_imports`

Propósito: persistir el estado funcional de cada `ImportacionAgenda` confirmada.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | PK; proporcionado externamente por Application |
| `agenda_date` | text | NOT NULL | — | `AgendaFecha.value`; formato `YYYY-MM-DD` |
| `imported_at` | timestamp with time zone | NOT NULL | — | Instante server-side de la UoW |
| `outcome` | text | NOT NULL | — | CHECK: `IMPORTED`, `ALREADY_IMPORTED`, `RECONCILED` |
| `received_records` | integer | NOT NULL | 0 | `>= 0` |
| `processed` | integer | NOT NULL | 0 | `>= 0` |
| `added` | integer | NOT NULL | 0 | `>= 0` |
| `updated` | integer | NOT NULL | 0 | `>= 0` |
| `unchanged` | integer | NOT NULL | 0 | `>= 0` |
| `restored` | integer | NOT NULL | 0 | `>= 0` |
| `pending_review` | integer | NOT NULL | 0 | `>= 0` |
| `rejected` | integer | NOT NULL | 0 | `>= 0` |
| `duplicate_folio` | integer | NOT NULL | 0 | `>= 0` |
| `withdrawn_from_agenda` | integer | NOT NULL | 0 | `>= 0` |
| `incidents` | integer | NOT NULL | 0 | `>= 0` |
| `errors` | integer | NOT NULL | 0 | `>= 0` |

**PRIMARY KEY:** `(id)`

**CHECK constraints:**
- `outcome IN ('IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED')`
- Todos los conteos `>= 0` (puede validarse por columna o con expresión combinada; Application y Domain ya garantizan la ecuación)

**No se incluye:** fingerprint, filename, layout, staging path, HTTP metadata.

**Ownership:** `agenda-preparation` module.

## PHY-AP-003 — Tabla `agendas`

Propósito: representar la Agenda lógica `(tenant_database + agenda_date)`. Como la
database ya es tenant-local, la identidad física es `agenda_date`.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `agenda_date` | text | NOT NULL | — | PK; `AgendaFecha.value`; formato `YYYY-MM-DD` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` | Instante de primera creación; server-generated |

**PRIMARY KEY:** `(agenda_date)`

No se introduce una clave técnica adicional; no existe `AgendaId` Domain y no debe
filtrarse una identidad técnica al Domain/Application. La tabla sólo garantiza la
existencia de la Agenda y ancla la FK de `citas`.

**No se incluye:** `updated_at`, `closed_at`, estado de Agenda. El estado vigente se
infiere de la última importación confirmada y de las Citas ACTIVAS.

## PHY-AP-004 — Tabla `citas`

Propósito: persistir el estado vigente e historia de cada `Cita` dentro de una Agenda.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `agenda_date` | text | NOT NULL | — | FK → `agendas.agenda_date`; parte del PK |
| `folio` | text | NOT NULL | — | `FolioCita.value`; identidad de Cita dentro de la Agenda |
| `hora` | text | NOT NULL | — | `HoraCita.value`; formato `HH:mm` |
| `expediente_reference` | text | NULL | — | `ExpedienteReferencia.value`; opaco, nullable |
| `nombre_paciente` | text | NOT NULL | — | Valor funcional allow-listed; trim exterior aplicado |
| `tipo_derechohabiente` | text | NOT NULL | — | Valor funcional; no enum; trim exterior |
| `tipo_consulta` | text | NOT NULL | — | CHECK: `FIRST_TIME`, `SUBSEQUENT` |
| `medico_numero_empleado` | text | NOT NULL | — | `NumeroEmpleado.value`; identidad primaria del médico |
| `medico_nombre` | text | NOT NULL | — | `MedicoReferencia.nombre`; descriptivo |
| `servicio_codigo` | text | NOT NULL | — | `ServicioEspecialidad.codigo` |
| `servicio_nombre` | text | NOT NULL | — | `ServicioEspecialidad.nombre` |
| `lifecycle` | text | NOT NULL | — | CHECK: `ACTIVA`, `RETIRADA_DE_AGENDA` |

**PRIMARY KEY:** `(agenda_date, folio)` — identidad compuesta; coherente con Domain

**FOREIGN KEY:** `agenda_date → agendas(agenda_date)` ON DELETE NO ACTION

**CHECK constraints:**
- `tipo_consulta IN ('FIRST_TIME', 'SUBSEQUENT')`
- `lifecycle IN ('ACTIVA', 'RETIRADA_DE_AGENDA')`

**No se incluye:** Turno, Consultorio, Destino, CURP, teléfono, sexo, edad, vigencia,
datos clínicos, `updated_at`, `withdrawn_at`, `restored_at`, timestamps de lifecycle.

**Historia preservada:** las Citas retiradas permanecen con `lifecycle = 'RETIRADA_DE_AGENDA'`.
No se eliminan filas.

**Collation:** se usa la collation `default` de la database institucional existente para
texto; no se fija una collation específica en esta decisión. Las consultas de
`PreparationList` con `PATIENT_NAME_ASC` / `nombre ASC` confían en el orden
lexicográfico de la collation de la base de datos. Una decisión institucional posterior
puede especificar `es-ES-x-icu` u otra si el piloto lo requiere. T-10 puede añadir un
bloque `COLLATE` en las queries cuando la collation esté fijada; T-09 no lo bloquea.

## PHY-AP-005 — Tabla `agenda_registros`

Propósito: persistir `RegistroImportadoAgenda` — evidencia histórica allow-listed por
cada fila recibida en una importación.

**Resolución originalValues / interpretedValues: columnas normalizadas** (no JSONB
abierto). La allow-list es cerrada y estable; las consultas de result/incidents son
simples; la allow-list de RAW-AP-004 define exactamente 12 campos originales y 7
interpretados. Columnas normalizadas son consultables directamente y evitan deserializar
JSONB para queries frecuentes.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | PK |
| `importacion_id` | uuid | NOT NULL | — | FK → `agenda_imports.id` |
| `source_position` | integer | NOT NULL | — | `PosicionRegistroOrigen.value`; base 1; `> 0` |
| `processing_result` | text | NOT NULL | — | CHECK catálogo cerrado; ver abajo |
| `orig_folio` | text | NULL | — | `originalValues.folio` |
| `orig_patient_name` | text | NULL | — | `originalValues.patientName` |
| `orig_expediente_reference` | text | NULL | — | `originalValues.expedienteReference` |
| `orig_beneficiary_type` | text | NULL | — | `originalValues.beneficiaryType` |
| `orig_first_time_marker` | text | NULL | — | `originalValues.firstTimeMarker` |
| `orig_subsequent_marker` | text | NULL | — | `originalValues.subsequentMarker` |
| `orig_agenda_date` | text | NULL | — | `originalValues.agendaDate` |
| `orig_appointment_time` | text | NULL | — | `originalValues.appointmentTime` |
| `orig_physician_employee_number` | text | NULL | — | `originalValues.physicianEmployeeNumber` |
| `orig_physician_name` | text | NULL | — | `originalValues.physicianName` |
| `orig_service_code` | text | NULL | — | `originalValues.serviceCode` |
| `orig_service_name` | text | NULL | — | `originalValues.serviceName` |
| `interp_folio` | text | NULL | — | `interpretedValues.folio?.value` |
| `interp_agenda_date` | text | NULL | — | `interpretedValues.agendaFecha?.value` |
| `interp_beneficiary_type` | text | NULL | — | `interpretedValues.beneficiaryType` |
| `interp_appointment_kind` | text | NULL | — | `interpretedValues.appointmentKind`; CHECK si NOT NULL: `FIRST_TIME`,`SUBSEQUENT` |
| `interp_appointment_time` | text | NULL | — | `interpretedValues.appointmentTime` |
| `interp_numero_empleado` | text | NULL | — | `interpretedValues.numeroEmpleado?.value` |
| `interp_servicio_codigo` | text | NULL | — | `interpretedValues.servicioEspecialidad?.codigo` |
| `interp_servicio_nombre` | text | NULL | — | `interpretedValues.servicioEspecialidad?.nombre` |
| `resolved_expediente_id` | text | NULL | — | `resolvedReferences.expedienteId` |
| `resolved_physician_reference` | text | NULL | — | `resolvedReferences.physicianReference` |

**PRIMARY KEY:** `(id)`

**FOREIGN KEY:** `importacion_id → agenda_imports(id)` ON DELETE NO ACTION

**CHECK constraints:**
- `source_position > 0`
- `processing_result IN ('ADDED','UPDATED','UNCHANGED','RESTORED','PENDING_REVIEW','REJECTED','DUPLICATE_FOLIO')`
- `interp_appointment_kind IS NULL OR interp_appointment_kind IN ('FIRST_TIME','SUBSEQUENT')`

**No se incluye:** raw row completa, HTML, DOM, staging content, filename, bytes.

## PHY-AP-006 — Tabla `agenda_incidencias`

Propósito: persistir `IncidenciaImportacion` — incidencias de resolución por registro.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | PK |
| `importacion_id` | uuid | NOT NULL | — | FK → `agenda_imports.id` |
| `registro_id` | uuid | NOT NULL | — | FK → `agenda_registros.id` |
| `source_position` | integer | NOT NULL | — | `PosicionRegistroOrigen.value`; base 1 |
| `incident_type` | text | NOT NULL | — | CHECK catálogo cerrado |

**PRIMARY KEY:** `(id)`

**FOREIGN KEY:**
- `importacion_id → agenda_imports(id)` ON DELETE NO ACTION
- `registro_id → agenda_registros(id)` ON DELETE NO ACTION

**CHECK constraint:**
- `incident_type IN ('PHYSICIAN_NOT_RESOLVED','PHYSICIAN_AMBIGUOUS','SERVICE_NOT_RESOLVED','EXPEDIENT_NOT_RESOLVED','REQUIRED_DATA_MISSING','ROW_INCONSISTENT','DUPLICATE_FOLIO_IN_SNAPSHOT')`

**No se incluye:** stack traces, raw row, parser internals, candidatos no aprobados.

**Cardinalidad:** 0..N por `registro_id`.

## PHY-AP-007 — Tabla `agenda_artifact_metadata`

Propósito: asociar fingerprint técnico (fuera de Domain) con importaciones confirmadas.
Implementa `ImportArtifactMetadataRepository`.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | PK técnico |
| `importacion_id` | uuid | NOT NULL | — | FK → `agenda_imports.id` |
| `agenda_date` | text | NOT NULL | — | Fecha de Agenda del artefacto |
| `fingerprint` | text | NOT NULL | — | Valor opaco; tipo físico agnóstico al algoritmo |
| `imported_at` | timestamp with time zone | NOT NULL | — | Copia del `agenda_imports.imported_at`; facilita orden sin JOIN |

**PRIMARY KEY:** `(id)`

**FOREIGN KEY:** `importacion_id → agenda_imports(id)` ON DELETE NO ACTION

**No existe UNIQUE(fingerprint):** una key nueva con artefacto idéntico puede producir
otra `ImportacionAgenda` `ALREADY_IMPORTED`. No se introduce unicidad conceptual.

**Semántica de `findEquivalent`:**
```sql
SELECT importacion_id, imported_at
FROM agenda_artifact_metadata
WHERE agenda_date = $1 AND fingerprint = $2
ORDER BY imported_at DESC, importacion_id DESC
LIMIT 1
```

El tipo `text` es suficientemente agnóstico para SHA-256 hex, BLAKE3 hex o cualquier
otro string no vacío que elija el futuro estándar técnico.

## PHY-AP-008 — Tabla `agenda_idempotency_keys`

Propósito: rastrear `Idempotency-Key` por `importacion_id` para detectar conflictos de
idempotencia. Implementa `IdempotencyKeyRepository`.

| Columna | Tipo físico | Nullability | Default | Notas |
|---|---|---|---|---|
| `idempotency_key` | text | NOT NULL | — | PK; key proporcionada por el cliente |
| `importacion_id` | uuid | NOT NULL | — | FK → `agenda_imports.id`; importación registrada |
| `recorded_at` | timestamp with time zone | NOT NULL | `now()` | Server-side; no del cliente |

**PRIMARY KEY:** `(idempotency_key)`

**FOREIGN KEY:** `importacion_id → agenda_imports(id)` ON DELETE NO ACTION

**Semántica:**
- `findByKey(key, tenant)`: `SELECT importacion_id FROM agenda_idempotency_keys WHERE idempotency_key = $1`
- `recordKey(key, importacionId, tenant)`: `INSERT INTO agenda_idempotency_keys(idempotency_key, importacion_id, recorded_at) VALUES ($1, $2, now())`

**Replay:** `findByKey` retorna `importacionId`; Application usa ese ID para recuperar
la respuesta original de `agenda_imports` (outcome + métricas). No se almacena la
respuesta serializada; se reconstruye desde las tablas canónicas.

**Ventana de idempotencia:** configurable por política operacional. No se fija duración
en este documento. La tabla puede soportar expiración futura mediante `recorded_at`; no
se implementa `expired_at` ni job de limpieza en T-09.

**IDEMPOTENCY_KEY_REUSED:** si `findByKey` retorna una fila con `importacion_id` Y
`findEquivalent` retorna null (fingerprint distinto), Application lanza el error. La
tabla no almacena fingerprint para evitar duplicar la lógica de comparación.

## PHY-AP-009 — Foreign key summary

| FK | Tabla origen | Columna | Tabla destino | Columna | ON DELETE |
|---|---|---|---|---|---|
| FK-AP-001 | `citas` | `agenda_date` | `agendas` | `agenda_date` | NO ACTION |
| FK-AP-002 | `agenda_registros` | `importacion_id` | `agenda_imports` | `id` | NO ACTION |
| FK-AP-003 | `agenda_incidencias` | `importacion_id` | `agenda_imports` | `id` | NO ACTION |
| FK-AP-004 | `agenda_incidencias` | `registro_id` | `agenda_registros` | `id` | NO ACTION |
| FK-AP-005 | `agenda_artifact_metadata` | `importacion_id` | `agenda_imports` | `id` | NO ACTION |
| FK-AP-006 | `agenda_idempotency_keys` | `importacion_id` | `agenda_imports` | `id` | NO ACTION |

**ON DELETE NO ACTION** en todas las FKs: preserva evidencia histórica. No se implementan
hard deletes funcionales dentro del slice inicial.

## PHY-AP-010 — Indexes

Los índices siguen la convención `tablename_column_idx`.

### `agenda_imports`

```sql
-- History cursor (ListAgendaImports: ORDER BY imported_at DESC, id DESC)
CREATE INDEX agenda_imports_imported_at_id_idx
  ON agenda_imports (imported_at DESC, id DESC);

-- Filter by agenda_date (optional; ListAgendaImports con filtro de fecha)
CREATE INDEX agenda_imports_agenda_date_idx
  ON agenda_imports (agenda_date);
```

### `agenda_registros`

```sql
-- Query by importacion_id (GetAgendaImportResult: load registros)
CREATE INDEX agenda_registros_importacion_id_idx
  ON agenda_registros (importacion_id);

-- Cursor for paged result queries: importacion_id + source_position + id
CREATE INDEX agenda_registros_importacion_source_idx
  ON agenda_registros (importacion_id, source_position, id);
```

### `agenda_incidencias`

```sql
-- Query by importacion_id (GetAgendaImportIncidents: load incidents)
CREATE INDEX agenda_incidencias_importacion_id_idx
  ON agenda_incidencias (importacion_id);

-- Cursor for paged incident queries
CREATE INDEX agenda_incidencias_importacion_source_idx
  ON agenda_incidencias (importacion_id, source_position, id);
```

### `agenda_artifact_metadata`

```sql
-- findEquivalent: (agenda_date, fingerprint) lookup
CREATE INDEX agenda_artifact_metadata_date_fp_idx
  ON agenda_artifact_metadata (agenda_date, fingerprint, imported_at DESC, importacion_id DESC);
```

### `citas`

```sql
-- PreparationList base: (agenda_date, lifecycle) — foundation for all preparation queries
CREATE INDEX citas_agenda_date_lifecycle_idx
  ON citas (agenda_date, lifecycle);

-- Preparation ordering: service grouping
CREATE INDEX citas_agenda_date_servicio_idx
  ON citas (agenda_date, lifecycle, servicio_codigo, servicio_nombre, medico_nombre, medico_numero_empleado, hora, folio);

-- AgendaDaySummary: active appointments count
-- Covered by citas_agenda_date_lifecycle_idx above
```

**No se agregan índices especulativos.** Los índices se validarán con `EXPLAIN` durante
el piloto. Índices adicionales para el ordenamiento `PATIENT_NAME_ASC` (sobre
`nombre_paciente`) pueden añadirse en una migración posterior si el profiling lo
justifica.

## PHY-AP-011 — Collation para nombres

**Decisión:** usar la collation `default` de la database institucional existente.
No se fija en este documento una collation específica (`es-ES-x-icu` u otra).

**Consecuencia práctica:** el orden lexicográfico de `servicio_nombre`, `medico_nombre`
y `nombre_paciente` en las queries de PreparationList es determinista dentro de la misma
database, pero puede diferir entre bases de datos con configuraciones distintas.

**Acción posterior:** si el piloto revela inconsistencias de orden, una decisión
institucional adicional puede especificar la collation y añadir un índice explícito con
`COLLATE`. T-09 y T-10 no bloquean esta decisión; T-10 puede añadir un comentario
técnico en las queries relevantes.

## PHY-AP-012 — Timestamps

| Instante | Fuente | Columna |
|---|---|---|
| `imported_at` | UoW server-side (`importedAt`) | `agenda_imports.imported_at` |
| `recorded_at` (idempotency) | `now()` en INSERT | `agenda_idempotency_keys.recorded_at` |
| `imported_at` (metadata) | Copia de `agenda_imports.imported_at` | `agenda_artifact_metadata.imported_at` |
| `created_at` (agendas) | `now()` en INSERT | `agendas.created_at` |

**No se introducen:** `updated_at`, `withdrawn_at`, `restored_at`, `deleted_at`.
El lifecycle de Cita se registra en la columna `lifecycle`, no en timestamps.

## PHY-AP-013 — Audit y staging

- `audit_log` permanece sin cambios. Agenda Preparation escribe en `audit_log` mediante
  `PostgresAuditWriter` existente. No se crea tabla `agenda_audit`.
- `agenda_incidencias` NO es tabla de auditoría; es evidencia funcional de incidencias
  de importación. Los dos conceptos son distintos.
- Staging del archivo/raw no se persiste en ninguna tabla de este schema. Su gestión
  pertenece a Infrastructure staging (fuera del scope de T-09).

## PHY-AP-014 — Preparación para impresión

La impresión utiliza el mismo read model (`PreparationItem`) desde `citas`. No requiere
tabla adicional. `listForPrint` es un query sobre `citas` con `lifecycle = 'ACTIVA'`
y sin paginación.

## PHY-AP-015 — Migration strategy

- T-09 crea una única migration tenant nueva que añade las siete tablas aprobadas.
- No modifica migrations anteriores (`0000_tan_quicksilver.sql`, `0001_uneven_terrax.sql`).
- Sigue la convención de naming de Drizzle Kit (`drizzle-kit generate`).
- La migration es aplicada por el runner existente en `tooling/db/migrate-tenants.ts`
  (una vez que ese runner esté completo).
- Es forward-only. No contiene DROP ni ALTER COLUMN destructivo.

## PHY-AP-016 — Drizzle schema

- El schema Drizzle debe reflejar exactamente esta decisión física.
- Las tablas de Agenda Preparation se añaden al archivo de schema existente
  `packages/platform/database/src/schema/tenant.ts` o a un archivo separado
  `packages/platform/database/src/schema/agenda.ts` importado desde el archivo principal.
- La decisión documental precede al código.
- Drizzle no es la fuente de verdad del diseño.

## PHY-AP-017 — Optimistic concurrency

`ImportacionAgenda` y `Agenda` son aggregates, pero sus tablas no usan `row_version`
en este slice porque:
- `agenda_imports` es inmutable tras `finalize`; no hay write-after-create.
- `agendas` y `citas` se actualizan sólo dentro de la UoW de una importación; el
  Aggregate Domain gestiona la consistencia interna.
- No se expone un comando de reapertura (AP-OQ-006 diferido).

Si una futura decisión introduce comandos concurrentes sobre Agenda/Cita, se añadirá
`row_version` en una migration posterior. No se anticipa en T-09.

## PHY-AP-018 — Readiness para T-09

Con esta decisión aprobada:

- T-09 puede definir el Drizzle schema de las siete tablas.
- T-09 puede generar y validar la migration tenant.
- T-09 puede ejecutar tests de migration: aplicar, verificar idempotencia (re-aplicar
  es no-op), verificar constraints y verificar que las migrations anteriores no se
  modificaron.

**STOP si T-09 requiere:**
- nueva columna no definida aquí;
- constraint o nullability distinta a la definida;
- FK a una tabla no definida aquí;
- JSONB con estructura abierta;
- schema de staging de bytes/raw;
- algoritmo de fingerprint concreto.

En ese caso, STOP_AND_ESCALATE con evidencia de la contradicción.
