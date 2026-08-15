---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.2.0"
status: "Draft for UX/UI validation"
date: "2026-08-14"
amended: "2026-08-14 — DEC-EW-STATE-001, OQ-EW-001/007: estados y desambiguación actualizados"
design_direction: "Clinical operational UI"
frontend: "React + TypeScript + Vite"
api_contract: "REST/OpenAPI /api/v1"
---
# APP-003 — Expediente Workspace

## Pregunta central
¿Dónde está el expediente? ¿Quién lo tiene? ¿Desde cuándo? ¿Qué puedo hacer ahora?

## Header (above the fold)
- Número de expediente (formato `RFC/COD`; presentación preferente con `/`).
- Referencia mínima de paciente (datos C3 — campo exacto: OQ-EW-002 pendiente).
- `EstadoOperativo` con badge semántico (uno de los 6 valores aceptados):
  `DISPONIBLE`, `APARTADO`, `EN_TRASLADO`, `EN_CONSULTA`, `NO_LOCALIZADO`, `EXTRAVIADO`.
- Ubicación actual.
- Custodio actual (con `acceptedAt` si `EN_CONSULTA`; null si `EN_TRASLADO` sin aceptar).
- Indicadores: préstamo activo / incidencias abiertas.

**Badges de estado (DEC-EW-STATE-001):**
- `EN_BUSQUEDA` **no** es badge de Expediente — es estado de Solicitud.
- `PRESTADO` **no** es badge de Expediente — pertenece al Préstamo.
- `EN_TRASLADO` vs `EN_CONSULTA` son distintos y visualmente diferenciados.

## Barra de comandos contextual
Muestra únicamente los comandos del array `capabilities[]` devuelto por el API.
No calcula transiciones en el frontend.

Ejemplos de comandos posibles (según estado y rol):
`SOLICITAR`, `DISPATCH`, `ACCEPT_CUSTODY`, `ABRIR_PRESTAMO`, `RENOVAR_PRESTAMO`,
`RECIBIR_DEVOLUCION`, `CONFIRMAR_REARCHIVO`, `REPORTAR_INCIDENCIA`.

## Tabs
`Resumen` | `Movimientos` | `Solicitudes` | `Préstamos` | `Incidencias` | `Auditoría*`

`*` Tab Auditoría: visible solo si `capabilities` incluye permiso de auditoría (OQ-EW-003).

## Flujo de búsqueda y desambiguación (OQ-EW-001/007 RESOLVED)

Cuando la búsqueda por número devuelve **N > 1** resultados:
1. Se muestra una lista de coincidencias con: número de expediente, nombre del
   derechohabiente, CURP y número ISSSTE.
2. El usuario selecciona manualmente.
3. **Nunca** se abre automáticamente una coincidencia cuando existan varias.
4. La UI acepta búsqueda con `/`, `-` o sin separador; normaliza antes de enviar.

Cuando N = 0: estado vacío descriptivo.
Cuando N = 1: abre el workspace directamente.

## Privacidad
- Número de expediente y datos de paciente no aparecen en `document.title`,
  URL visible, toasts ni nombres de archivo exportado.
- Ver INT-009.

## Fuente
UC-018, SPEC-009, DDD-013, BIZ-007, API-011,
DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001.
