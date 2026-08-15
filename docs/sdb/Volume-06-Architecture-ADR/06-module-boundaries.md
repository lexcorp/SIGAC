---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-006 — Module Boundaries

Módulos backend:
- archive-operations
- requests
- preparation
- loans
- incidents
- reference-data
- identity-access
- reporting-audit
- integrations
- tenant-platform

## Regla
Un módulo no modifica directamente tablas propiedad de otro módulo. Interactúa mediante application services, ports o eventos internos.

## Shared Kernel mínimo
- IDs técnicos.
- Result/Error primitives.
- Date/time abstractions.
- TenantContext.
- Transaction boundary.
No compartir entidades de dominio por comodidad.

## HTTP boundary

Un resolver de infraestructura convierte el contexto HTTP autenticado en el
`RequestContext` canónico. Los tipos HTTP/NestJS no entran a Application. Controllers
sólo invocan Use Cases canónicos y no acceden directamente a Repository. Actor, tenant
y trazabilidad se resuelven server-side antes del Use Case.

El módulo API de Expediente es configurable mediante providers/tokens NestJS para el
resolver y los cuatro Use Cases de T-11. El composition root construye autenticación,
tenant resolver, projection/persistence adapters y UoW antes de registrar el módulo.
El controller no conoce esos puertos internos. Tests pueden aportar fakes explícitos;
`AppModule` productivo no registra fakes ni monta el módulo sin dependencias reales.
