---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-14"
amended: "2026-08-15 — OQ-DAT-001/OQ-DAT-004 RESOLVED; DB-EW-001..014 aplicadas"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# Open Data/API Questions

## Cerradas (2026-08-14)

| OQ | Pregunta | Resolución |
|----|----------|------------|
| OQ-DAT-001 | Exact expediente identifier format? | RESOLVED — patrón `RFC_BASE_10 + SEP + COD_2`; separadores `/`, `-` o sin sep.; representación preferente `/`; campo normalizado sin sep. para búsqueda. Ver DAT-006, DAT-016, DDD-007. |
| OQ-DAT-004 | Whether Movimiento stored in expediente module or dedicated schema? | RESOLVED — propiedad de Archive Operations y tabla `movimientos_expediente` en cada database tenant, separada de `audit_log`. Ver TL-EW-007 y DB-EW-001..014. |

## Aclaración sobre OQ-API-002

OQ-API-002 (BFF vs direct SPA token model) — no se resuelve en este ciclo.
La arquitectura BFF-OIDC está definida en ADR-0027; la pregunta abierta refiere
detalles de implementación del token flow que no impactan el modelo de datos
de expediente-workspace v0.2.0.

## Abiertas

OQ-DAT-002 Patient master source?
OQ-DAT-003 Need multiple TOMOS as independent physical units?
OQ-DAT-005 Exact retention periods?
OQ-DAT-006 Need pg_trgm for fuzzy patient-name search?
OQ-DAT-007 Need RLS on control DB shared tables?
OQ-DAT-008 Exact import columns from SIMEF?
OQ-API-001 `If-Match` 412 vs domain 409 convention?
OQ-API-002 BFF vs direct SPA token model (detalles de implementación)?
OQ-API-003 Need bulk preparation commands?
OQ-API-004 Need webhook/event delivery?
OQ-API-005 Export file formats?
OQ-API-006 Max history/report window?
