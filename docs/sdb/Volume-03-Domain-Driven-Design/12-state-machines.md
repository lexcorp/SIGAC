---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — DEC-EW-STATE-001: EstadoOperativo corregido"
---
# DDD-012 — State Machines

## ImportacionAgenda (IMP-AP-001..014)

`BUILDING → FINALIZED` es la única transición interna de T-02. Outcome y métricas son
nulos durante construcción y se fijan una vez en `finalize(outcome)`. No hay reapertura.
El layout incompatible se rechaza antes de construir el Aggregate y no es un estado.

## Cita de Agenda Preparation (AGD-AP-001..009)

```text
ACTIVA --ausente de snapshot--> RETIRADA_DE_AGENDA
RETIRADA_DE_AGENDA --mismo FOLIO reaparece--> ACTIVA
```

`ACTIVA` participa en preparación vigente. `RETIRADA_DE_AGENDA` conserva Entity, FOLIO y
último contenido funcional; no es cancelación clínica. No existen otros estados ni
timestamps de lifecycle en T-03.

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
