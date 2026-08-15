---
project: SIGAC
sdb_volume: "10 - Implementation & Engineering"
version: "0.1.0"
status: "Draft for engineering validation"
date: "2026-08-14"
architecture:
  style: "Modular Monolith + Clean Architecture"
  backend: "TypeScript + Node.js LTS + NestJS"
  frontend: "React + TypeScript + Vite"
  database: "PostgreSQL"
  api: "REST/OpenAPI"
  tenancy: "database-per-tenant"
---
# Volume 10 — Implementation & Engineering

Este volumen convierte el Software Design Book en reglas concretas de construcción.

## Objetivo
Permitir que un equipo humano o Codex pueda implementar SIGAC sin volver a decidir:
- arquitectura;
- límites de módulos;
- estructura del repositorio;
- convenciones;
- patrones de aplicación;
- testing;
- CI/CD;
- migrations;
- observabilidad;
- seguridad;
- documentación.

## Principio
La implementación debe seguir:

Spec → Use Case → Application Service → Domain → Repository Port → Infrastructure Adapter → API/UI

No se permite que Controller, ORM o UI sustituyan las reglas del dominio.
