---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-012 — State Machines

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
