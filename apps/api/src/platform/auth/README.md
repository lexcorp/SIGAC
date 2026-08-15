# BFF Authentication Adapter

Target:
- Authorization Code flow handled server-side.
- NestJS acts as confidential OIDC client.
- Browser receives an opaque HttpOnly/Secure/SameSite session cookie.
- OIDC access/refresh tokens remain server-side.
- Session maps actor identity and authorized tenants.

Do not implement direct browser token storage without a new ADR.
