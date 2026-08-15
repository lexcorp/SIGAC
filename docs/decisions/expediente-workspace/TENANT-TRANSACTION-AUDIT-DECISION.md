# Tenant Transaction & Audit Decision — Expediente Workspace

**Estado:** APPROVED WITH BLOCKING GAP  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.16 / T-09

## TX-EW-001 — TenantDatabaseRouter

`packages/platform/database` es propietario del `TenantDatabaseRouter`, componente de
infraestructura que recibe un `TenantContext` ya validado server-side y resuelve el
pool/database PostgreSQL allow-listed correspondiente. Nunca recibe tenant, database
name ni connection string desde body/query arbitrarios y no realiza autorización.

```text
TenantContext → TenantDatabaseRouter → tenant pool/database
```

Los tipos Drizzle, PostgreSQL, pool y connection quedan dentro de Infrastructure y no
escapan a Domain/Application.

## TX-EW-002 — Routing confiable

El router usa el registro/routing server-side vigente y mantiene pools separados por
tenant. No abre queries cross-tenant ni acepta un nombre de database sin validarlo
contra el registro allow-listed. Actor→tenant se valida antes de invocarlo.

## TX-EW-003 — Tenant transaction

Infrastructure abre una única transacción sobre el pool resuelto:

```text
TenantContext → tenant database → BEGIN → shared infrastructure transaction handle
```

El handle concreto no forma parte de un port Application. No existen transacciones
distribuidas ni transacciones que abarquen databases tenant distintas.

## TX-EW-004 — Ownership y ubicación de audit_log

`audit_log` pertenece lógicamente a Security / Audit y se almacena físicamente dentro
de cada tenant database. Archive Operations no adquiere ownership ni ejecuta SQL
directo contra esa tabla. Una plataforma futura de reporting puede proyectar estos
registros, pero no sustituye el audit transaccional tenant-local.

## TX-EW-005 — Transaction-bound AuditWriter

Infrastructure de Security / Audit proporciona un binder/factory capaz de ligar un
`AuditWriter` a un transaction handle PostgreSQL ya existente. El resultado implementa
sin cambios el port Application:

```typescript
AuditWriter.append(entry: AuditEntry, context: RequestContext): Promise<void>;
```

El binder y los tipos de transaction permanecen en Infrastructure. No se añade
DatabaseTransaction, Drizzle ni PostgreSQL al contrato Application.

## TX-EW-006 — PostgresArchiveOperationsUnitOfWork

`PostgresArchiveOperationsUnitOfWork` implementa la interface existente
`ArchiveOperationsUnitOfWork`. Después de resolver tenant y abrir una transacción,
construye sobre el mismo handle:

- `ExpedienteRepository` transaccional;
- `MovimientoExpedienteWriter` transaccional;
- `AuditWriter` transaccional proporcionado por Security / Audit;
- un único `operationOccurredAt`.

Entrega esos cuatro elementos mediante el `ArchiveOperationsTransaction` existente. No
se modifican las interfaces de T-07/T-08.

## TX-EW-007 — Success atómico

```text
BEGIN
  save Expediente
  append MovimientoExpediente
  append audit success
COMMIT
```

Las tres escrituras usan el mismo transaction handle y database tenant.

## TX-EW-008 — Rollback

Si falla cualquiera de las tres escrituras o el callback, Infrastructure ejecuta
rollback de todo. No persiste parcialmente aggregate, Movimiento ni audit success. No
se simula atomicidad con conexiones o transacciones independientes.

## TX-EW-009 — Audit standalone de fallos

`denied`, `not-found`, `conflict` e `invalid-transition`, producidos fuera de la UoW
mutante, usan el mismo `AuditWriter` Application mediante una transacción tenant-local
independiente administrada por infraestructura Audit. No se crea otra interface
Application. El resultado se registra únicamente después del rollback cuando hubo una
UoW fallida.

## TX-EW-010 — Schema composition

`packages/platform/database` puede componer un registry Drizzle tenant con schemas
físicos exportados por los módulos propietarios. Esta composición técnica no transfiere
ownership: Archive Operations conserva `expedientes`/`movimientos_expediente`, Reference
Data conserva `ubicaciones` y Security / Audit conserva `audit_log`.

## TX-EW-011 — Migration ownership de audit_log

T-10 permanece PASS y su migración inicial no se reescribe. Security / Audit es
propietario de una migración tenant posterior para `audit_log`, aplicada a cada tenant
database por el migration runner. DAT-012 debe ser la autoridad de su DDL.

### AUD-DB-GAP — BLOCKING

DAT-012 todavía no define inequívocamente tipo y nullability de `id`, `actor_ref`,
`action`, `resource_type`, `resource_id`, `result`, `occurred_at`, `source`,
`source_ip_hash` y `security_context`, ni resuelve si los campos candidatos forman parte
del contrato físico. No se puede generar la migración ni implementar el adapter audit
sin inventar columnas/tipos. T-09 permanece bloqueada hasta cerrar este gap.

## TX-EW-012 — operationOccurredAt

La UoW PostgreSQL crea un único `operationOccurredAt` al iniciar la operación
transaccional y lo expone mediante `ArchiveOperationsTransaction`. DomainEvent y
Movimiento reutilizan ese instante conforme a DOM-EVENT-001. No se introduce ClockPort.

## Readiness

El routing, ownership, binding y flujo transaccional quedan decididos. T-09 no está
implementation-ready únicamente por `AUD-DB-GAP`; no quedan otros gaps conocidos en
estas decisiones.
