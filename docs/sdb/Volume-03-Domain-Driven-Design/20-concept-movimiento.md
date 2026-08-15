---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-020 — MovimientoExpediente
Registra una transición relevante de la trayectoria física/operativa.
Ejemplos: Archivo→Preparación, Preparación→Carrito, Carrito→Consultorio, Consultorio→Archivo, Recepción→Anaquel.
Movimiento no es el concepto central, no sustituye a Préstamo y no sustituye a Audit Log.

## Ownership (OQ-DOM-001 RESOLVED)

`MovimientoExpediente` pertenece lógica y físicamente al módulo Expediente / Archive
Operations. Se persiste en el schema de cada tenant junto con Expediente, con escritura
append-oriented. Permanece absolutamente separado de `audit_log`.
