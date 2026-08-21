# Spec 002 readiness — iteración 3

## Evidencia cruzada

- `.xlsm`: 419 citas, 399 salidas, 20 omisiones y configuración histórica superpuesta.
- Agenda SIMEF del 21/08/2026: 273 citas y 22 bloques médico/Servicio, con FOLIO, número de empleado y código de Servicio; sin Turno, Consultorio o Destino explícitos.
- Cuestionario: decisiones de identidad, reimportación, equivalencia Servicio/Especialidad y campos mínimos.

## DD-EW-001..006

| Pregunta | Estado | Cerrado/acotado | Bloqueo restante |
|---|---|---|---|
| DD-EW-001 Identidad | RESOLVED | Agenda tenant + fecha; cita por FOLIO; médico por número de empleado tenant-scoped. | Ninguno para requirements. |
| DD-EW-002 Idempotencia | RESOLVED | Sin diferencias: informar ya importada. Con diferencias: reconciliar/actualizar. | Técnica de comparación pertenece al diseño. |
| DD-EW-003 Reconciliación | RESOLVED | ADD, UPDATE, UNCHANGED, `RETIRADA_DE_AGENDA` y restauración conceptual por FOLIO. | Ninguno para requirements. |
| DD-EW-004 Servicio/destino | RESOLVED | Servicio=Especialidad en este proceso; Turno y consultorio/destino fuera del slice. | `NEW-EVIDENCE-GAP` no bloqueante registrado. |
| DD-EW-005 Layout | RESOLVED | Primer slice soporta HTML `.xls` observado y falla cerrado ante incompatibilidad. | Fingerprint concreto es diseño. |
| DD-EW-006 Minimización | RESOLVED | Lista mínima y exclusiones confirmadas. | Política raw se define sin ampliar el contrato funcional. |

## Scope inicial acotado

Incluye importar snapshot diario, validar layout, resolver cita por FOLIO, resolver médico por número de empleado, conservar Servicio/Especialidad y producir lista inicial minimizada. Excluye Turno, consultorio/destino, paquetes, SM10-1 completo y `ATENCION_FUERA_DE_AGENDA`.

No quedan blockers de negocio para el alcance inicial. Turno, consultorio/destino y `ATENCION_FUERA_DE_AGENDA` continúan fuera y no bloquean.

`remaining_business_questions: 0`.

`implementation_ready_for_spec_002: true`.
