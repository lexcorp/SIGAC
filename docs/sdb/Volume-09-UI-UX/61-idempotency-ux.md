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
# INT-007 — Idempotency UX

Disable duplicate submit while request is pending, but do not rely on UI alone.
Retry-safe commands use backend idempotency where specified.
Network ambiguity should show “verificando resultado” before encouraging repeat action.
