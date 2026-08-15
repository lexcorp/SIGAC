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
# DEL-003 — Codex UI Guardrails

Codex MUST:
- consume design tokens;
- reuse shared components;
- follow OpenAPI contracts;
- derive actions from capabilities/state;
- preserve keyboard/focus behavior;
- implement loading/empty/error/conflict states;
- add accessibility and interaction tests;
- maintain traceability records.

Codex MUST NOT:
- invent business states;
- invent permissions;
- hardcode tenant identity;
- use color alone for status;
- add dashboard widgets without operational purpose;
- copy reference-site UI verbatim;
- bypass API/domain validation;
- expose audit/security data to unauthorized roles.
