---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-020 — Transactions

One application command = one tenant DB transaction when possible.

Inside transaction:
- load aggregate;
- validate;
- write aggregate state;
- append movement if relevant;
- append outbox event;
- append audit metadata through coordinated mechanism.

Avoid distributed transactions across tenant databases/control plane.

Dispatch usa ArchiveOperationsUnitOfWork: update Expediente con expectedRowVersion,
append Movimiento DISPATCHED y append audit success en una única transacción del tenant,
ALL OR NOTHING. UoW aporta operationOccurredAt; MovimientoWriter establece recordedAt al
INSERT. Ningún timestamp proviene del cliente.
Application entrega `operationOccurredAt` a `Expediente.dispatch` como occurredAt. El
Domain Event y el Movimiento DISPATCHED conservan exactamente ese mismo instante; el
aggregate no lo genera y no se introduce event factory/envelope diferido para T-07.

Ante optimistic lock mismatch, la transacción mutante hace rollback completo. Después
del rollback se registra audit `conflict` fuera de esa UoW; no se persiste cambio de
aggregate, Movimiento ni audit success.
