---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-14"
amended: "2026-08-15 — DB-EW-001..014: modelo físico PostgreSQL definitivo"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-006 — Expediente

## Tabla física canónica: `expedientes`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID PK | Identidad técnica primaria (`ExpedienteId`) |
| `expediente_numero` | TEXT NOT NULL | Identificador institucional (patrón RFC+COD); tolera `/`, `-` o sin sep.; no unique |
| `expediente_numero_normalizado` | TEXT NOT NULL | Forma normalizada sin separador para búsqueda eficiente |
| `paciente_id_institucional` | TEXT NOT NULL | `PacienteReferencia.idInstitucional` |
| `paciente_curp` | TEXT NOT NULL | `PacienteReferencia.curp` |
| `paciente_nombre_operativo` | TEXT NOT NULL | `PacienteReferencia.nombreOperativo` |
| `paciente_numero_issste` | TEXT NOT NULL | `PacienteReferencia.numeroIssste` |
| `estado_operativo` | TEXT NOT NULL CHECK | Enum de 6 valores (ver abajo) |
| `ubicacion_actual_id` | UUID nullable FK → ubicaciones | |
| `custodio_tipo` | TEXT nullable | Tipo de custodio actual |
| `custodio_ref` | TEXT nullable | Referencia del custodio actual |
| `custodio_servicio` | TEXT nullable | `Custodia.service` |
| `custodio_location` | TEXT nullable | `Custodia.location`; identificador estable cuando se conoce |
| `custodio_accepted_at` | timestamptz nullable | Timestamp de `CustodyAccepted`; null si no está aceptada |
| `created_at` | timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP | Metadata física |
| `updated_at` | timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP | Metadata física; excluida del aggregate/read model por READ-EW-013 |
| `row_version` | BIGINT NOT NULL DEFAULT 0 | Optimistic concurrency (DAT-019); se mapea a bigint |

`HospitalId` procede exclusivamente del `TenantContext`/database tenant. No existe
`hospital_id`. Los cuatro campos de PacienteReferencia son obligatorios, explícitos y
no contienen contenido clínico; no se usa JSONB.

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
-- No existe UNIQUE sobre expediente_numero ni expediente_numero_normalizado.
```

La búsqueda por `expediente_numero` puede devolver múltiples filas.
El campo `expediente_numero_normalizado` (sin separador) se indexa para búsqueda eficiente.

## Índice aprobado

```sql
CREATE INDEX expedientes_numero_normalizado_idx
  ON expedientes (expediente_numero_normalizado);
```

No se aprueban otros índices secundarios para este slice. La FK aprobada es
`expedientes.ubicacion_actual_id → ubicaciones.id`.

## Tabla `ubicaciones`

Contiene exclusivamente `id UUID PRIMARY KEY`, `codigo TEXT NOT NULL` y
`descripcion TEXT NOT NULL`, sin UNIQUE ni columnas adicionales. El Repository hace
join para rehidratar el VO completo. Custodia se persiste inline y no tiene tabla.

## Fuente
DDD-013, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001,
POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014.
