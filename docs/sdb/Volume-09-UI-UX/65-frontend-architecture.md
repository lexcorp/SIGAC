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
# DEL-002 — Frontend UI Architecture

Target from architecture:
React + TypeScript + Vite.

Suggested UI layering:
- app shell
- routes
- feature modules
- shared design-system primitives
- API generated/client layer
- authorization/capability adapter
- query/cache layer
- forms
- telemetry/error boundary

Frontend must not contain authoritative domain transition logic.
