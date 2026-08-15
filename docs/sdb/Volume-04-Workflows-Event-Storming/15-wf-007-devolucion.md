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
# WF-007 — Devolución

## Trigger
Expediente regresa físicamente a Archivo Clínico.

## Secuencia
1. Identificar expediente.
2. ReceiveReturn.
3. Registrar quien devuelve.
4. Registrar quien recibe.
5. Registrar fecha/hora.
6. Localizar préstamo/vale/control relacionado.
7. Verificar condición según facultades.
8. Registrar observación/incidencia si procede.
9. Cerrar préstamo cuando corresponda.
10. Pasar a rearchivo.

## Importante
Devuelto != Archivado.
