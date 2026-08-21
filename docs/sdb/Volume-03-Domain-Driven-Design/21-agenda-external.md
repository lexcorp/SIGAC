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

RESULT-AP-001..014 reemplaza nombres exploratorios para el slice: ImportacionAgenda,
Agenda, Cita, RecordProcessingResult e ImportIncident. Fingerprint es metadata, no
identidad. Cada fila termina en uno de los siete resultados aprobados.
