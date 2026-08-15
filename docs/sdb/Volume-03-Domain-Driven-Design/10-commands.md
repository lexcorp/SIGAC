---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-006: DispatchExpediente, AcceptCustody"
---
# DDD-010 — Commands

CreateRequest
AssignRequest
StartSearch
MarkLocated
MarkNotLocated
PrepareRequest
CancelRequest
ImportAgenda
ReconcileAgenda
CreatePreparationBatch
DispatchExpediente
AcceptCustody
TransferCustody
RegisterLocation
OpenLoan
RenewLoan
ReceiveReturn
CloseLoan
ConfirmRearchive
OpenIncident
EscalateIncident
ResolveIncident
DeclareLost

## Notas (2026-08-14)

`DispatchExpediente` — registra la salida física del expediente de Archivo Clínico
  hacia el destino. Produce `ExpedienteDispatched`; estado → `EN_TRASLADO`.
  Input: ExpedienteId, destination Ubicacion, intendedCustodian `{type,reference}` con
  ambos strings obligatorios y no vacíos,
  businessReference `{type:string,id:string|null}`, expectedRowVersion bigint y
  RequestContext. Origen/custodio previos se derivan del aggregate. No abre Préstamo ni
  confirma custodia. Ningún dato del custodio previsto se deriva de destination.
  Application pasa `operationOccurredAt` explícitamente a `Expediente.dispatch` como
  `occurredAt`; no procede del command cliente.
  (OQ-EW-006 RESOLVED)

`AcceptCustody` — registra la confirmación del receptor autorizado en destino.
  Produce `CustodyAccepted`; estado → `EN_CONSULTA`.
  Input: ExpedienteId, receptor `{type,reference,service}`, ubicacionDestino Ubicacion,
  businessReference `{type,id}`, expectedRowVersion y RequestContext. type/reference son
  obligatorios; service nullable.
  Es una acción autenticada y auditable del receptor; no requiere firma criptográfica.
  (OQ-EW-006 RESOLVED)

`OpenLoan` — requiere `FuenteHabilitanteSalida` como parte del contexto de negocio.
  (OQ-EW-005 RESOLVED)
