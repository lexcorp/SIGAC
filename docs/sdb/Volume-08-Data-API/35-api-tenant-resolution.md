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
# API-005 — Tenant Resolution

Candidate sources:
- host/subdomain;
- server-maintained user tenant selection;
- trusted session claim validated against control DB.

Never:
`tenant_id` from arbitrary JSON body → database name.

Resolved tenant becomes immutable RequestContext.
