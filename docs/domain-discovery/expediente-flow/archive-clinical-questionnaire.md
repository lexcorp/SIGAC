# Cuestionario prioritario para Archivo Clínico — iteración 3

Las respuestas recibidas resolvieron identidad diaria, FOLIO, médico, Servicio/Especialidad, reimportación y minimización. La Agenda real contradice únicamente la presencia explícita de Turno y consultorio/destino; ambos quedan fuera del primer slice.

## MUST ANSWER BEFORE SPEC 002

Ninguna pregunta pendiente. La ausencia posterior se resolvió como `RETIRADA_DE_AGENDA`, sin inferir cancelación clínica.

## SHOULD ANSWER DURING SPEC

1. ¿Cuándo cierra una importación y puede reabrirse?
2. ¿Qué periodo debe conservarse el archivo/payload original y quién puede verlo?
3. ¿Cómo se informa y corrige un layout de SIMEF cambiado?
4. ¿Qué métricas y términos entiende negocio: recibidas, clasificadas, pendientes, incidencias, revisión?
5. ¿Una entrada de Agenda crea una Solicitud o sólo un requerimiento de preparación?
6. ¿Quién puede corregir una resolución de médico y reprocesar una fila?

## CAN DEFER

1. Turno y su fuente autoritativa/configuración.
2. Consultorio/destino y su regla de derivación.
3. Identidad/ciclo de vida de paquetes y relación transaccional con Expedientes.
4. Generación completa e impresión de SM10-1.
5. Barcode/RFID o automatización de descarga.
6. `ATENCION_FUERA_DE_AGENDA`, cita abierta y hojas especiales.
7. SM1-14, Orden Superior y préstamo extraordinario, salvo interferencia con disponibilidad.
