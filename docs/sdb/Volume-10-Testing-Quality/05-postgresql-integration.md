# TQ-005 — PostgreSQL Integration

Usar PostgreSQL real/efímero para repositories, constraints, transactions, optimistic concurrency, outbox y migrations.

Para T-09 verificar:

- TenantDatabaseRouter nunca cruza pools y rechaza rutas no allow-listed;
- Repository, MovimientoWriter y AuditWriter comparten exactamente una transacción;
- commit persiste las tres escrituras;
- fallo en cualquiera produce rollback de las tres;
- audits standalone usan una transacción tenant-local independiente;
- operationOccurredAt es único y se propaga a evento/movimiento;
- ningún tipo PostgreSQL/Drizzle aparece en contratos Application.

Los tests de atomicidad con audit quedan bloqueados por AUD-DB-GAP hasta disponer del
DDL canónico de audit_log.
