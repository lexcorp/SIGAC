---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: FR-LOAN-007 autorización por fuente"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# SPEC-006 — Préstamo

FR-LOAN-001 Abrir préstamo con `FuenteHabilitanteSalida` válida.
FR-LOAN-002 Calcular vencimiento por `LoanDeadlinePolicy` según fuente y configuración.
FR-LOAN-003 Consultar préstamos activos.
FR-LOAN-004 Detectar préstamos vencidos.
FR-LOAN-005 Renovar préstamo (según política y fuente habilitante).
FR-LOAN-006 Cerrar préstamo.
FR-LOAN-007 Validar autorización según `FuenteHabilitanteSalida`:
  - `CONSULTA_PROGRAMADA`: no requiere autorización individual adicional por expediente.
  - `VALE_ARCHIVO_SM_1_14`: fuente previamente validada, emitida/autorizada por
    `DIRECCION` o `COORDINACION_MEDICA`; ejecución por `ARCHIVISTA` o
    `ARCHIVO_JEFE` con `LOAN_OPEN`; registrar referencia del formato.
  - `ORDEN_SUPERIOR`: fail-closed; no habilita OpenLoan en este slice.

```gherkin
Scenario: Préstamo por consulta programada
  Given el tipo de salida es CONSULTA_PROGRAMADA
  When se abre el préstamo
  Then queda Activo
  And se calcula fecha límite según LoanDeadlinePolicy
  And no se requiere autorización individual adicional

Scenario: Préstamo extraordinario por SM 1-14
  Given el tipo de salida es VALE_ARCHIVO_SM_1_14
  And la fuente fue emitida/autorizada por DIRECCION o COORDINACION_MEDICA
  And el ejecutante es ARCHIVISTA o ARCHIVO_JEFE con LOAN_OPEN
  When se abre el préstamo
  Then queda Activo con plazo máximo de 24 horas
  And se registra la referencia del formato SM 1-14

Scenario: Intento de préstamo sin fuente habilitante válida
  Given el actor no está facultado para la fuente habilitante indicada
  When intenta abrir el préstamo
  Then el sistema rechaza la operación con error de autorización

Scenario: Préstamo SM 1-14 vencido que requiere extensión
  Given un préstamo VALE_ARCHIVO_SM_1_14 vencido
  When se requiere más tiempo
  Then se genera un nuevo formato/préstamo
  And no se renueva el préstamo vencido
```

## Fuente
BIZ-010, UC-010, WF-006, DECISION-REGISTER OQ-EW-005.
