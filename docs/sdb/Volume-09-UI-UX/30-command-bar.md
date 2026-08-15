---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.2.0"
status: "Draft for UX/UI validation"
date: "2026-08-13"
design_direction: "Clinical operational UI"
frontend: "React + TypeScript + Vite"
api_contract: "REST/OpenAPI /api/v1"
---
# DS-014 — Context Command Bar

Shows valid commands for current resource/state/role.
Examples:
Solicitar, Iniciar búsqueda, Marcar localizado, Preparar, Entregar, Recibir devolución, Rearichivar, Reportar incidencia.

Commands must be derived from application capability, not frontend guesses.

Capabilities operativas canónicas del Expediente Workspace:
`SOLICITAR`, `INICIAR_BUSQUEDA`, `MARCAR_LOCALIZADO`, `MARCAR_NO_LOCALIZADO`,
`DISPATCH`, `ACCEPT_CUSTODY`, `ABRIR_PRESTAMO`, `RENOVAR_PRESTAMO`,
`RECIBIR_DEVOLUCION`, `CONFIRMAR_REARCHIVO`, `REPORTAR_INCIDENCIA`.

`EXPEDIENT_VIEW` es permission, no capability. `AUDITOR_CONSULTA` recibe
`capabilities: []` para comandos operativos.

Para `ABRIR_PRESTAMO`, backend evalúa `0..N` fuentes disponibles y requiere al menos una
fuente validada `CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14`. La Command Bar no valida ni
elige fuentes. `ORDEN_SUPERIOR` no habilita la capability en esta spec.
