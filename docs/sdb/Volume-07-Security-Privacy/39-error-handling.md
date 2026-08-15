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
# SEC-039 — Error Handling

External response:
- safe problem code;
- correlation id;
- user-appropriate message.

Internal log:
- diagnostic detail without secrets/PII overflow.

Never expose:
SQL, stack traces in production, filesystem paths, tokens, DB names/credentials.
