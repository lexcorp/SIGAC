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
# Volume 04 — Workflows & Event Storming

Este volumen modela cómo fluye el trabajo en SIGAC a lo largo del tiempo.

Secuencia macro:

Agenda/Demanda → Preparación → Búsqueda → Localización / No localización → Preparación final → Entrega/Custodia → Préstamo cuando aplica → Devolución → Recepción → Rearchivo → Cierre.

## Regla editorial

- Evento = algo que ya ocurrió.
- Comando = intención de hacer algo.
- Actor = quien inicia o ejecuta una acción.
- Política = regla que reacciona a un evento.
- Read Model = información que ayuda a decidir.
- Hotspot = duda, excepción o conflicto pendiente.

Este volumen describe workflows de negocio, no endpoints ni tablas.
