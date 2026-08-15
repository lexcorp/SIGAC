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
# DEL-005 — UX Acceptance Criteria

Given an authorized archivist
When they open Dashboard
Then pending operational work is visible without navigating through reports.

Given an expediente
When Workspace opens
Then current state, location and custody are visible above the fold.

Given an invalid transition
When user attempts the command
Then the UI preserves context and explains that the action is unavailable.

Given keyboard-only use
When navigating core workflows
Then all required actions are reachable with visible focus.
