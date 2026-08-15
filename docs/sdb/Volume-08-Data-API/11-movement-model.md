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
# DAT-011 — MovimientoExpediente

Append-oriented.

- id
- expediente_id
- movement_type
- origin_location_id nullable
- destination_location_id nullable
- origin_custodian_ref nullable
- destination_custodian_ref nullable
- business_reference_type
- business_reference_id nullable
- occurred_at
- recorded_at
- actor_ref
- source
- correlation_id

## Purpose
Reconstruir trayectoria física/operativa.

## Ownership y proyección

Pertenece lógica y físicamente a Expediente / Archive Operations y se almacena junto con
Expediente en cada schema tenant. `ExpedienteTimelineQueryPort` devuelve el summary de
todos los campos anteriores, renombrando `id` como `movimientoId`, con orden estable
`occurred_at DESC, id DESC`.

No se usa para:
- login;
- configuración;
- cambios de permisos;
- audit técnico general.

No se mezcla ni comparte persistencia con `audit_log`.

Para DISPATCHED, el append contiene expedienteId, movementType, origin/destination
location, origin/destination custodian ref, business reference type/id, occurredAt,
actorRef, source y correlationId. Writer genera id y recordedAt al persistir. Sin C3.
Específicamente para `MovimientoExpedienteAppend` con `movementType='DISPATCHED'`,
`destinationCustodianRef: string` es obligatorio y equivale a
`intendedCustodian.reference`. No se añade destinationCustodianType porque DAT-011 no
lo contiene. Esto no cambia la nulabilidad general de DAT-011 para
otros tipos de movimiento. Su occurredAt es exactamente operationOccurredAt de la UoW.
