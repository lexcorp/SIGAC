# Preguntas abiertas

## Readiness DD-EW-001..006 para spec 002

El estado detallado está en `spec-002-readiness.md`.

- `DD-EW-001` (RESOLVED): Agenda tenant + fecha; cita por FOLIO; importación y fila conservan identidad técnica separada.
- `DD-EW-002` (RESOLVED): sin diferencias informa ya importada; con diferencias reconcilia/actualiza.
- `DD-EW-003` (RESOLVED): ADD, UPDATE, UNCHANGED, `RETIRADA_DE_AGENDA` y restauración conceptual por el mismo FOLIO.
- `DD-EW-004` (RESOLVED para slice): Servicio/Especialidad equivalentes; Turno y consultorio/destino ausentes y fuera de alcance inicial.
- `DD-EW-005` (RESOLVED para slice): layout HTML `.xls` observado y fail-closed ante incompatibilidad.
- `DD-EW-006` (RESOLVED para slice): lista mínima y exclusiones confirmadas.
No quedan preguntas de negocio bloqueantes para escribir spec 002 dentro del alcance acotado.

## Preguntas posteriores no bloqueantes

- `DD-EW-007`: ¿Cuál es la identidad, destino y ciclo de vida de un paquete?
- `DD-EW-008`: ¿Qué significa “preparado” y quién lo confirma? ¿Lista física, expediente localizado o paquete completo?
- `DD-EW-009`: ¿Qué ocurre formalmente con no localizado, ya prestado, duplicado o provisional durante preparación?

## Bloqueantes para solicitud/préstamo extraordinario

- `DD-EW-010`: Se obtuvo una instancia SM1-14; falta plantilla/instructivo oficial para certificar obligatoriedad, firmas, folio, copias y reglas de llenado.
- `DD-EW-011`: Definir el flujo completo y evidencia habilitante de Orden Superior.
- `DD-EW-012`: Definir prioridades entre solicitudes concurrentes, incluida Urgencias.
- `DD-EW-013`: Precisar excepciones al plazo de 24 horas, evidencia, vencimiento y renovación.
- `DD-EW-014`: Definir cancelación, rechazo, entrega parcial y retorno tardío.
- `DD-EW-015`: Definir criterios verificables de integridad/buen estado sin capturar contenido clínico.
- `DD-EW-016`: Definir qué registro digital permanece cuando el vale físico es destruido y su retención autorizada.

## Validación transversal

- `DD-EW-006A`: ¿Una entrada de Agenda crea una SolicitudExpediente o una unidad de trabajo de preparación diferente? Puede resolverse durante la spec sin cambiar el scope inicial.
- `DD-EW-017`: Confirmar actores efectivos de entrega/recepción por unidad (enfermería, médico, mensajero) y separación entre previsto y efectivo.
- `DD-EW-018`: Confirmar ubicaciones físicas canónicas, TOMOS y secciones especiales sin convertir observaciones en catálogo.
- `DD-EW-019`: Definir vínculo entre paquete, movimientos individuales y custodia; no asumir una transacción masiva.
- `DD-EW-020`: Acordar métricas operativas y su minimización; los volúmenes de entrevista son aproximados.
