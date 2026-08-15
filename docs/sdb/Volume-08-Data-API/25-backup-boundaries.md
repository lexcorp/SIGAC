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
# DAT-025 — Backup Boundaries

Backup units:
- sigac_control;
- each tenant database;
- IdP configuration/database;
- deployment configuration;
- secrets recovery mechanism.

Per-tenant restore must not require restoring all hospitals.
