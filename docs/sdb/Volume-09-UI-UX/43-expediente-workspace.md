---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.3.0"
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

El Workspace consume un único `ExpedienteReadModel` compuesto server-side, incluyendo
Solicitud activa, Préstamo activo e Incidencias abiertas. El frontend no consulta ni
orquesta esos dominios por separado para reconstruir la pantalla.
No calcula transiciones en el frontend.

Ejemplos de comandos posibles (según estado y rol):
`SOLICITAR`, `INICIAR_BUSQUEDA`, `MARCAR_LOCALIZADO`, `MARCAR_NO_LOCALIZADO`,
`DISPATCH`, `ACCEPT_CUSTODY`, `ABRIR_PRESTAMO`, `RENOVAR_PRESTAMO`,
`RECIBIR_DEVOLUCION`, `CONFIRMAR_REARCHIVO`, `REPORTAR_INCIDENCIA`.

El array contiene comandos operativos. `EXPEDIENT_VIEW` no se incluye.
`AUDITOR_CONSULTA` puede consultar con `EXPEDIENT_VIEW`, pero recibe `capabilities: []`.

`ABRIR_PRESTAMO` aparece sólo si backend encuentra al menos una fuente habilitante
validada `CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14`, además del resto del contexto.
El frontend no recibe/valida evidencia ni selecciona la fuente concreta. Varias fuentes
pueden coexistir; `OpenLoan` resuelve la selección. `ORDEN_SUPERIOR` permanece
fail-closed aunque el provider la marque validada.

## Tabs
`Resumen` | `Movimientos` | `Solicitudes` | `Préstamos` | `Incidencias` | `Auditoría*`

`*` El tab Auditoría requiere `EXPEDIENT_AUDIT_VIEW`, fuera del array de capabilities
operativas. OQ-EW-003 está RESOLVED.

## Flujo de búsqueda y desambiguación (OQ-EW-001/007 RESOLVED)

Cuando la búsqueda por número devuelve **N > 1** resultados:
1. Se muestra una lista de coincidencias con: número de expediente, nombre del
   derechohabiente, CURP y número ISSSTE.
2. El usuario selecciona manualmente.
3. **Nunca** se abre automáticamente una coincidencia cuando existan varias.
4. La UI acepta búsqueda con `/`, `-` o sin separador; normaliza antes de enviar.

Cuando N = 0: estado vacío descriptivo.
Cuando N = 1: abre el workspace directamente.

El contrato activo es `GET /api/v1/expedientes?numero={numero}` con respuesta
`{ items: ExpedienteSearchItem[] }`. No existe `total` ni paginación. Los items usan
exclusivamente los campos mínimos aprobados por SEARCH-EW-002.

## Privacidad
- Número de expediente y datos de paciente no aparecen en `document.title`,
  URL visible, toasts ni nombres de archivo exportado.
- Ver INT-009.

## Fuente
UC-018, SPEC-009, DDD-013, BIZ-007, API-011,
DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001.

## Extensión v0.3.21

OQ-EW-003 queda RESOLVED: Auditoría requiere `EXPEDIENT_AUDIT_VIEW`, que no es
capability. Sin ella queda oculta y no consulta; con ella consume GET `/audit`, muestra
items sanitizados y mantiene cursor opaco.

`DispatchExpedienteDialog` captura destination mediante selector de Ubicación,
intendedCustodian type/reference y businessReference type/id opcional.
`AcceptCustodyDialog` captura receptor type/reference/service nullable,
ubicacionDestino y businessReference type/id opcional. Ambos usan rowVersion actual no
editable, omiten metadata server-side, preservan input ante errores y refrescan después
de 204. No existen catálogos de custodios, tipos ni business references. Las opciones
dependen de `ListUbicaciones`, cuyo endpoint exige `LOCATION_VIEW`. La UI no evalúa esa
permission: consume el endpoint y aplica Problem Details vigente ante 403.
