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
# SEC-030 — File Upload / Agenda Import Security

- allow-list file formats;
- size limits;
- generated server-side filename;
- temporary quarantine/staging;
- never execute uploaded files;
- parse with hardened libraries;
- protect against zip bombs if archives supported;
- reject formulas/macros where not needed;
- validate row/column counts;
- delete staging according to policy;
- malware scanning if institutional tooling exists.
