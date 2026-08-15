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
  (OQ-EW-006 RESOLVED)

`AcceptCustody` — registra la confirmación del receptor autorizado en destino.
  Produce `CustodyAccepted`; estado → `EN_CONSULTA`.
  Es una acción autenticada y auditable del receptor; no requiere firma criptográfica.
  (OQ-EW-006 RESOLVED)

`OpenLoan` — requiere `FuenteHabilitanteSalida` como parte del contexto de negocio.
  (OQ-EW-005 RESOLVED)
