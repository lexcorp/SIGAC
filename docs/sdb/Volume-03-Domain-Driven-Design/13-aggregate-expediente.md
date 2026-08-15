---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-013 — Aggregate Expediente
Responsabilidad: representar la situación operativa actual del expediente físico y proteger coherencia entre disponibilidad, ubicación y custodia.

Datos mínimos candidatos: ExpedienteId, ExpedienteNumero, PacienteReferencia, HospitalId, estado operativo, ubicación actual, custodia actual, condición operativa.

No contiene diagnósticos, notas, tratamientos ni estudios.
