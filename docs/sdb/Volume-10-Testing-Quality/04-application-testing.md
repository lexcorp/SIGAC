# TQ-004 — Application Testing

Cada Use Case valida autorización, aggregate, reglas, persistencia, audit/outbox, errores y concurrencia/idempotencia cuando aplique.

Para `ExpedienteCapabilityService`, cubrir al menos:
- Role, Permission, Capability y Command no se sustituyen entre sí.
- Sin `EXPEDIENT_VIEW`, resultado vacío.
- `AUDITOR_CONSULTA` con `EXPEDIENT_VIEW`, operational capabilities vacías.
- Cada capability requiere su permission canónica y estado/contexto válido.
- ActorContext/TenantContext llegan ya validados; el servicio no resuelve tenant.
- SM 1-14: emisor y ejecutante separados; ejecución por Archivo/Jefatura con fuente validada.
- `ORDEN_SUPERIOR` no habilita `ABRIR_PRESTAMO` (fail-closed).
- colección de fuentes vacía -> `ABRIR_PRESTAMO` ausente;
- una o varias fuentes: basta una validada `CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14`;
- fuentes no validadas -> `ABRIR_PRESTAMO` ausente;
- `ORDEN_SUPERIOR` validada -> `ABRIR_PRESTAMO` ausente;
- CapabilityService no selecciona una fuente ni valida evidencia.

Para `GetExpediente` y sus puertos de proyección, cubrir al menos:
- composición server-side del read model único;
- cardinalidad `0..1` y ausencia `null` para Solicitud/Préstamo activos;
- cardinalidad `0..N` y ausencia `[]` para Incidencias abiertas;
- `ExpedienteId` y `TenantContext` obligatorios en cada query port;
- ningún query port retorna aggregates ajenos;
- audit `EXPEDIENTE_VIEW` con `success`, `denied`, `not-found`;
- ningún registro de audit contiene datos C3;
- el controller no escribe audit.
- `ExitEnablingSourceQueryPort` recibe el mismo ExpedienteId/TenantContext, devuelve
  `0..N` y usa `[]` como ausencia.
- el input público es `{ expedienteId, context: RequestContext }` y los puertos reciben
  `context.tenant`;
- `AuditWriter` recibe el `AuditEntry` semántico y el mismo `RequestContext`;
- `requestId` y `correlationId` se conservan distintos, y `occurredAt` no lo establece
  el Use Case;
- success, denied y not-found generan entry append-only sin datos C3.
- falta de `EXPEDIENT_VIEW` produce `PERMISSION_DENIED` y audit `denied` sin consultar
  el Repository;
- ausencia dentro del tenant, incluido un ID existente sólo en otro tenant, produce
  `EXPEDIENTE_NOT_FOUND`, audit `not-found` y no revela existencia cross-tenant;
- `INSUFFICIENT_ENABLING_SOURCE` nunca representa falta de permission;
- el read model contiene `rowVersion` y no contiene `updatedAt`.

Para `GetExpedienteTimeline`, cubrir al menos:
- `EXPEDIENT_VIEW` y `RequestContext` canónico;
- query port recibe `context.tenant`, nunca tenant de input arbitrario;
- orden `occurredAt DESC, movimientoId DESC` y cursor opaco;
- ausencia `{ items: [], nextCursor: null }`, sin `total`;
- summary con los campos DAT-011 y sin datos clínicos;
- audit de acceso separado; ninguna fila de audit en `items`;
- cross-tenant no divulgativo;
- el Use Case no elimina movimientos ni decide retención.
- autorización sucede antes de Repository/query port; sin permission produce
  `PERMISSION_DENIED` y audit `EXPEDIENTE_TIMELINE_VIEW/denied`;
- Repository tenant-scoped nulo produce `EXPEDIENTE_NOT_FOUND` y audit `not-found`, sin
  invocar el timeline port;
- página vacía y página no vacía producen audit `success` sobre resourceType EXPEDIENTE;
- auditar la consulta no crea MovimientoExpediente.

Para `SearchExpedientesByNumero`, cubrir al menos:
- input con `ExpedienteNumero` y `RequestContext` canónicos;
- variantes `/`, `-` y sin separador delegadas al VO;
- Repository invocado con `context.tenant` y resultados 0, 1 y N;
- output summary exacto, sin aggregates ni campos adicionales;
- falta de `EXPEDIENT_VIEW` -> `PERMISSION_DENIED` sin consultar Repository;
- audit `EXPEDIENTE_SEARCH/EXPEDIENTE/{numeroNormalizado}` success para 0..N;
- audit sin nombres, CURP, número ISSSTE, IDs/cantidad de resultados ni otros datos C3.

Para Dispatch, cubrir permission/tenant/not-found, expectedRowVersion, transición,
payload/evento, Movimiento DAT-011 sin C3, timestamps no-client y atomicidad rollback de
aggregate+movimiento+audit. Cubrir intendedCustodian type/reference obligatorios/no
vacíos, Custodia con service/location/acceptedAt null y optimistic
conflict: rollback sin aggregate ni Movimiento, seguido de audit `conflict` externo.
Comprobar identidad temporal:
`DomainEvent.occurredAt === MovimientoExpedienteAppend.occurredAt ===
transaction.operationOccurredAt`, y destinationCustodianRef obligatorio en DISPATCHED.
Comprobar que destinationCustodianRef equivale a intendedCustodian.reference y que el
evento conserva intendedCustodian type/reference sin metadata técnica.
Para estado incompatible, comprobar rollback sin aggregate/Movimiento/audit success,
append externo `invalid-transition` y `ApplicationError(REQUEST_INVALID_TRANSITION)`.
Comprobar además que sólo optimistic rowVersion mismatch usa audit `conflict`.

Para AcceptCustody cubrir receptor efectivo, ubicación por ID, timestamp UoW,
precondiciones, rowVersion, tenant, Movimiento completo, business reference desde input,
los cinco resultados de audit y atomicidad. CST-GAP-001/002 están cerrados.

Para `GetExpedienteAudit`, cubrir permission antes de queries, existencia tenant-scoped,
404 no divulgativo, cursor/limit/TenantContext, página vacía/no vacía y summary exacto
sin changeSummary/securityContext. Audit y Movimiento permanecen separados.
`EXPEDIENT_AUDIT_VIEW` nunca aparece en capabilities.
Verificar orden `occurredAt DESC, auditId DESC`, desempate estable y cursor conceptual
`occurredAt + auditId` sin interpretación fuera del adapter.

Los tests de `ListUbicaciones` cubren autorización `LOCATION_VIEW` antes del query,
403 sin permission, propagación exclusiva de `context.tenant`, catálogo vacío `[]` y
output exacto id/codigo/descripcion. No esperan un audit identifier para esta lectura.

Para Agenda Preparation cubrir:
- permissions por operación sin autorización directa por roles;
- fail-closed antes de Repository, parser o lectura del upload;
- import denegado con `ImportAttemptId` distinto de tracing/fingerprint/identidades;
- import confirmado con audit success y layout rechazado sin AuditEntry;
- lecturas success/denied/not-found y empty success para recurso existente;
- tenant propagation y ausencia cross-tenant no divulgativa;
- AuditEntry sin archivo, raw, filas ni datos personales;
- ausencia de `capabilities[]` y `AGENDA_INCIDENT_RESOLVE`.

API-AP-001..014 añade input sin HTTP, stream no abierto antes de authorization, UoW
completa/rollback, outcomes IMPORTED/ALREADY_IMPORTED/RECONCILED, fingerprint posterior
a auth, retries por key y queries cursor-based. No fija outcomes de fila AP-OQ-004.

RESULT-AP-001..014 supersede esa reserva: probar ImportOutcome separado, exactamente un
resultado por fila, incidencias locales sin exception, exclusión de preparación,
métricas aritméticas y rollback exclusivo de fallos globales.
