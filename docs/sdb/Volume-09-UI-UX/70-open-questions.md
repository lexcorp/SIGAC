---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.2.0"
status: "Draft for UX/UI validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-UX-004, OQ-UX-005 cerradas"
design_direction: "Clinical operational UI"
frontend: "React + TypeScript + Vite"
api_contract: "REST/OpenAPI /api/v1"
---
# Open UX/UI Questions

## Cerradas (2026-08-14)

| OQ | Pregunta | Resolución |
|----|----------|------------|
| OQ-UX-004 | Which patient identifiers may appear in high-density queues? | RESOLVED — número de expediente (`RFC/COD`), nombre del derechohabiente, CURP, número ISSSTE. Todos C3; mostrar solo el mínimo necesario para la tarea. Ver SEC-003, INT-009, DECISION-REGISTER OQ-EW-007. |
| OQ-UX-005 | Exact validated state vocabulary from domain specs? | RESOLVED — `EstadoOperativo` del Expediente: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO. `EN_BUSQUEDA` es estado de Solicitud. Ver DEC-EW-STATE-001, DDD-012. |

## Abiertas

OQ-UX-001 Exact workstation resolutions used in Archivo Clínico?
OQ-UX-002 Touch screens used?
OQ-UX-003 Barcode scanner expected in MVP or later?
OQ-UX-006 Which bulk actions are permitted?
OQ-UX-007 Need printer/label workflows?
OQ-UX-008 Which roles may see Audit tab?
OQ-UX-009 Preferred hospital branding co-existence with SIGAC?
OQ-UX-010 Dark mode needed? Default proposal: no for MVP.
OQ-UX-011 Exact notification center scope?
OQ-UX-012 Mobile use cases, if any?
