# Modelo de dominio preliminar de Agenda

## Bounded Contexts

Emerge un candidato **Agenda / Appointment Preparation**, tenant-scoped, responsable de ingesta, resolución, clasificación, incidencias y lista de preparación. Se diferencia de **Archive Operations / Expediente Workspace**, propietario de Expediente, estado, ubicación, custodia y movimientos.

Interfaz conceptual: `Agenda/Cita → Necesidad de Expediente → referencia a Expediente`. Sigue abierto si `RequerimientoExpediente` es Aggregate, proyección, Solicitud o relación derivada. Cita programada no equivale a Solicitud SM1-14.

La identidad candidata queda acotada: Agenda por tenant + fecha; Cita por `FOLIO`; médico por número de empleado tenant-scoped. Servicio/Especialidad es un único concepto operacional dentro de este contexto. `ATENCION_FUERA_DE_AGENDA` es otro flujo y queda fuera del slice.

## Aggregate/entity candidates

| Candidato | Responsabilidad/identidad/lifecycle | Invariantes, comandos y eventos candidatos | Dudas |
|---|---|---|---|
| `ImportacionAgenda` | Ejecución tenant-scoped sobre Agenda diaria; recibida→validada→procesada/cerrada | importar, validar; `AgendaImportada`, `ImportacionRechazada` | cierre/reapertura y retención |
| `Agenda` | Citas de fecha/periodo para tenant | incorporar revisión; `AgendaRevisada` | ¿Aggregate o proyección de importaciones? |
| `Cita` | Cita estable referenciada por fuente | reconciliar; `CitaAgregada/Cambiada/Desaparecida` candidatos | llave y semántica de desaparición |
| `RegistroImportadoAgenda` | Traza fila→normalización→resolución | validar/resolver | separar raw evidence de estado mutable |
| `IncidenciaImportacion` | Problema explícito resoluble | resolver/reabrir; `IncidenciaResuelta` | ownership, catálogo y severidad |
| `AsignacionMedicoServicioTurno` | Configuración tenant-scoped fuera del primer slice | configurar/desactivar | Aggregate/reference data y fuente de Turno siguen abiertos |
| `PreparacionAgenda` | Progreso de localización para jornada | generar lista, marcar localización | relación con Solicitud y Package |
| `RequerimientoExpediente` | Une necesidad originada por cita con Expediente | solicitar/localizar | naturaleza sigue OPEN |

Estados sugeridos en la revisión (`IMPORTADO`, `VALIDADO`, `CLASIFICADO`, pendientes, duplicado, ignorado, error) no se fijan como enums ni se mezclan con `EstadoOperativo`.

## Future Use Cases candidatos

- UC-AGENDA-001 Importar Agenda — Agenda context.
- UC-AGENDA-002 Validar registros — Agenda context.
- UC-AGENDA-003 Resolver médico — Agenda/reference data boundary.
- UC-AGENDA-004 Resolver incidencias — Agenda context.
- UC-AGENDA-005 Generar lista de expedientes — Agenda→Archive Operations projection.
- UC-AGENDA-006/007/008 Consultar por turno/servicio o especialidad/médico — read models.
- UC-AGENDA-009 Actualizar asignación médico-turno — reference configuration, ownership abierto.
- UC-AGENDA-010 Reprocesar pendientes — Agenda context.

No son specs ni endpoints.

## TO-BE preliminar

Importar → registrar importación → validar layout → conservar evidencia original bajo política → normalizar sin destruir origen → resolver cita/Expediente/médico/servicio-turno → clasificar.

- Válido: Cita normalizada → necesidad de Expediente → lista de preparación.
- Problema: incidencia explícita → revisión → corrección de configuración/resolución → reproceso trazable.

La lista inicial muestra nombre del derechohabiente, Expediente, tipo de derechohabiente, primera vez/subsecuente, fecha, hora y médico + Servicio/Especialidad. Turno y consultorio/destino quedan fuera del primer slice; MATUTINO/VESPERTINO no son entidades. No se diseñan UI, API ni persistencia.
