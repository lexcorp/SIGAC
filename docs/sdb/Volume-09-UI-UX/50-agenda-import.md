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

Wizard:
1 Upload
2 Validate
3 Review
4 Reconcile
5 Complete

Display source file hash/metadata only to authorized technical/admin roles where useful.

## API-AP-001..014

El slice inicial ejecuta un único POST síncrono y después consulta recursos. Los pasos
del wizard son presentación, no commands/transacciones separadas. La futura UI no muestra
hash/fingerprint, raw o filename, no interpreta cursor y no calcula outcomes.

Retry usa la misma Idempotency-Key. Turno/Consultorio permanecen fuera. Esta propagación
no diseña ni implementa componentes.

La futura UX presenta ImportOutcome separado de resultados/incidencias de fila. No
inventa PARTIAL/FAILED, no trata incidencia como 4xx y no mezcla retirada con fila
recibida. Esta propagación sólo define estados conceptuales.
