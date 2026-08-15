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
AgendaVersionImported
AgendaReconciled
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

## Notas (2026-08-14)

`ExpedienteDispatched` — emitido por `DispatchExpediente`. El expediente sale físicamente
  de Archivo Clínico; `EstadoOperativo` → `EN_TRASLADO`. Registra actor (archivista/mensajero),
  destino previsto, timestamp y correlación con la jornada/solicitud.
  (OQ-EW-006 RESOLVED)

`CustodyAccepted` — emitido por `AcceptCustody`. El receptor autorizado confirma la
  recepción en destino; `EstadoOperativo` → `EN_CONSULTA`. Registra receptor, ubicación
  de destino, timestamp y acción autenticada del receptor.
  (OQ-EW-006 RESOLVED)

`CustodyTransferred` — sigue siendo válido para transferencias internas o
  re-asignaciones de custodia distintas al flujo primario de despacho/aceptación.
