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

Verificar además DDL exacto de audit_log, checks de result/source, ausencia de tenant_id,
FKs/índices secundarios/source_ip_hash, append-only, mapping completo y prohibición de
metadata sensible. `AUD-DB-GAP` está CLOSED.
