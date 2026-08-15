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

- OIDC Authorization Code + PKCE para SPA.
- Access tokens cortos.
- Refresh handling según patrón aprobado.
- No tokens en localStorage si se adopta BFF/cookie session.
- Cookies: Secure, HttpOnly y SameSite adecuado cuando aplique.
- idle timeout y absolute timeout configurables.
- revocación/invalidación en pérdida de privilegios cuando IdP lo soporte.
- no registrar tokens/session IDs.
- regenerar contexto tras cambios de autenticación.
