---
inclusion: always
---
# Security
Nunca debilitar auth, autorización, tenant isolation, audit o privacidad. TenantContext se resuelve server-side. No loguear datos de paciente, tokens o secretos. Tests/DEMO usan datos sintéticos. Ambigüedad => STOP_AND_ESCALATE.
