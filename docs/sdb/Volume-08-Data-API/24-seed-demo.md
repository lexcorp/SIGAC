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
# DAT-024 — Seed & DEMO

Production seed:
- required system catalogs only.

DEMO seed:
- synthetic patients;
- synthetic expediente numbers;
- predefined jornada;
- active/vencido loans;
- no localizado incident;
- agenda reconciliation scenario.

Seed scripts are versioned and deterministic.
