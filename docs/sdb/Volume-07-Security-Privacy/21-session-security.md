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
# SEC-021 — Session Security

La frontera HTTP autenticada produce `ActorContext` sin fijar nombres de claims OIDC en
este slice. Una request sin identidad autenticada produce
`AUTHENTICATION_REQUIRED`/401. El `correlationId` sólo se propaga desde una fuente
trusted aprobada; si falta se genera, siempre distinto del `requestId` de la petición.

- OIDC Authorization Code + PKCE para SPA.
- Access tokens cortos.
- Refresh handling según patrón aprobado.
- No tokens en localStorage si se adopta BFF/cookie session.
- Cookies: Secure, HttpOnly y SameSite adecuado cuando aplique.
- idle timeout y absolute timeout configurables.
- revocación/invalidación en pérdida de privilegios cuando IdP lo soporte.
- no registrar tokens/session IDs.
- regenerar contexto tras cambios de autenticación.
