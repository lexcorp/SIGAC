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
# SEC-005 — Privacy Data Inventory

Inventario candidato:

| Dato | Necesidad | Clasificación |
|---|---|---|
| ExpedienteNumero | Identificación operativa | C3 |
| Nombre paciente | Búsqueda/identificación | C3 |
| Identificador institucional | Desambiguación | C3 |
| Consultorio/servicio | Flujo operativo | C2/C3 según contexto |
| Ubicación expediente | Localización | C2/C3 |
| Custodio | Responsabilidad | C2/C3 |
| Usuario actor | Auditoría | C2 |
| Timestamps | Auditoría | C2 |
| Incidencia | Operación | C3 |
| Diagnóstico | No requerido MVP | NO RECABAR |
| Nota clínica | No requerido MVP | NO RECABAR |
