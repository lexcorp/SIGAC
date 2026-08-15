---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: columna préstamo actualizada con FuenteHabilitanteSalida"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# Permission × Action Matrix — Candidate

| Acción | Archivo | Jefatura | Receptor Servicio | Coord. Médica | Dirección | TI |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Crear solicitud | C* | C* | C* | C* | C* | No |
| Asignar | Sí | Sí | No | No | No | No |
| Buscar/Localizar | Sí | Sí | No | No | No | No |
| Dispatch (DispatchExpediente) | Sí | Sí | No | No | No | No |
| Aceptar custodia (AcceptCustody) | No | No | Sí | No | No | No |
| Transferir custodia | Sí | Sí | Recibir* | No | No | No |
| Abrir préstamo — CONSULTA_PROGRAMADA | Sí | Sí | No | No | No | No |
| Abrir préstamo — VALE_ARCHIVO_SM_1_14 | Ejecutar | Ejecutar | No | Emitir vale | Emitir vale | No |
| Abrir préstamo — ORDEN_SUPERIOR | [pendiente] | [pendiente] | No | [pendiente] | [pendiente] | No |
| Renovar préstamo | Sí* | Sí | No | C* | C* | No |
| Recibir devolución | Sí | Sí | Entregar* | No | No | No |
| Resolver incidencia | Sí* | Sí | No | C* | C* | No |
| Ver auditoría | Limitado | Sí | No | No | No | Condicional |
| Configurar sistema | No | C | No | No | No | Sí |

`*` sujeto a tipología/autorización confirmada.
`C` condicional según contexto.

## Notas (2026-08-14)

- La autorización de `OpenLoan` depende de `FuenteHabilitanteSalida`, no de un
  permiso universal de rol. Ver BIZ-016, BIZ-010, DECISION-REGISTER OQ-EW-005.
- `AcceptCustody` es ejecutada por el receptor autorizado en destino (Enfermería
  o médico/solicitante). No por Archivo. Ver WF-005, DDD-018.
- Esta matriz es orientativa de UX. SEC-017 (Volume 07) es la autoridad para RBAC/ABAC.
- Pendiente: detalles de `ORDEN_SUPERIOR` como fuente habilitante.
