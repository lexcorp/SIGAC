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
# DAT-001 — Data Principles

1. PostgreSQL es la fuente transaccional primaria.
2. Un tenant/hospital operativo tiene su propia base de datos lógica.
3. El control plane no almacena expedientes/pacientes.
4. IDs técnicos opacos; identificadores institucionales se conservan aparte.
5. Constraints en DB protegen invariantes simples.
6. Reglas complejas permanecen en dominio/aplicación.
7. Historial crítico es append-oriented.
8. Auditoría, Movimiento y Outbox son conceptos distintos.
9. Datos clínicos no se agregan al MVP.
10. Las migraciones son versionadas y reproducibles.
