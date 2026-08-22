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

IMP-AP-003 cierra el ownership: `ImportArtifactMetadata`, fingerprint, filename temporal,
staging y detalles de ingestion no pertenecen al Aggregate Domain. Application/UoW
proporciona `ImportacionAgendaId` e `importedAt`; Domain no genera tiempo ni IDs.

API-AP-001..014 adopta streaming síncrono para la escala inicial. El Adapter implementa
`AgendaFileInput` —nombre canónico que sustituye el alias conceptual
`AgendaArtifactStream`—; Application no conoce multipart/filesystem. Una UoW tenant-scoped
confirma importación/reconciliación/resultados/métricas/audit. Worker queda diferido.

Parser entrega datos neutrales; Application asigna RecordProcessingResult/ImportIncident
y Domain reconcilia Citas. Resultados de fila no son exceptions, HTTP ni AuditResult.

## Phase 2
If authorized, connector/API integration reuses the same normalized contract.

## Rule
SIMEF column names and statuses never become domain primitives directly.

VO-AP-001..008 refuerza la frontera: el Adapter interpreta fecha/formato externo y
entrega valores canónicos; los Value Objects Domain no conocen HTML, `.xls`, encoding o
posición física. Parsing y normalización son responsabilidades distintas.

## Read boundaries v0.1.1

Application posee queries tenant-scoped para historial cursor-based de importaciones y
`AgendaDayReadModel`. HTTP, encoding del cursor y persistencia no escapan a esos
contratos. Controllers no componen el dashboard accediendo a repositories directamente.

## Agenda Domain boundary T-03

AGD-AP-001..009 mantiene tenant fuera del Aggregate: Application resuelve TenantContext y
Repository/UoW seleccionan su ámbito; Agenda conserva sólo AgendaFecha y Citas. Domain no
importa Archive Operations: `ExpedienteReferencia` es opaca/nullable. Reconciliación no
recibe parser rows, metadata, raw ni tipos de infraestructura.

## Application ports v0.1.7

Agenda Preparation recibe `AgendaFileInput` agnóstico y obtiene
`AgendaFileInspection` mediante `AgendaFileInterpreterPort`. Fingerprint es metadata
técnica Application y se consulta/asocia con `ImportArtifactMetadataRepository`; nunca
entra a ImportacionAgenda, Agenda ni sus Domain Repositories.

La UoW tenant-scoped entrega `ImportacionAgendaRepository`, `AgendaRepository`, el
metadata Repository, un `AuditWriter` transaction-bound y un único `importedAt`. Una
confirmación guarda ambos Aggregates, asocia metadata y escribe audit success en una
sola transacción; cualquier fallo revierte todo.

`AuditWriter`, `AuditEntry` y `AuditResult` pertenecen al contrato Application compartido
Security/Audit `@sigac/audit`. Archive Operations y Agenda Preparation dependen de ese
contrato; Agenda Preparation no depende de Archive Operations para auditar.
