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
# SEC-044 — Network Security

- reverse proxy is public/internal entry;
- DB inaccessible from users;
- admin paths restricted;
- default-deny firewall where feasible;
- egress restriction for server;
- DNS/NTP trusted;
- segmentation between app/DB/management;
- no trust solely because source is hospital LAN.
