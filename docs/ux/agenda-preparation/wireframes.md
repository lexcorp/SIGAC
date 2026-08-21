# Wireframes AP-01…AP-08

Los diagramas especifican estructura, no styling definitivo. Todo contenido de ejemplo es
sintético. Shell, tokens y foco visible reutilizan SIGAC.

## AP-01 — Agenda del día

- **Objetivo:** responder fecha, última actualización, Citas activas, médicos, Servicios e incidencias.
- **Actor:** personal de Archivo Clínico autorizado.
- **Permission:** `AGENDA_VIEW`; CTA adicional con `AGENDA_IMPORT`.
- **Datos:** `AgendaDayReadModel` exclusivamente.
- **Components:** DateSelector, AgendaSummary, AgendaStatus, MetricTile, EmptyState, ProblemBanner.
- **Actions:** cambiar fecha; importar/actualizar; abrir Lista, Incidencias o Importaciones.
- **States:** loading, 404/empty, loaded, safe error; CTA visible/hidden.
- **Entrada/salida:** App Shell → Agenda; sale a tabs, wizard o detalle latestImportacionId.
- **Requirements:** REQ-AP-004/013/017/020; AC-AP-011/014.
- **Use Case/API:** GetAgendaDay; GET `/api/v1/agendas/{date}`.
- **Prohibido:** lista de Citas, actorRef, Turno, Consultorio, raw, fingerprint, filename.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Preparación de Agenda                      Fecha [21/08/2026 ▾] [Importar]* │
│ [Agenda] [Lista de preparación] [Incidencias]** [Importaciones]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Agenda del 21 ago 2026     Actualizada 20 ago 2026 · 16:42  [Actualizada]   │
│ ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐                   │
│ │ 38 citas   │ │ 7 médicos│ │ 5 servicios│ │ 3 incidencias│                │
│ └────────────┘ └──────────┘ └────────────┘ └────────────┘                   │
│ [Ver lista de preparación] [Ver última importación]                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

`* AGENDA_IMPORT`; `** AGENDA_INCIDENT_VIEW`. Los números son sintéticos.

## AP-02 — Import Wizard / Seleccionar

- **Objetivo:** seleccionar exactamente una Agenda `.xls` SIMEF.
- **Actor/permission:** importador con `AGENDA_IMPORT`.
- **Datos:** archivo sólo en memoria/interacción del navegador.
- **Components:** Dialog, WizardStepper, FileDropzone, inline error, buttons.
- **Actions:** elegir/drop, reemplazar, cancelar, continuar.
- **States:** empty, drag, selected, invalid extension, too large, keyboard focus.
- **Entrada/salida:** CTA AP-01 → AP-02; cancelar vuelve AP-01; continuar inicia POST.
- **Requirements:** REQ-AP-001..003/008/015/017.
- **Use Case/API:** ImportAgenda; POST `/api/v1/agenda-imports`.
- **Prohibido:** ISO-8859/HTML, fingerprint, key, ImportAttemptId, tenant, filename durable.

```text
┌─ Importar / actualizar Agenda ───────────────────────────────────────────────┐
│ ① Seleccionar ━━━ ② Validar ─── ③ Procesar ─── ④ Resultado                 │
│                                                                              │
│ Agenda de Archivo Clínico exportada por SIMEF                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Arrastre un archivo .xls aquí                                            │ │
│ │ o [Elegir archivo]                                                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Seleccionado temporalmente: agenda-sintetica.xls  [Reemplazar]              │
│                                           [Cancelar] [Continuar]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

## AP-03 — Import Wizard / Validar

- **Objetivo:** comunicar verificación del artefacto sin inventar preview.
- **Actor/permission:** importador con `AGENDA_IMPORT`.
- **Datos:** ninguno anticipado; sólo estado local de request/error contractual.
- **Components:** WizardStepper, LoadingState, ProblemBanner.
- **Actions:** ninguna durante operación; volver a selección después de error seguro.
- **States:** indeterminate, layout rejected, unsupported, too large, validation error.
- **Entrada/salida:** AP-02 → operación única → AP-04/AP-05 o error.
- **Requirements:** REQ-AP-002/003; INV-AP-009.
- **Use Case/API:** mismo POST; no endpoint validate.
- **Prohibido:** preview de fecha/conteos/médicos/Servicios, progreso porcentual, parser details.

```text
┌─ Importar / actualizar Agenda ───────────────────────────────────────────────┐
│ ✓ Seleccionar ━━━ ② Validar ━━━ ③ Procesar ─── ④ Resultado                 │
│                         ◌                                                    │
│                Verificando la Agenda…                                       │
│        SIGAC comprueba que el artefacto sea compatible.                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

UX-GAP-001 permanece non-blocking: no hay preview contractual separado.

## AP-04 — Import Wizard / Procesar

- **Objetivo:** representar el POST síncrono mientras interpreta/reconcilia.
- **Actor/permission:** importador con `AGENDA_IMPORT`.
- **Datos:** estado pending del request, sin subestados server.
- **Components:** WizardStepper, indeterminate loader, caution text, ProblemBanner.
- **Actions:** no repetir/cancelar como si existiera cancelación servidor.
- **States:** processing, timeout, failed, network uncertainty.
- **Entrada/salida:** AP-03 → AP-05 o error.
- **Requirements:** REQ-AP-009/010/014/017.
- **Use Case/API:** ImportAgenda; POST síncrono/UoW.
- **Prohibido:** polling, queue, worker, porcentaje, progreso falso, retry automático.

```text
┌─ Importar / actualizar Agenda ───────────────────────────────────────────────┐
│ ✓ Seleccionar ━━━ ✓ Validar ━━━ ③ Procesar ━━━ ④ Resultado                 │
│                         ◌                                                    │
│                   Procesando la Agenda…                                     │
│      Espere a que finalice. No repita la operación.                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Sin señal server, la transición visual Validar→Procesar no pretende ser telemetría real.

## AP-05 — Import Wizard / Resultado

- **Objetivo:** confirmar outcome y métricas contractuales; dirigir al trabajo posterior.
- **Actor/permission:** `AGENDA_IMPORT`; links respetan permissions de lectura.
- **Datos:** ImportAgendaResponse y AgendaImportMetrics.
- **Components:** WizardStepper, ImportResultSummary, AgendaMetrics, buttons.
- **Actions:** ver Agenda, resultados, Lista, Incidencias autorizadas; cerrar.
- **States:** IMPORTED, ALREADY_IMPORTED, RECONCILED.
- **Entrada/salida:** POST 201 → AP-05; sale a AP-01/AP-06/AP-07/AP-08.
- **Requirements:** REQ-AP-009..014/017; AC-AP-001..005/009.
- **Use Case/API:** ImportAgenda response + Location.
- **Prohibido:** ImportAttemptId, filename, fingerprint, raw, Domain Events, metadata DB.

```text
┌─ Importar / actualizar Agenda ───────────────────────────────────────────────┐
│ ✓ Seleccionar ━━━ ✓ Validar ━━━ ✓ Procesar ━━━ ④ Resultado                 │
│ ✓ Agenda actualizada                                                        │
│ Recibidos 40 · Procesados 36 · Incidencias 4 · Errores 1                   │
│ Nuevas 8 | Actualizadas 5 | Sin cambios 20 | Restauradas 3                 │
│ Pendientes 3 | Rechazadas 0 | Duplicados 1 | Retiradas 2                  │
│ [Agenda del día] [Resultados] [Lista] [Incidencias]** [Cerrar]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

## AP-06 — Lista de preparación

- **Objetivo:** facilitar identificación y preparación física cotidiana.
- **Actor/permission:** personal con `AGENDA_VIEW`.
- **Datos:** PreparationItem exacto; orden hora ASC + FOLIO ASC; cursor opaco.
- **Components:** DateSelector, PreparationList, PreparationGroup, LoadMoreButton.
- **Actions:** expandir/contraer grupos, cargar más; sin transición Domain.
- **States:** loading, empty, grouped, loading-more, end, safe error.
- **Entrada/salida:** tab Lista; vuelve Agenda o navega tabs.
- **Requirements:** REQ-AP-012/013/015..017; AC-AP-010..012.
- **Use Case/API:** GetAgendaPreparationList; GET preparation-items.
- **Prohibido:** Turno, Consultorio, Destino, paquete, Mensajero, traslado, préstamo, C3 excluido.

```text
┌─ Lista de preparación · 21 ago 2026 ────────────────────────────────────────┐
│ ▼ Cardiología                                                               │
│   ▼ Dra. Laura Rivera · Empleado 00421                                      │
│   ┌──────┬──────────────┬──────────────────┬───────────┬──────────┬────────┐ │
│   │ Hora │ Expediente   │ Derechohabiente  │ Tipo DH   │ Cita     │ FOLIO  │ │
│   │08:10 │ ABCD00000110 │ Persona Ejemplo  │ Titular   │ Primera  │F-1001  │ │
│   │08:30 │ EFGH00000220 │ Usuario Sintético│ Familiar  │ Subsecu. │F-1002  │ │
│   └──────┴──────────────┴──────────────────┴───────────┴──────────┴────────┘ │
│ ▶ Medicina Interna                                                          │
│                              [Cargar más]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Recomendación: híbrido grupos expandibles + tabla. Una tabla plana pierde jerarquía;
cards consumen demasiado espacio; sólo grupos sin tabla reducen comparación de filas.

## AP-07 — Incidencias

- **Objetivo:** consultar filas que requieren revisión sin resolverlas en SIGAC.
- **Actor/permission:** personal con `AGENDA_INCIDENT_VIEW`.
- **Datos:** ImportIncidentSummary sanitizado, orden sourcePosition + incidentId.
- **Components:** IncidentList/Row, category label, LoadMoreButton, EmptyState.
- **Actions:** cargar más; abrir contexto de importación si está autorizado.
- **States:** loading, empty, one, multiple, loading-more, 403/404/network.
- **Entrada/salida:** tab/enlace resultado/detalle; vuelve a Agenda/importación.
- **Requirements:** REQ-AP-006/011/013/015/017.
- **Use Case/API:** GetAgendaImportIncidents; GET `/agenda-imports/{id}/incidents`.
- **Prohibido:** Resolve/Correct/Ignore/Assign, candidates sensibles, raw row, PII adicional.

```text
┌─ Incidencias de importación ─────────────────────────────────────────────────┐
│ [Médico no identificado]     Registro 12 · FOLIO F-1012                     │
│ [Expediente no identificado] Registro 18 · FOLIO F-1018                     │
│ [FOLIO duplicado]            Registros relacionados en la importación       │
│                                                        [Cargar más]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## AP-08 — Importaciones / detalle

- **Objetivo:** consultar historial minimizado y evidencia durable de una ejecución.
- **Actor/permission:** personal con `AGENDA_VIEW`; incidencias requieren permission propia.
- **Datos:** AgendaImportHistoryPage, ImportacionAgendaSummary, resultados e incidencias.
- **Components:** ImportHistory, ImportDetail, AgendaMetrics, result list, LoadMoreButton.
- **Actions:** filtrar fecha, cargar más, abrir detalle, cargar resultados/incidencias.
- **States:** history empty/loaded/more; detail loading/404/loaded; incidents hidden/visible.
- **Entrada/salida:** tab Importaciones o AP-05; detalle vuelve al historial.
- **Requirements:** REQ-AP-013/014/015/017/019; AC-AP-013.
- **Use Case/API:** ListAgendaImports; GetAgendaImportResult; GET collection/detail/results/incidents.
- **Prohibido:** total/hasMore técnico, cursor, raw, filename, fingerprint, actorRef en history, PII.

```text
┌─ Importaciones ───────────────────────────────────────────────────────────────┐
│ Fecha de Agenda [Todas ▾]                                                    │
│ 20 ago · 16:42  Agenda actualizada   Recibidos 40 · Incidencias 4 [Detalle] │
│ 19 ago · 15:58  Ya estaba actualizada Recibidos 38 · Incidencias 0 [Detalle]│
│                                                        [Cargar más]          │
├─ Detalle (ruta subordinada) ─────────────────────────────────────────────────┤
│ [Volver] Importación IMP-SYN-002 · Agenda 21 ago · Agenda actualizada       │
│ [Métricas]                                                                  │
│ Resultados [lista paginada] [Cargar más]                                    │
│ Incidencias** [lista paginada] [Cargar más]                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```
