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
# APP-010 — Agenda / SIMEF Import

Wizard UI, no lifecycle Domain:
1 Seleccionar
2 Validar
3 Procesar
4 Resultado

No se muestra hash, metadata técnica, raw o filename después de la selección.

## API-AP-001..014

El slice inicial ejecuta un único POST síncrono y después consulta recursos. Los pasos
del wizard son presentación, no commands/transacciones separadas. La futura UI no muestra
hash/fingerprint, raw o filename, no interpreta cursor y no calcula outcomes.

Retry usa la misma Idempotency-Key. Turno/Consultorio permanecen fuera. Esta propagación
no diseña ni implementa componentes.

La futura UX presenta ImportOutcome separado de resultados/incidencias de fila. No
inventa PARTIAL/FAILED, no trata incidencia como 4xx y no mezcla retirada con fila
recibida. Esta propagación sólo define estados conceptuales.

## Agenda del día e historial — v0.1.1

Preparación de Agenda es el concepto visible; upload es mecanismo. El dashboard consume
`AgendaDayReadModel` y no deriva conteos en cliente. Importaciones consume
`ListAgendaImports`, filtro opcional por fecha, cursor opaco y “Cargar más”, sin
total/page numbers. Empty history es válido. No muestra raw, filename, fingerprint,
actorRef o datos personales.

## Lista e impresión — v0.1.7

La lista agrupa Servicio/Especialidad por nombre/código y médico por nombre/número de
empleado, ASC. El usuario puede seleccionar `APPOINTMENT_TIME_ASC` —default— o
`PATIENT_NAME_ASC`; FOLIO es tie-breaker. Cambiar order descarta el cursor opaco y vuelve
al inicio.

Pantalla e impresión usan exactamente la misma secuencia. La impresión recupera la
colección vigente completa sin cursor, usa `AGENDA_VIEW`, no introduce `AGENDA_PRINT`,
no fija PDF y no genera SM10-1.
