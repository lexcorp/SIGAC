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
# DAT-016 — Search

Search MVP:
- expediente_numero exact/prefix;
- identificador institucional;
- nombre paciente normalizado;
- solicitud activa;
- ubicación/custodia actual.

## PostgreSQL
Start with btree + normalized text indexes.
`pg_trgm` candidate if fuzzy patient-name search is needed and approved.

No external search engine initially.
