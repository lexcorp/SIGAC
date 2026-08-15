---
spec: expediente-workspace
version: "0.3.5"
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
requires:
  - requirements.md (v0.3.5)
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
  - OQ-EW-DESIGN-003
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
expediente
  id                           UUID  PK                   -- ExpedienteId; identidad técnica primaria
  expediente_numero            varchar                     -- formato RFC_BASE_10+SEP+COD_2; NO UNIQUE
  expediente_numero_normalizado varchar                    -- sin separador; indexado para búsqueda
  paciente_ref_id              UUID | null
  paciente_nombre_busqueda     varchar | null              -- C3; solo búsqueda interna
  estado_operativo             varchar  CHECK (ver abajo)  -- DEC-EW-STATE-001
  ubicacion_actual_id          UUID | null  FK -> ubicaciones
  custodio_tipo                varchar | null
  custodio_ref                 varchar | null
  custody_accepted_at          timestamptz | null          -- null si EN_TRASLADO sin CustodyAccepted
  last_movement_id             UUID | null  FK -> movimientos_expediente
  created_at                   timestamptz
  updated_at                   timestamptz
  row_version                  bigint NOT NULL DEFAULT 0   -- optimistic concurrency
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
-- UNIQUE(expediente_numero, hospital_id)   <- pendiente profiling
INDEX ON expediente (expediente_numero_normalizado)  -- para búsqueda flexible
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
  expediente_id             UUID  FK -> expediente
  movement_type             varchar  -- incluye DISPATCHED, CUSTODY_ACCEPTED, etc.
  origin_location_id        UUID | null
  destination_location_id   UUID | null
  origin_custodian_ref      varchar | null
  destination_custodian_ref varchar | null
  business_reference_type   varchar
  business_reference_id     UUID | null
  occurred_at               timestamptz
  recorded_at               timestamptz
  actor_ref                 varchar
  source                    varchar
  correlation_id            UUID | null
```

No contiene datos de login, configuración ni audit técnico.

### 3.5 Audit Log (DAT-012) — separado de Movimiento

```
audit_log
  id               UUID  PK
  actor_ref        varchar
  action           varchar
  resource_type    varchar
  resource_id      UUID
  result           varchar
  occurred_at      timestamptz
  request_id       UUID
  correlation_id   UUID | null
  source_ip_hash   varchar | null
  source           varchar
  change_summary   jsonb | null   -- sin payload clínico completo
  security_context jsonb | null
```

Acceso de la aplicación: INSERT únicamente.

---

## 4. API — Contratos (API-011 v0.2.0)

### 4.1 Endpoints de consulta

| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/v1/expedientes/{id} | Read model completo por ExpedienteId UUID |
| GET | /api/v1/expedientes?numero={n} | Búsqueda — devuelve colección 0..N |
| GET | /api/v1/expedientes/{id}/timeline | Historial de movimientos operativos |
| GET | /api/v1/expedientes/{id}/current-custody | Custodia actual |
| GET | /api/v1/expedientes/{id}/active-loan | Préstamo activo si existe |

### 4.2 Búsqueda por número — respuesta colección

```jsonc
// GET /api/v1/expedientes?numero=PERR810604/10
{
  "data": [
    {
      "id": "uuid",
      "expedienteNumero": "PERR810604/10",
      "pacienteRef": { "displayLabel": "..." },
      "estadoOperativo": "DISPONIBLE",
      "ubicacionActual": { ... }
    }
  ],
  "total": 1
}
// N=0 -> data:[], total:0, HTTP 200
// N>1 -> array con datos de desambiguación; cliente NO elige automáticamente
```

### 4.3 Comandos de transición de estado

| Intento UI | Endpoint | Comando dominio |
|------------|----------|-----------------|
| Despachar | POST /api/v1/expedientes/{id}/dispatch | DispatchExpediente |
| Aceptar custodia | POST /api/v1/expedientes/{id}/accept-custody | AcceptCustody |
| Transferir custodia | POST /api/v1/expedientes/{id}/custody-transfers | TransferCustody |
| Confirmar rearchivo | POST /api/v1/expedientes/{id}/rearchive | ConfirmRearchive |
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
  "rowVersion": 42
}
```

capabilities[] es calculado server-side por ExpedienteCapabilityService considerando:
EstadoOperativo + rol del actor + FuenteHabilitanteSalida disponible + contexto.
Frontend solo renderiza lo que capabilities contiene.

`updatedAt` no pertenece al aggregate, `ExpedienteSnapshot` ni read model de este
vertical slice. No existe un query port para obtenerlo. `rowVersion` conserva la
responsabilidad de optimistic concurrency.

### 4.5 Manejo de errores (API-006)

```jsonc
{ "type": "https://sigac/errors/not-found", "status": 404,
  "code": "EXPEDIENTE_NOT_FOUND", "traceId": "..." }

{ "type": "https://sigac/errors/conflict", "status": 409,
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "detail": "El expediente fue modificado. Recarga antes de reintentar.",
  "currentVersion": 43, "traceId": "..." }

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
  readonly result: 'success' | 'denied' | 'not-found';
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

### 7.3 Use Case: DispatchExpediente

```
Input: { expedienteId, destinoRef, rowVersion, context: RequestContext }

Pasos:
  1. Verificar permiso EXPEDIENT_DISPATCH en tenant
  2. findById con row_version                       -> 409 si conflicto
  3. Validar EstadoOperativo = APARTADO             -> 409 si no
  4. Ejecutar DispatchExpediente
  5. EstadoOperativo -> EN_TRASLADO
  6. custody_accepted_at -> null
  7. Guardar con row_version+1
  8. Emitir ExpedienteDispatched -> MovimientoExpediente
  9. AuditWriter.append(AuditEntry, context)
```

### 7.4 Use Case: AcceptCustody

```
Input: { expedienteId, receptorRef, ubicacionDestino, rowVersion, context: RequestContext }

Pasos:
  1. Verificar permiso CUSTODY_ACCEPT en tenant (actor es receptor autorizado)
  2. findById con row_version                       -> 409 si conflicto
  3. Validar EstadoOperativo = EN_TRASLADO          -> 409 si no
  4. Ejecutar AcceptCustody
  5. EstadoOperativo -> EN_CONSULTA
  6. custody_accepted_at -> now()
  7. custodio_ref -> receptorRef
  8. Guardar con row_version+1
  9. Emitir CustodyAccepted -> MovimientoExpediente
  10. AuditWriter.append(AuditEntry, context)
```

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
| Préstamo activo | Módulo Préstamo; query port consumidor en Workspace | read model server-side y GET /expedientes/{id}/active-loan |
| Solicitud activa | Módulo Solicitud; query port consumidor en Workspace | read model server-side |
| Incidencias abiertas | Módulo Incidencia; query port consumidor en Workspace | read model server-side |
| Historial movimientos | Módulo Expediente | GET /expedientes/{id}/timeline |
| Capabilities préstamo | ExpedienteCapabilityService | incluidas en capabilities[] |

> **OQ-DOM-001 abierta:** ¿MovimientoExpediente en schema de expediente o separado?
> Implementar en schema de expediente hasta resolución; interfaz abstracta para migración.

---

## 11. Open Questions de diseño (no bloqueantes)

| ID | Pregunta | Impacto |
|----|----------|---------|
| OQ-EW-DESIGN-001 | ¿Comandos abren drawer inline o navegan a módulo? | CommandBar y flujo UX |
| OQ-EW-DESIGN-002 | ¿capabilities[] incluye metadatos de por qué está deshabilitado? | Read model y UX |
| OQ-EW-DESIGN-003 | ¿Timeline usa cursor-based pagination u offset? | GetExpedienteTimeline |
| OQ-EW-DESIGN-005 | ¿ExpedienteCapabilityService en módulo Expediente o cross-module? | Estructura packages |

`OQ-EW-DESIGN-004` está RESOLVED: endpoint/read model agregado compuesto server-side
por `GetExpediente` (READ-MODEL-COMPOSITION-DECISION).

---

## 12. Implementation Readiness

```yaml
spec_version: "0.3.5"
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
  - OQ-EW-DESIGN-003
  - OQ-EW-DESIGN-005
contradictions_found: []
implementation_ready: true
```
