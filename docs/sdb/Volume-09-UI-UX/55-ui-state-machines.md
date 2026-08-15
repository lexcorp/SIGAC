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
# INT-001 — UI State Machines

UI reflects domain state; it does not invent state.

Example conceptual request progression:
PENDIENTE → ASIGNADA → EN_BUSQUEDA → LOCALIZADA → PREPARADA → ENTREGADA → DEVUELTA → REARCHIVADA

Exception branches may create/incorporate incidents.

Exact state names/transitions must be generated from validated domain/specs before implementation.
