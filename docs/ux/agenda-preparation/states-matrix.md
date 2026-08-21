# States Matrix

## Frame states

| Frame | Loading | Empty | Success variants | Error variants | Pagination |
|---|---|---|---|---|---|
| AP-01 Agenda | summary skeleton | Agenda 404 | existing Agenda | network, 401, 403 | N/A |
| AP-02 Select | N/A | no file | selected | invalid, unsupported, too large | N/A |
| AP-03 Validate | indeterminate | N/A | transition within POST | 400, 413, 415, 422 | N/A |
| AP-04 Process | indeterminate | N/A | transition to result | timeout, failed, network | N/A |
| AP-05 Result | N/A | N/A | imported, already, reconciled | response unavailable | N/A |
| AP-06 Preparation | skeleton | no items | grouped items | network, 401, 403, 404 | load-more/loading/end |
| AP-07 Incidents | skeleton | no incidents | one/multiple | network, 401, 403, 404 | load-more/loading/end |
| AP-08 Import Detail | skeleton | N/A | summary/results | import 404, network, 401/403 | results/incidents independent |

## Empty copy

- Agenda: “No hay una Agenda registrada para esta fecha.”
- Preparación: “No hay registros disponibles en la lista de preparación.”
- Incidencias: “No se detectaron registros que requieran revisión.”
- Historial: “No hay importaciones registradas.”

## WizardStep

`UPCOMING | CURRENT | COMPLETED | ERROR` son sólo UI. El stepper siempre muestra los
cuatro labels. Validar y Procesar forman una única operación técnica; sin señal server no
se simula porcentaje ni avance interno verificable.

## Outcome copy

| Contract | Heading | Supporting meaning |
|---|---|---|
| `IMPORTED` | Agenda importada | Primera Agenda confirmada para la fecha |
| `ALREADY_IMPORTED` | La Agenda ya está actualizada | Sin cambios efectivos |
| `RECONCILED` | Agenda actualizada | Cambios reconciliados y métricas disponibles |

`RETIRADA_DE_AGENDA` se presenta “Retirada de la Agenda” con ayuda: “Esta cita estaba
presente anteriormente y ya no aparece en la Agenda más reciente.” Nunca “Cancelada”.

## Incident copy

| Contract | Visible label |
|---|---|
| `PHYSICIAN_NOT_RESOLVED` | Médico no identificado |
| `PHYSICIAN_AMBIGUOUS` | Coincidencia de médico ambigua |
| `SERVICE_NOT_RESOLVED` | Servicio/Especialidad no identificado |
| `EXPEDIENT_NOT_RESOLVED` | Expediente no identificado |
| `REQUIRED_DATA_MISSING` | Falta un dato requerido |
| `ROW_INCONSISTENT` | Registro inconsistente |
| `DUPLICATE_FOLIO_IN_SNAPSHOT` | FOLIO duplicado |

No hay acciones Resolver, Corregir, Ignorar o Asignar.

## Safe error matrix

| Code | UX response | Retry |
|---|---|---|
| `HTTP_VALIDATION_ERROR` | Revisar selección/datos, sin eco sensible | volver a Seleccionar |
| `AUTHENTICATION_REQUIRED` | aplicar recuperación de sesión del shell | no en wizard |
| `PERMISSION_DENIED` | mensaje seguro; ocultar acción posterior | no |
| `AGENDA_UPLOAD_TOO_LARGE` | informar límite sin filename durable | seleccionar otro |
| `AGENDA_ARTIFACT_UNSUPPORTED` | solicitar Agenda `.xls` SIMEF | seleccionar otro |
| `AGENDA_LAYOUT_REJECTED` | “No se reconoció el formato de la Agenda” | seleccionar otro |
| `IDEMPOTENCY_KEY_REUSED` | conflicto de intento, no “FOLIO duplicado” | pendiente UX-GAP-003 |
| `AGENDA_IMPORT_TIMEOUT` | operación no terminó a tiempo | sin retry automático |
| `AGENDA_IMPORT_FAILED` | no se completó la importación | sin retry automático |
| `AGENDA_IMPORT_NOT_FOUND` | no se encontró la importación | volver a historial |
| `AGENDA_NOT_FOUND` | empty Agenda para fecha consultada | importar si autorizado |
| network/unknown | mensaje genérico seguro | sin prometer estado servidor |

Nunca mostrar stack, parser, HTML, database, tenant interno, raw, fingerprint o PII.
