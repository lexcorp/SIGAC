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
# API-021 — Platform / Tenant Admin

Control-plane API kept separate from tenant business API where possible.

Examples:
GET /platform/tenants
POST /platform/tenants
POST /platform/tenants/{id}/provision
POST /platform/tenants/{id}/migrate
POST /platform/tenants/{id}/demo-reset

Strong admin auth required.
