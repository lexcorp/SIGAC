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
# SEC-026 — Output Encoding

React default escaping is not a reason to trust data.

- never render untrusted HTML by default;
- sanitize explicitly approved rich content;
- context-aware encoding;
- CSV export protects against formula injection;
- filenames/content-disposition sanitized.
