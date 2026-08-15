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
# API-019 — Audit

Restricted endpoint:
GET /audit?resourceType=EXPEDIENTE&resourceId=...

No mutation endpoints.

Pagination mandatory.
Sensitive technical fields may be redacted based on role.
