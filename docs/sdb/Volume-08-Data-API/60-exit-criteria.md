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
# Exit Criteria — Volume 08

Ready for Volume 09 UI/UX when:
- main entities have stable physical shape;
- API resources cover MVP workflows;
- error/pagination/idempotency policies are chosen;
- tenant data boundaries are accepted;
- OpenAPI starter exists;
- open data questions have owners;
- security controls are represented in contracts.
