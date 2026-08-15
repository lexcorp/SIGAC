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
# Open Engineering Questions

OQ-ENG-001 Monorepo tool: npm workspaces, pnpm or Nx?
OQ-ENG-002 ORM/query layer: Prisma, Drizzle, TypeORM or explicit SQL adapter?
OQ-ENG-003 Migration tool?
OQ-ENG-004 Test runner: Vitest/Jest?
OQ-ENG-005 E2E: Playwright?
OQ-ENG-006 UI component foundation: custom/headless library?
OQ-ENG-007 Query cache: TanStack Query?
OQ-ENG-008 Form library?
OQ-ENG-009 OIDC frontend pattern: BFF vs SPA PKCE direct?
OQ-ENG-010 Container registry available?
OQ-ENG-011 CI platform: GitHub Actions or institutional CI?
OQ-ENG-012 staging topology?
OQ-ENG-013 deployment runtime: Docker vs Podman?
OQ-ENG-014 ORM migrations across database-per-tenant implications?
OQ-ENG-015 coding language conventions: Spanish domain names vs English technical layer?
