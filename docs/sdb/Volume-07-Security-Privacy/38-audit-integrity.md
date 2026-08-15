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
# SEC-038 — Audit Integrity

- append-oriented write path;
- application role cannot update/delete audit rows;
- retention policy;
- timestamps server-side;
- actor and tenant mandatory;
- correlation ID;
- privileged export controlled;
- periodic integrity/reconciliation checks candidate.

Cryptographic chaining is optional and requires separate ADR; not required by default.

## Enforcement para Expediente Workspace

Los Use Cases escriben mediante el puerto de Application `AuditWriter`; los controllers
no son propietarios del audit. El contrato sólo permite append y requiere
`actorRef`, `action`, `resourceType`, `resourceId`, `result`, `occurredAt`, `requestId`,
`correlationId` cuando aplique, `source` y metadata mínima permitida. `TenantContext` es
obligatorio en cada append.

Para `GetExpediente`, la acción canónica es `EXPEDIENTE_VIEW`, el recurso es
`EXPEDIENTE` y los resultados son exactamente `success`, `denied`, `not-found`.
Los intentos fallidos también se registran sin datos C3.
