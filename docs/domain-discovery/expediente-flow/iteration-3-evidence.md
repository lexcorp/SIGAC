# Iteración 3 — respuestas y Agenda real

## Verificación directa de `AgenConMed_027204ESTA455748.xls`

La inspección fue estructural y agregada; no se reprodujeron personas, contactos, folios ni Expedientes reales.

| Aspecto | Evidencia directa |
|---|---|
| Fecha | 21/08/2026, única fecha encontrada en el snapshot. |
| Citas | 273 filas de cita. |
| Bloques médico/servicio | 22 bloques; cada uno contiene citas de una agenda médico/servicio. |
| Médico | `Médico:` seguido por número de empleado y nombre. Los 22 bloques tienen número; hay 22 números distintos. |
| Servicio | `Servicio:` seguido por código y nombre. Los 22 bloques tienen código; hay 14 códigos distintos. |
| Turno | Ausente: cero etiquetas/campos explícitos. |
| Consultorio | Ausente: cero etiquetas/campos explícitos. |
| Destino | Ausente: cero etiquetas/campos explícitos. |
| Formato | HTML ISO-8859 exportado con extensión `.xls`, 4 tablas y 301 filas no vacías. |

Un archivo corresponde a una fecha concreta y contiene múltiples agendas distinguibles operacionalmente por médico + Servicio/Especialidad. La Agenda lógica del primer slice se considera tenant + fecha; los bloques no son archivos/agregados independientes.

## Respuestas formalizadas

1. `[BUSINESS RULE]` `FOLIO` identifica establemente una cita dentro de SIMEF.
2. `[BUSINESS RULE]` El número de empleado identifica confiablemente al médico, siempre tenant-scoped. El nombre permanece original/descriptivo.
3. `[BUSINESS RULE]` Servicio y Especialidad son equivalentes operacionalmente en este proceso. Esto no establece equivalencia universal fuera del contexto Agenda.
4. `[BUSINESS RULE]` Reimportación sin diferencias informa “ya importada”; con diferencias actualiza/reconcilia por FOLIO.
5. `[BUSINESS RULE]` La lista inicial conserva nombre, Expediente, tipo de derechohabiente, primera vez/subsecuente, fecha, hora y médico + Servicio/Especialidad.
6. `[BUSINESS RULE]` Atención fuera de Agenda/cita abierta queda fuera de spec 002.

Para el primer slice, SIMEF es la fuente autoritativa de la cita, FOLIO, médico/número de empleado y Servicio/Especialidad tal como aparecen en el snapshot. Los catálogos del `.xlsm` son implementación AS-IS y no prevalecen sobre esos datos. Esta regla no convierte a SIMEF en fuente de Turno, porque dicho campo no está presente.

## NEW-EVIDENCE-GAP

| Gap | Respuesta | Archivo real | Clasificación final |
|---|---|---|---|
| `NEW-EVIDENCE-GAP-001` Turno | El cuestionario dice que la Agenda contiene Turno. | No hay campo/etiqueta Turno. El `.xlsm` posee `ROL MEDICOS/TurnosMedicos`. | Turno es configurable/derivable fuera de SIMEF; no se cierra su algoritmo. Fuera del primer slice. |
| `NEW-EVIDENCE-GAP-002` Consultorio/destino | El cuestionario dice que sale de Servicio/Especialidad + médico y que la Agenda lo trae. | No hay campo/etiqueta Consultorio o Destino. | Dato ausente; una regla de derivación podría existir, pero no está demostrada. Fuera del primer slice. |

Clasificación explícita:

- Dato presente: fecha, FOLIO, médico con número/nombre, Servicio con código/nombre y campos de cita.
- Dato configurable/derivable: Turno mediante configuración operacional; consultorio/destino sólo como afirmación pendiente de fuente/regla.
- Dato ausente: Turno, Consultorio y Destino como columnas/campos explícitos del snapshot.

## Turno

SIMEF no lo proporciona explícitamente en el archivo observado. Tampoco se aprueba derivarlo de la hora. El mecanismo AS-IS comprobable es configuración en `ROL MEDICOS/TurnosMedicos`, con mecanismos históricos superpuestos. Para spec 002 inicial no es indispensable: importar, validar, resolver médico por número de empleado y producir la lista confirmada puede hacerse sin turno. Su diseño queda para una decisión posterior.

## Consultorio/destino

No es campo explícito y no forma parte de la lista mínima confirmada. Se excluye formalmente del primer slice. No bloquea spec 002 y no se deriva silenciosamente de médico o Servicio/Especialidad.

## Reconciliación por FOLIO

| Snapshot A → B | Regla confirmada |
|---|---|
| FOLIO nuevo | Agregar cita. |
| Mismo FOLIO sin cambios | Informar que ya fue importada/sin cambios. |
| Mismo FOLIO con hora, médico, Servicio/Especialidad, Expediente u otro campo modificado | Actualizar/reconciliar conservando trazabilidad de revisión. |
| FOLIO duplicado dentro del mismo snapshot | Incidencia explícita; no asociación silenciosa. |
| FOLIO presente en A y ausente en B | `RETIRADA_DE_AGENDA`: retirar de preparación vigente, conservar historia y no inferir cancelación clínica. |
| FOLIO retirado que reaparece | Restaurar/reactivar conceptualmente la misma cita por FOLIO; no crear identidad nueva. |

Decisión cerrada: **“ausencia en snapshot posterior” no equivale a “cancelación clínica confirmada”**. `RETIRADA_DE_AGENDA` es lenguaje de reconciliación y no un diseño definitivo de state machine.

## `ATENCION_FUERA_DE_AGENDA`

Nombre conceptual para un flujo distinto. Las hojas especiales del `.xlsm` evidencian atención operativa fuera de la Agenda, pero no establecen reglas suficientes. Queda fuera de spec 002; no es estado, enum, Aggregate ni endpoint aprobado.
