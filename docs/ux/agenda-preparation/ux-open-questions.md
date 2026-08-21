# UX Open Questions

Ningún gap modifica automáticamente la spec. Los gaps bloqueantes impiden cerrar las
superficies indicadas; no invalidan los contratos ya aprobados.

## UX-GAP-001 — Preview de validación

- Necesidad: mostrar fecha detectada, registros, médicos y servicios antes de confirmar.
- Pantalla: AP-03.
- Motivo UX: aumentar confianza antes de procesar.
- Contrato faltante: operación server-side inspect/validate separada; el POST vigente es
  síncrono y atómico.
- Impacto: sin contrato, AP-03 sólo comunica una fase indeterminada del POST y esos datos
  aparecen en Resultado.
- Clasificación: non-blocking.

## UX-GAP-002 — Filtros y búsqueda

- Necesidad: buscar por Expediente/paciente y filtrar por Servicio/Médico/resultado.
- Pantallas: AP-06 y AP-08.
- Motivo UX: manejar listas grandes.
- Contrato faltante: parámetros/query semantics; los endpoints sólo aprueban cursor y
  limit. Filtrar únicamente la página cargada produciría resultados incompletos.
- Impacto: primera versión conserva agrupación Servicio → Médico y carga incremental.
- Clasificación: non-blocking; requiere profiling/decisión posterior.

## UX-GAP-003 — Retry técnico e Idempotency-Key

- Necesidad: ofrecer “Reintentar” tras timeout/fallo técnico conservando la misma key.
- Pantalla: AP-03/AP-04 error.
- Motivo UX: recuperación sin duplicar operación.
- Contrato faltante: ownership, almacenamiento y expiración UX de la key; API sólo fija
  su semántica y ventana configurable.
- Impacto: no hay retry automático ni CTA que regenere key. El usuario puede cerrar e
  iniciar explícitamente una nueva reimportación funcional.
- Clasificación: non-blocking para el flujo inicial; blocking sólo para añadir retry.

## UX-GAP-004 — Historial de importaciones — RESOLVED

- Necesidad: poblar el área “Importaciones” y navegar a detalles anteriores.
- Pantalla: navegación principal y AP-SCR-005.
- Motivo UX: la arquitectura solicitada incluye una colección de importaciones.
- Contrato aprobado: `ListAgendaImports`, GET conceptual `/api/v1/agenda-imports`, fecha
  opcional, cursor opaco `importedAt + importacionId`, orden descendente y campos mínimos.
- Resultado: el historial y navegación al detalle quedan especificados.
- Clasificación: resolved; no bloqueante.

## UX-GAP-005 — Summary de Agenda del día — RESOLVED

- Necesidad: responder última actualización, citas vigentes e incidencias.
- Pantalla: AP-SCR-001.
- Motivo UX: son preguntas operativas exigidas al dashboard.
- Contrato aprobado: `AgendaDayReadModel` con datos de última importación y conteos
  vigentes definidos; GET `/api/v1/agendas/{date}` conserva 404 cuando no existe.
- Resultado: AP-SCR-001 loaded queda especificado sin composición frontend.
- Clasificación: resolved; no bloqueante.

## Matriz de filtros

| Filtro | Estado |
|---|---|
| Expediente | UX-GAP-002 |
| Paciente | UX-GAP-002 |
| Servicio/Especialidad | UX-GAP-002 |
| Médico | UX-GAP-002 |
| Resultado/estado | UX-GAP-002 |

## Conteo

- Blocking: 0.
- Non-blocking: 3.
- `implementation_ready: true`.
