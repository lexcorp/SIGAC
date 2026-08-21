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
# DAT-026 — Data Security

- application DB role least privilege;
- migration role separate;
- backup role separate;
- no cross-tenant DB credentials exposed to browser;
- connection selection server-side;
- sensitive fields not copied into logs;
- exports permission-controlled;
- DEMO never receives production rows.

Agenda SIMEF, staging y persistencia están aislados por tenant. No hay storage raw
compartido sin namespace ni selección desde filename/contenido. Raw no se expone a
humanos y se descarta al outcome terminal. Logs/audit/métricas excluyen C3 y raw.
