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
# ES-001 — Big Picture Event Storming

```mermaid
flowchart LR
 A[Agenda publicada/importada] --> B[Demanda creada]
 B --> C[Solicitud creada]
 C --> D[Solicitud asignada]
 D --> E[Búsqueda iniciada]
 E --> F{¿Expediente localizado?}
 F -->|Sí| G[Expediente localizado]
 F -->|No| H[Expediente no localizado]
 G --> I[Expediente preparado]
 I --> J[Custodia transferida]
 J --> K{¿Préstamo formal aplica?}
 K -->|Sí| L[Préstamo abierto]
 K -->|No| M[Expediente entregado]
 L --> N[Expediente entregado]
 M --> O[Atención/uso]
 N --> O
 O --> P[Devolución recibida]
 P --> Q[Integridad verificada según facultades]
 Q --> R[Préstamo cerrado si aplica]
 R --> S[Expediente rearchivado]
 H --> T[Incidencia abierta cuando aplique]
 T --> U[Reintento / Escalamiento]
 U --> E
```

## Hotspots principales
- diferencia entre entrega y préstamo;
- inicio exacto de custodia externa;
- momento en que “no localizado” escala;
- definición de TOMO/Provisional;
- tratamiento de citas añadidas después de preparación.
