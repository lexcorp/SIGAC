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
# API-018 — Reporting

GET /reports/dashboard
GET /reports/preparation
GET /reports/loans
GET /reports/incidents
GET /reports/search-times

Exports:
explicit permission, bounded date ranges, audit.
