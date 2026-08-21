---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.1.0"
status: "Draft for use-case/spec validation"
date: "2026-08-13"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-001 — Importar Agenda

## Objetivo
Ingresar a SIGAC una versión de la agenda/demanda para preparar expedientes.

## Actor
Jefatura de Archivo o rol autorizado.

## Precondiciones
- usuario autenticado;
- hospital/tenant resuelto;
- permission `AGENDA_IMPORT`;
- archivo/formato soportado.

## Flujo principal
1. Actor selecciona archivo.
2. Sistema valida estructura.
3. Calcula fingerprint.
4. Registra versión.
5. Traduce registros a demanda.
6. Identifica duplicados.
7. Reconcilia Agenda/Citas y produce la lista inicial de preparación.
8. Publica AgendaImported.

## Alternos
- mismo archivo ya importado → no duplicar;
- filas inválidas → reportar;
- filas con incidencias → conservar resultado/incidencia explícitos y confirmar la
  importación cuando la UoW completa sea válida; no existe outcome `PARTIAL`.

## Acceptance
Given una agenda válida no importada
When el usuario la importa
Then se registra una única versión
And se crean ítems de demanda sin duplicados.

## Authorization y audit — AUTH-AP-001..003

La frontera genera `ImportAttemptId` después de resolver RequestContext y antes de
autorizar o leer el archivo. Falta de permission audita
`AGENDA_IMPORT/AGENDA_IMPORT_ATTEMPT/{ImportAttemptId}/denied`. Importación
aceptada/confirmada audita `AGENDA_IMPORT/AGENDA_IMPORT/{ImportacionAgenda.id}/success`.
Layout rechazado es outcome operacional y no genera AuditEntry ni amplía AuditResult.

## HTTP/Application contract — API-AP-001..014

POST `/api/v1/agenda-imports` recibe multipart con un `file` `.xls` y
`Idempotency-Key` requerido. Application recibe `{importAttemptId, artifact,
idempotencyKey, context}` sin tipos HTTP. La ejecución es síncrona y una UoW confirma
importación + reconciliación + resultados + métricas + audit success. Import inicial,
idéntico y reconciliado responden 201; layout rechazado responde 422 sin ImportacionAgenda.

RESULT-AP-001..014 fija ImportOutcome `IMPORTED|ALREADY_IMPORTED|RECONCILED` y resultados
`ADDED|UPDATED|UNCHANGED|RESTORED|PENDING_REVIEW|REJECTED|DUPLICATE_FOLIO`.
Incidencias locales permiten confirmar 201; estructura incompatible rechaza globalmente.

## Queries operacionales v0.1.1

`ListAgendaImports` recibe fecha opcional, paginación cursor-based y RequestContext;
requiere `AGENDA_VIEW`. Devuelve items minimizados ordenados por
`importedAt DESC, importacionId DESC`; colección vacía es válida.

`GetAgendaDay` requiere `AGENDA_VIEW` y devuelve el resumen vigente de tenant+fecha.
Agenda ausente produce `AGENDA_NOT_FOUND`, no `null`.
