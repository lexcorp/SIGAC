---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-022 — Domain Event Flow
```mermaid
flowchart TD
 A[AgendaImported / AgendaReconciled — integración futura] --> B[RequestCreated]
 B --> C[RequestAssigned]
 C --> D[SearchStarted]
 D --> E{Localizado?}
 E -->|Sí| F[ExpedienteLocated]
 E -->|No| G[ExpedienteNotLocated]
 F --> H[ExpedientePrepared]
 H --> I[CustodyTransferred]
 I --> J[LoanOpened cuando aplica]
 J --> K[ReturnReceived]
 K --> L[LoanClosed]
 L --> M[ExpedienteRearchived]
 G --> N[IncidentOpened cuando aplica]
```

AGD-AP-007 difiere `AgendaReconciled` para T-03. Este diagrama conserva únicamente una
integración conceptual futura y no autoriza emisión ni creación de Solicitud en el slice.
