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
# Volume 06 — Architecture & ADR

Este volumen convierte los requisitos funcionales y de dominio de SIGAC en una arquitectura técnica concreta y gobernada por decisiones explícitas.

## Baseline recomendado

- **Arquitectura de aplicación:** monolito modular.
- **Estilo interno:** Clean Architecture por módulo / bounded context.
- **Backend:** Node.js LTS + TypeScript + NestJS.
- **Frontend:** React + TypeScript + Vite.
- **API:** REST/JSON documentada con OpenAPI.
- **Base de datos:** PostgreSQL.
- **Autenticación:** OpenID Connect / OAuth 2.0; Keycloak como implementación self-hosted de referencia.
- **Autorización:** RBAC + reglas contextuales en aplicación.
- **Multi-tenancy:** control plane compartido + base de datos lógica separada por tenant para datos operativos.
- **Tenant DEMO:** tenant aislado con base propia y datos sintéticos reseteables.
- **Eventos:** Domain Events internos + Transactional Outbox para integración; no Event Sourcing.
- **Despliegue inicial:** contenedores en infraestructura Linux del hospital.
- **Observabilidad:** logs estructurados, health checks, métricas y trazas compatibles con OpenTelemetry.
- **Integraciones:** Anti-Corruption Layer; SIMEF inicialmente por importación y posteriormente por integración autorizada.

## Filosofía

La arquitectura debe ser suficientemente fuerte para un sistema hospitalario, pero no más compleja de lo necesario. Microservicios, Kubernetes, Event Sourcing y brokers distribuidos no forman parte del baseline inicial.
