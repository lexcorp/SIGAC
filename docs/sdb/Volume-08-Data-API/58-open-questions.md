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
# Open Data/API Questions

OQ-DAT-001 Exact expediente identifier format?
OQ-DAT-002 Patient master source?
OQ-DAT-003 Need multiple TOMOS as independent physical units?
OQ-DAT-004 Whether Movimiento stored in expediente module or dedicated schema?
OQ-DAT-005 Exact retention periods?
OQ-DAT-006 Need pg_trgm?
OQ-DAT-007 Need RLS on control DB shared tables?
OQ-DAT-008 Exact import columns from SIMEF?
OQ-API-001 `If-Match` 412 vs domain 409 convention?
OQ-API-002 BFF vs direct SPA token model?
OQ-API-003 Need bulk preparation commands?
OQ-API-004 Need webhook/event delivery?
OQ-API-005 Export file formats?
OQ-API-006 Max history/report window?
