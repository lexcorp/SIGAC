---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-026 — Multi-Tenancy Boundary
HospitalId es contexto de negocio.
TenantId es frontera arquitectónica.
No contaminar lenguaje del negocio con SaaS.
La estrategia database-per-tenant/schema/shared se decidirá en Architecture/Data.
