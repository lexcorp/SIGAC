---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — DEC-EW-STATE-001: EstadoOperativo corregido"
---
# DDD-012 — State Machines

## EstadoOperativo del Expediente (DEC-EW-STATE-001 ACCEPTED)

```mermaid
stateDiagram-v2
    [*] --> DISPONIBLE
    DISPONIBLE --> APARTADO : reserva para jornada/solicitud
    APARTADO --> EN_TRASLADO : DispatchExpediente
    EN_TRASLADO --> EN_CONSULTA : CustodyAccepted (receptor confirma)
    EN_CONSULTA --> EN_TRASLADO : devolución iniciada
    EN_TRASLADO --> DISPONIBLE : ReturnReceived + verificación + rearchivo
    DISPONIBLE --> NO_LOCALIZADO : búsqueda sin resultado
    NO_LOCALIZADO --> DISPONIBLE : localizado y rearchivado
    NO_LOCALIZADO --> EXTRAVIADO : declaración formal (requiere autorización)
    EN_CONSULTA --> NO_LOCALIZADO : reporte de no localización en destino
```

**Notas obligatorias:**
- `EN_BUSQUEDA` **no** es un valor de `EstadoOperativo`. Es el estado de la **Solicitud**.
- `PRESTADO` **no** es un valor de `EstadoOperativo`. Pertenece al aggregate **Préstamo**.
- `NO_LOCALIZADO ≠ EXTRAVIADO`. La transición requiere proceso formal.
- La vuelta a `DISPONIBLE` requiere devolución + verificación + rearchivo confirmados.
  Recibir físicamente el expediente **no** equivale a rearchivarlo (BR-005, INV-LOAN-002).
- Las transiciones de `EstadoOperativo` pueden reaccionar a eventos de otros aggregates.

## Solicitud
```mermaid
stateDiagram-v2
    [*] --> Pendiente
    Pendiente --> Asignada
    Asignada --> EnBusqueda
    EnBusqueda --> Localizada
    EnBusqueda --> NoLocalizada
    Localizada --> Preparada
    Preparada --> Entregada
    Pendiente --> Cancelada
    Asignada --> Cancelada
    NoLocalizada --> EnBusqueda
```

## Préstamo
```mermaid
stateDiagram-v2
    [*] --> Activo
    Activo --> Vencido
    Activo --> Renovado
    Renovado --> Activo
    Activo --> Devuelto
    Vencido --> Devuelto
    Devuelto --> Cerrado
```
