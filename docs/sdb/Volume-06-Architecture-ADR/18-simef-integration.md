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
# ARC-018 — SIMEF Integration

## Phase 1
Excel/file import through an Anti-Corruption Layer.

Pipeline:
upload → validate → normalize → fingerprint → staging → reconcile → commit domain changes → report errors.

Para Agenda Preparation, archivo y filas raw pertenecen a Infrastructure staging y se
eliminan al concluir/abortar. Domain conserva únicamente valores originales allow-listed
+ interpretación + resolución. `ImportArtifactMetadata` pertenece al ingestion/Application
boundary; su fingerprint no identifica Agenda ni ImportacionAgenda.

API-AP-001..014 adopta streaming síncrono para la escala inicial. El Adapter implementa
`AgendaArtifactStream`; Application no conoce multipart/filesystem. Una UoW tenant-scoped
confirma importación/reconciliación/resultados/métricas/audit. Worker queda diferido.

Parser entrega datos neutrales; Application asigna RecordProcessingResult/ImportIncident
y Domain reconcilia Citas. Resultados de fila no son exceptions, HTTP ni AuditResult.

## Phase 2
If authorized, connector/API integration reuses the same normalized contract.

## Rule
SIMEF column names and statuses never become domain primitives directly.
