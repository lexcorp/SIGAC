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
# WF-002 — Preparación

## Trigger
Existencia de demanda para una jornada.

## Happy Path
1. Archivista visualiza ítems pendientes.
2. Toma/asume lote o solicitud.
3. Inicia búsqueda.
4. Localiza expediente.
5. Verifica coincidencia de identidad.
6. Marca localizado.
7. Ordena por horario/consultorio.
8. Integra paquete/carrito.
9. Marca preparado.

## Resultado
Expediente listo para entrega.

## Reglas
No marcar Preparado si no se ha localizado o existe excepción formal.
