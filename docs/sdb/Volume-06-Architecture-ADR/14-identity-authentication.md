---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-014 — Identity & Authentication

## Decision
Use standard OpenID Connect/OAuth 2.0.

## Reference implementation
Keycloak self-hosted is recommended when no institutional IdP is available. If a hospital already has an IdP, SIGAC integrates through OIDC rather than replacing it.

## Token model
- short-lived access token;
- identity claims only as necessary;
- roles/groups mapped to SIGAC permissions;
- tenant/hospital assignment validated by SIGAC, not trusted solely from UI.

## Important
Authentication answers “who are you?”; domain authorization answers “may you do this here, for this type of request?”.
