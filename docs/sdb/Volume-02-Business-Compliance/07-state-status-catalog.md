---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
amended: "2026-08-14 — DEC-EW-STATE-001, OQ-EW-001"
---
# BIZ-007 — State & Status Catalog

## Solicitud — estados candidatos
Pendiente, Asignada, EnBusqueda, Localizada, Preparada, Entregada, Cancelada, NoLocalizada.

## Expediente — EstadoOperativo (ACEPTADO, DEC-EW-STATE-001)
Los seis valores aceptados para `EstadoOperativo` del aggregate Expediente son:

| Valor | Descripción |
|-------|-------------|
| `DISPONIBLE` | En Archivo Clínico, sin despacho activo ni préstamo |
| `APARTADO` | Reservado para una jornada/solicitud programada; aún en Archivo |
| `EN_TRASLADO` | En tránsito físico (despachado pero custodia aún no aceptada en destino) |
| `EN_CONSULTA` | Custodia aceptada formalmente en el servicio/consultorio de destino |
| `NO_LOCALIZADO` | No encontrado durante búsqueda; no declarado extraviado |
| `EXTRAVIADO` | Declarado extraviado por proceso formal (requiere política/autorización) |

### Reglas de estado (DEC-EW-STATE-001)
- `EN_BUSQUEDA` pertenece al estado de la Solicitud, **no** al EstadoOperativo del Expediente.
- `PRESTADO` pertenece al aggregate Préstamo; **no** se usa como EstadoOperativo del Expediente.
- `NO_LOCALIZADO ≠ EXTRAVIADO`: el primero es operativo; el segundo requiere proceso formal.
- EstadoOperativo no sustituye los estados de Solicitud, Préstamo, Incidencia, Custodia ni Ubicación.
- Las transiciones pueden ocurrir como reacción a eventos de otros aggregates/módulos.

### Flujo base
`DISPONIBLE → APARTADO → EN_TRASLADO → EN_CONSULTA → EN_TRASLADO → DISPONIBLE`

La transición final a `DISPONIBLE` requiere devolución, verificación y rearchivo confirmados.
Recibir físicamente el expediente **no** equivale automáticamente a rearchivarlo (BR-005).

## Préstamo — estados candidatos
Activo, Vencido, Renovado, Devuelto, Cerrado.

## Incidencia — estados candidatos
Abierta, EnInvestigacion, Escalada, Resuelta.

## Jornada — estados candidatos
Abierta, EnPreparacion, Lista, EnOperacion, Cerrada.

## Pendiente de clasificación DDD
Provisional, TOMO, Deteriorado, Duplicado — requieren decisión de dominio (OQ-DOM-004, OQ-DOM-005).
