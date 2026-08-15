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
# UX-006 — Responsive Strategy

Desktop-first por naturaleza operacional.

Breakpoints conceptuales:
- Wide ≥ 1440: navegación + workspace + context panel.
- Desktop 1024–1439: navegación + workspace; panel contextual en drawer.
- Tablet 768–1023: operaciones seleccionadas.
- Mobile <768: consulta/acciones simples; no prometer paridad para workflows masivos.

La matriz final depende del hardware institucional.
