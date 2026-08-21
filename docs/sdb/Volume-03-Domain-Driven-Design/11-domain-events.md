---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-006: ExpedienteDispatched, CustodyAccepted"
---
# DDD-011 — Domain Events

RequestCreated
RequestAssigned
SearchStarted
ExpedienteLocated
ExpedienteNotLocated
ExpedientePrepared
RequestCancelled
PreparationBatchCreated
AgendaImported
AgendaReconciled (deferred para Agenda Preparation T-03)
CitaWithdrawnFromAgenda (deferred para Agenda Preparation T-03)
CitaRestored (deferred para Agenda Preparation T-03)
LateAppointmentDetected
ExpedienteDispatched
CustodyAccepted
CustodyTransferred
ExpedienteLocationChanged
LoanOpened
LoanRenewed
LoanExpired
ReturnReceived
LoanClosed
ExpedienteRearchived
IncidentOpened
IncidentEscalated
IncidentResolved
ExpedienteDeclaredLost

AuditEvent no es sinónimo de DomainEvent.

Agenda Preparation no emite evento por cada fila/métrica/incidencia. AGD-AP-007 difiere
explícitamente `AgendaReconciled`, `CitaWithdrawnFromAgenda` y `CitaRestored`: T-03 no los
implementa ni emite hasta aprobar payload y temporalidad. Retirada/restauración preservan
FOLIO y no significan cancelación clínica.

## Notas (2026-08-14)

`ExpedienteDispatched` — emitido por `DispatchExpediente`. El expediente sale físicamente
de Archivo y entra en traslado. Payload mínimo: expedienteId, originLocation,
destinationLocation, originCustodianRef, intendedCustodian `{type,reference}`,
businessReferenceType y businessReferenceId. No incluye requestId, source ni recordedAt.
`intendedCustodian.type/reference` son strings obligatorios y no vacíos.
Su `DomainEvent.occurredAt` se recibe explícitamente desde Application/UoW y coincide
con el occurredAt del Movimiento DISPATCHED. El aggregate no genera timestamps.
  de Archivo Clínico; `EstadoOperativo` → `EN_TRASLADO`. Registra actor (archivista/mensajero),
  destino previsto, timestamp y correlación con la jornada/solicitud.
  (OQ-EW-006 RESOLVED)

## DOM-EVENT-001

Cuando `occurredAt` representa el instante efectivo de una operación, Application/UoW
lo entrega explícitamente al método del aggregate. El dominio no llama `Date.now()`, no
crea `new Date()` para fechar el evento, no obtiene Clock ni usa timestamps implícitos.

`CustodyAccepted` — emitido por `AcceptCustody`. El receptor autorizado confirma la
  recepción en destino; `EstadoOperativo` → `EN_CONSULTA`. Registra receptor, ubicación
  de destino, timestamp y acción autenticada del receptor.
  Payload mínimo: expedienteId, location Ubicacion, intendedCustodian `{type,reference}`
  y acceptedCustodian `{type,reference,service}`. occurredAt usa operationOccurredAt;
  no incluye metadata técnica.
  (OQ-EW-006 RESOLVED)

`CustodyTransferred` — sigue siendo válido para transferencias internas o
  re-asignaciones de custodia distintas al flujo primario de despacho/aceptación.
