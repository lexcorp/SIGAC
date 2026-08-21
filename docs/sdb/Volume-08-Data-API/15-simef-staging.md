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

Modelo histórico candidato superseded parcialmente por RAW-AP-001..012; no es DDL.

`agenda_imports`
- id
- metadata sanitizada; no filename proporcionado por cliente
- file_sha256
- imported_by_ref
- imported_at
- status
- row_count
- valid_count
- invalid_count
- effective_date

`agenda_staging_rows` (sólo transitorio)
- id
- import_id
- row_number
- raw transitorio, eliminado al finalizar/abortar
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

Staging dura sólo lo necesario, con máximo configurable y nunca indefinidamente. La
evidencia durable usa valores allow-listed, interpretación/resolución, fingerprint/layout
y conteos. El schema físico permanece pendiente.
