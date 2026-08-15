---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-021 — Agenda Externa / Anti-Corruption Layer
SIMEF pertenece a un contexto externo.
SIGAC importará solo la representación necesaria.
Candidate ACL: AgendaImportAdapter.
Candidate objects: AgendaVersion, AgendaItem, AgendaFingerprint, AgendaReconciliationResult.
Una importación no se asume definitiva.
