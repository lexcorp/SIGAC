# Análisis de artefactos

## Agenda de Archivo Clínico de SIMEF

Análisis estructural del archivo original, sin reproducir filas ni valores personales:

- `[AS-IS]` exportación HTML con extensión `.xls`, 4 tablas y 471 filas no vacías en la muestra.
- Encabezado: institución/sistema, rango de fecha, unidad y clave.
- Columnas de cita observadas: número de cita, fecha, hora, folio, expediente, tipo, nombre del derechohabiente, contacto, vigencia, sexo, edad, primera vez y subsecuente.
- La secuencia repite bloques de **médico + servicio**, seguidos por renglones de citas. Médico, servicio, expediente, tipo y horario son patrones repetidos útiles para agrupación operacional.
- No se observó una columna explícita de consultorio en el encabezado extraído. `[OPEN QUESTION]` cómo se determina el consultorio/destino que el procedimiento dice usar.
- `[OPEN QUESTION]` estabilidad futura del layout y zona horaria/corte. La iteración 3 confirma FOLIO como identidad de cita e idempotencia/reconciliación a nivel de Agenda diaria.

### Minimización

Para preparación física parecen necesarios, sujetos a validación: identificador de cita/fuente, fecha-hora, identificador de Expediente, médico, servicio y destino operativo. Nombre u otros identificadores podrían servir para desambiguación segura, pero requieren propósito y controles. Contacto, vigencia, sexo, edad y cualquier dato asistencial no deben incorporarse por defecto.

## SM10-1

- `[SOURCE]` el archivo analizado contiene múltiples secciones “Datos del médico”, con clave/nombre/cédula, servicio/clave/horario y tabla de consultas.
- Sus columnas abarcan hora, nombre, expediente, vigencia, tipo de derechohabiente, edad, sexo, primera/subsecuente y numerosos campos asistenciales/estadísticos.
- `[SOURCE]` la Guía usa el SM10-1 para concordar, ordenar y acompañar expedientes; no autoriza que SIGAC replique todos sus campos.

## Mapeo conceptual Agenda → SM10-1

| Concepto | Agenda | SM10-1 | Estado del mapeo |
|---|---|---|---|
| Fecha de consulta | Presente | Presente | Conocido estructuralmente; reglas de formato pendientes. |
| Unidad/clave | Presente | Presente | Conocido estructuralmente. |
| Médico | Bloque con clave/nombre | Sección con clave/nombre y cédula | Parcial: cédula no aparece en Agenda observada. |
| Servicio | Bloque con clave/nombre | Sección con clave/nombre | Conocido estructuralmente. |
| Horario de jornada | Citas individuales por hora | Horario del médico y hora de cita | Parcial: origen del horario de jornada no está establecido. |
| Expediente | Columna | Columna | Conocido; no asumir unicidad global. |
| Nombre | Columna | Columna | Conocido, pero dato personal sujeto a minimización. |
| Primera/subsecuente | Columnas | Columnas | Conocido estructuralmente. |
| Consultorio/paquete | No observado como columna explícita | No observado como campo inequívoco | `[OPEN QUESTION]` regla de derivación o fuente adicional. |
| Campos asistenciales del SM10-1 | No todos presentes | Presentes | Fuera del objetivo de gestión física; no importar sin decisión. |

### Snapshot del 21/08/2026

La nueva Agenda confirma 273 citas en 22 bloques médico/Servicio. Cada bloque expone número de empleado + nombre y código + nombre de Servicio. No expone Turno, Consultorio ni Destino. El detalle y los `NEW-EVIDENCE-GAP` están en `iteration-3-evidence.md`.

## SM1-14

Se recibió una instancia independiente fuera de `knowledge/`. Estructura observada, sin reproducir valores: encabezado institucional y denominación SM1-14/“Vale al archivo”; servicio/especialidad/coordinación; motivo/destino textual; turno; fecha; teléfono/extensión/red; tabla numerada con nombre del paciente y número de expediente; solicitante con nombre y firma; nota de fundamento en la Guía. La instancia abarca más de una página y permite múltiples expedientes.

Con respaldo de la Guía se conocen además: emisión/autorización restringida, préstamo ordinario de 24 horas, nuevo formato para renovación, responsabilidad de devolución íntegra y destrucción del vale tras devolución verificada. Permanecen `[OPEN QUESTION]`: cuáles campos son obligatorios, catálogo de motivo/destino, número máximo de expedientes, firma autorizadora frente a solicitante, ejemplares/folio, evidencia de entrega/retorno, custodia física, cancelación y regularización de Orden Superior.

La instancia contiene datos personales reales y no se usa como fixture.
