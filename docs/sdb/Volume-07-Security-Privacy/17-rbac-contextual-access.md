---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.2.0"
status: "Draft for security/privacy validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: enabling source añadida a la tupla"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-017 — RBAC + Contextual Access

## Decisión
- RBAC para permiso grueso (rol del actor).
- Policy/context checks para tipo de solicitud, hospital, estado del recurso,
  finalidad y fuente habilitante de salida.

## Tupla de autorización (actualizada — OQ-EW-005 RESOLVED)

`subject + permission + tenant + resource + business context + enabling source`

| Componente | Descripción |
|------------|-------------|
| `subject` | Actor autenticado (usuario + roles) |
| `permission` | Acción solicitada (ej. `LOAN_OPEN`, `EXPEDIENT_VIEW`) |
| `tenant` | Hospital/tenant resuelto server-side; nunca del body |
| `resource` | Recurso específico (expediente, solicitud, préstamo…) |
| `business context` | Estado del recurso, tipo de solicitud, servicio, etc. |
| `enabling source` | `FuenteHabilitanteSalida` para operaciones de salida/préstamo |

## Principio
El backend **siempre** re-verifica autorización completa en cada petición.
No se delega la verificación al frontend.

## Aplicación a préstamos/salidas (OQ-EW-005)
- `CONSULTA_PROGRAMADA`: el rol Archivo/Jefatura es suficiente; no se requiere
  verificación de actor emisor adicional.
- `VALE_ARCHIVO_SM_1_14`: además del rol, se verifica que el actor emisor del vale
  sea Director, Subdirector o Coordinación Médica.
- `ORDEN_SUPERIOR`: verificación pendiente de spec detallada.

## Fuente
BIZ-016, DDD-010, DECISION-REGISTER OQ-EW-005, NIST SP 800-207.
