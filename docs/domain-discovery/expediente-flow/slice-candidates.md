# Candidatos de vertical slice

## Candidato A — Importación y reconciliación de Agenda

Ingerir una exportación SIMEF, validar estructura, minimizar datos y producir una lista de preparación versionada. Valor: elimina copiado/macro opaco y hace visibles anomalías. Único riesgo de negocio abierto: significado de un FOLIO que desaparece en una reexportación.

## Candidato B — Preparación y localización por jornada

Asignar búsquedas, marcar localizado/no localizado y visualizar avance por médico/servicio/destino, reutilizando Expediente Workspace. Valor: ataca tiempos de búsqueda y faltantes. Dependencia: necesita una importación confiable.

## Candidato C — Paquetes, despacho y retorno de consulta programada

Formar paquetes, registrar entrega/custodia, recoger, verificar y rearchivar mediante movimientos individuales. Valor: trazabilidad extremo a extremo. Riesgo: identidad del paquete y atomicidad con expedientes pendientes.

## Candidato D — Solicitud extraordinaria y préstamo SM1-14

Registrar vale, autorizar, buscar, abrir préstamo, renovar, devolver y cerrar. Valor: reemplaza control disperso. Bloqueado por ausencia del formato original y reglas incompletas de Orden Superior/excepciones.

## Recomendación para la futura spec 002

`[TO-BE]` Recomendar **A + una porción mínima de B**: “Importar Agenda SIMEF y obtener lista de preparación validada, con localización explícita por Expediente”. Es el slice con evidencia operativa tangible, frontera clara con SIMEF y reutilización inmediata del Workspace. Debe excluir inicialmente generación completa del SM10-1, paquetes/traslado y SM1-14.

Antes de iniciar la spec deben cerrarse `DD-EW-001` a `DD-EW-006` y acordarse un fixture desidentificado/versionado para pruebas. No se crea la spec 002 en esta fase.

La iteración 3 resuelve identidad, idempotencia, layout, minimización y el concepto Servicio/Especialidad. Turno, consultorio/destino y atención fuera de Agenda quedan formalmente fuera. Sólo resta decidir qué significa que un FOLIO desaparezca en una reexportación de la misma fecha.
