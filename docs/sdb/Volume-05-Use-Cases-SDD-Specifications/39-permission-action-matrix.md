---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.1.0"
status: "Draft for use-case/spec validation"
date: "2026-08-13"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# Permission × Action Matrix — Candidate

| Acción | Archivo | Jefatura | Receptor Servicio | Coord. Médica | Dirección | TI |
|---|---:|---:|---:|---:|---:|---:|
| Crear solicitud | C* | C* | C* | C* | C* | No |
| Asignar | Sí | Sí | No | No | No | No |
| Buscar | Sí | Sí | No | No | No | No |
| Transferir custodia | Sí | Sí | Recibir* | No | No | No |
| Abrir préstamo | Sí* | Sí | No | Autorizar* | Autorizar* | No |
| Recibir devolución | Sí | Sí | Entregar* | No | No | No |
| Resolver incidencia | Sí* | Sí | No | C* | C* | No |
| Configurar sistema | No | C | No | No | No | Sí |

`*` pendiente de tipología/autorización.
