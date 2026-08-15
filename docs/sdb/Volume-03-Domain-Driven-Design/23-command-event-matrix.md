---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-023 — Command/Event Matrix
CreateRequest→RequestCreated
AssignRequest→RequestAssigned
StartSearch→SearchStarted
MarkLocated→ExpedienteLocated
MarkNotLocated→ExpedienteNotLocated
ImportAgenda→AgendaVersionImported
ReconcileAgenda→AgendaReconciled
TransferCustody→CustodyTransferred
OpenLoan→LoanOpened
RenewLoan→LoanRenewed
ReceiveReturn→ReturnReceived
CloseLoan→LoanClosed
ConfirmRearchive→ExpedienteRearchived
OpenIncident→IncidentOpened
ResolveIncident→IncidentResolved
