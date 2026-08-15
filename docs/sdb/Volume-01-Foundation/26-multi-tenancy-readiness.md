---
project: SIGAC
sdb_volume: 01-Foundation
version: 0.1.0
status: Draft for functional validation
---
# FND-026 — Multi-Tenancy Readiness
SIGAC deberá poder atender múltiples hospitales. Hospital es concepto de dominio; Tenant es arquitectura/aislamiento.
Readiness: IDs no acoplados, configuración organizacional, catálogos tenant-scoped cuando corresponda, aislamiento, auditoría con contexto, migraciones y backup tenant-aware.
No decidido: database-per-tenant, schema-per-tenant o shared+tenant_id. Se resolverá por ADR.
