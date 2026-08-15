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
no son propietarios del audit. Application entrega un `AuditEntry` semántico y el
`RequestContext` canónico. El writer crea el `AuditRecord` completo con `actorRef` y
tenant desde el contexto, `requestId`, `correlationId` y `source` desde el contexto y
`occurredAt` establecido al hacer append. El contrato sólo permite append.

`requestId` identifica una ejecución concreta y `correlationId` un flujo lógico; no son
intercambiables. El contexto se construye y valida en la frontera server-side, nunca
desde body/query arbitrarios.

Para `GetExpediente`, la acción canónica es `EXPEDIENTE_VIEW`, el recurso es
`EXPEDIENTE` y los resultados son exactamente `success`, `denied`, `not-found`.
Los intentos fallidos también se registran sin datos C3.
