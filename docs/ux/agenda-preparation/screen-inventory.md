# Screen Inventory

| ID | Forma | Propósito | Contrato principal |
|---|---|---|---|
| AP-SCR-001 | Página con tabs | Agenda del día y dashboard operativo | GET Agenda por fecha |
| AP-WIZ-001 | Dialog/stepper | Importar o actualizar Agenda | POST agenda-imports |
| AP-SCR-002 | Paso 4 del wizard | Resultado inmediato | ImportAgendaResponse |
| AP-SCR-003 | Tab/vista | Lista inicial de preparación | GET preparation-items |
| AP-SCR-004 | Tab/vista condicional | Incidencias de importación | GET incidents |
| AP-SCR-005 | Página subordinada | Metadata y resultados de importación | GET import + results/incidents |

Total de superficies identificadas: seis; cinco pantallas/vistas y un wizard. AP-SCR-002
no crea ruta independiente.

## AP-SCR-001

Encabezado “Preparación de Agenda”, selector de fecha y acción autorizada. El summary
muestra agendaDate, latestImportedAt/latestOutcome, activeAppointments, physicians,
services e incidentCount; latestImportacionId enlaza al detalle.
Cuando existe Agenda, el upload no domina el layout.

## AP-WIZ-001 / AP-SCR-002

Stepper horizontal Seleccionar → Validar → Procesar → Resultado. La respuesta 201
alimenta el último paso. Los errores permanecen asociados a la etapa pertinente.

## AP-SCR-003

Vista desktop-first agrupada por Servicio/Especialidad y Médico. Columnas de fila:
FOLIO, paciente/derechohabiente, Expediente, tipo de derechohabiente,
primera vez/subsecuente, fecha, hora, médico/número de empleado y Servicio.

## AP-SCR-004

Listado de consulta con categoría humana, posición/referencia permitida y FOLIO nullable.
Sin acciones correctivas.

## AP-SCR-005

Summary: importacionId, fecha, importedAt, actorRef cuando el contrato autorizado lo
entrega, outcome, layoutVersion y métricas. Secciones paginadas de resultados e
incidencias; esta última respeta su permission independiente.

El detalle es alcanzable desde el resultado inmediato o desde `ListAgendaImports`.
