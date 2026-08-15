---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# API-015 — Devoluciones

POST /devoluciones

Request candidate:
- expedienteId
- prestamoId optional
- returnedByRef
- conditionCode
- notes

Response indicates:
- returnReceived
- loanClosed status
- pendingRearchive
- incidentCreated optional
