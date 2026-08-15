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
# API-004 — Authentication

OIDC access/session context validated at boundary.

## Session authorization projection v0.3.23

GET `/api/v1/session` requiere autenticación y responde únicamente
`{actorId,permissions}` mediante `GetSessionAuthorization` desde el RequestContext
server-side. No requiere permission
adicional. No expone roles, tenantIds, claims OIDC raw, tokens/cookies, capabilities ni
configuración de tenant/database. Request no autenticada produce
`AUTHENTICATION_REQUIRED`/401.

API never accepts user identity from request body.

Actor is derived from authenticated security context.
