---
spec: agenda-preparation
version: "0.1.5"
status: "Approved for Implementation"
date: "2026-08-21"
---

# Agenda Preparation — Traceability

## 1. Convenciones

La cadena obligatoria es:

`source → business rule → requirement/invariant → design → task → future test`.

La precedencia de fuentes es la de `knowledge/README.md`. Un procedimiento derivado, entrevista, observación, macro o hipótesis no sobrescribe silenciosamente una fuente normativa. Las discrepancias se registran y se resuelven mediante decisión formal.

## 2. Source registry

| ID | Fuente | Clasificación | Uso en la spec |
|---|---|---|---|
| SRC-AP-001 | `knowledge/README.md` | Gobierno de conocimiento | Precedencia, etiquetas y trazabilidad |
| SRC-AP-002 | `knowledge/01-normativa/guias/Guia de organización y manejo del expediente clinico.pdf` | `[SOURCE]` normativa/autoritaria | Contexto institucional y límites del procedimiento |
| SRC-AP-003 | `knowledge/02-procedimientos/citas-programadas/PROCESOS_ARCHIVO_CLINICO_CITAS_PROGRAMADAS.docx` | `[AS-IS]` derivada | Proceso de preparación por citas programadas |
| SRC-AP-004 | `knowledge/03-formatos-oficiales/SM10-1/FORMATO_SM10-1_HOJA DE LABORES DEL MEDICO.xls` | Formato oficial | Contexto futuro; no autoriza generar SM10-1 completo |
| SRC-AP-005 | `knowledge/04-simef-evidencia-operativa/agenda-archivo-clinico/AGENDA DE ARCHIVO CLINICO.xls` | Evidencia operativa | Layout real HTML ISO-8859, campos y bloques |
| SRC-AP-006 | `knowledge/04-simef-evidencia-operativa/formato-general-archivo-clinico/Formato General Archivo Clinico 2.1.xlsm` | Evidencia operativa | Contexto AS-IS/macros; no regla Domain automática |
| SRC-AP-007 | `knowledge/05-notas-operativas/` | Observaciones/hipótesis | Preguntas, respuestas y contexto, subordinados a fuentes mayores |
| SRC-AP-008 | `docs/domain-discovery/expediente-flow/source-map.md` | Discovery aprobado | Inventario y precedencia aplicada |
| SRC-AP-009 | `docs/domain-discovery/expediente-flow/as-is-process-map.md` | Discovery aprobado | Flujo actual y actores |
| SRC-AP-010 | `docs/domain-discovery/expediente-flow/artifact-analysis.md` | Discovery aprobado | Estructura y contenido observado |
| SRC-AP-011 | `docs/domain-discovery/expediente-flow/excel-reverse-engineering.md` | Discovery aprobado | Separación evidencia VBA/reglas confirmadas |
| SRC-AP-012 | `docs/domain-discovery/expediente-flow/business-rules.md` | Discovery aprobado | Reglas RN y gaps cerrados |
| SRC-AP-013 | `docs/domain-discovery/expediente-flow/event-storming.md` | Discovery aprobado | Commands/events/casos excepcionales candidatos |
| SRC-AP-014 | `docs/domain-discovery/expediente-flow/domain-model-analysis.md` | Discovery aprobado | Entidades, identidades y aggregates candidatos |
| SRC-AP-015 | `docs/domain-discovery/expediente-flow/domain-boundaries.md` | Discovery aprobado | Bounded contexts e integración |
| SRC-AP-016 | `docs/domain-discovery/expediente-flow/exceptions-map.md` | Discovery aprobado | Errores y resultados explícitos |
| SRC-AP-017 | `docs/domain-discovery/expediente-flow/open-questions.md` | Discovery aprobado | DD-EW-001..006 resueltas |
| SRC-AP-018 | `docs/domain-discovery/expediente-flow/iteration-3-evidence.md` | Discovery aprobado | Evidencia real y decisiones iteración 3 |
| SRC-AP-019 | `docs/domain-discovery/expediente-flow/spec-002-readiness.md` | Discovery aprobado | Readiness para crear spec 002 |
| SRC-AP-020 | `docs/domain-discovery/expediente-flow/fixtures/test-data/` | Golden Dataset desidentificado | Futuros tests parser/reconciliación |
| SRC-AP-021 | `docs/decisions/agenda-preparation/AUTHORIZATION-AUDIT-DECISION.md` | Decisión APPROVED | Permissions, ImportAttemptId, audit y tenant fail-closed |
| SRC-AP-022 | `docs/decisions/agenda-preparation/RAW-DATA-RETENTION-DECISION.md` | Decisión APPROVED | Categorías raw, minimización, protección, acceso, retención y disposición |
| SRC-AP-023 | `docs/decisions/agenda-preparation/IMPORT-API-DECISION.md` | Decisión APPROVED | Input, upload, sync/UoW, idempotencia, HTTP, queries y cursor |
| SRC-AP-024 | `docs/decisions/agenda-preparation/IMPORT-RESULT-TAXONOMY-DECISION.md` | Decisión APPROVED | Outcomes, resultados, incidencias, métricas, eventos y read models |
| SRC-AP-025 | `docs/decisions/agenda-preparation/DOMAIN-VALUE-OBJECTS-DECISION.md` | Decisión APPROVED | Invariantes, igualdad, provenance y parser boundary de VOs T-01 |
| SRC-AP-026 | `docs/decisions/agenda-preparation/IMPORTACION-AGENDA-DOMAIN-DECISION.md` | Decisión APPROVED | Contratos completos de Aggregate, registros, incidencias, métricas y lifecycle T-02 |

## 3. Business-rule registry

| ID | Regla aprobada | Fuente principal |
|---|---|---|
| BR-AP-001 | Archivo descargado corresponde a una fecha; un archivo incluye múltiples bloques médico/Servicio. | SRC-AP-005, SRC-AP-010, SRC-AP-018 |
| BR-AP-002 | Agenda lógica inicial = tenant + fecha. | SRC-AP-014, SRC-AP-015, SRC-AP-019 |
| BR-AP-003 | FOLIO es identidad estable de Cita. | SRC-AP-012, SRC-AP-017..019 |
| BR-AP-004 | Número de empleado identifica médico tenant-scoped; nombre es descriptivo/fallback controlado. | SRC-AP-012, SRC-AP-017..019 |
| BR-AP-005 | Servicio y Especialidad son equivalentes sólo en este proceso. | SRC-AP-012, SRC-AP-018 |
| BR-AP-006 | Reimportación idéntica es idempotente; con diferencias se reconcilia. | SRC-AP-012, SRC-AP-017..019 |
| BR-AP-007 | Reconciliación: ADD/UPDATE/UNCHANGED/RETIRADA/RESTORE por FOLIO. | SRC-AP-012, SRC-AP-013, SRC-AP-018/019 |
| BR-AP-008 | Retirada conserva historia, excluye preparación y no significa cancelación clínica. | SRC-AP-012, SRC-AP-016..019 |
| BR-AP-009 | Ningún registro desaparece silenciosamente; todo input tiene outcome explícito. | SRC-AP-012/013/016/019 |
| BR-AP-010 | Lista inicial usa exclusivamente los campos mínimos aprobados. | SRC-AP-003, SRC-AP-005, SRC-AP-012/018 |
| BR-AP-011 | Turno y Consultorio/Destino no están explícitos y quedan fuera; no se infieren. | SRC-AP-005, SRC-AP-010/011/017..019 |
| BR-AP-012 | ATENCION_FUERA_DE_AGENDA y hojas especiales son flujo distinto y fuera del slice. | SRC-AP-006, SRC-AP-011/013/018/019 |
| BR-AP-013 | Layout observado: `.xls` nominal con HTML ISO-8859; formato desconocido falla cerrado. | SRC-AP-005, SRC-AP-010, SRC-AP-018 |
| BR-AP-014 | Preservar original + interpretación + referencia resuelta. | SRC-AP-010/012/014/019 |
| BR-AP-015 | Todos los conceptos y resoluciones están aislados por tenant. | SRC-AP-015/019, AGENTS.md |
| BR-AP-016 | Fixtures del repositorio son desidentificados; evidencia real sólo baseline externo controlado. | SRC-AP-001, SRC-AP-019/020 |
| BR-AP-017 | Agenda usa permissions explícitas, no capabilities ni autorización directa por roles. | SRC-AP-021 |
| BR-AP-018 | ImportAttemptId permite auditar denied antes de leer; layout rechazado no es AuditResult. | SRC-AP-021 |
| BR-AP-019 | Archivo/fila raw es staging C3 transitorio; evidencia durable usa allow-list y metadata sanitizada. | SRC-AP-022 |
| BR-AP-020 | Retención es diferenciada/configurable; raw se elimina terminalmente y no tiene acceso humano inicial. | SRC-AP-022 |
| BR-AP-021 | Import API es multipart `.xls`, síncrona, streaming, idempotente y atómica. | SRC-AP-023 |
| BR-AP-022 | HTTP, outcome de importación y outcome de fila son conceptos separados. | SRC-AP-023 |
| BR-AP-023 | ImportOutcome, RecordProcessingResult, ImportIncident y ApplicationError son niveles separados y cerrados. | SRC-AP-024 |
| BR-AP-024 | Todo FOLIO duplicado marca todas sus ocurrencias; no hay ganador ni reconciliación. | SRC-AP-024 |
| BR-AP-025 | Retirada es efecto sobre una Cita previa, no resultado de fila ni cancelación clínica. | SRC-AP-024 |
| BR-AP-026 | Historial de importaciones es tenant-scoped, cursor-based y minimizado. | Contrato UX aprobado v0.1.1 |
| BR-AP-027 | Agenda del día resume exclusivamente el estado vigente con conteos definidos. | Contrato UX aprobado v0.1.1 |
| BR-AP-028 | Los VOs T-01 usan formas canónicas mínimas sin inferir patrones del artefacto. | SRC-AP-025 |
| BR-AP-029 | Original e interpretación pertenecen a RegistroImportadoAgenda; parsing queda en Adapter. | SRC-AP-025 |
| BR-AP-030 | Cada VO T-01 rechaza inválidos con su único DomainError.code aprobado. | SRC-AP-025, VO-AP-009 |
| BR-AP-031 | ImportacionAgenda se construye con IDs/instante externos, finaliza una vez y deriva métricas sin metadata del artefacto. | SRC-AP-026 |

## 4. Matriz end-to-end

| Trace | Source | Business rule | Requirement / invariant | Design | Task | Futuro test |
|---|---|---|---|---|---|---|
| TR-AP-001 | SRC-AP-005/010/018 | BR-AP-001/013 | REQ-AP-001..004; INV-AP-009 | §2, §10 | T-02, T-05/06, T-11/12 | TEST-AP-PARSER-001..004; TEST-AP-APP-001 |
| TR-AP-002 | SRC-AP-012/014/017..019 | BR-AP-002/003 | REQ-AP-004/005; INV-AP-001/002 | §3.2/3.3 | T-01, T-03/04 | TEST-AP-DOM-001..003 |
| TR-AP-003 | SRC-AP-012/017..019 | BR-AP-004 | REQ-AP-006; INV-AP-006/007 | §3.6, §7 | T-01, T-05/06 | TEST-AP-MATCH-001..004 |
| TR-AP-004 | SRC-AP-012/018 | BR-AP-005 | REQ-AP-007 | §3.3/3.6 | T-01, T-03 | TEST-AP-DOM-004 |
| TR-AP-005 | SRC-AP-012/013/016..019 | BR-AP-006..009 | REQ-AP-009..011/014; INV-AP-003..005 | §3.1/3.2, §4/6 | T-02..04, T-06/08 | TEST-AP-RECON-001..006; TEST-AP-METRIC-001 |
| TR-AP-006 | SRC-AP-003/005/012/018 | BR-AP-010 | REQ-AP-012/013/015 | §9 | T-07/08, T-13..15 | TEST-AP-QUERY-001..004; TEST-AP-UI-001 |
| TR-AP-007 | SRC-AP-005/010/011/017..019 | BR-AP-011/012 | REQ-AP-002/012/015; INV-AP-012 | §1, §3.6, §10 | T-01, T-11/12, T-15 | TEST-AP-SCOPE-001..003 |
| TR-AP-008 | SRC-AP-010/012/014/019 | BR-AP-014 | REQ-AP-008/015 | §3.4, §10, §12/14 | T-02, T-06, T-09..12, T-16 | TEST-AP-RAW-001..003; TEST-AP-PRIV-001 |
| TR-AP-009 | SRC-AP-015/019 | BR-AP-015 | REQ-AP-001/004/006/017; INV-AP-011 | §2, §7, §12/14 | T-05/06, T-09/10, T-13, T-16/17 | TEST-AP-TENANT-001..004 |
| TR-AP-010 | SRC-AP-019/020 | BR-AP-016 | REQ-AP-018 | §10/12 | T-04/08, T-12, T-16..19 | TEST-AP-GOLDEN-001; TEST-AP-PRIV-002 |
| TR-AP-011 | SRC-AP-015, expediente-workspace contracts | Boundary separation | REQ-AP-016 | §2, §7, §13 | T-05/06/07 | TEST-AP-BOUNDARY-001..002 |
| TR-AP-012 | SRC-AP-021 | BR-AP-017/018 | requirements §6/7 | design §8/12 | T-00, T-05/06, T-08, T-13/16 | TEST-AP-AUTH-001..006; TEST-AP-AUDIT-001..006 |
| TR-AP-013 | SRC-AP-022 | BR-AP-019/020 | REQ-AP-008/015/017/018 | design §12/14 | T-00, T-02, T-06, T-09..12, T-16..19 | TEST-AP-RAW-001..008; TEST-AP-PRIV-001..004 |
| TR-AP-014 | SRC-AP-023 | BR-AP-021/022 | requirements import contract | design §8/10/11 | T-00, T-05/06/08, T-10..14, T-16..19 | TEST-AP-API-001..014; TEST-AP-IDEMP-001..004; TEST-AP-UOW-001..003 |
| TR-AP-015 | SRC-AP-024 | BR-AP-023..025 | REQ-AP-009..014; INV-AP-003..005 | design §4..6/9/11 | T-01..08, T-13..19 | TEST-AP-RESULT-001..008; TEST-AP-METRIC-001..004; TEST-AP-DUP-001..003 |
| TR-AP-016 | Contratos UX v0.1.1 | BR-AP-026/027 | REQ-AP-019/020; AC-AP-013/014 | design §8/9 | T-07/08, T-10, T-13..19 | TEST-AP-HISTORY-001..005; TEST-AP-DAY-001..005 |
| TR-AP-017 | SRC-AP-025 | BR-AP-028/029 | REQ-AP-004..008; INV-AP-001/002/006/008 | design §3.4/3.6/10 | T-01 | TEST-AP-VO-001..015 |
| TR-AP-018 | SRC-AP-025 | BR-AP-030 | requirements §5; design §3.6 | T-01 | TEST-AP-VO-ERROR-001..005 |
| TR-AP-019 | SRC-AP-026 | BR-AP-009/023/031 | REQ-AP-001/008/011/014/018; INV-AP-003; INV-IMP-AP-001..006 | design §3.1/3.4/4 | T-02 | TEST-AP-AGG-001..012 |

Namespaces: `INV-AP-001..012` son invariantes globales canónicas del slice;
`INV-IMP-AP-001..006` son invariantes verificables de `ImportacionAgenda` derivadas de
las decisiones `IMP-AP-001..014`. Ningún namespace sustituye a otro.

## 5. Acceptance criteria → tests

| Acceptance criterion | Future test IDs | Task owner |
|---|---|---|
| AC-AP-001 | TEST-AP-APP-001, TEST-AP-PARSER-001 | T-06, T-11/12 |
| AC-AP-002 | TEST-AP-RECON-001, TEST-AP-INT-001 | T-03/06, T-17 |
| AC-AP-003 | TEST-AP-RECON-002..004 | T-03/04 |
| AC-AP-004 | TEST-AP-RECON-005 | T-03/04 |
| AC-AP-005 | TEST-AP-RECON-006 | T-03/04 |
| AC-AP-006 | TEST-AP-PARSER-002..004 | T-11/12 |
| AC-AP-007 | TEST-AP-MATCH-001..003 | T-06/08 |
| AC-AP-008 | TEST-AP-MATCH-004 | T-01/06 |
| AC-AP-009 | TEST-AP-METRIC-001 | T-02/04 |
| AC-AP-010 | TEST-AP-QUERY-001, TEST-AP-PRIV-001 | T-07/08, T-16 |
| AC-AP-011 | TEST-AP-TENANT-001..004 | T-10, T-16/17/18 |
| AC-AP-012 | TEST-AP-SCOPE-001..003 | T-04, T-12, T-15 |

## 6. Open-question traceability

| OQ | Fuente del gap | Decisión requerida | Task bloqueada |
|---|---|---|---|
| AP-OQ-001 | SRC-AP-021 | RESOLVED — AUTH-AP-001..003 | Cerrado |
| AP-OQ-002 | SRC-AP-022 | RESOLVED — RAW-AP-001..012 | Cerrado |
| AP-OQ-003 | SRC-AP-023 | RESOLVED — API-AP-001..014 | Cerrado |
| AP-OQ-004 | SRC-AP-024 | RESOLVED — RESULT-AP-001..014 | Cerrado |
| AP-OQ-005 | domain-boundaries.md; design.md §13 | integración posterior con Solicitud/proyección | No bloquea T-01..T-19 del alcance inicial |
| AP-OQ-006 | design.md §4/15 | lifecycle de cierre/reapertura | No bloquea si no se expone reapertura |

## 7. SDB propagation required

| SDB target | Contenido a propagar antes de implementación | Task |
|---|---|---|
| Volume 02 | actores, proceso programado, minimización y exclusiones | T-00 |
| Volume 03 | bounded context, aggregates, identidades y lenguaje | T-00 |
| Volume 04 | flujo importación/reconciliación y excepciones | T-00 |
| Volume 05 | Use Cases, permissions y outcomes | T-00 |
| Volume 06 | ACL/parser, ownership, UoW e integración | T-00 |
| Volume 07 | autorización, audit, tenant y privacidad raw | T-00 |
| Volume 08 | contratos de datos/API y modelo físico tras decisiones | T-00 y posteriormente T-09/T-14 |
| Volume 09 | read models y UX sin reglas de negocio | T-00 y posteriormente T-15 |
| Volume 10 | estrategia de tests y Golden Dataset | T-00/T-12 |
| Volume 11 | operación, retención, reproceso y observabilidad | T-00 |
| Volume 12 | OQs, readiness y estado de la spec | T-00/T-19 |

## 8. Coverage/readiness

- Requirements con cadena de trazabilidad: `20/20`.
- Invariantes con test futuro: `12/12` mediante TR-AP-001..011.
- Acceptance criteria con test futuro: `14/14`.
- Gaps bloqueantes identificados: `0`.
- Gaps no bloqueantes identificados: `2` (`AP-OQ-005..006`).
- `requirements_ready: true`
- `design_ready: true`
- `tasks_ready: true`
- `implementation_ready: true`
