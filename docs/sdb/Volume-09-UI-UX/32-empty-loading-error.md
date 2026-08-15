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
# DS-016 — Empty / Loading / Error

Differentiate:
- no data exists;
- no search results;
- no results under filters;
- permission unavailable;
- loading;
- service failure;
- stale/concurrency conflict.

Every recoverable state offers a next action.
