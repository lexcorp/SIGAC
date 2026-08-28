---
spec: agenda-to-vale-archivo
version: "0.2.0"
status: "Approved for Implementation"
date: "2026-08-27"
---

# Tasks — Agenda Preparation → Vale Archivo

## Dependency graph

```text
T-00
  -> T-01 -> T-02 -> T-02A -> T-02B -> T-03
                    -> T-04 -> T-05 -> T-06 -> T-07
                    -> T-08 -> T-09 -> T-10
```

## T-00 — Cerrar decisiones bloqueantes

**Dependencias:** ninguna.  
**Estado:** PASS — ADR-0035..ADR-0040 aprobados en `decisions.md`.  
**Objetivo cumplido:** OQ-AV-001..009 resueltos; numeración, operación explícita,
permissions/audit, granularidad, repetidos, no resueltos, trazabilidad, reconciliación e
integridad transaccional definidos.  
**Gate:** PASS; T-01 habilitada.

## T-01 — Contratos Application de integración

**Dependencias:** T-00.  
**Estado:** DESIGN COMPLETE / READY FOR IMPLEMENTATION — diseño técnico aprobado en
`design.md` §11.  
**Objetivo de T-01:** definir el módulo neutral, DTOs mínimos, ports, Application Service
y contract tests sin crear código o infraestructura en la fase de diseño.

### T-01.1 — Módulo ACL neutral

Definir `packages/modules/agenda-vale-integration` como módulo Application sin Domain
propio y sin dependencias a `@sigac/agenda-preparation` o `@sigac/vale-archivo`.

### T-01.2 — Ports y DTOs

Definir `AgendaPreparationReadPort`, `ValeGenerationPort`,
`GenerationSnapshotHasherPort` y los tipos neutrales de `design.md` §11.2..11.4. No
crear adapters, repositories, tablas ni contratos HTTP.

### T-01.3 — Application Service

Diseñar `GenerateValesFromAgenda` con autorización compuesta, clasificación,
agrupación, deduplicación, resolución explícita, validación de source version y llamada
única al target port. No crear Vales directamente.

### T-01.4 — Tests contractuales

Definir contract tests para boundaries de imports, RequestContext, permisos, 0/1/N grupos, repetidos
same/cross-group, no resueltos, Servicio ausente, grupo vacío, source stale,
`ALREADY_GENERATED`, exactitud/minimización de comandos y outputs.

**Gate documental T-01:** T-01.1..T-01.4 definidos sin gaps y `git diff --check`.
La implementación y sus gates de código comienzan en T-02; no iniciar T-02 en esta
ejecución.

## T-02 — Application Service de orquestación

**Dependencias:** T-01.  
**Objetivo:** implementar agrupación, autorización, idempotencia y resultados por grupo
sin infraestructura.  
**Tests:** 0/1/N grupos; claves estables; replay; tenant propagation; cero parciales.

## T-02A — Proyección Application de Agenda para generación

**Dependencias:** T-02.  
**Estado:** PASS.  
**Objetivo:** implementar en Agenda Preparation el Use Case/query
`GetPreparedAgendaGenerationSource` aprobado por ADR-0041. Debe producir Citas `ACTIVA`,
última importación confirmada y `sourceVersion` canónica sin exponer Aggregate, Entity,
Repository o tabla.

**Tests:** Agenda ausente; sólo Citas activas; mapping allow-listed; orden canónico por
FOLIO; `sourceVersion` estable; cambio funcional altera versión; tenant propagation;
verificación current/stale.

**Scope excluido:** adapters API, endpoints, migrations y cambios al lifecycle de Agenda.

**Resultado:** `GetPreparedAgendaGenerationSource` y
`AgendaGenerationSourceQueryPort` implementados; versión SHA-256/JCS determinista,
orden FOLIO ASC, tenant propagation y verificación current/stale cubiertos por tests.

## T-02B — `GenerateValeBatch` en Application de Vale Archivo

**Dependencias:** T-02A.  
**Estado:** PASS.  
**Objetivo:** implementar el Use Case y ports Application definidos en ADR-0041, sin
infraestructura concreta. Debe aceptar un batch propietario de Vale Archivo, exigir
`REQUEST_CREATE`, crear un Vale por grupo mediante Domain y coordinar numeración,
idempotencia, trazabilidad y audit a través de una UnitOfWork abstracta.

**Tests:** 0/1/N grupos; mapping a Aggregate; permiso; replay; formato de resultados;
fallo all-or-nothing mediante fake UnitOfWork; audit sin PII; ningún import a Agenda o al
módulo neutral.

**Scope excluido:** PostgreSQL, migrations, adapter ACL, controller, endpoint y UI.

**Resultado:** `GenerateValeBatch` y `ValeBatchUnitOfWork` implementados en Application
de Vale Archivo; numeración server-side `VA-YYYYMMDD-NNN`, replay por identidad
idempotente, creación de Aggregate/items, snapshot inmutable y audit success quedan
coordinados por una sola transacción tenant-scoped. `RegistrarVale` permanece intacto.

## T-03 — Adapters ACL de ambos contextos

**Dependencias:** T-02A y T-02B.  
**Estado:** PASS.  
**Objetivo:** proyectar Citas elegibles y traducir comandos neutrales al Use Case de Vale
sin compartir Aggregates/repositories.  
**Tests:** mapping, minimización, Citas retiradas/no elegibles y boundaries.

Entregables una vez desbloqueada:

- `apps/api/src/agenda-vale-integration/AgendaPreparationReadAdapter.ts`;
- `apps/api/src/agenda-vale-integration/ValeGenerationAdapter.ts`;
- `packages/modules/agenda-vale-integration/src/infrastructure/AgendaSnapshotHasher.ts`;
- tests unitarios de mapping, delegación, canonicalización y boundaries.

No crear endpoints, UI, migrations ni acceso directo a repositories/tablas.

**Resultado:** `AgendaPreparationReadAdapter` y `ValeGenerationAdapter` implementados
en el composition boundary de API, con mapping allow-listed y delegación exclusiva a
los Use Cases públicos. `AgendaSnapshotHasher` implementa SHA-256/JCS determinista sin
IO ni dependencias a bounded contexts. Tests cubren tenant/source propagation, errores
de Agenda, replay `ALREADY_GENERATED` y canonicalización del snapshot.

## T-04 — Persistence de trazabilidad e idempotencia

**Dependencias:** T-03.  
**Objetivo:** schema/migration no destructiva, repository y constraint tenant-local
según identidad aprobada.  
**Tests:** uniqueness concurrente, rollback e isolation.

## T-05 — UnitOfWork/composición transaccional

**Dependencias:** T-04.  
**Objetivo:** atomicidad aprobada entre Vale, items, trazabilidad y audit.  
**Tests:** commit/rollback y fallo en cada write.

## T-06 — API y OpenAPI

**Dependencias:** T-05.  
**Objetivo:** comando/query aprobado, RequestContext server-side y RFC7807.  
**Tests:** validation, 401/403/conflict, replay y tenant no falsificable.

## T-07 — Frontend de confirmación

**Dependencias:** T-06.  
**Objetivo:** seleccionar Agenda/grupos y capturar sólo metadata aprobada.  
**Tests:** loading/error/replay, accesibilidad y payload exacto.

## T-08 — PostgreSQL integration

**Dependencias:** T-05 y T-06.  
**Objetivo:** flujo real Agenda → ACL → Vale → vínculo → audit por tenant.  
**Tests:** agrupación, duplicados concurrentes, trazabilidad, rollback y cross-tenant.

## T-09 — E2E

**Dependencias:** T-07 y T-08.  
**Objetivo:** flujo real desde Agenda preparada hasta consulta del Vale generado.

## T-10 — Quality pipeline y release readiness

**Dependencias:** T-09.  
**Objetivo:** lint, typecheck, tests, build, OpenAPI, migrations, integration, isolation,
E2E y `git diff --check`.

## Regla global STOP_AND_ESCALATE

Detener ante contrato, permission, audit identifier, identidad/idempotencia, lifecycle,
schema, tenant rule, transacción o reconciliación no aprobados. No crear soluciones
provisionales para avanzar el grafo.
