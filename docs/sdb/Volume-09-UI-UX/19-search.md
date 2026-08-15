---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.1.0"
status: "Draft for UX/UI validation"
date: "2026-08-13"
design_direction: "Clinical operational UI"
frontend: "React + TypeScript + Vite"
api_contract: "REST/OpenAPI /api/v1"
---
# DS-003 — Search

Universal Search is first-class.
Search field supports expediente number, patient/reference identifiers and supported patient name lookup.

Results grouped by resource when useful.
Recent searches are local/user-scoped only if privacy policy permits.

## Expediente Workspace v0.3.20

La búsqueda por número consume exclusivamente
`GET /api/v1/expedientes?numero={numero}` y su wrapper `{ items }`. El frontend puede
normalizar separadores para presentación/envío, pero el VO server-side conserva la
autoridad canónica. Flujo obligatorio: 0 items muestra estado vacío; 1 item abre el
Workspace; N > 1 muestra `DisambiguationList` y exige selección manual. Nunca se
auto-selecciona entre múltiples coincidencias.
