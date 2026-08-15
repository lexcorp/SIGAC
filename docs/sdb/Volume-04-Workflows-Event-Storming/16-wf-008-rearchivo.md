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
# WF-008 — Rearchivo

## Trigger
Expediente recibido y habilitado para regresar a archivo.

## Secuencia
1. Determinar ubicación física válida.
2. Llevar expediente a ubicación.
3. Confirmar colocación.
4. ConfirmRearchive.
5. Actualizar ubicación actual.
6. Liberar custodia temporal.
7. Cerrar solicitud/jornada cuando corresponda.

## Resultado
Expediente nuevamente disponible en Archivo Clínico.
