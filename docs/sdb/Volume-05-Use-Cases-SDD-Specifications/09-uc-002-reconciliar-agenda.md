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
# UC-002 — Reconciliar Agenda

La reconciliación automática pertenece a importar/reimportar y exige `AGENDA_IMPORT`;
no introduce permission ni capability separada. No existe command manual de resolución
de incidencias en el slice inicial.

La reconciliación forma parte de la UoW síncrona de ImportAgenda y no confirma estado
parcial. Una key nueva con artefacto idéntico crea ImportacionAgenda trazable
`ALREADY_IMPORTED` sin mutar Agenda/Cita.

Cita previa ausente produce RETIRADA_DE_AGENDA como lifecycle/reconciliation effect y
métrica, no resultado de fila. Reaparición produce RESTORED sobre la misma Cita.

## Objetivo
Detectar diferencias entre versiones de agenda.

## Flujo
1. Comparar versión nueva vs última aceptada.
2. Clasificar altas, bajas y modificaciones.
3. Detectar citas añadidas después de preparación.
4. Crear demanda nueva cuando corresponda.
5. No eliminar silenciosamente trabajo ya ejecutado.
6. Registrar AgendaReconciled.

## Acceptance
Given una jornada con 12 citas preparadas
And una nueva versión contiene 15
When se reconcilia
Then se detectan 3 altas
And se crean 3 demandas nuevas
And las 12 existentes no se duplican.
