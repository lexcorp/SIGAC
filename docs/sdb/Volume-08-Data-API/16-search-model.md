---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007: búsqueda devuelve colección 0..N + normalización"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-016 — Search

## Búsqueda por número de expediente (OQ-EW-001/007 RESOLVED)

La búsqueda por `expediente_numero` devuelve una **colección de 0..N resultados**.
El API nunca elige automáticamente cuando N > 1.

### Normalización de separadores
Se almacena `expediente_numero_normalizado` (sin separador) para búsqueda interna.
La presentación siempre usa el separador preferente `/`.

Variantes aceptadas en búsqueda:
- `PERR810604/10` → normaliza a `PERR81060410`
- `PERR810604-10` → normaliza a `PERR81060410`
- `PERR81060410`  → ya normalizado

### Desambiguación (OQ-EW-007)
Si N > 1, el cliente recibe la lista con datos mínimos para que el usuario
elija manualmente: nombre, CURP, número ISSSTE.
**Nunca** se selecciona automáticamente una coincidencia.

## Otros patrones de búsqueda MVP

- `expediente_numero` exact / prefix (con normalización de separador).
- Nombre paciente normalizado (búsqueda por texto).
- Solicitud activa del expediente.
- Ubicación/custodia actual.

## PostgreSQL
- `btree` sobre `expediente_numero_normalizado`.
- Texto normalizado (unaccented, lowercase) para nombre de paciente.
- `pg_trgm` candidato si se aprueba búsqueda fuzzy de nombre (OQ-DAT-006 abierta).
- No se usa motor de búsqueda externo inicialmente.

## Fuente
DECISION-REGISTER OQ-EW-001, OQ-EW-007, DDD-007, DAT-006.
