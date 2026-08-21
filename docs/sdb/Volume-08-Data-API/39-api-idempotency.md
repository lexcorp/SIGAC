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
# API-009 — Idempotency

Use `Idempotency-Key` for:
- agenda import;
- open loan candidate;
- custody transfer candidate;
- external integration commands.

Server stores key + request fingerprint + response for bounded window.

Same key + different payload → 409.

Agenda import requiere `Idempotency-Key`, scoped por actor+tenant+operación durante una
ventana configurable. Misma key/artefacto devuelve 201/Location/body originales sin
reprocesar; misma key/artefacto distinto usa `IDEMPOTENCY_KEY_REUSED`/409. Key nueva con
archivo idéntico crea ImportacionAgenda `ALREADY_IMPORTED` sin duplicar Agenda/Cita.
