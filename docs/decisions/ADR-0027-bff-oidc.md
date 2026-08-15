# ADR-0027 — BFF-style OIDC Session

Status: Accepted for bootstrap design; implementation requires security review.

NestJS handles OAuth/OIDC as confidential client and stores tokens server-side.
Browser uses an opaque secure session cookie. Authorization Code flow is used.
This supersedes a direct-token SPA as the preferred SIGAC browser pattern.
