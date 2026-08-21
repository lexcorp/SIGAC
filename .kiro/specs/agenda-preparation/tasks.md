---
spec: agenda-preparation
version: "0.1.2"
status: "Approved for Implementation"
date: "2026-08-20"
requires:
  - "requirements.md v0.1.2"
  - "design.md v0.1.2"
---

# Agenda Preparation — Tasks

## 1. Reglas de ejecución

- La precedencia es: decisiones aprobadas → SDB propagado → esta spec → código existente.
- Antes de cada task se leen sus fuentes y se comprueban todas sus dependencias.
- No se implementa una task dependiente si su predecesora no está en PASS.
- Cada cambio de comportamiento incluye tests proporcionales y trazabilidad actualizada.
- No se introducen Turno, Consultorio, Destino, SM1-14, préstamo, paquetes, traslado, cita abierta ni automatización VBA.
- Los fixtures versionados deben estar desidentificados. Los artefactos reales no se copian a tests.
- TenantContext siempre es server-resolved; no existen queries ni transacciones cross-tenant.

## 2. STOP_AND_ESCALATE global

Detener la implementación, conservar el trabajo válido y no avanzar a tasks dependientes si es necesario:

- inventar permission, audit action/result o matriz de autorización;
- decidir retención, cifrado, acceso o eliminación del archivo/raw sin aprobación;
- inventar contrato HTTP, límite, modalidad sync/async o semántica de upload;
- cambiar la taxonomía contractual de outcomes/incidencias sin aprobación;
- introducir datos personales o clínicos fuera de REQ-AP-012;
- asumir unicidad de ExpedienteNumero o asociar ambiguamente médico/Expediente;
- inferir Turno, Consultorio, Destino o cancelación clínica;
- decidir schema, constraint o migration destructiva sin fuente canónica;
- modificar invariantes de Archive Operations;
- contradecir una fuente de mayor precedencia.

## 3. Dependency graph

```text
T-00
  |
  v
T-01 -----> T-02 -----+
  |                    |
  +-------> T-03 -----+--> T-04
                            |
                            v
                           T-05
                            |
                            v
                           T-06 --> T-07 --> T-08
                                             |
                                             v
                                            T-09 --> T-10 --> T-11 --> T-12
                                                                      |
                                                                      v
                                                                     T-13 --> T-14 --> T-15 --> T-16 --> T-17 --> T-18 --> T-19
```

## 4. Tasks

### T-00 — Verificar decisiones y propagación SDB

**Dependencias:** ninguna.

**Objetivo:** verificar el cierre documental de `AP-OQ-001..004`, incluida la taxonomía
RESULT-AP-001..014, y que el SDB esté sincronizado antes de implementar Domain.

**Entregables:** taxonomía final; SDB sincronizado; readiness actualizado.

**Gate:** revisión documental y `git diff --check`.

### T-01 — Value Objects y taxonomía Domain

**Dependencias:** T-00.

**Fuentes:** REQ-AP-003..008, REQ-AP-011, INV-AP-002/006/008,
`IMPORT-RESULT-TAXONOMY-DECISION.md`.
También aplica `DOMAIN-VALUE-OBJECTS-DECISION.md`.

**Objetivo:** implementar únicamente los Value Objects y tipos de resultado aprobados: fecha, FOLIO, número de empleado, Servicio/Especialidad, posición de origen y resultado de registro.

**Tests:** fecha canónica/gregoriana; trim exterior e igualdad exacta de FOLIO y número
de empleado; ceros iniciales; identidad de Servicio por código con nombre descriptivo;
posición entera positiva base 1; rechazo de inválidos; ausencia de parsing/HTML y de
originalValues en los VOs.

### T-02 — Aggregate `ImportacionAgenda`

**Dependencias:** T-01.

**Fuentes:** REQ-AP-001..003, REQ-AP-008, REQ-AP-011/014/018.

**Objetivo:** implementar el Aggregate root de ingestión, sus registros/resultados/incidencias y conteos. No implementar parser ni persistencia.

**Tests:** exactamente un outcome por fila, ecuación de métricas, rechazo estructural fail-closed, idempotencia interna y ausencia de campos excluidos.

### T-03 — Aggregate `Agenda` y reconciliación de `Cita`

**Dependencias:** T-01.

**Fuentes:** REQ-AP-004/005/009/010/012, INV-AP-001..005.

**Objetivo:** implementar Agenda tenant+fecha y reconciliación por FOLIO: ADD, UPDATE, UNCHANGED, RETIRADA_DE_AGENDA y RESTORE.

**Tests:** tabla completa de reconciliación; historia preservada; retirada no es cancelación; reaparición conserva identidad; no hay Turno/Consultorio.

### T-04 — Verification suite de Domain

**Dependencias:** T-02, T-03.

**Objetivo:** completar tests unitarios/property-based requeridos por invariantes y fixtures sintéticos del Domain.

**Gate:** typecheck y tests focalizados del módulo.

### T-05 — Application ports y contratos

**Dependencias:** T-04.

**Fuentes:** design.md §7, REQ-AP-006/008/016/017.

**Objetivo:** definir Repository/query/parser/UoW ports mínimos y tenant-scoped. `ExpedienteReferenceQueryPort` mantiene cardinalidad 0..N. Ningún port importa infraestructura.

**Tests:** compile-time/contract sólo si el repositorio ya usa ese patrón.

### T-06 — Use Case `ImportAgenda`

**Dependencias:** T-05.

**Fuentes:** REQ-AP-001..011, REQ-AP-014/017/018.

**Objetivo:** orquestar validación, interpretación, matching, reconciliación, resultados y atomicidad mediante los ports aprobados.

**Tests:** archivo válido; layout inválido; reimportación idéntica; reconciliación con cambios; médico 0/1/N; Expediente 0/1/N; tenant propagation; audit según T-00.

### T-07 — Query Use Cases y read models

**Dependencias:** T-06.

**Fuentes:** REQ-AP-012/013/015/017, design.md §8/9.

**Objetivo:** implementar resumen del día, historial cursor-based de importaciones,
resultados por registro, lista vigente de preparación e incidencias, sin aggregates
externos completos.

**Tests:** campos exactos, historial empty/filtro/orden/cursor, conteos vigentes del día,
retirada excluida, minimización y aislamiento tenant.

### T-08 — Verification suite de Application

**Dependencias:** T-06, T-07.

**Objetivo:** completar casos de autorización, idempotencia, fallos, rollback conceptual y propagación de RequestContext/TenantContext.

**Gate:** typecheck, tests del módulo y `git diff --check`.

### T-09 — Modelo físico y migrations tenant

**Dependencias:** T-08.

**Fuentes:** decisión física aprobada en T-00, REQ-AP-008/014/015/017.

**Objetivo:** definir schema PostgreSQL y migrations no destructivas. Aplicar
RAW-AP-001..012: no persistir archivo/fila raw ni filename cliente; separar metadata,
allow-list original, normalización y estado Domain.

**Tests/gates:** migration validation, idempotence y constraints; STOP ante constraint o nullability no aprobada.

### T-10 — PostgreSQL adapters y UnitOfWork

**Dependencias:** T-09.

**Objetivo:** implementar Repositories/query adapters y UoW tenant-scoped con atomicidad entre importación y reconciliación; reutilizar infraestructura canónica.

**Tests:** round-trip, optimistic concurrency si fue aprobada, rollback y tenant isolation con PostgreSQL real.

### T-11 — Parser/Anti-Corruption Layer SIMEF

**Dependencias:** T-10.

**Fuentes:** artefacto real controlado, `artifact-analysis.md`, `excel-reverse-engineering.md`, fixtures desidentificados.

**Objetivo:** implementar el adapter HTML ISO-8859 bajo `.xls`; entregar contrato neutral
a Application. Staging es tenant-scoped/protegido y se elimina al outcome terminal. No
ejecutar macros ni incorporar hojas históricas fuera de Agenda.

**Tests:** layout válido, encoding, bloques múltiples, headers alterados/missing, contenido inválido y fail-closed.

### T-12 — Golden Dataset y regresión del importer

**Dependencias:** T-11.

**Objetivo:** validar parser/reconciliación con fixtures desidentificados versionados y baseline externo mediante hash/métricas agregadas.

**Gate:** ninguna PII real en fixtures, logs, snapshots o reports.

### T-13 — API boundary

**Dependencias:** T-12.

**Fuentes:** contrato HTTP, permissions y audit aprobados en T-00.

**Objetivo:** implementar API-AP-001..014 y los contratos v0.1.1: multipart streaming, ImportAttemptId,
Idempotency-Key, límites/timeouts, ejecución síncrona, responses/queries y RFC7807.
Controllers no acceden a Repositories, parser, filesystem, database o TenantRouter.

**Tests:** auth, authorization, validation, errores sanitizados, tenant no falsificable y contratos de upload/query.

### T-14 — OpenAPI

**Dependencias:** T-13.

**Objetivo:** publicar endpoints, incluido historial GET `/agenda-imports` y
`AgendaDayReadModel`, multipart, headers, responses, paginación y errors de
API-AP-001..014/v0.1.1, sin raw ni outcomes no aprobados.

**Gate:** OpenAPI validation y contract tests.

### T-15 — Frontend de importación y preparación

**Dependencias:** T-14.

**Fuentes:** SDB Volume 09 propagado y contratos OpenAPI.

**Objetivo:** implementar carga, resumen, resultados, incidencias y lista inicial. UI consume permissions/resultados server-side; no calcula matching ni reconciliación.

**Tests:** loading/empty/error, accessibility, resultados explícitos y ausencia de Turno/Consultorio/Destino.

### T-16 — Security, privacy y tenant hardening

**Dependencias:** T-15.

**Objetivo:** verificar permissions, audit, aislamiento tenant, sanitización, límites aprobados, minimización y controles del raw conforme T-00.

**Tests:** acceso denegado, cross-tenant, upload malicioso, logs sin PII y datos excluidos ausentes.

### T-17 — PostgreSQL integration

**Dependencias:** T-16.

**Objetivo:** validar API/Application → parser → Repository/UoW → tenant PostgreSQL con importación, reimportación, reconciliación, rollback y read models.

**Gate:** PostgreSQL real, migrations vigentes, tenant isolation obligatorio.

### T-18 — E2E

**Dependencias:** T-17.

**Objetivo:** probar flujo real autorizado: importar, observar resultados, reconciliar, atender incidencias permitidas y consultar lista de preparación.

**Tests:** idempotencia, snapshot cambiado, retirada/restauración, layout inválido y UX sin PII técnica.

### T-19 — Pipeline y cierre

**Dependencias:** T-18.

**Objetivo:** ejecutar todos los quality gates y cerrar trazabilidad/readiness sólo cuando no queden gaps bloqueantes.

**Gates mínimos:** lint, typecheck, unit/contract/integration/E2E tests, build, OpenAPI validation, migration validation/idempotence, tenant/security/privacy gates y `git diff --check`.

## 5. Checkpoints

| Grupo | Tasks | Gate mínimo |
|---|---|---|
| Decisions/SDB | T-00 | revisión documental, diff check |
| Domain | T-01..T-04 | typecheck + unit/property tests |
| Application | T-05..T-08 | typecheck + unit/contract tests |
| Persistence | T-09..T-10 | migrations + PostgreSQL integration focalizada |
| Importer | T-11..T-12 | parser/golden regression + privacy scan |
| API/OpenAPI | T-13..T-14 | API tests + OpenAPI validation |
| Frontend | T-15 | typecheck + UI/accessibility tests + build |
| Security/integration | T-16..T-17 | tenant/privacy/security + PostgreSQL real |
| E2E/final | T-18..T-19 | Playwright/E2E + pipeline completo |

## 6. Estado inicial

| Task | Estado |
|---|---|
| T-00 | PASS — AP-OQ-001..004 RESOLVED y SDB propagado |
| T-01..T-19 | NOT STARTED |

No puede declararse `agenda-preparation implementation: COMPLETE` hasta que T-19 y todos sus gates estén en PASS.
