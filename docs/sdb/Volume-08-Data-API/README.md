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
# Volume 08 — Data & API

Este volumen traduce el dominio, workflows, specs, arquitectura y seguridad de SIGAC a:

- modelo lógico y físico de datos;
- ownership de tablas por módulo;
- estrategia control-plane + database-per-tenant;
- auditoría y outbox;
- staging/reconciliación de agenda SIMEF;
- índices y búsqueda;
- migraciones;
- retención;
- contratos REST;
- OpenAPI;
- paginación, idempotencia, errores y versionado;
- contratos consumibles por frontend, Codex e integraciones.

## Principio

El modelo de datos implementa el dominio; no lo redefine.

`Expediente` continúa siendo el concepto central.  
`Movimiento`, `Audit Log` y `Domain Event` permanecen separados.
