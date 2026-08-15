---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.2.0"
status: "Draft for workflow validation"
date: "2026-08-14"
amended: "2026-08-14 — DEC-EW-STATE-001: EstadoOperativo Expediente corregido"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# Workflow State Matrix

| Aggregate | Estados aceptados |
|-----------|-------------------|
| **Expediente** (`EstadoOperativo`) | `DISPONIBLE`, `APARTADO`, `EN_TRASLADO`, `EN_CONSULTA`, `NO_LOCALIZADO`, `EXTRAVIADO` |
| **Solicitud** | Pendiente, Asignada, EnBusqueda, Localizada, Preparada, Entregada, Cancelada, NoLocalizada |
| **Préstamo** | Activo, Vencido, Renovado, Devuelto, Cerrado |
| **Incidencia** | Abierta, EnInvestigacion, Escalada, Resuelta |
| **Jornada** | Abierta, EnPreparacion, Lista, EnOperacion, Cerrada |

## Notas obligatorias (DEC-EW-STATE-001)

- `EN_BUSQUEDA` **no** es un `EstadoOperativo` del Expediente; es estado de la **Solicitud**.
- `PRESTADO` **no** es un `EstadoOperativo` del Expediente; pertenece al aggregate **Préstamo**.
- `NO_LOCALIZADO ≠ EXTRAVIADO`: el segundo requiere declaración formal con autorización.
- Los estados del Expediente pueden cambiar como reacción a eventos de otros aggregates.
- La vuelta a `DISPONIBLE` requiere: devolución → verificación → rearchivo confirmados.

## Transiciones base del Expediente

```
DISPONIBLE → APARTADO         (reserva para jornada)
APARTADO   → EN_TRASLADO      (DispatchExpediente)
EN_TRASLADO → EN_CONSULTA     (CustodyAccepted)
EN_CONSULTA → EN_TRASLADO     (devolución iniciada)
EN_TRASLADO → DISPONIBLE      (ReturnReceived + verificación + rearchivo)
DISPONIBLE  → NO_LOCALIZADO   (búsqueda sin resultado)
NO_LOCALIZADO → DISPONIBLE    (localizado y rearchivado)
NO_LOCALIZADO → EXTRAVIADO    (declaración formal autorizada)
```
