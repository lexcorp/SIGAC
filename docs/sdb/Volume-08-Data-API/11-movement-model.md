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
# DAT-011 — MovimientoExpediente (`movimientos_expediente`)

Append-oriented.

| Columna | Tipo/nullability |
|---|---|
| `id` | UUID PRIMARY KEY |
| `expediente_id` | UUID NOT NULL FK → `expedientes.id` |
| `movement_type` | TEXT NOT NULL, sin CHECK en este slice |
| `origin_location_id` | UUID NULL |
| `destination_location_id` | UUID NULL |
| `origin_custodian_ref` | TEXT NULL |
| `destination_custodian_ref` | TEXT NULL |
| `business_reference_type` | TEXT NOT NULL, sin CHECK |
| `business_reference_id` | TEXT NULL |
| `occurred_at` | TIMESTAMPTZ NOT NULL |
| `recorded_at` | TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP |
| `actor_ref` | TEXT NOT NULL |
| `source` | TEXT NOT NULL CHECK (`source IN ('WEB', 'INTERNAL')`) |
| `correlation_id` | TEXT NULL |

`business_reference_id` y `correlation_id` no exigen UUID porque Application usa
strings opacos. No se crean FKs para actor, custodios, business reference, correlation
ni ubicaciones históricas. La única FK de esta tabla aprobada para el slice es
`expediente_id → expedientes.id`.

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

Para CUSTODY_ACCEPTED, origin/destination location y custodian refs derivan del estado
pre/post; destinationLocation usa ubicacionDestino.id y destinationCustodianRef usa
receptor.reference. businessReferenceType/id proceden del input AcceptCustody;
actor/source/correlation proceden de RequestContext. No se añade destinationCustodianType.
La business reference no se deriva de Dispatch/correlationId ni participa en Custodia,
autorización o tenant. `occurred_at` procede de Application/UoW y `recorded_at` lo
establece PostgreSQL al insertar. Fuente: POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-009..014.
