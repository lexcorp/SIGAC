# Event Storming exploratorio

Todos los nombres son lenguaje candidato, no contratos de implementación.

## Actores y sistemas

- `[SOURCE]` Archivo clínico, personal médico, enfermería, Dirección, Subdirección y Coordinación médica.
- `[AS-IS]` Jefatura de archivo, archivista, mensajero, solicitante/representante y supervisor administrativo.
- `[AS-IS]` SIMEF como fuente de Agenda; hojas Excel/macros y formatos físicos como sistemas externos/manuales.

## Secuencia de preparación programada

| Comando candidato | Evento candidato | Política/evidencia | Read model candidato |
|---|---|---|---|
| Importar Agenda | Agenda importada | La descarga ocurre antes de preparación. | Resumen de importación y anomalías. |
| Organizar preparación | Preparación organizada | Orden por horario; agrupación observada por médico/servicio/consultorio. | Lista de preparación. |
| Asignar búsqueda | Búsqueda asignada | Práctica operativa; responsable exacto requiere validación. | Trabajo por archivista. |
| Marcar localizado/no localizado | Expediente localizado / no localizado | La Guía exige localizar y contempla faltantes. | Estado de preparación por cita. |
| Integrar paquete | Expediente agregado a paquete | Paquetes por consultorio en la Guía. | Paquete y faltantes. |
| Despachar paquete | Paquete despachado | Traslado observado; T-07 existente cubre movimiento de Expediente individual. | Entregas pendientes. |
| Aceptar entrega | Custodia aceptada | Entrega a médico/enfermería; identidad efectiva requiere registro. | Custodia actual. |
| Recoger/recibir retorno | Expediente retornado | Archivo debe recoger/recibir al término del turno. | Retornos pendientes. |
| Verificar y rearchivar | Expediente verificado / rearchivado | Guía pp. 32–33. | Pendientes de verificación/rearchivo. |

### Flujo de importación previo

| Comando candidato | Evento/resultado candidato | Política candidata | Read model candidato |
|---|---|---|---|
| Registrar importación | Importación registrada | Separar archivo, Agenda, ejecución y fila. | Resumen 419/399/20 en la muestra. |
| Validar layout | Layout compatible/rechazado | No interpretar silenciosamente un layout desconocido. | Errores estructurales. |
| Resolver médico | Médico resuelto/pendiente/ambiguo | Id estable primero; no asociar ambigüedad. | Incidencias de identidad. |
| Resolver servicio/turno | Asignación resuelta/pendiente | Fuente tenant-scoped; turno configurable. | Incidencias de configuración. |
| Clasificar registro | Registro clasificado/con incidencia | Ningún registro desaparece. | Conteos y porcentaje de revisión. |
| Reprocesar | Registro reprocesado | Conservar raw y resolución previa bajo política. | Historial de resolución. |

Los nombres de resultados son lenguaje exploratorio, no enums.

### Política aprobada de reconciliación

La comparación por FOLIO produce conceptualmente ADD, UPDATE, UNCHANGED, `RETIRADA_DE_AGENDA` o restauración de la misma cita. Una retirada elimina la cita de la preparación vigente, conserva historia y no afirma cancelación clínica. No se fijan nombres técnicos de comandos o Domain Events.

## Secuencia extraordinaria

| Comando candidato | Evento candidato | Política/evidencia | Read model candidato |
|---|---|---|---|
| Registrar vale | Solicitud registrada | SM1-14 requerido; campos pendientes. | Solicitudes pendientes. |
| Validar/autorización del vale | Vale validado/rechazado | Autoridades indicadas en Guía. | Solicitud autorizada. |
| Asignar y ejecutar búsqueda | Búsqueda iniciada / expediente localizado | Secuencia derivada observada. | Cola de búsqueda. |
| Entregar e iniciar préstamo | Préstamo abierto | Responsabilidad y plazo de 24 horas. | Préstamos activos/vencimiento. |
| Renovar préstamo | Préstamo renovado | Requiere nuevo formato. | Historial de renovaciones. |
| Recibir devolución | Devolución recibida | Debe volver íntegro. | Retornos por verificar. |
| Verificar devolución | Devolución verificada / incidencia detectada | Integridad y buen estado. | Verificación e incidencias. |
| Cerrar vale físico | Vale destruido | Destrucción posterior a verificación. | Cierre de solicitud/préstamo. |
| Confirmar rearchivo | Expediente rearchivado | Orden físico documentado. | Ubicación actual. |

## Políticas que no deben consolidarse aún

- `[OPEN QUESTION]` prioridad entre solicitudes concurrentes: “primero que solicita/dialogar” sólo proviene de entrevista.
- `[OPEN QUESTION]` estados “pendiente, en búsqueda, localizado, preparado, entregado, provisional” son respuestas de entrevista, no catálogo aprobado.
- `[OPEN QUESTION]` no asistencia y cancelación clínica explícita siguen fuera de esta decisión; no se infieren desde `RETIRADA_DE_AGENDA`.
- `[TO-BE]` agentes, Playwright, códigos de barras o RFID son ideas, no comportamiento requerido.
