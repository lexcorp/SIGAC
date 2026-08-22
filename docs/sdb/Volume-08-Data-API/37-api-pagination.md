---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# API-007 — Pagination

Default:
cursor pagination for histories/audit/movements.

Response:
- items
- nextCursor
- hasMore

Offset pagination acceptable for small reference catalogs.

Server enforces max page size.

Para Expediente Timeline el contrato específico es `{ items, nextCursor }`; no exige
`hasMore` ni `total`. El cursor opaco representa `occurredAt + movimientoId`. El orden es
`occurredAt DESC, movimientoId DESC`. No hay un máximo numérico canónico aprobado, por
lo que este slice no inventa uno.

Para Expediente Audit el contrato específico también es `{items,nextCursor}`, sin
`hasMore` ni `total`. El orden determinista es `occurredAt DESC, auditId DESC`; el
cursor opaco representa `occurredAt + auditId`. Application, API y frontend sólo lo
reciben y reenvían.

Agenda results/incidents/preparation-items usa `{items,nextCursor}`, sin total/hasMore.
`limit` positivo requerido, máximo configurable. Resultados/incidencias usan cursor
opaco posición+registroId y posición+incidenciaId ASC. Preparation-items agrupa por
Servicio nombre/código y médico nombre/número de empleado ASC; admite
`APPOINTMENT_TIME_ASC` —default, hora/FOLIO— y `PATIENT_NAME_ASC` —nombrePaciente/FOLIO—.
Su cursor incluye conceptualmente todas las claves y queda ligado al order; cambiarlo
reinicia desde el principio.
