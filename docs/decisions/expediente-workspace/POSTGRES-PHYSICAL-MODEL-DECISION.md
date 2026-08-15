# PostgreSQL Physical Model Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.15 / T-10 y T-09

## DB-EW-001 — Nombres físicos

Los nombres físicos definitivos son `expedientes`, `ubicaciones`,
`movimientos_expediente` y `audit_log`. Los nombres del Domain pueden permanecer en
singular. `expediente` y `expediente_movimientos` no son nombres físicos válidos para
este slice.

## DB-EW-002 — Tenant y HospitalId

Las tres tablas operacionales pertenecen a la database de cada tenant. `HospitalId` se
obtiene exclusivamente de `TenantContext.hospitalId`; no se persiste `hospital_id` en
`expedientes` y ninguna query cruza databases tenant.

## DB-EW-003 — PacienteReferencia

El tipo canónico vigente exige cuatro strings no null. Se persisten como columnas
explícitas, sin JSONB y sin contenido clínico:

| Propiedad Domain | Columna | Tipo/nullability |
|---|---|---|
| `idInstitucional` | `paciente_id_institucional` | `TEXT NOT NULL` |
| `curp` | `paciente_curp` | `TEXT NOT NULL` |
| `nombreOperativo` | `paciente_nombre_operativo` | `TEXT NOT NULL` |
| `numeroIssste` | `paciente_numero_issste` | `TEXT NOT NULL` |

## DB-EW-004 — Ubicaciones

`ubicaciones` contiene exclusivamente `id UUID PRIMARY KEY`, `codigo TEXT NOT NULL` y
`descripcion TEXT NOT NULL`. No se aprueba UNIQUE ni otra columna. La nullability de
`expedientes.ubicacion_actual_id` sigue la del aggregate: `UUID NULL`.

## DB-EW-005 — Custodia inline

Custodia no tiene tabla propia. `expedientes` persiste `custodio_tipo`, `custodio_ref`,
`custodio_servicio`, `custodio_location` y `custodio_accepted_at`, todos nullable porque
`custodiaActual` puede ser null y `service`, `location` y `acceptedAt` también lo son en
el VO. Cuando existe Custodia, sus invariantes se aplican al rehidratar el aggregate.
`custodio_location` permanece `TEXT NULL`.

## DB-EW-006 — Row version

`row_version` es `BIGINT NOT NULL DEFAULT 0`. El adapter usa bigint y optimistic
locking real; no usa JavaScript `number`, default 1 ni last-write-wins.

## DB-EW-007 — ExpedienteNumero

`expediente_numero` y `expediente_numero_normalizado` son `TEXT NOT NULL`.
`expediente_numero` no tiene UNIQUE. El único índice secundario aprobado para este
slice es un btree no unique sobre `expediente_numero_normalizado`.

## DB-EW-008 — EstadoOperativo

`estado_operativo` es `TEXT NOT NULL` con CHECK cerrado a `DISPONIBLE`, `APARTADO`,
`EN_TRASLADO`, `EN_CONSULTA`, `NO_LOCALIZADO` y `EXTRAVIADO`.

## DB-EW-009 — MovimientoExpediente

`movimientos_expediente` implementa DAT-011. `business_reference_id` y
`correlation_id` son `TEXT NULL`, compatibles con Application. `movement_type` y
`business_reference_type` son `TEXT NOT NULL` sin CHECK en v0.3.15. Las referencias de
ubicación son UUID nullable y las referencias de custodio son TEXT nullable.

## DB-EW-010 — RequestSource y tiempos

`source` es `TEXT NOT NULL` con CHECK `IN ('WEB', 'INTERNAL')`.
`occurred_at` es `TIMESTAMPTZ NOT NULL` y lo aporta Application/UoW conforme a
DOM-EVENT-001. `recorded_at` es `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` y lo
establece PostgreSQL al insertar el movimiento.

## DB-EW-011 — Foreign keys

Se aprueban `expedientes.ubicacion_actual_id → ubicaciones.id` y
`movimientos_expediente.expediente_id → expedientes.id`. No se crean FKs para
`actor_ref`, referencias de custodio, `business_reference_id` ni `correlation_id`.
Tampoco se añaden FKs no aprobadas a las ubicaciones históricas del movimiento.

## DB-EW-012 — DDL conceptual definitivo

```sql
CREATE TABLE ubicaciones (
  id UUID PRIMARY KEY,
  codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL
);

CREATE TABLE expedientes (
  id UUID PRIMARY KEY,
  expediente_numero TEXT NOT NULL,
  expediente_numero_normalizado TEXT NOT NULL,
  paciente_id_institucional TEXT NOT NULL,
  paciente_curp TEXT NOT NULL,
  paciente_nombre_operativo TEXT NOT NULL,
  paciente_numero_issste TEXT NOT NULL,
  estado_operativo TEXT NOT NULL CHECK (estado_operativo IN (
    'DISPONIBLE', 'APARTADO', 'EN_TRASLADO', 'EN_CONSULTA',
    'NO_LOCALIZADO', 'EXTRAVIADO'
  )),
  ubicacion_actual_id UUID NULL REFERENCES ubicaciones(id),
  custodio_tipo TEXT NULL,
  custodio_ref TEXT NULL,
  custodio_servicio TEXT NULL,
  custodio_location TEXT NULL,
  custodio_accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX expedientes_numero_normalizado_idx
  ON expedientes (expediente_numero_normalizado);

CREATE TABLE movimientos_expediente (
  id UUID PRIMARY KEY,
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  movement_type TEXT NOT NULL,
  origin_location_id UUID NULL,
  destination_location_id UUID NULL,
  origin_custodian_ref TEXT NULL,
  destination_custodian_ref TEXT NULL,
  business_reference_type TEXT NOT NULL,
  business_reference_id TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_ref TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('WEB', 'INTERNAL')),
  correlation_id TEXT NULL
);
```

`updated_at` permanece sólo como metadata física y no pertenece al aggregate,
`ExpedienteSnapshot`, read model ni API conforme a READ-EW-013. `audit_log` permanece
separado y no se recrea en T-10; sus `request_id` y `correlation_id` son TEXT conforme
al `RequestContext` canónico, no UUID.

## DB-EW-013 — Mapping Repository

El adapter consulta `expedientes` dentro de la database seleccionada por
`TenantContext`, hace join de `ubicacion_actual_id` con `ubicaciones` y rehidrata
`Ubicacion {id,codigo,descripcion}`. Rehidrata `PacienteReferencia` desde sus cuatro
columnas, Custodia desde las cinco columnas inline y `rowVersion` como bigint.
`hospitalId` procede de `TenantContext.hospitalId`, nunca de la fila. La búsqueda usa
`ExpedienteNumero.normalizado` contra `expediente_numero_normalizado` y devuelve 0..N.

## DB-EW-014 — Migración y verificación

T-10 debe eliminar el UNIQUE vigente de `expediente_numero`, corregir default/tipo de
`row_version` y crear/completar las tres tablas mediante migración tenant versionada no
destructiva. T-09 queda después de T-10. Los tests PostgreSQL verifican DDL, CHECKs,
nullability, búsqueda 0..N, join de Ubicacion, rehidratación completa, bigint,
optimistic locking y aislamiento database-per-tenant.

## Gaps cerrados

Quedan cerrados para T-10 los gaps de nombres físicos, HospitalId, persistencia de
PacienteReferencia, Ubicacion, Custodia, rowVersion, falta de unicidad, tipos de
business reference/correlation, RequestSource, foreign keys y mapping VO ↔ DB.
