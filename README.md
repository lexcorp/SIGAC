# SIGAC — Unified Repository v0.2.0

Este repositorio consolida en una sola estructura:

1. Repository Bootstrap Pack
2. SDB Master v1.0-draft — 12 volúmenes canónicos
3. Agentic Engineering Extension
4. Fuentes originales del proyecto

## Fuente de verdad

Normatividad/evidencia → SDB → ADR Accepted → Specs aprobadas → OpenAPI/contratos → AGENTS/steering → código.

## Estructura canónica SDB

- Volume-01 Foundation
- Volume-02 Business & Compliance
- Volume-03 Domain-Driven Design
- Volume-04 Workflows & Event Storming
- Volume-05 Use Cases & SDD Specifications
- Volume-06 Architecture & ADR
- Volume-07 Security & Privacy
- Volume-08 Data & API
- Volume-09 UI/UX
- Volume-10 Testing & Quality
- Volume-11 DevOps & Operations
- Volume-12 OpenSpec / SpecBoot

El antiguo `Volume 10 — Implementation & Engineering` se conserva sólo bajo `docs/legacy/`.

## Primer paso

No pidas a Kiro que construya el sistema completo. Primero valida el bootstrap y después usa el experimento controlado de `Expediente Workspace`.

---

# SIGAC Repository Bootstrap Pack

This is the implementation bootstrap for SIGAC.

It does **not** replace the Software Design Book. The SDB remains the design/specification source
of truth. This repository skeleton gives Codex and developers a constrained place to implement it.

## Prerequisites

- Node.js 24 LTS
- Corepack
- Docker or Podman with Compose-compatible workflow
- Git
- VS Code recommended

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres keycloak
pnpm db:bootstrap
pnpm dev
```

Then open:
- Web: http://localhost:5173
- API: http://localhost:3000/api/v1/health
- Keycloak dev console: http://localhost:8080

## First implementation slice

`Expediente lookup / Workspace`

Read:
1. SDB Volume 03 — Aggregate Expediente
2. Volume 05 — UC-018 / SPEC-009
3. Volume 08 — API-011
4. Volume 09 — Expediente Workspace
5. Volume 10 — Codex Operating Contract
6. `AGENTS.md`

## Security note

Development identity/configuration is only for local bootstrap. Production must use the approved
OIDC/BFF configuration and institutional security controls.
