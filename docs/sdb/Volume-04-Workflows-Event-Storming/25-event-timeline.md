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
# Event Timeline — ejemplo conceptual

08:00 AgendaVersionImported
08:03 RequestCreated
08:10 RequestAssigned
08:12 SearchStarted
08:14 ExpedienteLocated
08:18 ExpedientePrepared
09:00 CustodyTransferred
09:02 LoanOpened (si aplica)
13:40 ReturnReceived
13:44 LoanClosed
13:50 ExpedienteRearchived

La línea de tiempo es útil para auditoría de negocio y para medir tiempos.
