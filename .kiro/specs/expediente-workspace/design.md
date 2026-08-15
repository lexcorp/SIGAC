---
spec: expediente-workspace
version: "0.3.20"
status: "Draft — pending stakeholder validation"
date: "2026-08-15"
sdb_sources:
  - "Volume-02 / BIZ-006, BIZ-007, BIZ-008, BIZ-010, BIZ-016"
  - "Volume-03 / DDD-007, DDD-009–013, DDD-018–020"
  - "Volume-05 / UC-018, SPEC-009, SDD-005, SDD-006"
  - "Volume-07 / SEC-003, SEC-017, SEC-032, SEC-038"
  - "Volume-08 / DAT-006, DAT-011, DAT-012, DAT-019, API-001, API-005, API-006, API-011, DAT-016"
  - "Volume-09 / APP-003, IA-005, DS-014, DEL-002, INT-001–INT-009"
  - "Volume-12 / OS-004, OS-017, OS-018"
decisions_applied:
  - "OQ-EW-001 RESOLVED"
  - "OQ-EW-005 RESOLVED"
  - "OQ-EW-006 RESOLVED"
  - "OQ-EW-007 RESOLVED"
  - "DEC-EW-STATE-001 ACCEPTED"
  - "AUTHORIZATION-DECISION APPROVED"
  - "READ-MODEL-COMPOSITION-DECISION APPROVED"
  - "OQ-EW-DESIGN-004 RESOLVED"
  - "READ-EW-008..012 APPROVED"
  - "AUTH-EW-006/007 APPROVED"
  - "CTX-EW-001..004 APPROVED"
  - "AUD-EW-003..006 APPROVED"
  - "READ-EW-013 APPROVED"
  - "ERR-EW-001..004 APPROVED"
  - "TL-EW-001..017 APPROVED"
  - "OQ-EW-DESIGN-003 RESOLVED"
  - "OQ-DOM-001 RESOLVED"
  - "DISPATCH-DECISION DSP-EW-001..011 APPROVED; DSP-GAP-001/002 CLOSED"
  - "DOM-EVENT-001 APPROVED"
  - "AUD-EW-010..013 APPROVED"
  - "DSP-EW-014..016 APPROVED"
  - "CST-EW-001..010 APPROVED; CST-GAP-001/002 CLOSED"
  - "POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014 APPROVED"
  - "TENANT-TRANSACTION-AUDIT-DECISION TX-EW-001..012 APPROVED"
  - "AUDIT-PHYSICAL-MODEL-DECISION AUD-DB-EW-001..013 APPROVED; AUD-DB-GAP CLOSED"
  - "HTTP-REQUEST-CONTEXT-DECISION HTTP-EW-001, API-BIGINT-001, API-EW-021 APPROVED"
  - "HTTP-COMMAND-CONTRACT-DECISION API-EW-024..026, API-EW-030 APPROVED"
  - "EXPEDIENT-SEARCH-DECISION SEARCH-EW-001..010 APPROVED"
requires:
  - requirements.md (v0.3.20)
open_questions_blocking: []
open_questions_non_blocking:
  - OQ-EW-002
  - OQ-EW-003
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
  - OQ-EW-DESIGN-001
  - OQ-EW-DESIGN-002
  - OQ-EW-DESIGN-005
---

# Expediente Workspace — Design

---

## 1. Principios de diseño

| Principio | Regla | Fuente |
|-----------|-------|--------|
| **Dominio puro** | El dominio no importa NestJS, Drizzle, React ni HTTP | AGENTS.md, steering/structure.md |
| **Autorización server-side** | Backend re-verifica cada petición incluyendo FuenteHabilitanteSalida | SEC-017, DEL-002 |
| **Tenant immutable** | TenantContext server-side; ningún valor de tenant del body | SEC-032, API-005 |
| **Movimiento != Audit** | Trayectoria física y audit_log son tablas y read paths distintos | DDD-020, DAT-011, DAT-012 |
| **Sin contenido clínico** | Ningún campo clínico en ninguna capa | DDD-013, BIZ-014 |
| **UI refleja estado** | Frontend no calcula transiciones; recibe capabilities del API | INT-001, DEL-002 |
| **Concurrencia explícita** | Comandos críticos usan row_version; conflicto -> 409 | DAT-019 |
| **Audit append-only** | Rol de aplicación no puede UPDATE/DELETE filas de audit | SEC-038, DAT-012 |
| **ExpedienteNumero no único** | No declarar UNIQUE sobre expediente_numero sin profiling SIMEF | BR-017, INV-EXP-003 |

---

## 2. Arquitectura por capas

```
Browser (React)
  └─ API Client (generated / typed)
       └─ BFF / Controller  [apps/api]
            └─ Application Use Case  [packages/modules/expediente/application]
                 └─ Repository Port (interface)  [packages/modules/expediente/domain]
                      └─ PostgreSQL Repository Adapter  [packages/platform/persistence]
                           └─ Tenant Database (database-per-tenant)
```

`GetExpediente` compone un único read model en Application. El frontend consume esa
respuesta y no orquesta bounded contexts. Application del Workspace posee los query
ports mínimos como consumidor de proyecciones.

| Capa | Responsabilidad | Prohibido |
|------|----------------|-----------|
| **Domain** | Aggregate Expediente, invariantes, VOs (Custodia, Ubicacion, ExpedienteNumero, FuenteHabilitanteSalida, EstadoOperativo) | Importar NestJS, Drizzle, React, HTTP |
| **Application** | Use Cases, orquestación, cálculo de capabilities | Lógica de infraestructura; acceso directo a DB |
| **Controller** | Deserializar, resolver TenantContext, llamar UC, serializar | Escribir repositorios; lógica de negocio |
| **React Feature** | Renderizar read model; mostrar capabilities como comandos | Calcular transiciones de dominio |
| **Audit** | Registrar eventos append-only | Mezclar con Movimiento |

---

## 3. Modelo de datos

### 3.1 Aggregate Expediente (DAT-006 v0.2.0)

```
ubicaciones
  id                           UUID  PK
  codigo                       TEXT NOT NULL
  descripcion                  TEXT NOT NULL

expedientes
  id                           UUID  PK                   -- ExpedienteId; identidad técnica primaria
  expediente_numero            TEXT NOT NULL               -- NO UNIQUE
  expediente_numero_normalizado TEXT NOT NULL              -- btree no unique
  paciente_id_institucional    TEXT NOT NULL
  paciente_curp                TEXT NOT NULL
  paciente_nombre_operativo    TEXT NOT NULL
  paciente_numero_issste       TEXT NOT NULL
  estado_operativo             TEXT NOT NULL CHECK          -- DEC-EW-STATE-001
  ubicacion_actual_id          UUID | null  FK -> ubicaciones
  custodio_tipo                TEXT | null
  custodio_ref                 TEXT | null
  custodio_servicio            TEXT | null
  custodio_location            TEXT | null
  custodio_accepted_at         timestamptz | null
  created_at                   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  updated_at                   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP -- metadata física
  row_version                  BIGINT NOT NULL DEFAULT 0   -- optimistic concurrency
```

**EstadoOperativo — valores aceptados (DEC-EW-STATE-001):**

| Valor | Descripción |
|-------|-------------|
| DISPONIBLE | En Archivo, sin despacho activo |
| APARTADO | Reservado para jornada/solicitud; aún en Archivo |
| EN_TRASLADO | Despachado; custodia aún no aceptada en destino |
| EN_CONSULTA | Custodia aceptada formalmente por receptor en destino |
| NO_LOCALIZADO | No encontrado; no declarado extraviado |
| EXTRAVIADO | Declarado extraviado por proceso formal (requiere autorización) |

**Valores que NO son EstadoOperativo del Expediente:**
- EN_BUSQUEDA — es estado de Solicitud.
- PRESTADO — pertenece al aggregate Préstamo.

**Constraint de unicidad:**
```sql
-- NO crear hasta perfilar datos reales de SIMEF (BR-017, INV-EXP-003):
-- No existe hospital_id ni UNIQUE sobre expediente_numero.
CREATE INDEX expedientes_numero_normalizado_idx
  ON expedientes (expediente_numero_normalizado);
```

### 3.2 ExpedienteNumero — VO (DDD-007 v0.2.0)

Patrón: `<RFC_BASE_10><SEPARADOR><CODIGO_DERECHOHABIENTE_2>`
Ejemplo anonimizado: `PERR810604/10`

- rfcBase: 10 chars sin homoclave.
- separador: / (preferente), - o ausente.
- codigoDerechohabiente: 10, 20, 30, 40, 50, 60, 70, 80, 90.
- Normalización: almacenar sin separador para búsqueda; presentar con /.
- No es identidad técnica primaria; ExpedienteId UUID lo es.

### 3.3 FuenteHabilitanteSalida — VO (DDD-007 v0.2.0)

| Valor | Descripción |
|-------|-------------|
| CONSULTA_PROGRAMADA | Flujo normal; habilitada por agenda |
| VALE_ARCHIVO_SM_1_14 | Solicitud extraordinaria; formato SM 1-14; 24 h máx. |
| ORDEN_SUPERIOR | Fuente válida reconocida; detalles fuera de este slice |

### 3.4 MovimientoExpediente (DAT-011)

```
movimientos_expediente
  id                        UUID  PK
  expediente_id             UUID NOT NULL FK -> expedientes
  movement_type             TEXT NOT NULL  -- sin CHECK en este slice
  origin_location_id        UUID | null
  destination_location_id   UUID | null
  origin_custodian_ref      TEXT | null
  destination_custodian_ref TEXT | null
  business_reference_type   TEXT NOT NULL  -- sin CHECK
  business_reference_id     TEXT | null
  occurred_at               timestamptz NOT NULL
  recorded_at               timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  actor_ref                 TEXT NOT NULL
  source                    TEXT NOT NULL CHECK (source IN ('WEB','INTERNAL'))
  correlation_id            TEXT | null
```

No contiene datos de login, configuración ni audit técnico.

Las tablas viven en la database tenant. HospitalId se toma de TenantContext. El
Repository hace join `expedientes.ubicacion_actual_id → ubicaciones.id` para rehidratar
el VO completo. Custodia se rehidrata desde sus cinco columnas inline. No hay FKs para
actor, custodios, business reference, correlation ni ubicaciones históricas. Véase
POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014.

### 3.5 Audit Log (DAT-012) — separado de Movimiento

```
audit_log
  id               UUID PK                         -- generado por adapter; sin DB default
  actor_ref        TEXT NOT NULL
  action           TEXT NOT NULL                   -- sin CHECK
  resource_type    TEXT NOT NULL                   -- sin CHECK
  resource_id      TEXT NOT NULL                   -- sin FK; no asume UUID
  result           TEXT NOT NULL CHECK             -- cinco AuditResult canónicos
  request_id       TEXT NOT NULL
  correlation_id   TEXT NOT NULL
  source           TEXT NOT NULL CHECK             -- WEB | INTERNAL
  occurred_at      timestamptz NOT NULL            -- adapter; sin DB default
  change_summary   jsonb | null                    -- Record<string,string>; sin C3
  security_context jsonb | null                    -- metadata técnica permitida
```

Acceso de la aplicación: INSERT únicamente.

Ownership lógico: Security / Audit. Storage físico: cada tenant database. Su schema se
compone en platform/database sin transferir ownership. Un binder de infraestructura
crea AuditWriter ligado a la transacción existente; Archive Operations no ejecuta SQL
directo en audit_log. AUD-DB-EW-001..013 define el DDL exacto, sin tenant_id,
source_ip_hash, FKs ni índices secundarios y con append-only estricto.

### 3.6 TenantDatabaseRouter y UoW PostgreSQL

```text
TenantContext validado
  → TenantDatabaseRouter (pool allow-listed)
  → BEGIN tenant-local
  → transactional Repository + MovimientoWriter + AuditWriter
  → COMMIT | ROLLBACK ALL
```

`PostgresArchiveOperationsUnitOfWork` implementa la interface Application existente y
expone además un único operationOccurredAt. Los handles Drizzle/PostgreSQL permanecen en
Infrastructure. Audit standalone abre su propia transacción tenant-local después del
rollback cuando corresponde. No existen distributed/cross-tenant transactions.

---

## 4. API — Contratos (API-011 v0.2.0)

### 4.1 Endpoints de consulta

API-011 conserva el mapa futuro, pero el scope implementable de T-11 está marcado como
**vigente** o **diferido** según exista Use Case Application canónico.

| Método | Ruta | Propósito | T-11 |
|--------|------|-----------|------|
| GET | /api/v1/expedientes/{id} | Read model completo por ExpedienteId UUID | Vigente |
| GET | /api/v1/expedientes/{id}/timeline | Historial de movimientos operativos | Vigente |
| GET | /api/v1/expedientes?numero={n} | Búsqueda — devuelve colección 0..N | Vigente tras T-12A |
| GET | /api/v1/expedientes/{id}/current-custody | Custodia actual | Diferido: sin Use Case |
| GET | /api/v1/expedientes/{id}/active-loan | Préstamo activo si existe | Diferido: sin Use Case |

### 4.2 Búsqueda por número — respuesta colección

```jsonc
// GET /api/v1/expedientes?numero=PERR810604/10
{
  "items": [
    {
      "expedienteId": "uuid",
      "expedienteNumero": "PERR810604/10",
      "paciente": {
        "idInstitucional": "...",
        "curp": "...",
        "nombreOperativo": "...",
        "numeroIssste": "..."
      },
      "estadoOperativo": "DISPONIBLE",
      "ubicacion": { "id": "uuid", "codigo": "...", "descripcion": "..." }
    }
  ]
}
// N=0 -> items:[], HTTP 200
// N>1 -> array con datos de desambiguación; cliente NO elige automáticamente
```

`SearchExpedientesByNumero` recibe `{numero: ExpedienteNumero, context}` y retorna
`readonly ExpedienteSearchItem[]`. El controller sólo invoca el Use Case. La respuesta
HTTP no contiene `total` ni paginación. La búsqueda exige `EXPEDIENT_VIEW`, usa tenant
server-side y audita `EXPEDIENTE_SEARCH` con success para 0..N.

### 4.3 Comandos de transición de estado

| Intento UI | Endpoint | Comando dominio |
|------------|----------|-----------------|
| Despachar | POST /api/v1/expedientes/{id}/dispatch | DispatchExpediente |
| Aceptar custodia | POST /api/v1/expedientes/{id}/accept-custody | AcceptCustody |
| Transferir custodia | POST /api/v1/expedientes/{id}/custody-transfers | TransferCustody |
| Confirmar rearchivo (diferido T-11) | POST /api/v1/expedientes/{id}/rearchive | ConfirmRearchive aún sin Use Case canónico |
| Abrir préstamo | POST /api/v1/prestamos | OpenLoan + FuenteHabilitanteSalida |
| Renovar préstamo | POST /api/v1/prestamos/{id}/renew | RenewLoan |
| Recibir devolución | POST /api/v1/devoluciones | ReceiveReturn |
| Solicitar expediente | POST /api/v1/solicitudes | CreateRequest |
| Iniciar búsqueda | POST /api/v1/solicitudes/{id}/start-search | StartSearch |
| Marcar localizado | POST /api/v1/solicitudes/{id}/mark-located | MarkLocated |
| Marcar no localizado | POST /api/v1/solicitudes/{id}/mark-not-located | MarkNotLocated |
| Reportar incidencia | POST /api/v1/incidencias | OpenIncident |

### 4.4 Read model — GET /api/v1/expedientes/{id}

```jsonc
{
  "id": "uuid",
  "expedienteNumero": "PERR810604/10",
  "pacienteRef": {
    "id": "uuid",
    "displayLabel": "string"   // C3 mínimo — campo exacto: OQ-EW-002
  },
  "estadoOperativo": "DISPONIBLE|APARTADO|EN_TRASLADO|EN_CONSULTA|NO_LOCALIZADO|EXTRAVIADO",
  "ubicacionActual": { "id": "uuid", "codigo": "string", "descripcion": "string" },
  "custodiaActual": {
    "custodioTipo": "string",
    "custodioRef": "string",
    "servicio": "string|null",
    "aceptadaEn": "ISO8601|null"  // null si EN_TRASLADO sin CustodyAccepted
  },
  "prestamoActivo": {
    "prestamoId": "uuid",
    "finalidad": "string",
    "custodioRef": "string",
    "destinoTipo": "string",
    "destinoRef": "string",
    "dueAt": "ISO8601",
    "fuenteHabilitanteSalida": "CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14|ORDEN_SUPERIOR",
    "estado": "Activo|Vencido"
  } | null,
  "solicitudActiva": {
    "solicitudId": "uuid",
    "tipo": "string",
    "origen": "string",
    "estado": "Pendiente|Asignada|EnBusqueda|Localizada|Preparada|Entregada|Cancelada|NoLocalizada",
    "asignadoA": "string|null"
  } | null,
  "incidenciasAbiertas": [{
    "incidenciaId": "uuid",
    "tipo": "string",
    "severidad": "string",
    "estado": "Abierta|EnInvestigacion|Escalada",
    "resumen": "string",
    "asignadoA": "string|null",
    "openedAt": "ISO8601"
  }],
  "capabilities": ["DISPATCH", "SOLICITAR", "REPORTAR_INCIDENCIA", ...],
  "rowVersion": "42"
}
```

capabilities[] es calculado server-side por ExpedienteCapabilityService considerando:
EstadoOperativo + rol del actor + FuenteHabilitanteSalida disponible + contexto.
Frontend solo renderiza lo que capabilities contiene.

`updatedAt` no pertenece al aggregate, `ExpedienteSnapshot` ni read model de este
vertical slice. No existe un query port para obtenerlo. `rowVersion` conserva la
responsabilidad de optimistic concurrency.

En HTTP/OpenAPI, `rowVersion` y `expectedRowVersion` son strings decimales con patrón
`^[0-9]+$`; la frontera convierte a/desde `bigint` sin usar JavaScript `number`.

### 4.6 RequestContext HTTP

Un resolver de infraestructura autenticado produce el único `RequestContext` con actor,
tenant, requestId, correlationId y `source=WEB`. El tenant es trusted/allow-listed y
pertenece a `actor.tenantIds`; body/query no seleccionan contexto. CorrelationId sólo se
propaga de fuente trusted o se genera, y nunca reutiliza requestId. Tipos HTTP no entran
a Application. Request no autenticada retorna 401; actor autenticado sin permission, 403.

### 4.7 Validación y módulo configurable

Dispatch y AcceptCustody responden 204 No Content; sus DomainEvent no se serializan.
La validación estructural retorna RFC7807 400 con code `HTTP_VALIDATION_ERROR`, detail
estable y `errors?` con códigos `REQUIRED|INVALID_FORMAT|INVALID_TYPE|OUT_OF_RANGE`.
Nunca refleja valores recibidos ni mensajes default de NestJS.

`ExpedienteApiModule` (nombre adaptable) se configura con
`AuthenticatedRequestContextResolver`, GetExpediente, GetExpedienteTimeline,
DispatchExpediente y AcceptCustody. Controller sólo consume esos objetos construidos.
El composition root posee adapters y UoW. Tests registran providers explícitos;
`AppModule` productivo no registra fakes ni monta este módulo sin dependencias reales.

### 4.5 Manejo de errores (API-006)

```jsonc
{ "type": "https://sigac/errors/not-found", "status": 404,
  "code": "EXPEDIENTE_NOT_FOUND", "traceId": "..." }

{ "type": "https://sigac/errors/conflict", "status": 409,
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "detail": "El expediente fue modificado. Recarga antes de reintentar.",
  "currentVersion": "43", "traceId": "..." }

{ "type": "https://sigac/errors/authorization", "status": 403,
  "code": "INSUFFICIENT_ENABLING_SOURCE", "traceId": "..." }
```

Taxonomía cerrada de `ApplicationError`: `PERMISSION_DENIED` (403),
`INSUFFICIENT_ENABLING_SOURCE` (403), `EXPEDIENTE_NOT_FOUND` (404),
`OPTIMISTIC_LOCK_CONFLICT` (409), `REQUEST_INVALID_TRANSITION` (409).
`AUTHENTICATION_REQUIRED` (401) pertenece a API/BFF. Falta de `EXPEDIENT_VIEW` usa
`PERMISSION_DENIED`. Cross-tenant no tiene code público propio: retorna
`EXPEDIENTE_NOT_FOUND`.

Sin stack trace, sin nombre de DB, sin datos clínicos en errores.

---

## 5. Diseño de la UI (APP-003 v0.2.0)

### 5.1 Anatomía de la página

```
+------------------------------------------------------+
| 1. Global Shell                                      |
+------------------------------------------------------+
| 2. Breadcrumb: Archivo > Expediente > {numero}       |
+------------------------------------------------------+
| 3. Header (above the fold)                           |
|    Nº Expediente | Ref. Paciente (mínima) C3         |
|    Estado: badge | Ubicación actual                  |
|    Custodio (+ acceptedAt si EN_CONSULTA)            |
|    Indicadores: préstamo activo / incidencias        |
+------------------------------------------------------+
| 4. Barra de Comandos (capabilities[])                |
|    [Solicitar] [Despachar] [Reportar incid.] ...     |
+------------------------------------------------------+
| 5. Tabs                                              |
|    Resumen | Movimientos | Solicitudes | Préstamos   |
|    Incidencias | Auditoría*                          |
+------------------------------------------------------+
| 6. Superficie de trabajo (tab activo)                |
+------------------------------------------------------+
| 7. Región persistente de feedback / error            |
+------------------------------------------------------+
* Tab Auditoría: permiso pendiente OQ-EW-003; fuera de capabilities operativas
```

### 5.2 Badges de EstadoOperativo

Los badges reflejan exactamente los 6 valores de DEC-EW-STATE-001:

| Badge | Color semántico sugerido | Nota |
|-------|--------------------------|------|
| DISPONIBLE | Verde | En archivo |
| APARTADO | Azul | Reservado |
| EN_TRASLADO | Naranja | En tránsito; custodio sin confirmar |
| EN_CONSULTA | Morado | Custodia aceptada en destino |
| NO_LOCALIZADO | Amarillo | No encontrado |
| EXTRAVIADO | Rojo | Proceso formal requerido |

EN_BUSQUEDA y PRESTADO NO se usan como badges del Expediente.

### 5.3 Pantalla de desambiguación (OQ-EW-001/007 RESOLVED)

Cuando la búsqueda devuelve N > 1:
1. Lista de coincidencias con: expedienteNumero, nombre, CURP, número ISSSTE.
2. Usuario selecciona manualmente.
3. NUNCA apertura automática cuando N > 1.
4. Input de búsqueda acepta /, - o sin separador; normaliza antes de enviar.

### 5.4 Estados de la UI

| Estado UI | Condición | Comportamiento |
|-----------|-----------|----------------|
| loading | Petición en vuelo | Skeleton; comandos deshabilitados |
| loaded | Datos recibidos | Render normal |
| empty | N=0 en búsqueda | Estado vacío descriptivo |
| error | Error red / 5xx | Región de error persistente |
| conflict | 409 optimistic lock | Banner; botón Recargar; preservar contexto |
| disambiguate | N>1 en búsqueda | Lista de desambiguación |

### 5.5 Tabs y contenido

| Tab | Contenido | Restricción |
|-----|-----------|-------------|
| **Resumen** | Estado expandido, custodia detallada (con/sin acceptedAt), préstamo activo, solicitud activa | EXPEDIENT_VIEW |
| **Movimientos** | Timeline MovimientoExpediente (incl. DISPATCHED, CUSTODY_ACCEPTED) | Archivista, Jefatura, Auditor |
| **Solicitudes** | Historial de solicitudes | Según permisos |
| **Préstamos** | Historial con FuenteHabilitanteSalida visible | Según permisos |
| **Incidencias** | Abiertas y cerradas | Según permisos |
| **Auditoría** | audit_log (DAT-012); distinto de Movimientos | Permiso exacto pendiente — OQ-EW-003; fuera de capabilities operativas |

### 5.6 Privacidad en presentación (INT-009)

- expedienteNumero es dato C3; no en document.title, URL visible ni logs frontend.
- pacienteRef.displayLabel: campo mínimo (OQ-EW-002 no bloqueante).
- Toasts y notificaciones no contienen datos C3.
- Exports no contienen datos de paciente en filename.

---

## 6. Módulos del frontend (DEL-002)

```
apps/web/src/features/expediente-workspace/
  index.ts
  ExpedienteWorkspace.tsx          # routing entry
  components/
    ExpedienteHeader.tsx           # numero, ref paciente, estado badge, ubicación, custodia
    CommandBar.tsx                 # capabilities[] -> botones; no calcula dominio
    DisambiguationList.tsx         # lista cuando N>1; selección manual obligatoria
    tabs/
      ResumenTab.tsx
      MovimientosTab.tsx           # timeline DAT-011; incluye DISPATCHED/CUSTODY_ACCEPTED
      SolicitudesTab.tsx
      PrestamosTab.tsx
      IncidenciasTab.tsx
      AuditoriaTab.tsx             # permiso pendiente OQ-EW-003; fuera de capabilities
  hooks/
    useExpediente.ts               # fetch + cache; invalidar en 409
    useExpedienteSearch.ts         # búsqueda 0..N; normaliza separadores
    useExpedienteTimeline.ts       # fetch DAT-011
    useCapabilities.ts             # derivado del read model; no calcula dominio
  api/
    expedienteApi.ts               # funciones tipadas sobre cliente OpenAPI
  types/
    expediente.types.ts            # derivados del OpenAPI contract
```

### Reglas del frontend (DEL-002)
- No contiene lógica de transición de dominio.
- capabilities viene del API; hooks derivan de él.
- useExpedienteSearch normaliza separadores antes de enviar; no elige coincidencias.

---

## 7. Módulos del backend

### 7.1 Estructura

```
packages/modules/expediente/
  domain/
    Expediente.ts                  # aggregate root
    ports/
      ExpedienteRepository.ts      # interface
    value-objects/
      ExpedienteNumero.ts          # VO con normalización y catálogo de códigos
      EstadoOperativo.ts           # enum 6 valores; rechaza EN_BUSQUEDA y PRESTADO
      FuenteHabilitanteSalida.ts   # enum 3 valores
      Custodia.ts                  # custodianType, custodianReference, acceptedAt
      Ubicacion.ts
  application/
    GetExpediente.ts               # use case query
    GetExpedienteTimeline.ts       # use case query
    DispatchExpediente.ts          # use case command
    AcceptCustody.ts               # use case command
    ExpedienteCapabilityService.ts # calcula capabilities[]

packages/platform/persistence/
  PostgresExpedienteRepository.ts  # adapter

apps/api/src/expediente/
  ExpedienteController.ts          # NestJS controller
```

### 7.2 Use Case: GetExpediente

#### Puertos de Application propiedad de Expediente Workspace

```typescript
interface ActiveRequestQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveRequestSummary | null>;
}

interface ActiveLoanQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveLoanSummary | null>;
}

interface OpenIncidentsQueryPort {
  findOpenByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<readonly OpenIncidentSummary[]>;
}

interface ExitEnablingSourceQueryPort {
  findAvailableByExpediente(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<readonly FuenteHabilitanteSalidaContext[]>;
}

interface FuenteHabilitanteSalidaContext {
  tipo: FuenteHabilitanteSalida;
  validada: boolean;
}

type RequestSource = 'WEB' | 'INTERNAL';

interface RequestContext {
  readonly actor: ActorContext;
  readonly tenant: TenantContext;
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: RequestSource;
}

interface AuditEntry {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly result:
    | 'success'
    | 'denied'
    | 'not-found'
    | 'conflict'
    | 'invalid-transition';
  readonly changeSummary?: Readonly<Record<string, string>>;
}

interface AuditWriter {
  append(entry: AuditEntry, context: RequestContext): Promise<void>;
}

type ApplicationErrorCode =
  | 'PERMISSION_DENIED'
  | 'INSUFFICIENT_ENABLING_SOURCE'
  | 'EXPEDIENTE_NOT_FOUND'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'REQUEST_INVALID_TRANSITION';
```

`RequestContext`, `AuditEntry`, los summaries y `AuditRecord` tienen exactamente los campos definidos en
READ-MODEL-COMPOSITION-DECISION. Ausencia: Solicitud/Préstamo `null`; Incidencias y
fuentes habilitantes `[]`.
Los query ports no exponen aggregates. `AuditWriter` no ofrece update/delete.

```
Input: { expedienteId: ExpedienteId, context: RequestContext }

Pasos:
  1. Verificar EXPEDIENT_VIEW con context.actor     -> PERMISSION_DENIED si no
  2. context construido server-side                 -> nunca del body/query
  3. findById(id, context.tenant)                   -> 404 si no existe
  4. ActiveLoanQueryPort.findActiveByExpedienteId(id, context.tenant)
  5. ActiveRequestQueryPort.findActiveByExpedienteId(id, context.tenant)
  6. OpenIncidentsQueryPort.findOpenByExpedienteId(id, context.tenant)
  7. ExitEnablingSourceQueryPort.findAvailableByExpediente(id, context.tenant)
  8. ExpedienteCapabilityService(..., context.actor, context.tenant)
  9. AuditWriter.append(AuditEntry, context); writer establece occurredAt
  10. Retornar ExpedienteReadModel con capabilities[]
```

### 7.2A Use Case: GetExpedienteTimeline

```typescript
interface TimelinePagination {
  readonly cursor?: string;
  readonly limit: number;
}

interface MovimientoExpedienteSummary {
  readonly movimientoId: string;
  readonly movementType: string;
  readonly originLocation: string | null;
  readonly destinationLocation: string | null;
  readonly originCustodianRef: string | null;
  readonly destinationCustodianRef: string | null;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly actorRef: string;
  readonly source: string;
  readonly correlationId: string | null;
}

interface TimelinePage {
  readonly items: readonly MovimientoExpedienteSummary[];
  readonly nextCursor: string | null;
}

interface ExpedienteTimelineQueryPort {
  findByExpediente(
    expedienteId: ExpedienteId,
    pagination: TimelinePagination,
    tenant: TenantContext,
  ): Promise<TimelinePage>;
}
```

Input: `{ expedienteId, pagination: { cursor?, limit }, context: RequestContext }`.
Requiere `EXPEDIENT_VIEW`; el port recibe `context.tenant`. Orden determinista:
`occurredAt DESC, movimientoId DESC`. El cursor opaco representa ambos valores y no lo
interpreta el cliente. Ausencia `items=[]/nextCursor=null`; sin total. AuditWriter registra
el acceso por separado. OQ-EW-010 permanece abierta y T-06 no decide retención.

Orden de ejecución:

1. Autorizar `EXPEDIENT_VIEW`; si falta, audit
   `EXPEDIENTE_TIMELINE_VIEW/EXPEDIENTE/denied` y `PERMISSION_DENIED`.
2. `ExpedienteRepository.findById(expedienteId, context.tenant)`; si es null, audit
   `not-found` y `EXPEDIENTE_NOT_FOUND`.
3. `ExpedienteTimelineQueryPort.findByExpediente(...)`.
4. Audit `success` tanto para página vacía como no vacía.
5. Retornar `TimelinePage` sin mezclar audit ni crear Movimiento.

### 7.3 Use Case: DispatchExpediente

```
Input: { expedienteId, destination: Ubicacion,
         intendedCustodian: {type:string,reference:string},
         businessReference: {type:string,id:string|null},
         expectedRowVersion: bigint, context: RequestContext }

Pasos:
  1. Verificar permiso EXPEDIENT_DISPATCH en tenant
  2. findById con row_version                       -> 409 si conflicto
  3. Validar EstadoOperativo = APARTADO             -> 409 si no
  4. Ejecutar `Expediente.dispatch` pasando
     `occurredAt: transaction.operationOccurredAt`
  5. EstadoOperativo -> EN_TRASLADO
  6. custodio_accepted_at -> null
  7. Guardar con row_version+1
  8. Emitir ExpedienteDispatched -> MovimientoExpediente DISPATCHED
  9. UoW: save aggregate + append movimiento + audit EXPEDIENTE_DISPATCH success
     en una transacción tenant-scoped ALL OR NOTHING
```

`ArchiveOperationsUnitOfWork` expone Repository, MovimientoWriter, AuditWriter y
operationOccurredAt al callback. Writer genera movimientoId/recordedAt. Denied y
not-found se auditan fuera de la mutación. Ante optimistic lock mismatch, la UoW
mutante hace rollback y posteriormente se registra `result=conflict` fuera de ella;
no se persiste aggregate ni Movimiento. `intendedCustodian.type/reference` son
obligatorios y no vacíos. Alimentan custodianType/custodianReference; service, location
y acceptedAt quedan null y ningún campo se deriva del destino.
Conforme DOM-EVENT-001, el aggregate usa el occurredAt recibido y no llama Date.now(),
no crea new Date() para fechar el evento ni obtiene un Clock. Para DISPATCHED,
`destinationCustodianRef: string` es obligatorio. Se verifica que
`DomainEvent.occurredAt === MovimientoExpedienteAppend.occurredAt ===
transaction.operationOccurredAt`. No se introduce event factory/envelope diferido.
El evento conserva `intendedCustodian: {type,reference}`; Movimiento usa únicamente
`destinationCustodianRef=intendedCustodian.reference` porque DAT-011 no contiene type.
Si el estado no permite Dispatch, la UoW hace rollback sin aggregate, Movimiento ni
audit success. Después se registra `EXPEDIENTE_DISPATCH/EXPEDIENTE/expedienteId` con
`invalid-transition` fuera de la UoW y se lanza `REQUEST_INVALID_TRANSITION`/409.
`conflict` permanece exclusivo del mismatch de rowVersion aunque ambos errores usen 409.

### 7.4 Use Case: AcceptCustody

```
Input: { expedienteId, receptor: {type,reference,service},
         ubicacionDestino: Ubicacion, businessReference: {type,id},
         expectedRowVersion, context: RequestContext }

Pasos:
  1. Verificar permiso CUSTODY_ACCEPT en tenant (actor es receptor autorizado)
  2. findById con row_version                       -> 409 si conflicto
  3. Validar EstadoOperativo = EN_TRASLADO          -> 409 si no
  4. Ejecutar AcceptCustody
  5. EstadoOperativo -> EN_CONSULTA
  6. custodio_accepted_at -> transaction.operationOccurredAt
  7. custodia efectiva -> receptor; location -> ubicacionDestino.id
  8. Guardar con row_version+1
  9. Emitir CustodyAccepted -> MovimientoExpediente
  10. AuditWriter.append(AuditEntry, context)
```

Receptor efectivo materializa custodianType/reference/service; location usa
ubicacionDestino.id y acceptedAt usa operationOccurredAt. Exige Custodia previa no
aceptada y ubicación coincidente. CustodyAccepted contiene custodio previsto y aceptado.
Movimiento usa businessReference del input y audit usa
`CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId`. CST-GAP-001/002 están cerrados.

### 7.5 ExpedienteCapabilityService (actualizado)

Entradas: EstadoOperativo, SolicitudActiva?, PrestamoActivo?, actor.roles,
          actor.permissions, TenantContext validado y
          readonly FuenteHabilitanteSalidaContext[].

Salida: string[] de capabilities operativas. EXPEDIENT_VIEW no forma parte del array.

ActorContext conserva actorId, permissions y tenantIds, y añade roles. ActorContext y
TenantContext llegan validados server-side; el servicio no resuelve tenant.

Estados de contexto admitidos:
- Solicitud: Pendiente, Asignada, EnBusqueda, Localizada, Preparada, Entregada,
  Cancelada, NoLocalizada.
- Préstamo: Activo, Vencido, Renovado, Devuelto, Cerrado.

Reglas de capabilities para préstamo:
- ABRIR_PRESTAMO incluido SOLO si:
  - EstadoOperativo compatible (ej. DISPONIBLE)
  - existe fuente `CONSULTA_PROGRAMADA` con `validada=true` + actor Archivo/Jefatura, O
  - existe `VALE_ARCHIVO_SM_1_14` con `validada=true` + actor es
    ARCHIVISTA/ARCHIVO_JEFE. DIRECCION/COORDINACION_MEDICA emite o autoriza el vale,
    pero no recibe LOAN_OPEN por emitirlo.
  - FuenteHabilitanteSalida = ORDEN_SUPERIOR -> no incluir (fail-closed en T-04).

El provider determina `validada`. CapabilityService no valida evidencia y sólo comprueba
existencia de al menos una fuente habilitante; no selecciona cuál utilizar. `OpenLoan`
selecciona y registra la fuente concreta. `ORDEN_SUPERIOR` permanece fail-closed aunque
llegue con `validada=true`.

Reglas de capabilities para despacho/custodia:
- DISPATCH incluido si EstadoOperativo = APARTADO + actor es Archivo/Jefatura.
- ACCEPT_CUSTODY incluido si EstadoOperativo = EN_TRASLADO + actor es receptor autorizado.
- AUDITOR_CONSULTA con EXPEDIENT_VIEW recibe capabilities operativas vacías.

---

## 8. Seguridad y privacidad

| Control | Implementación | Fuente |
|---------|----------------|--------|
| Autenticación | OIDC/BFF; token validado en cada petición | API-034, SEC |
| Autorización | Server-side; incluye FuenteHabilitanteSalida en tupla | SEC-017, AGENTS.md |
| Tenant isolation | TenantContext server-side; connection pool por tenant | SEC-032, API-005 |
| Datos C3 en logs | No loguear pacienteRef, expedienteNumero, custodioRef | SEC-003, AGENTS.md |
| Audit append | INSERT-only; nunca UPDATE/DELETE | SEC-038, DAT-012 |
| Concurrencia | row_version; 409 en conflicto | DAT-019 |
| Errores | RFC7807; sin stack trace, sin nombre DB, sin datos clínicos | API-006 |
| CORS/CSRF | Según Volume 07 §27/28 | SEC-027, SEC-028 |

---

## 9. Testing — capas requeridas (TQ-002 v0.2.0)

| Capa | Qué probar | Framework |
|------|-----------|-----------|
| **Domain unit** | ExpedienteNumero (variantes de separador, catálogo); EstadoOperativo (6 valores, rechaza EN_BUSQUEDA/PRESTADO); FuenteHabilitanteSalida; capabilities por estado/rol/fuente; INV-EXP-003..005 | Vitest |
| **Application UC** | GetExpediente, DispatchExpediente, AcceptCustody con actores autorizados/no; cross-tenant IDOR; audit trail | Vitest |
| **PostgreSQL integration** | findById, findByNumero (0..N, normalización separadores); no cross-tenant; row_version | Vitest + PostgreSQL real |
| **API contract** | GET /expedientes/{id}; GET ?numero= colección 0/1/N; POST /dispatch; POST /accept-custody; 403; 404; 409; tenant | Vitest / contract |
| **Tenant isolation** | Tenant-A no obtiene Tenant-B; forged tenant rechazado | TQ-007 |
| **Frontend component** | ExpedienteHeader (6 badges; EN_BUSQUEDA/PRESTADO ausentes); DisambiguationList (N>1 no auto-selecciona); CommandBar (capabilities); AuditoriaTab (oculto sin permiso) | Vitest + Testing Library |
| **E2E** | Búsqueda variantes; desambiguación; estados; despacho/custodia; préstamo por fuente; conflicto 409; tenant | Playwright |
| **Accesibilidad** | Teclado; foco; ARIA | Playwright / axe |

---

## 10. Dependencias entre módulos

| Dato | Módulo propietario | API |
|------|--------------------|-----|
| Préstamo activo | Módulo Préstamo; query port consumidor en Workspace | read model server-side; sub-recurso diferido hasta Use Case canónico |
| Solicitud activa | Módulo Solicitud; query port consumidor en Workspace | read model server-side |
| Incidencias abiertas | Módulo Incidencia; query port consumidor en Workspace | read model server-side |
| Historial movimientos | Módulo Expediente / Archive Operations; schema de cada tenant | GET /expedientes/{id}/timeline |
| Capabilities préstamo | ExpedienteCapabilityService | incluidas en capabilities[] |

`OQ-DOM-001` está RESOLVED: Movimiento pertenece lógica y físicamente a Archive
Operations y permanece separado de `audit_log`.

---

## 11. Open Questions de diseño (no bloqueantes)

| ID | Pregunta | Impacto |
|----|----------|---------|
| OQ-EW-DESIGN-001 | ¿Comandos abren drawer inline o navegan a módulo? | CommandBar y flujo UX |
| OQ-EW-DESIGN-002 | ¿capabilities[] incluye metadatos de por qué está deshabilitado? | Read model y UX |
| OQ-EW-DESIGN-005 | ¿ExpedienteCapabilityService en módulo Expediente o cross-module? | Estructura packages |

`OQ-EW-DESIGN-004` está RESOLVED: endpoint/read model agregado compuesto server-side
por `GetExpediente` (READ-MODEL-COMPOSITION-DECISION).
`OQ-EW-DESIGN-003` está RESOLVED por TL-EW-001..006: cursor pagination.

---

## 12. Implementation Readiness

```yaml
spec_version: "0.3.20"
blocking_open_questions: []
non_blocking_open_questions:
  - OQ-EW-002
  - OQ-EW-003
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
  - OQ-EW-DESIGN-001
  - OQ-EW-DESIGN-002
  - OQ-EW-DESIGN-005
contradictions_found: []
implementation_ready: true
```
