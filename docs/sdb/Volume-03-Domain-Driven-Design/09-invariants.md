---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-009 — Invariants Candidates
INV-EXP-001 Expediente tiene identificador institucional.
INV-EXP-002 Mantiene situación operativa coherente.
INV-EXP-003 No puede estar disponible en archivo y bajo custodia externa incompatible.
INV-LOAN-001 Préstamo tiene expediente, responsable/custodio, finalidad e inicio.
INV-LOAN-002 Préstamo cerrado no vuelve a activo.
INV-REQ-001 Solicitud tiene origen/finalidad.
INV-REQ-002 No pasa a Preparada sin localización o excepción formal.
INV-PREP-001 Reimportación equivalente no duplica ítems.
INV-INC-001 Resolución conserva actor, fecha y causa.
