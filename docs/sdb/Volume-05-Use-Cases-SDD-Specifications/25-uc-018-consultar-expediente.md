---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-018 — Consultar Situación del Expediente

## Objetivo
Permitir a un usuario autorizado conocer la situación operativa actual de un expediente
físico: dónde está, quién lo tiene, desde cuándo y qué ocurrió.

## Read Model
- `expedienteNumero` (formato institucional con separador preferente `/`)
- referencia mínima del paciente (datos C3 — mínimo necesario para identificación operativa)
- `estadoOperativo` (uno de: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA,
  NO_LOCALIZADO, EXTRAVIADO — DEC-EW-STATE-001)
- ubicación actual
- custodia actual (tipo, referencia, `acceptedAt` si aplica)
- préstamo activo (si existe)
- solicitud activa (si existe)
- incidencias abiertas (si existen)
- historial de movimientos operativos relevantes (`MovimientoExpediente`)
- `capabilities[]` — acciones válidas para el actor actual en el estado actual

## Búsqueda por número (OQ-EW-001/007 RESOLVED)
- La búsqueda por `expedienteNumero` puede devolver **0, 1 ó N coincidencias**.
- Si N = 0: estado vacío descriptivo; no revelar información de otros tenants.
- Si N = 1: abrir el workspace directamente.
- Si N > 1: presentar lista de coincidencias con datos mínimos de desambiguación
  (nombre, CURP, número ISSSTE); **nunca** abrir automáticamente una coincidencia
  cuando existan varias (INV-EXP-003, BR-017).
- Se aceptan variantes de separador (`/`, `-`, sin separador) para búsqueda;
  la presentación usa `/` como forma preferente.

### Use Case SearchExpedientesByNumero (SEARCH-EW-001..005)

`SearchExpedientesByNumero` recibe `{ numero: ExpedienteNumero; context:
RequestContext }`, exige `EXPEDIENT_VIEW` y usa exclusivamente
`ExpedienteRepository.findByNumero(numero, context.tenant)`. Retorna
`readonly ExpedienteSearchItem[]` (0..N). Cada item contiene `expedienteId`,
`expedienteNumero`, `estadoOperativo`, `ubicacion` nullable y `paciente` con exactamente
`idInstitucional`, `curp`, `nombreOperativo` y `numeroIssste`. No retorna aggregates ni
datos adicionales del Workspace.

Una búsqueda válida con cero o N resultados audita
`EXPEDIENTE_SEARCH/EXPEDIENTE/{numeroNormalizado}` con resultado `success`. Cero no es
not-found y el audit no registra datos del paciente, IDs/cantidad de resultados ni
otros datos C3. Falta de permission produce `PERMISSION_DENIED`.

## UX principle
Debe responder rápidamente: dónde está, quién lo tiene, desde cuándo y qué puedo hacer.

## Non-goals
- No mostrar diagnósticos, notas clínicas, tratamientos ni estudios.
- No autorizar acceso al contenido clínico del expediente.

## Precondición
Actor autenticado con permiso `EXPEDIENT_VIEW` en el tenant resuelto server-side.

## Input de Application

`GetExpediente` recibe exclusivamente `{ expedienteId: ExpedienteId; context:
RequestContext }`. La frontera server-side construye el contexto inmutable; Application
usa `context.actor` y `context.tenant` y no acepta esos valores desde body/query.

Si falta `EXPEDIENT_VIEW`, produce `ApplicationError(PERMISSION_DENIED)` antes de
consultar el Repository. Si el Repository tenant-scoped no encuentra el Expediente,
produce `ApplicationError(EXPEDIENTE_NOT_FOUND)`, incluso si el mismo identificador
existe en otro tenant.

## Composición del read model (READ-EW-001..012)

`GetExpediente` compone server-side un único `ExpedienteReadModel`. Obtiene el Expediente
tenant-scoped y consume proyecciones mínimas mediante:

- `ActiveRequestQueryPort.findActiveByExpedienteId(ExpedienteId, TenantContext)` ->
  `ActiveRequestSummary | null` (`solicitudId`, `tipo`, `origen`, `estado`,
  `asignadoA` nullable).
- `ActiveLoanQueryPort.findActiveByExpedienteId(ExpedienteId, TenantContext)` ->
  `ActiveLoanSummary | null` (`prestamoId`, `finalidad`, `custodioRef`, `destinoTipo`,
  `destinoRef`, `dueAt`, `fuenteHabilitanteSalida`, `estado: Activo|Vencido`).
- `OpenIncidentsQueryPort.findOpenByExpedienteId(ExpedienteId, TenantContext)` ->
  `readonly OpenIncidentSummary[]` (`incidenciaId`, `tipo`, `severidad`, `estado`,
  `resumen`, `asignadoA` nullable, `openedAt`).
- `ExitEnablingSourceQueryPort.findAvailableByExpediente(ExpedienteId, TenantContext)` ->
  `readonly FuenteHabilitanteSalidaContext[]`, cardinalidad `0..N`, ausencia `[]`;
  cada elemento contiene exclusivamente `tipo` y `validada`.

Los puertos pertenecen a Application de Expediente Workspace como consumidor de
proyecciones; los aggregates siguen perteneciendo a sus módulos. El frontend recibe el
read model ya compuesto y no orquesta dominios.

El provider determina `validada`. `GetExpediente` pasa la colección completa a
`ExpedienteCapabilityService`, que sólo comprueba si existe al menos una fuente validada
de tipo `CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14`. No selecciona la fuente de
`OpenLoan`. `ORDEN_SUPERIOR` no habilita la capability aunque llegue validada.

`updatedAt` no forma parte del `ExpedienteReadModel`; no pertenece al aggregate ni al
snapshot. `rowVersion` es el mecanismo de concurrencia del vertical slice.

## Timeline de movimientos (TL-EW-001..017)

`GetExpedienteTimeline` recibe `{ expedienteId, pagination: { cursor?, limit }, context }`,
requiere `EXPEDIENT_VIEW` y consulta `ExpedienteTimelineQueryPort` con
`context.tenant`. Devuelve `{ items, nextCursor }`, ordenado por
`occurredAt DESC, movimientoId DESC`. El cursor es opaco y representa conceptualmente
esa tupla. Ausencia: `{ items: [], nextCursor: null }`; no devuelve `total`.

Los items son proyecciones DAT-011 sin datos clínicos. Movimiento pertenece a Archive
Operations y jamás mezcla registros de `audit_log`. El acceso se registra mediante
`AuditWriter`. T-06 no decide retención y `OQ-EW-010` permanece abierta.

Orden del Use Case: autorizar `EXPEDIENT_VIEW`; comprobar existencia con
`ExpedienteRepository.findById(expedienteId, context.tenant)`; consultar el timeline;
auditar; retornar. Falta de permission produce `PERMISSION_DENIED` y audit `denied`.
Ausencia tenant-scoped produce `EXPEDIENTE_NOT_FOUND` y audit `not-found`.

La acción es `EXPEDIENTE_TIMELINE_VIEW`, con `resourceType = EXPEDIENTE` y
`resourceId = expedienteId`. Timeline vacío y no vacío son `success`. El audit no crea
movimientos y sus filas nunca forman parte del resultado.

## DispatchExpediente (DSP-EW-001..011)

Input: ExpedienteId, destination Ubicacion, intendedCustodian `{type,reference}` con
ambos strings obligatorios y no vacíos,
businessReference `{type,id}`, expectedRowVersion bigint y RequestContext. Autoriza
EXPEDIENT_DISPATCH, carga tenant-scoped, ejecuta la transición APARTADO→EN_TRASLADO y en
una UoW guarda aggregate, Movimiento DISPATCHED y audit success ALL OR NOTHING.
Dentro del callback invoca `Expediente.dispatch` con
`occurredAt = transaction.operationOccurredAt`; el evento y el movimiento usan
exactamente ese mismo instante.
El aggregate construye Custodia en traslado con type/reference recibidos y
service/location/acceptedAt null. El evento transporta intendedCustodian
`{type,reference}`. Movimiento DISPATCHED usa
`destinationCustodianRef=intendedCustodian.reference` y no añade el type.

Audit: `EXPEDIENTE_DISPATCH/EXPEDIENTE/{expedienteId}`. Denied/not-found quedan fuera de
la transacción mutante. Optimistic conflict provoca rollback completo y después se
audita `conflict` fuera de la UoW fallida; no persiste aggregate ni Movimiento.
Una transición inválida también provoca rollback completo y después se audita
`invalid-transition` fuera de la UoW; produce `REQUEST_INVALID_TRANSITION`/HTTP 409.
`conflict` permanece reservado exclusivamente al mismatch de rowVersion.

## AcceptCustody (CST-EW-001..010)

Input: ExpedienteId, receptor `{type,reference,service}`, ubicacionDestino Ubicacion,
businessReference `{type,id}`, expectedRowVersion y RequestContext. Exige CUSTODY_ACCEPT, EN_TRASLADO, Custodia existente
no aceptada y ubicación coincidente. Usa receptor efectivo para Custodia, location =
ubicacionDestino.id y occurredAt = operationOccurredAt. En success, save + Movimiento
CUSTODY_ACCEPTED + audit success comparten UoW ALL OR NOTHING.

Movimiento toma businessReferenceType/id exclusivamente del input. Audit usa
`CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId`; success es atómico y denied/not-found/
conflict/invalid-transition se escriben fuera de la UoW mutante. CST-GAP-001/002 CLOSED.

## Audit

El Use Case produce un `AuditEntry` semántico y consume
`AuditWriter.append(entry, context)` desde Application. Registra `EXPEDIENTE_VIEW` /
`EXPEDIENTE` con resultado exacto `success`, `denied` o `not-found` y sin datos C3. El
writer añade actor, tenant, request/correlation IDs, source y `occurredAt`; el controller
no escribe audit.

## Fuente
DDD-013, SPEC-009, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007,
DEC-EW-STATE-001, READ-MODEL-COMPOSITION-DECISION.

## Frontera HTTP (HTTP-EW-001, API-EW-021, SEARCH-EW-006..008)

La frontera autenticada construye el `RequestContext` antes de Application. La extensión
de búsqueda publica `GET /api/v1/expedientes?numero={numero}` respaldado únicamente por
`SearchExpedientesByNumero`; current-custody, active-loan y rearchive permanecen
diferidos. El controller nunca accede al Repository.

La respuesta de búsqueda es `{ items: readonly ExpedienteSearchItem[] }`, sin `total`
ni paginación. `numero` ausente, vacío o inválido produce
`HTTP_VALIDATION_ERROR`/400; la normalización pertenece al VO.

En JSON, `rowVersion` y `expectedRowVersion` son strings decimales; Application conserva
`bigint`.

Dispatch y AcceptCustody son comandos síncronos/transaccionales. En success sus
endpoints responden 204 sin body; los DomainEvent `ExpedienteDispatched` y
`CustodyAccepted` no se exponen por HTTP. El cliente puede refrescar GetExpediente.

## Extensión v0.3.21 — GetExpedienteAudit y comandos UI

`GetExpedienteAudit` recibe `{ expedienteId, pagination: { cursor?, limit }, context }`,
exige `EXPEDIENT_AUDIT_VIEW`, comprueba existencia con `ExpedienteRepository` y consulta
`ExpedienteAuditQueryPort` usando exclusivamente `context.tenant`. Retorna
`{items,nextCursor}` cursor-based, sin total. Falta de permission usa
`PERMISSION_DENIED`; ausencia tenant-scoped usa `EXPEDIENTE_NOT_FOUND`.

Cada item contiene sólo auditId, action, result canónico, actorRef, occurredAt, source,
requestId y correlationId. No expone changeSummary/securityContext. El endpoint es
`GET /api/v1/expedientes/{id}/audit`; Audit permanece separado de Movimiento.

Dispatch/AcceptCustody se capturan en diálogos sólo cuando su capability existe.
`expectedRowVersion` procede del Workspace y no es editable; actor, tenant, timestamps
y tracing nunca proceden del formulario.

## Extensión v0.3.22 — ListUbicaciones

`ListUbicaciones` recibe `{ context: RequestContext }`, requiere `LOCATION_VIEW` antes
de consultar y consume `UbicacionesQueryPort.findAll(context.tenant)`. Retorna
`readonly UbicacionOption[]`, limitado a `id`, `codigo`, `descripcion`. Catálogo vacío
es success con `[]`; no existe not-found. `LOCATION_VIEW` no es capability.
