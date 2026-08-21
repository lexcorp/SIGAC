---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.1.0"
status: "Draft for workflow validation"
date: "2026-08-13"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# ES-004 — Domain Events

AgendaImported
AgendaReconciled (candidate DEFERRED para T-03)
CitaWithdrawnFromAgenda (candidate DEFERRED para T-03)
CitaRestored (candidate DEFERRED para T-03)
DemandDetected
RequestCreated
RequestAssigned
SearchStarted
ExpedienteLocated
ExpedienteNotLocated
ExpedientePrepared
CustodyTransferred
LoanOpened
LoanRenewed
LoanExpired
ExpedienteDelivered
ReturnReceived
ReturnConditionChecked
LoanClosed
ExpedienteRearchived
IncidentOpened
IncidentEscalated
IncidentResolved
ExpedienteDeclaredLost
RequestCancelled

AGD-AP-007 determina que T-03 no emite estos candidatos hasta aprobar payload y
temporalidad. No se crea evento por ADD, UPDATE, métrica o incidencia. Retirada no
equivale a cancelación clínica.
