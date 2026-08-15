---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001"
---
# DDD-013 — Aggregate Expediente

**Responsabilidad:** Representar la situación operativa actual del expediente físico
y proteger coherencia entre disponibilidad, ubicación y custodia.

## Datos mínimos confirmados

| Campo | Tipo | Notas |
|-------|------|-------|
| `ExpedienteId` | UUID | Identidad técnica primaria; generado por SIGAC (INV-EXP-001) |
| `ExpedienteNumero` | VO `ExpedienteNumero` | Identificador institucional; patrón RFC+COD; tolerante a separadores (OQ-EW-001) |
| `PacienteReferencia` | Referencia mínima | id institucional, CURP, nombre operativo, núm. ISSSTE; no clínico |
| `HospitalId` | `HospitalId` | Tenant al que pertenece |
| `EstadoOperativo` | `EstadoOperativoExpediente` | DISPONIBLE / APARTADO / EN_TRASLADO / EN_CONSULTA / NO_LOCALIZADO / EXTRAVIADO (DEC-EW-STATE-001) |
| `UbicacionActual` | `Ubicacion` nullable | Dónde está registrado actualmente |
| `CustodiaActual` | `Custodia` nullable | Quién responde operativamente |
| `CondicionOperativa` | enum | Estado físico del expediente (Íntegro, Deteriorado…) |
| `rowVersion` | bigint | Optimistic concurrency |

## Reglas del aggregate

- No contiene diagnósticos, notas clínicas, tratamientos ni estudios (BR-014).
- `EstadoOperativo` toma únicamente los seis valores de DEC-EW-STATE-001.
  `EN_BUSQUEDA` y `PRESTADO` **no** son valores válidos aquí.
- `expedienteNumero` no se declara UNIQUE hasta validar datos de SIMEF (INV-EXP-003).
- La identidad técnica es `ExpedienteId`; `expedienteNumero` es el identificador institucional.
- El despacho (`DispatchExpediente`) y la aceptación de custodia (`AcceptCustody`)
  son transiciones de estado distintas (INV-EXP-005).

## Fuente
SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001.
