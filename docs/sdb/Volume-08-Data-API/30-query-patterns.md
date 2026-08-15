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
# DAT-030 — Query Patterns

Optimized queries:
- current expediente status;
- expediente timeline;
- pending preparation;
- overdue loans;
- open incidents;
- agenda import errors;
- requests by date/service;
- returned pending rearchive.

Avoid giant “everything joins everything” screens. Use purpose-built read models.
