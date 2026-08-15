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
# DS-018 — Agenda File Import

Flow:
Select file → validation → preview summary → errors → reconcile → result.

Never represent upload success as reconciliation success.
Show row counts: total, valid, invalid, added, changed, removed.
