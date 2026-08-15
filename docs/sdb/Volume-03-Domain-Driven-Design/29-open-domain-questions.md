---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-DOM-003, OQ-DOM-010 cerradas vía OQ-EW-006/001"
---
# DDD-029 — Open Domain Questions

## Cerradas (2026-08-14)

| OQ | Pregunta | Resolución |
|----|----------|------------|
| OQ-DOM-003 | ¿Cuándo inicia Custodia externa? | RESOLVED — al emitirse `CustodyAccepted` tras confirmación del receptor autorizado. Ver DDD-018, OQ-EW-006. |
| OQ-DOM-010 | ¿Fuente maestra de paciente/expediente? | RESOLVED (parcial) — `ExpedienteNumero` proviene de SIMEF con patrón RFC+COD. Identidad técnica es UUID interno. Ver DDD-007, OQ-EW-001. |
| OQ-DOM-001 | ¿Movimiento dentro de Expediente o append-only separado? | RESOLVED — pertenece al módulo Expediente / Archive Operations y se persiste junto con Expediente en cada schema tenant; permanece separado de audit_log. Ver TL-EW-007. |

## Abiertas

OQ-DOM-002 ¿Préstamo aplica a toda entrega o solo a salidas formales?
OQ-DOM-004 ¿Provisional es tipo, condición o expediente distinto?
OQ-DOM-005 ¿TOMO es parte del mismo expediente o unidad administrable?
OQ-DOM-006 ¿Cuándo NoLocalizado abre Incidencia? (INV-INC-002 establece que no es automático)
OQ-DOM-007 ¿Cuándo termina Solicitud?
OQ-DOM-008 ¿Jornada cierra por fecha, turno o consultorio?
OQ-DOM-009 ¿Qué ubicaciones temporales son oficiales?
