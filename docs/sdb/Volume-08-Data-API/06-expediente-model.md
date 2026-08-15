---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001: sin UNIQUE, estados corregidos"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-006 — Expediente

## Campos candidatos

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID PK | Identidad técnica primaria (`ExpedienteId`) |
| `expediente_numero` | varchar | Identificador institucional (patrón RFC+COD); tolera `/`, `-` o sin sep. |
| `expediente_numero_normalizado` | varchar | Forma normalizada sin separador para búsqueda eficiente |
| `paciente_ref_id` | UUID nullable | Referencia al paciente (C3) |
| `paciente_nombre_busqueda` | varchar nullable | Nombre normalizado para búsqueda (C3) |
| `estado_operativo` | varchar CHECK | Enum de 6 valores (ver abajo) |
| `ubicacion_actual_id` | UUID nullable FK → ubicaciones | |
| `custodio_tipo` | varchar nullable | Tipo de custodio actual |
| `custodio_ref` | varchar nullable | Referencia del custodio actual |
| `custody_accepted_at` | timestamptz nullable | Timestamp de `CustodyAccepted`; null si EN_TRASLADO sin aceptar |
| `last_movement_id` | UUID nullable FK → movimientos_expediente | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `row_version` | bigint NOT NULL DEFAULT 0 | Optimistic concurrency (DAT-019) |

## Constraint de estado operativo (DEC-EW-STATE-001)

```sql
CHECK (estado_operativo IN (
  'DISPONIBLE',
  'APARTADO',
  'EN_TRASLADO',
  'EN_CONSULTA',
  'NO_LOCALIZADO',
  'EXTRAVIADO'
))
```

**`EN_BUSQUEDA` y `PRESTADO` no son valores válidos** de `estado_operativo`.

## Constraint de unicidad (OQ-EW-001/007 RESOLVED)

```sql
-- NO crear antes de perfilar datos reales de SIMEF:
-- UNIQUE(expediente_numero, hospital_id)   ← pendiente profiling SIMEF
```

La búsqueda por `expediente_numero` puede devolver múltiples filas.
El campo `expediente_numero_normalizado` (sin separador) se indexa para búsqueda eficiente.

## Índices candidatos

```sql
INDEX ON expediente (expediente_numero_normalizado)   -- búsqueda flexible
INDEX ON expediente (estado_operativo)                -- filtros operativos
INDEX ON expediente (ubicacion_actual_id)
```

## Fuente
DDD-013, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001.
