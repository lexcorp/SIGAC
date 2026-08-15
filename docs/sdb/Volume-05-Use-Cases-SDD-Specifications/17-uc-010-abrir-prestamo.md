---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: FuenteHabilitanteSalida"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-010 — Abrir Préstamo

## Objetivo
Formalizar una salida que requiera préstamo, evaluando la fuente habilitante aplicable.

## Flujo
1. Determinar `FuenteHabilitanteSalida` del contexto de la operación:
   - `CONSULTA_PROGRAMADA`: no requiere autorización individual adicional.
   - `VALE_ARCHIVO_SM_1_14`: la fuente llega previamente validada; `DIRECCION` o
     `COORDINACION_MEDICA` emite/autoriza y `ARCHIVISTA` o `ARCHIVO_JEFE` ejecuta
     con `LOAN_OPEN`; registrar referencia del formato SM 1-14.
   - `ORDEN_SUPERIOR`: no habilita OpenLoan en este slice (fail-closed).
2. Validar tipo de solicitud y autorización según la fuente.
3. Validar que el expediente está disponible para préstamo (`EstadoOperativo` compatible).
4. Registrar solicitante, custodio, finalidad y `FuenteHabilitanteSalida`.
5. Aplicar `LoanDeadlinePolicy` según fuente habilitante y política configurable.
6. Crear préstamo Activo.
7. Emitir `LoanOpened`.

## Regla de autorización
`subject + permission + tenant + resource + business context + enabling source`

No existe la regla "cualquier médico puede solicitar" (BIZ-016, BR-018).
Emitir o autorizar SM 1-14 no concede `LOAN_OPEN` al emisor.

## Notas
- 24h es la política observada para `VALE_ARCHIVO_SM_1_14`, no constante universal.
- Si el plazo de `VALE_ARCHIVO_SM_1_14` vence y se requiere más tiempo, se genera
  un nuevo formato/préstamo.
- `OpenLoan` aplica optimistic locking (`row_version`) — acción crítica (DAT-019).

## Fuente
BIZ-010, BIZ-016, DDD-010, WF-006, DECISION-REGISTER OQ-EW-005.
