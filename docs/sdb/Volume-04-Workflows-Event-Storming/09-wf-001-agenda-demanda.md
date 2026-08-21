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
# WF-001 — Agenda & Demanda

## Trigger
Disponibilidad de una nueva lista/agenda para una fecha futura.

## Happy Path
1. Jefatura/usuario importa agenda.
2. Sistema valida formato.
3. Se registra versión de agenda.
4. Se detectan citas relevantes.
5. Se crean demandas/solicitudes sin duplicar existentes.
6. Se agrupan por jornada, especialidad, consultorio y hora.
7. Se muestra cola de preparación.

## Variantes
- importación repetida;
- citas añadidas;
- cambios de consultorio/hora;
- cancelaciones;
- registros incompletos.

## Resultado
Jornada preparada para iniciar búsqueda.

Agenda Preparation inicial termina en lista, no Jornada/paquetes. Reconciliación produce
ADDED/UPDATED/UNCHANGED/RESTORED por fila y RETIRADA_DE_AGENDA para Cita previa ausente.
Incidencias locales no abortan otras filas. Turno/Consultorio/cancelación quedan fuera.

Dentro del snapshot ya reconciliable, Agenda valida atómicamente FOLIO único y fecha
compatible antes de mutar. Un snapshot vacío retira todas las Citas activas; una retirada
permanece almacenada y una reaparición reactiva la misma identidad. T-03 no emite Domain
Events de reconciliación.
