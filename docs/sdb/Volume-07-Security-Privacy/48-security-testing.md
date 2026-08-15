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
# SEC-048 — Security Testing

Required suites:
- authorization matrix tests;
- tenant isolation tests;
- IDOR/BOLA tests;
- session tests;
- input validation;
- upload abuse;
- privilege escalation;
- audit generation;
- sensitive-data logging tests;
- backup/restore security;
- dependency/configuration scans.
