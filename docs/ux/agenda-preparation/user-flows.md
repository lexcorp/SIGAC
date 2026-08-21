# User Flows

## UF-AP-001 — Consultar Agenda del día

1. Entrar a Preparación de Agenda.
2. Seleccionar fecha.
3. Consultar `GET /api/v1/agendas/{date}`.
4. Mostrar `AgendaDayReadModel` o, ante 404, “No hay una Agenda registrada para esta fecha”.
5. Navegar a Lista, Incidencias —si está autorizada— o Importaciones.

## UF-AP-002 — Importar o actualizar

1. Con `AGENDA_IMPORT`, activar “Importar / actualizar Agenda”.
2. **Seleccionar:** elegir exactamente un `.xls`; reemplazar o cancelar antes de enviar.
3. **Validar:** el stepper comunica la fase conceptual, pero no realiza un endpoint
   separado ni muestra fecha/conteos anticipados (UX-GAP-001).
4. **Procesar:** un único POST síncrono muestra loader indeterminado. No porcentaje,
   subestados confirmados, worker ni polling.
5. **Resultado:** representar `IMPORTED`, `ALREADY_IMPORTED` o `RECONCILED`, métricas
   aprobadas y enlaces a detalle/lista/incidencias según permissions.
6. Cerrar y refrescar Agenda del día.

El archivo sólo se nombra durante selección. Después no se presenta filename.

## UF-AP-003 — Revisar preparación

1. Abrir Lista de preparación para la fecha.
2. Cargar página ordenada por hora + FOLIO.
3. Agrupar visualmente Servicio/Especialidad → Médico → citas.
4. “Cargar más” reenvía el cursor opaco; nunca se decodifica ni se muestran páginas.

## UF-AP-004 — Revisar incidencias

1. Mostrar tab sólo con `AGENDA_INCIDENT_VIEW`.
2. Consultar incidencias por importación.
3. Mostrar categoría humana y referencia mínima permitida.
4. Cargar más con cursor opaco.
5. No ofrecer Resolver, Corregir, Ignorar o Asignar.

## UF-AP-005 — Consultar importación

1. Consultar `GET /api/v1/agenda-imports` con fecha opcional y cursor.
2. Elegir una importación del historial ordenado por importedAt/importacionId DESC.
3. Consultar summary y páginas de resultados.
4. Consultar incidencias sólo con permission específica.
5. No mostrar raw, filename, fingerprint, actorRef o metadata técnica.

## Errores y retry

- Validación/formato/layout: conservar el dialog, anunciar error y permitir volver a
  Seleccionar cuando sea seguro.
- 401: salir del flujo y aplicar recuperación de sesión del shell.
- 403: cerrar/ocultar acción y mostrar mensaje seguro.
- 404 en consulta: estado no encontrado, sin revelar tenant.
- timeout/fallo técnico: no reintentar automáticamente. La preservación de
  Idempotency-Key en retry manual requiere decisión UX/infrastructure (UX-GAP-003).
- 409 por key reutilizada: no regenerar automáticamente ni tratar como fila duplicada.
