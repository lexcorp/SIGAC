---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.2.0"
status: "Draft for workflow validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: FuenteHabilitanteSalida en validación"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# WF-006 — Préstamo

## Trigger
Tipo de salida que requiere préstamo formal con `FuenteHabilitanteSalida` válida.

## Secuencia
1. Determinar `FuenteHabilitanteSalida` de la solicitud/salida:
   - `CONSULTA_PROGRAMADA`: continúa sin autorización individual adicional.
   - `VALE_ARCHIVO_SM_1_14`: verificar que el actor emisor es Director, Subdirector
     o Coordinación Médica; registrar referencia del formato SM 1-14.
   - `ORDEN_SUPERIOR`: verificar fuente; detalles de validación pendientes de spec.
2. Validar que el expediente está disponible para préstamo.
3. `OpenLoan` con fuente habilitante, solicitante, custodio y finalidad.
4. Registrar solicitante, custodio, finalidad y destino.
5. Aplicar `LoanDeadlinePolicy` según fuente:
   - `VALE_ARCHIVO_SM_1_14`: plazo máximo 24 horas.
   - Otras fuentes: según política configurable.
6. Asociar evidencia/formato cuando aplique (ej. número de SM 1-14).
7. Marcar préstamo Activo → emitir `LoanOpened`.
8. Monitorear vencimiento.

## Excepciones
Hospitalización, trámites y otras causas autorizadas pueden modificar plazo/política
según `LoanDeadlinePolicy` configurable (no es constante universal).

Si el plazo de `VALE_ARCHIVO_SM_1_14` vence y se requiere más tiempo, se genera
un nuevo formato/préstamo; no se renueva el mismo.

## Fuente
SRC-GUIA, SRC-INT-003, DECISION-REGISTER OQ-EW-005.
