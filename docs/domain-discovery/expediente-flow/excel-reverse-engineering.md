# Ingeniería inversa del Excel operativo

## Evidencia directa

Libro analizado: `/home/admin/Documentos/Formato General Archivo Clinico 2.1.xlsm`, SHA-256 registrado en `source-map.md`. La revisión se hizo sobre Open XML y agregados; no se copiaron registros personales.

- `[AS-IS]` 19 hojas, 5 tablas estructuradas y proyecto VBA.
- `BASE DE REGISTROS`: 419 citas desde la fila 16, 34 nombres de médico distintos y 22 servicios distintos.
- `TurnosMedicos`: 95 asignaciones: 52 MATUTINO, 29 VESPERTINO y 14 FIN DE SEMANA.
- `NumEmpleados`: 190 registros de configuración bajo especialidad, médico y código de empleado.
- `MedicosCodigo`: aproximadamente 273 médicos con clave, unidad, servicio, horario, cédula, tipo y otros atributos.
- `ServicioCodigos`: 101 filas incluyendo encabezado, con código y servicio.
- Salidas detectadas por patrón de Expediente: 219 MATUTINO y 180 VESPERTINO; 20 de 419 no aparecen en esas salidas.
- `[AS-IS]` 18 faltantes se atribuyen en la revisión a espacios internos distintos en un nombre; 2 a médico existente sin turno válido.

El porcentaje observado es 399/419 = 95.23 % clasificado y 20/419 = 4.77 % sin salida. Es una medición de una muestra, no un SLA.

## Golden/Regression Dataset strategy

El libro real puede ser referencia controlada para comprobar agregados y casos, pero no debe entrar al repositorio ni ejecutarse como fixture por contener datos personales. La estrategia candidata es:

1. conservar externamente hash, fecha de análisis y métricas agregadas del original;
2. representar cada característica mediante fixtures sintéticos pequeños;
3. probar que `recibidos = resultados explícitos` sin exigir que todos sean clasificados;
4. cubrir por separado duplicado, reconciliación, layout incompatible, resolución por espacios, cero/múltiples candidatos, médico sin turno, fin de semana y vacío;
5. no usar nombres, contactos, correos, folios, Expedientes ni datos clínicos reales.

Read model métrico candidato: recibidos, clasificados, incidencias y porcentaje automático/revisión. Fórmula y términos requieren validación; los valores 419/399/20/95.23 %/4.77 % sólo describen esta muestra.

## Fuentes superpuestas y deuda técnica

`CODIGO MEDICOS → NumEmpleados → TurnosMedicos → bloques preconfigurados MATUTINO/VESPERTINO → lógica VBA histórica`.

Dos médicos que no figuran en `TurnosMedicos` aparecen correctamente en VESPERTINO según la revisión. Esto prueba mecanismos superpuestos, pero no permite inferir cuál debe prevalecer. `[TO-BE]` Se propone una fuente autoritativa tenant-scoped para médico + servicio/especialidad + turno; su ownership y mantenimiento siguen abiertos.

## Business rule frente a restricción Excel

| Comportamiento observado | Clasificación | Tratamiento candidato | Evidencia |
|---|---|---|---|
| Agrupar por médico | `[BUSINESS RULE]` supported | Conservar como agrupación/read model. | Guía, SM10-1 y salida. |
| Ordenar citas cronológicamente | `[BUSINESS RULE]` supported | Conservar. | Guía y salida. |
| Clasificar por turno configurado | `[BUSINESS RULE]` candidate | Validar con Archivo; no inferir sólo por hora. | `TurnosMedicos` y casos observados. |
| Agrupar por servicio/especialidad | `[BUSINESS RULE]` candidate | Conservar sólo tras definir ambos conceptos. | Salida y SM10-1. |
| Bloques físicos de ~30 filas por médico | `[TECHNICAL CONSTRAINT]` | Eliminar; no migrar. | Layout MATUTINO/VESPERTINO y VBA histórico. |
| Hojas MATUTINO/VESPERTINO | `[TECHNICAL CONSTRAINT]` | No modelar como entidades; usar vistas/filtros por turno. | Libro. |
| Copiar registros entre hojas | `[TECHNICAL CONSTRAINT]` | No migrar; una cita conserva asociación. | Libro/VBA. |
| Comparar nombres con `Trim/UCase` | `[TECHNICAL CONSTRAINT]` defectuosa | Sustituir por resolución explícita, sin definir algoritmo aún. | Incidencia de espacios. |
| Omitir registros no resueltos | Comportamiento defectuoso | Eliminar; todo registro debe tener resultado explícito. | 20 registros sin salida. |

## Identidad y resolución de médico

`[SUPPORTED]` Nombre de médico no es identificador estable. Estrategia conceptual a validar:

1. Resolver por identificador estable disponible y tenant-scoped (número de empleado/código/`medicoId`).
2. Si no existe, usar comparación normalizada sólo como fallback controlado.
3. Conservar valor original, valor normalizado y entidad resuelta.
4. Si hay cero o varios candidatos, no asociar silenciosamente.

Normalización candidata: Unicode acordado, case folding, trim, colapso de espacios múltiples y tratamiento explícito de acentos. `[OPEN QUESTION]` Ninguna transformación ni precedencia está aprobada todavía.

## Turno y asignación operacional

`Turno` es un concepto configurable; MATUTINO, VESPERTINO y FIN DE SEMANA son valores observados, no universo cerrado. Hora/fecha no sustituyen la asignación. `AsignacionMedicoServicioTurno` es candidato tenant-scoped; no se diseña su tabla ni Aggregate todavía. Servicio, especialidad, consultorio, destino físico y turno permanecen conceptos separados.

## Incidencias candidatas

Médico no identificado, médico sin turno, servicio no resuelto, múltiples médicos candidatos, registro duplicado, formato inválido, layout incompatible y Expediente no resuelto. Los nombres no son enums definitivos. Principio candidato: ningún registro desaparece; termina procesado, pendiente, incidencia, duplicado, ignorado justificadamente o error.

## DD-EW-001 — identidad de importación

Se distinguen:

- archivo físico: bytes/nombre/checksum;
- Agenda lógica: tenant + fecha o periodo de agenda, sujeto a validación;
- importación: ejecución concreta con actor, instante, archivo y resultado;
- cita: registro de negocio cuya llave estable no está confirmada;
- registro crudo: fila y payload tal como fueron recibidos.

`ImportacionAgenda` es candidato con id, tenant, referencia segura al archivo, fecha de importación, actor, fecha/periodo de Agenda, conteos, incidencias y estado. Checksum detecta igualdad binaria, no identidad de negocio. `RegistroImportadoAgenda` puede mezclar evidencia técnica y resultado de dominio; debe separarse conceptualmente en raw evidence inmutable y resolución/procesamiento mutable antes de decidir persistencia.

Nueva evidencia: Agenda lógica tenant + fecha; el archivo diario contiene múltiples bloques médico/Servicio y `FOLIO` identifica la cita. Estado: **RESOLVED** para el primer slice.

## DD-EW-002 — idempotencia

Casos distintos: mismo archivo binario, mismo contenido con otro nombre, misma Agenda lógica exportada igual y nueva versión de la misma Agenda. Decisión: sin diferencias se informa que ya fue importada; con diferencias se reconcilia/actualiza la importación previa. Checksum puede apoyar la comparación técnica, pero no es identidad de negocio. Estado: **RESOLVED**.

## DD-EW-003 — reconciliación

| Cambio entre exportaciones | Identidad | Resultado aprobado | Semántica |
|---|---|---|---|
| Nueva cita | FOLIO nuevo | ADD | Incorporar a Agenda vigente. |
| Cita modificada | Mismo FOLIO | UPDATE | Actualizar sólo campos permitidos y conservar trazabilidad. |
| Cita idéntica | Mismo FOLIO | UNCHANGED | No modificar. |
| Cita desaparecida | FOLIO antes presente, ahora ausente | `RETIRADA_DE_AGENDA` | Sale de preparación, conserva historia y no implica cancelación clínica. |
| Cita reaparecida | Mismo FOLIO retirado | RESTORE conceptual | Reactivar/restaurar la misma identidad. |

Estado: **RESOLVED**. La state machine y los nombres técnicos se difieren al diseño futuro.

## DD-EW-004 — conceptos de destino

- Servicio: campo/catálogo observado.
- Especialidad: equivalente operacionalmente a Servicio en este proceso; no se generaliza fuera del contexto.
- Médico: persona/referencia operacional, no nombre como llave.
- Consultorio: requerido por el procedimiento, sin columna inequívoca en Agenda.
- Destino físico: lugar de entrega, no necesariamente Servicio o consultorio.
- Turno: clasificación/configuración operacional.

Servicio y Especialidad son equivalentes operacionalmente para Agenda. Consultorio/destino y Turno no están presentes explícitamente y se excluyen del primer slice. Estado: **RESOLVED** dentro de ese alcance.

## DD-EW-005 — layout y versionado

La Agenda `.xls` previa es HTML exportado; el `.xlsm` es Open XML con `BASE DE REGISTROS` de A:S, encabezados en dos niveles, datos desde fila 16, filas especiales y bloques médico/servicio. Un `AgendaLayoutFingerprint` candidato puede describir tipo físico, encabezados requeridos, posición/estructura y versión detectada, sin ser aún contrato.

Compatibilidad estructural, validez de contenido y validez de negocio son controles distintos. El primer slice soportará el layout observado: HTML `.xls`, fecha/unidad, encabezados de cita y bloques `Médico:`/`Servicio:`. Ante otro layout: fail closed e incidencia; nunca interpretar silenciosamente columnas desplazadas. Estado: **RESOLVED** para requirements; fingerprints concretos son diseño posterior.

## DD-EW-006 — minimización

| Campo | Disponible | Finalidad/matching | Preparación/UI | Persistencia candidata | Sensibilidad/decisión |
|---|---|---|---|---|---|
| No. cita | Sí | identidad candidata | trazabilidad | posiblemente sí | confirmar estabilidad |
| Fecha cita | Sí | Agenda/reconciliación | sí | sí, mínima | operacional |
| Hora cita | Sí | orden | sí | sí | operacional |
| Folio | Sí | correlación candidata | no necesariamente | pendiente | no asumir identidad |
| Expediente + tipo/No. | Sí | resolver Expediente | sí | referencia mínima | identificador personal; conservar formato completo sin asumir unicidad |
| Nombre | Sí | referencia operativa/desambiguación | sí, confirmado para lista | proyección minimizada | dato personal; acceso restringido |
| Contacto | Sí | sin finalidad de archivo demostrada | no | no | dato personal; transitorio/descartar |
| Vigencia | Sí | no demostrada para preparación | no | no | dato administrativo sensible |
| Sexo/edad | Sí | no demostrada | no | no | personales; descartar |
| Primera/subsecuente | Sí | aparece en SM10-1 | sí, confirmado para lista | mínimo requerido | no inferir otros datos clínicos |
| Médico | Sí | resolución/agrupación | sí | referencia + original controlado | nombre personal; preferir id estable |
| Servicio | Sí | resolución/agrupación | sí | referencia/código | definir frente a especialidad |
| CURP | No observado en Agenda | ninguna en este slice | no | no | no incorporarlo |
| Payload original | Sí | trazabilidad/reproceso | no | retención por decidir | requiere cifrado, acceso y plazo; no equivale a dominio normalizado |

La lista inicial conserva nombre, Expediente, tipo de derechohabiente, primera vez/subsecuente, fecha, hora y médico + Servicio/Especialidad. Contacto, vigencia, sexo, edad y CURP quedan excluidos. El raw sólo puede conservarse bajo política técnica de seguridad/retención que no amplíe el read model. Estado: **RESOLVED** para el primer slice.
