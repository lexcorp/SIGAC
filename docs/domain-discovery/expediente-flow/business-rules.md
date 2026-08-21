# Reglas preliminares RN-001..RN-020

Estados: `CONFIRMED` = fuente autoritativa; `SUPPORTED` = varias evidencias consistentes; `CANDIDATE` = plausible, requiere negocio; `OPEN` = definición insuficiente; `CONTRADICTED` = evidencia contraria.

| RN | Regla resumida | Estado | Fuente/justificación |
|---|---|---|---|
| RN-001 | Una Agenda diaria tenant-scoped contiene múltiples bloques médico/Servicio para una fecha. | CONFIRMED | Cuestionario y snapshot 21/08/2026. |
| RN-002 | Conservar identificador completo de Expediente, incluido tipo. | SUPPORTED | Agenda/SM10-1; semántica de columnas E/F/G requiere validación. |
| RN-003 | Cada cita se relaciona con médico por número de empleado o queda pendiente. | CONFIRMED | Identificador confirmado por negocio; Agenda lo incluye por bloque. |
| RN-004 | Debe resolverse relación válida médico–Servicio/Especialidad, equivalentes en este proceso. | CONFIRMED | Cuestionario y bloques Agenda. |
| RN-005 | Médico puede tener asignación operacional de turno. | SUPPORTED | `TurnosMedicos`; vigencia/cardinalidad abiertas. |
| RN-006 | Turno no se infiere sólo de la hora; su fuente exacta sigue sin resolver. | OPEN | Agenda no trae Turno; `.xlsm` usa configuración superpuesta. Fuera del primer slice. |
| RN-007 | Consultar/agrupar turno→servicio/especialidad→médico→hora. | CANDIDATE | Salida Excel y operación; orden jerárquico exacto requiere negocio. |
| RN-008 | Citas del mismo médico se ordenan cronológicamente. | SUPPORTED | Guía exige orden de horario y salida lo implementa. |
| RN-009 | Conservar primera vez/subsecuente en la lista inicial. | CONFIRMED | Respuesta de Archivo Clínico. |
| RN-010 | Médico sin configuración no puede desaparecer; genera resultado explícito. | CANDIDATE | Defecto observado y objetivo de trazabilidad. |
| RN-011 | Identidad tenant-scoped de médico es número de empleado; el nombre no es llave. | CONFIRMED | Respuesta de negocio y Agenda. |
| RN-012 | Variaciones de representación no causan pérdida silenciosa. | CANDIDATE | Espacios confirmados; acentos/Unicode no probados aún. |
| RN-013 | Conservar representación original para trazabilidad. | CANDIDATE | Necesario para explicar/reprocesar; retención y seguridad abiertas. |
| RN-014 | Todo registro termina con resultado explícito. | CANDIDATE | Principio de seguridad operacional; vocabulario final abierto. |
| RN-015 | Médico no resuelto inequívocamente queda para revisión. | CANDIDATE | Evita asociación errónea; workflow de revisión abierto. |
| RN-016 | Médico sin turno produce incidencia explícita. | CANDIDATE | Caso de 2 citas; lenguaje y resolución pendientes. |
| RN-017 | Turnos son configurables, no limitados estructuralmente a dos. | SUPPORTED | Tres valores observados y separación de hojas técnica. |
| RN-018 | Una fuente autoritativa tenant-scoped para asignación. | CANDIDATE | Deuda técnica demostrada; ownership aún abierto. |
| RN-019 | Normalización no destruye el dato original. | CANDIDATE | Trazabilidad; política de raw abierta. |
| RN-020 | No asociar automáticamente ante múltiples candidatos. | CANDIDATE | Principio de seguridad; caso múltiple debe validarse con fixture/negocio. |

Ninguna RN es requirement definitivo. No hay RN `CONTRADICTED`; RN-002, RN-006 y RN-009 necesitan precisión antes de promoverse.

## Decisión aprobada de reconciliación

- FOLIO nuevo: incorporar a la Agenda vigente.
- FOLIO existente modificado: actualizar únicamente campos permitidos por el futuro modelo de Agenda.
- FOLIO existente idéntico: reconocer que no hubo cambio.
- FOLIO antes presente y ahora ausente: `RETIRADA_DE_AGENDA`; sale de la preparación vigente y conserva evidencia histórica.
- FOLIO retirado que reaparece: restaurar/reactivar conceptualmente la misma identidad mediante reconciliación.

`RETIRADA_DE_AGENDA` no significa cancelación clínica confirmada y no autoriza una state machine adicional en discovery.
