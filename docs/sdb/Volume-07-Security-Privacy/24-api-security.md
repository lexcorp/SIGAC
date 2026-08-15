---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.1.0"
status: "Draft for security/privacy validation"
date: "2026-08-13"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-024 — API Security

Antes de Application, el resolver server-side valida que el TenantContext trusted y
allow-listed pertenezca a `actor.tenantIds`. Body/query no pueden aportar tenant,
databaseName, connection string, actor, requestId ni correlationId. Los tipos HTTP no
cruzan el boundary hacia Application.

Los errores de validación HTTP no reflejan valores recibidos ni mensajes internos de
framework. Problem Details puede listar sólo field + código cerrado (`REQUIRED`,
`INVALID_FORMAT`, `INVALID_TYPE`, `OUT_OF_RANGE`) y nunca datos C3, tokens, cookies,
stack traces, SQL, database names o connection strings.

- auth mandatory by default;
- authorization in application layer;
- schema validation;
- mass-assignment prevention;
- pagination limits;
- object-level authorization;
- tenant context before repository access;
- idempotency for imports/commands selected;
- safe error responses;
- OpenAPI contract tests.
