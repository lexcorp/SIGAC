---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-001 — Architecture Drivers

## Functional drivers
- localizar expediente rápidamente;
- mantener estado actual y trayectoria;
- preparar cientos de expedientes por jornada;
- registrar custodia, préstamo, devolución e incidencias;
- reconciliar agendas;
- ofrecer búsqueda y dashboard operativos.

## Quality drivers
1. Confidencialidad.
2. Aislamiento entre hospitales.
3. Trazabilidad.
4. Integridad transaccional.
5. Disponibilidad en jornada clínica.
6. Recuperabilidad.
7. Operación simple por TI local.
8. Evolución hacia barcode/RFID/integraciones.
9. Auditabilidad.
10. Configurabilidad por hospital.

## Constraints
- hospital público;
- infraestructura potencialmente on-premise;
- conectividad/integraciones externas variables;
- MVP sin contenido clínico;
- multi-hospital futuro.
