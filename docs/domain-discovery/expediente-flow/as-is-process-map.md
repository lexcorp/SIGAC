# Mapa de procesos AS-IS

## A. Citas programadas

| Paso | Actor/sistema | Actividad documentada | Evidencia |
|---|---|---|---|
| 1 | SIMEF / Jefatura o personal designado | Se agenda la consulta y se descarga la Agenda de Archivo Clínico, normalmente el día previo. | `[AS-IS]` procedimiento derivado e entrevista; la Guía sólo confirma la programación previa. |
| 2 | Personal de archivo | Procesa y ordena la exportación; la práctica descrita pasó de copiado manual a macros. | `[AS-IS]` procedimiento derivado. |
| 2a | Excel `.xlsm` | Copia/recibe la Agenda en `BASE DE REGISTROS`, resuelve médico/servicio mediante catálogos superpuestos y clasifica operativamente por turno. | `[AS-IS]` libro y revisión contrastada. |
| 2b | Excel `.xlsm` | Materializa resultados en hojas `MATUTINO`/`VESPERTINO`; registros no resueltos pueden quedar sin salida visible. | `[AS-IS]` 399 de 419 en la muestra. Las hojas y copias son implementación, no entidades. |
| 3 | Personal de archivo | Genera/imprime SM10-1 agrupado por médico, servicio, horario y destino operativo. | `[SOURCE]` Guía pp. 22, 31–33; `[AS-IS]` derivado y archivos reales. |
| 4 | Archivista | Busca, identifica y localiza cada Expediente; marca la lista física según la observación. | `[SOURCE]` Guía pp. 31–32; `[AS-IS]` entrevista. |
| 5 | Archivista | Ordena los expedientes y forma paquetes por consultorio; la evidencia operativa también habla de especialidad. | `[SOURCE]` Guía pp. 31–32; `[AS-IS]` derivado. |
| 6 | Archivista/mensajero | Coloca paquetes en carritos y los traslada antes de consulta. | `[AS-IS]` derivado e entrevista. |
| 7 | Archivo y receptor | Entrega presencial al personal médico; la Guía también indica enfermería según disponibilidad local. Se contrasta con SM10-1. | `[SOURCE]` Guía pp. 30–32; `[AS-IS]` derivado. |
| 8 | Médico | Usa el expediente durante consulta y registra agregados en SM10-1. | `[SOURCE]` Guía p. 32. |
| 9 | Archivo/mensajero | Recoge los expedientes al término del turno; la práctica usa la lista rayada como control. | `[SOURCE]` Guía pp. 20, 32; `[AS-IS]` entrevista. |
| 10 | Archivo | Verifica integridad/completitud, resguarda y rearchiva según orden físico. | `[SOURCE]` Guía pp. 32–33. |

Variaciones: `[SOURCE]` la Guía contempla pacientes presenciales agregados a la agenda; `[AS-IS]` la Agenda puede cambiar después de su descarga. La reconciliación aprobada compara por FOLIO: agrega, actualiza, conserva sin cambio, retira de preparación o restaura la misma identidad. La atención presencial/fuera de Agenda permanece fuera del slice.

## B. Solicitud extraordinaria y préstamo con SM1-14

| Paso | Actor | Actividad documentada | Evidencia |
|---|---|---|---|
| 1 | Dirección/Subdirección/Coordinación médica | Emite o autoriza la solicitud mediante SM1-14. | `[SOURCE]` Guía pp. 30–31. |
| 2 | Solicitante/representante | Presenta el vale en ventanilla. | `[AS-IS]` procedimiento derivado. |
| 3 | Jefatura/personal designado | Recibe y revisa que esté llenado y firmado. | `[AS-IS]` procedimiento derivado; campos exactos `[OPEN QUESTION]`. |
| 4 | Jefatura/personal designado | Asigna a personal para búsqueda. | `[AS-IS]` procedimiento derivado. |
| 5 | Archivista | Busca, identifica y localiza; si tarda, se informa al solicitante según práctica local. | `[AS-IS]` derivado. |
| 6 | Archivo/solicitante | Se entrega el Expediente y comienza la responsabilidad del solicitante. | `[SOURCE]` responsabilidad y plazo; ejecución detallada `[AS-IS]`. |
| 7 | Solicitante | Mantiene el préstamo hasta 24 horas, salvo excepciones generales; para más tiempo llena un nuevo formato. | `[SOURCE]` Guía pp. 30–31. |
| 8 | Solicitante | Devuelve íntegramente el Expediente. | `[SOURCE]` Guía p. 31. |
| 9 | Archivo | Verifica integridad y buen estado, localiza el vale y lo destruye físicamente. | `[SOURCE]` Guía p. 31. |
| 10 | Archivo | Reubica/rearchiva el Expediente. | `[SOURCE]` Guía pp. 31–33. |

`[OPEN QUESTION]` “Orden Superior” sólo está mencionada como fuente de salida. El derivado describe llamadas y entrega contra vale, pero no define autoridad, evidencia previa, plazo, regularización ni excepciones de forma suficiente; no se modela como flujo aprobado.

## Subsistema Excel observado

`SIMEF → Agenda → BASE DE REGISTROS → resolución médico/servicio → ROL MEDICOS y catálogos auxiliares → clasificación operacional → MATUTINO/VESPERTINO → listas/SM10-1/paquetes → localización física`.

Su propósito operativo no es sólo ordenar filas: ingiere la Agenda, resuelve referencias, clasifica y genera listas. `[TECHNICAL CONSTRAINT]` La reserva de bloques cercanos a 30 filas, hojas separadas y copia física de registros son mecanismos del libro y no deben migrarse como reglas.

## Snapshot verificado del 21/08/2026

`[AS-IS]` Un archivo diario contiene 273 citas en 22 bloques médico/Servicio. Cada bloque identifica médico por número de empleado + nombre y Servicio por código + nombre. FOLIO identifica cada cita. Turno, Consultorio y Destino no están presentes explícitamente; no participan en el alcance inicial.
