---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-SPEC-001, OQ-SPEC-003, OQ-SPEC-004, OQ-SPEC-009, OQ-SPEC-011, OQ-SPEC-012 cerradas o parcialmente resueltas"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# Open Questions — Volume 05

## Cerradas (2026-08-14)

| OQ | Pregunta | Resolución |
|----|----------|------------|
| OQ-SPEC-001 | Permisos exactos por tipo de solicitud | RESOLVED (parcial) — autorización depende de `FuenteHabilitanteSalida`. Ver BIZ-010, BIZ-016, UC-010. Pendiente: detalles de ORDEN_SUPERIOR. |
| OQ-SPEC-003 | Entrega vs préstamo | RESOLVED — `CONSULTA_PROGRAMADA` habilita entrega directa sin préstamo formal adicional; `VALE_ARCHIVO_SM_1_14` requiere préstamo formal de 24 h. Ver BIZ-010. |
| OQ-SPEC-004 | Custodio formal durante traslados | RESOLVED — durante `EN_TRASLADO` el responsable es el archivista/mensajero; la custodia externa formal inicia con `CustodyAccepted`. Ver DDD-018, WF-005. |
| OQ-SPEC-009 | Identificador único | RESOLVED — `ExpedienteNumero` no se asume único. Identidad técnica es `ExpedienteId` UUID. Ver DDD-007, BR-016/017. |
| OQ-SPEC-011 | Aceptación digital de custodia: ¿requiere confirmación del receptor? | RESOLVED — sí; `AcceptCustody` es acción autenticada y auditable del receptor. No requiere firma criptográfica en este slice. Ver DDD-018, WF-005. |
| OQ-SPEC-012 | ¿Qué campos son visibles a cada rol? | RESOLVED (parcial) — datos C3 mínimos para tarea operativa. Campo `pacienteRef.displayLabel` pendiente de detalle exacto (OQ-EW-002 en spec). Ver SEC-003, INT-009. |

## Abiertas

OQ-SPEC-002 Final exacto de Solicitud: ¿cuándo cierra formalmente?
OQ-SPEC-005 Criterio de Extraviado: ¿qué autoridad y proceso formal?
OQ-SPEC-006 TOMO/Provisional: tipo, condición o expediente distinto.
OQ-SPEC-007 No-show: ¿qué ocurre si el servicio no recibe el expediente?
OQ-SPEC-008 Formato real de importación SIMEF: columnas y estructura exacta.
OQ-SPEC-010 Procedimiento de contingencia (SPEC-011 pendiente).
