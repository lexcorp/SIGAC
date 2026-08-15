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
# DAT-015 — SIMEF Import Staging

`agenda_imports`
- id
- filename
- file_sha256
- imported_by_ref
- imported_at
- status
- row_count
- valid_count
- invalid_count
- effective_date

`agenda_staging_rows`
- id
- import_id
- row_number
- raw jsonb
- normalized jsonb
- validation_status
- validation_errors jsonb

`agenda_reconciliation`
- id
- previous_import_id
- new_import_id
- added_count
- changed_count
- removed_count
- reconciled_at

Staging se retiene por periodo técnico configurable y no indefinidamente.
