# Read Model Composition Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.7 / T-04 a T-20

## CTX-EW-001 — Contexto canónico de Application

`RequestContext` es el contexto canónico e inmutable de ejecución de Application. Los
Use Cases reutilizan los tipos canónicos `ActorContext` y `TenantContext`; no definen
copias locales.

## CTX-EW-002 — Contrato de RequestContext

```typescript
type RequestSource = 'WEB' | 'INTERNAL';

interface RequestContext {
  readonly actor: ActorContext;
  readonly tenant: TenantContext;
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: RequestSource;
}
```

`RequestSource` es cerrado para el alcance actual. No se añaden fuentes no respaldadas
por un flujo aprobado.

## CTX-EW-003 — Identificadores de ejecución y correlación

`requestId` identifica una ejecución/request concreta. `correlationId` relaciona las
operaciones de un mismo flujo lógico. Son identificadores distintos y ninguno puede
reutilizarse como sustituto del otro.

## CTX-EW-004 — Construcción server-side

La frontera server-side construye `RequestContext` antes de entrar a Application, una
vez resueltos y validados actor y tenant. Los Use Cases no toman actor, tenant,
`requestId` ni `correlationId` desde body o query arbitrarios.

## READ-EW-001 — Composición server-side

`GetExpediente` compone server-side un único `ExpedienteReadModel`. El endpoint del
Workspace devuelve el read model agregado; el frontend no consulta ni orquesta varios
dominios para reconstruirlo. Esto resuelve `OQ-EW-DESIGN-004`.

## READ-EW-002 — Ownership de los query ports

Préstamo, Solicitud e Incidencia conservan la propiedad de sus aggregates y reglas. Como
consumidor de sus proyecciones, Expediente Workspace es propietario de tres puertos
mínimos en su Application Layer:

- `ActiveLoanQueryPort`;
- `ActiveRequestQueryPort`;
- `OpenIncidentsQueryPort`.

Son contratos de consulta de proyección. No exponen aggregates ajenos ni transfieren la
propiedad del dominio al Workspace. Sus adapters serán provistos por los módulos o la
infraestructura propietaria de los datos.

Todos reciben `ExpedienteId` y `TenantContext`. El tenant es obligatorio, llega resuelto
server-side y nunca se obtiene del body.

## READ-EW-003 — ActiveRequestQueryPort

```typescript
interface ActiveRequestQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveRequestSummary | null>;
}

interface ActiveRequestSummary {
  solicitudId: string;
  tipo: string;
  origen: string;
  estado: EstadoSolicitud;
  asignadoA: string | null;
}
```

Cardinalidad: `0..1`. La ausencia se representa con `null`. `EstadoSolicitud` reutiliza
exclusivamente `Pendiente`, `Asignada`, `EnBusqueda`, `Localizada`, `Preparada`,
`Entregada`, `Cancelada`, `NoLocalizada`.

## READ-EW-004 — ActiveLoanQueryPort

```typescript
interface ActiveLoanQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveLoanSummary | null>;
}

interface ActiveLoanSummary {
  prestamoId: string;
  finalidad: string;
  custodioRef: string;
  destinoTipo: string;
  destinoRef: string;
  dueAt: Date;
  fuenteHabilitanteSalida: FuenteHabilitanteSalida;
  estado: 'Activo' | 'Vencido';
}
```

Cardinalidad: `0..1`. La ausencia se representa con `null`. Los campos proceden de
DDD-015, DAT-009, SPEC-006 y UC-018/REQ-EW-005. La fuente habilitante es obligatoria en
la proyección porque SPEC-006 exige registrarla y SPEC-009 exige mostrarla.

## READ-EW-005 — OpenIncidentsQueryPort

```typescript
interface OpenIncidentsQueryPort {
  findOpenByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<readonly OpenIncidentSummary[]>;
}

interface OpenIncidentSummary {
  incidenciaId: string;
  tipo: string;
  severidad: string;
  estado: 'Abierta' | 'EnInvestigacion' | 'Escalada';
  resumen: string;
  asignadoA: string | null;
  openedAt: Date;
}
```

Cardinalidad: `0..N`. La ausencia se representa con un array vacío. Sólo
`Abierta|EnInvestigacion|Escalada` son abiertas; `Resuelta` no forma parte del resultado.
Los campos son la proyección mínima de DDD-017/DAT-010 para indicador y listado. Esta
decisión no automatiza la creación de incidencias: `NO_LOCALIZADO` no abre una
Incidencia mientras `OQ-EW-004` permanezca abierta.

## READ-EW-006 — ExpedienteReadModel

`GetExpediente` obtiene el aggregate Expediente mediante `ExpedienteRepository`, consulta
los tres puertos anteriores, calcula `capabilities[]` mediante
`ExpedienteCapabilityService` y devuelve un único `ExpedienteReadModel` con:

- identidad y situación operativa del Expediente;
- `prestamoActivo: ActiveLoanSummary | null`;
- `solicitudActiva: ActiveRequestSummary | null`;
- `incidenciasAbiertas: readonly OpenIncidentSummary[]`;
- `capabilities: readonly ExpedienteCapability[]`;
- `rowVersion`.

El campo mínimo de presentación de paciente sigue bajo `OQ-EW-002`; se conserva el
`nombreOperativo` ya disponible en `PacienteReferencia` hasta su resolución.

## READ-EW-007 — Contrato de salida

`GetExpediente` devuelve un solo `ExpedienteReadModel` compuesto al API. No devuelve una
colección de respuestas parciales ni delega al controller o al frontend la composición.

## READ-EW-008 — ExitEnablingSourceQueryPort

Application de Expediente Workspace posee el contrato consumidor:

```typescript
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
```

El puerto no expone aggregates ni evidencia/documentación completa de Agenda o SM 1-14.

## READ-EW-009 — Cardinalidad

El resultado tiene cardinalidad `0..N`. La ausencia se representa exclusivamente con
`[]`. Pueden coexistir fuentes de tipos distintos o más de una evidencia disponible.

## READ-EW-010 — Responsabilidad de validación

`validada` es determinada por el provider/adapter que consulta la evidencia de la fuente
habilitante. `ExpedienteCapabilityService` nunca valida agenda, vale ni documentación;
sólo consume el resultado del puerto. Esta decisión no prescribe adapters concretos.

## READ-EW-011 v2 — Uso en GetExpediente

`GetExpediente` consulta `ExitEnablingSourceQueryPort` internamente con el mismo
`ExpedienteId` y `context.tenant` de los demás query ports. Su input público es:

```typescript
{
  expedienteId: ExpedienteId;
  context: RequestContext;
}
```

El Use Case utiliza `context.actor` y `context.tenant` internamente. El mismo patrón se
aplica a los Use Cases auditables posteriores del Workspace.

## READ-EW-012 — Evaluación y selección

Pueden coexistir varias fuentes válidas. `ExpedienteCapabilityService` sólo determina si
existe al menos una fuente habilitante para ofrecer `ABRIR_PRESTAMO`; no selecciona cuál
se utilizará. La selección y el registro de la fuente concreta pertenecen al command/use
case `OpenLoan`.

## READ-EW-013 — updatedAt fuera del vertical slice

`updatedAt` no pertenece al aggregate `Expediente` ni a `ExpedienteSnapshot`. Se elimina
de `ExpedienteReadModel` y del contrato API de este vertical slice. `rowVersion`
continúa siendo el mecanismo canónico de optimistic concurrency.

No se crea un query port exclusivamente para obtener `updatedAt`. Una futura necesidad
funcional podrá introducirlo como metadata de proyección mediante una decisión
específica.

## AUTH-EW-006 — Fuentes que habilitan ABRIR_PRESTAMO

Además de permission, rol, EstadoOperativo y ausencia de préstamo activo,
`ABRIR_PRESTAMO` requiere al menos un elemento con `validada: true` y `tipo` igual a
`CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14`.

## AUTH-EW-007 — ORDEN_SUPERIOR fail-closed

`ORDEN_SUPERIOR` nunca habilita `ABRIR_PRESTAMO` en esta spec, incluso si el provider la
retorna con `validada: true`. Permanecerá fail-closed hasta contar con su spec específica.

## AUD-EW-001 — Ownership de AuditWriter

Expediente Workspace es propietario del puerto `AuditWriter` en Application Layer. Su
contrato queda refinado por `AUD-EW-003..006`.

## AUD-EW-003 — AuditEntry y AuditRecord

`AuditEntry` es la intención semántica producida por Application. `AuditRecord` es el
registro persistido completo de DAT-012. Application no construye la metadata técnica
completa de `AuditRecord`.

```typescript
interface AuditEntry {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly result: 'success' | 'denied' | 'not-found';
  readonly changeSummary?: Readonly<Record<string, string>>;
}
```

`changeSummary` sólo se incluye cuando la operación y DAT-012 lo permiten. Nunca incluye
datos C3, payloads clínicos, tokens ni secretos.

## AUD-EW-004 — Contrato de AuditWriter

```typescript
interface AuditWriter {
  append(entry: AuditEntry, context: RequestContext): Promise<void>;
}
```

## AUD-EW-005 — Enriquecimiento del registro persistido

`AuditWriter` construye el `AuditRecord` persistido combinando:

- `action`, `resourceType`, `resourceId`, `result` y el `changeSummary` permitido desde
  `AuditEntry`;
- `actorRef` desde `context.actor`;
- el tenant/database resuelto desde `context.tenant`;
- `requestId`, `correlationId` y `source` desde `RequestContext`;
- `occurredAt`, establecido por `AuditWriter` en el momento de `append`.

`GetExpediente` no establece `occurredAt`. No se introduce un `ClockPort` en este slice;
la infraestructura podrá emplear posteriormente una fuente temporal testeable. Los
campos técnicos adicionales permitidos por DAT-012 son responsabilidad del adapter, no
de Application.

| Campo persistido DAT-012 | Fuente/responsable |
|---|---|
| `id` / `audit_id` | `AuditWriter`/adapter al persistir |
| tenant / database | `context.tenant`; selección server-side database-per-tenant |
| `actor_ref` | `context.actor.actorId` |
| `action` | `entry.action` |
| `resource_type` | `entry.resourceType` |
| `resource_id` | `entry.resourceId` |
| `result` | `entry.result` |
| `occurred_at` | `AuditWriter` al hacer append |
| `request_id` | `context.requestId` |
| `correlation_id` | `context.correlationId` |
| `source` | `context.source` |
| `change_summary` | `entry.changeSummary`, sólo si está permitido |
| `source_ip_hash` candidate | adapter, sólo si dispone del dato permitido |
| `security_context` mínimo | adapter, limitado a metadata técnica permitida |

## AUD-EW-006 — Append-only

`AuditWriter` sólo ofrece `append`; no ofrece update ni delete.

## AUD-EW-002 — Enforcement en Application

`GetExpediente`, `GetExpedienteTimeline` y los comandos del Workspace consumen
`AuditWriter` con el `RequestContext` canónico. El controller no escribe audit: la
frontera server-side sólo construye el contexto.

Para `GetExpediente`:

- `action = EXPEDIENTE_VIEW`;
- `resourceType = EXPEDIENTE`;
- `result = success` cuando devuelve el read model;
- `result = denied` cuando falta autorización;
- `result = not-found` cuando no existe en el tenant.

Los intentos se registran sin `expedienteNumero`, referencia de paciente ni otros datos C3.

## ERR-EW-001 — DomainError y ApplicationError

`DomainError != ApplicationError`. `DomainError` queda reservado para invariantes y
validaciones de dominio. Los Use Cases usan conceptualmente un `ApplicationError` con
un `code` cerrado para autorización, ausencia y concurrencia.

Para T-05, el tipo reside en Application de `archive-operations`. La arquitectura actual
no exige un package compartido ni autoriza colocarlo en `domain-kernel`. Una extracción
futura a un componente Application compartido será un refactor no bloqueante cuando
exista evidencia de reutilización.

```typescript
type ApplicationErrorCode =
  | 'PERMISSION_DENIED'
  | 'INSUFFICIENT_ENABLING_SOURCE'
  | 'EXPEDIENTE_NOT_FOUND'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'REQUEST_INVALID_TRANSITION';

interface ApplicationError extends Error {
  readonly name: 'ApplicationError';
  readonly code: ApplicationErrorCode;
}
```

## ERR-EW-002 — Taxonomía mínima canónica

| Application/API error code | HTTP futuro | Semántica |
|---|---:|---|
| `PERMISSION_DENIED` | 403 | Actor autenticado sin la permission requerida |
| `INSUFFICIENT_ENABLING_SOURCE` | 403 | Falta fuente habilitante válida para la operación contextual |
| `EXPEDIENTE_NOT_FOUND` | 404 | Expediente inexistente dentro del tenant activo |
| `OPTIMISTIC_LOCK_CONFLICT` | 409 | `rowVersion` no coincide |
| `REQUEST_INVALID_TRANSITION` | 409 | Operación inválida para el estado actual |

`AUTHENTICATION_REQUIRED` se mapea a HTTP 401 en la frontera API/BFF y no es un error
producido por `GetExpediente`. Cuando `context.actor.permissions` no contiene
`EXPEDIENT_VIEW`, `GetExpediente` produce `ApplicationError` con
`code = PERMISSION_DENIED`; no usa `INSUFFICIENT_ENABLING_SOURCE`.

## ERR-EW-003 — Tenant y no divulgación

No existe un identifier público `CROSS_TENANT_*`. El Repository opera exclusivamente en
`context.tenant`. Si el Expediente no existe en el tenant activo, incluso si existe en
otro tenant, Application produce `EXPEDIENTE_NOT_FOUND` y la API responde 404. Una señal
interna de manipulación pertenece a security/audit y no modifica la respuesta pública.

## ERR-EW-004 — Mapping RFC7807

La futura capa API de T-11/T-12 mapeará `ApplicationError.code` a RFC7807. `code` será
una extensión estable, por ejemplo:

```json
{
  "status": 403,
  "title": "Forbidden",
  "code": "PERMISSION_DENIED"
}
```

El Problem Details no contiene datos sensibles, stack trace, nombres de base de datos
ni información sobre existencia cross-tenant. Esta decisión no implementa el mapper.

## TL-EW-001 — Pagination

`GetExpedienteTimeline` usa cursor-based pagination. El orden canónico y determinista es
`occurredAt DESC, movimientoId DESC`. Esto cierra `OQ-EW-DESIGN-003`.

## TL-EW-002 — Cursor

El cursor es opaco para API/UI y representa conceptualmente la tupla
`occurredAt + movimientoId`. El frontend no interpreta ni construye su encoding interno.

## TL-EW-003 — Input

```typescript
interface TimelinePagination {
  readonly cursor?: string;
  readonly limit: number;
}

interface GetExpedienteTimelineInput {
  readonly expedienteId: ExpedienteId;
  readonly pagination: TimelinePagination;
  readonly context: RequestContext;
}
```

API-007 exige un máximo server-side, pero el SDB no define un valor numérico. Esta
decisión no inventa uno.

## TL-EW-004 — Query port

Application de Archive Operations posee el port consumidor:

```typescript
interface ExpedienteTimelineQueryPort {
  findByExpediente(
    expedienteId: ExpedienteId,
    pagination: TimelinePagination,
    tenant: TenantContext,
  ): Promise<TimelinePage>;
}
```

## TL-EW-005 — Result

```typescript
interface TimelinePage {
  readonly items: readonly MovimientoExpedienteSummary[];
  readonly nextCursor: string | null;
}
```

Ausencia: `{ items: [], nextCursor: null }`. Cursor pagination no exige `total` ni
`hasMore`; la presencia de `nextCursor` expresa que existe una página siguiente.

## TL-EW-006 — MovimientoExpedienteSummary

```typescript
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
```

Los campos derivan de DDD-020/DAT-011. No existe actualmente un enum canónico para
`movementType`, `businessReferenceType` o `source`; se conservan como strings y no se
inventan catálogos. El summary no contiene datos clínicos.

## TL-EW-007 — Ownership

`MovimientoExpediente` pertenece lógica y físicamente al módulo Expediente / Archive
Operations y se persiste junto con Expediente en el schema de cada tenant. Esto cierra
`OQ-DOM-001`. Es append-oriented y permanece absolutamente separado de `audit_log`.

## TL-EW-008 — Authorization y tenant

`GetExpedienteTimeline` requiere `EXPEDIENT_VIEW` y recibe el `RequestContext` canónico.
El query port recibe exclusivamente `context.tenant`. Una ausencia tenant-scoped usa
`EXPEDIENTE_NOT_FOUND` y no revela existencia en otro tenant.

## TL-EW-009 — Audit

El Use Case registra el acceso mediante `AuditWriter`. Ninguna entrada de `audit_log`
forma parte de `TimelinePage.items`; Movimiento y Audit son modelos distintos.

## TL-EW-010 — Retention

`OQ-EW-010` permanece abierta. T-06 no define ni ejecuta retención: devuelve únicamente
los movimientos disponibles bajo la política vigente.

## TL-EW-011 — Audit action

Para `GetExpedienteTimeline`, `AuditEntry.action = EXPEDIENTE_TIMELINE_VIEW`. Es distinta
de `EXPEDIENTE_VIEW` para distinguir la consulta específica del timeline de la consulta
general del Workspace.

## TL-EW-012 — Audit resource

`resourceType = EXPEDIENTE` y `resourceId = expedienteId`. El timeline es una proyección
subordinada del Expediente. No se crea `EXPEDIENTE_TIMELINE` ni se usa
`MOVIMIENTO_EXPEDIENTE` como resourceType para esta operación.

## TL-EW-013 — Authorization

La autorización ocurre antes de cualquier query. Si `context.actor.permissions` no
contiene `EXPEDIENT_VIEW`, el Use Case escribe audit `denied` y produce
`ApplicationError(PERMISSION_DENIED)`.

## TL-EW-014 — Resource existence

Después de autorizar, `GetExpedienteTimeline` ejecuta
`ExpedienteRepository.findById(expedienteId, context.tenant)` antes del query port. Si
devuelve `null`, escribe audit `not-found` y produce
`ApplicationError(EXPEDIENTE_NOT_FOUND)`. Incluye IDs existentes sólo en otro tenant y
no revela esa existencia.

## TL-EW-015 — Empty timeline

Para un Expediente existente, `{ items: [], nextCursor: null }` es una consulta válida y
se audita con `result = success`; no equivale a not-found.

## TL-EW-016 — Non-empty timeline

Una página con uno o más movimientos también se audita con `result = success`.

## TL-EW-017 — Separation

Ninguna fila de `audit_log` puede aparecer en `TimelinePage.items`. Auditar la consulta
no crea un `MovimientoExpediente`.

## OQs

`OQ-EW-DESIGN-004` queda RESOLVED. Permanecen abiertas `OQ-EW-002`, `OQ-EW-003`,
`OQ-EW-004` y la decisión de retención del timeline (`OQ-EW-010`).
