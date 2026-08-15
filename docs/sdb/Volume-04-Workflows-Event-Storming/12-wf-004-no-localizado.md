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
# WF-004 — Expediente No Localizado

## Trigger
No aparece en ubicación esperada.

## Secuencia candidata
1. MarkNotLocated.
2. Registrar ubicación buscada y actor.
3. Consultar préstamos/custodia/historial.
4. Revisar ubicaciones alternas autorizadas.
5. Reintentar búsqueda.
6. Si persiste, abrir incidencia según política.
7. Escalar a Jefatura/Coordinación cuando corresponda.
8. Mantener Solicitud trazable.
9. No declarar Extraviado automáticamente.

## Resultado
Localizado en reintento o Incidencia abierta.
