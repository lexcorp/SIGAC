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
# Actor Responsibility Matrix

| Acción | Archivo | Jefatura | Traslado | Receptor servicio | Coord. Médica | Dirección |
|---|---|---|---|---|---|---|
| Importar agenda | R/A | A | - | - | - | - |
| Buscar | R | A | - | - | - | - |
| Marcar no localizado | R | A | - | - | C | - |
| Transferir custodia | R | A | R* | R* | - | - |
| Abrir préstamo | R | A | - | C | C* | C* |
| Recibir devolución | R | A | R* | R* | - | - |
| Declarar extraviado | C | A? | - | - | C | A? |

`*` depende del flujo local. Pendiente validar.
