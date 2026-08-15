# OS-031 — Open Questions

Exact external version, mandatory artifacts, registry automation, generated docs policy, sign-off representation.

## Estado de OQs resueltas (2026-08-14)

Las siguientes OQs de spec que eran bloqueantes para expediente-workspace v0.3.0
han sido RESUELTAS y propagadas al SDB canónico:

| OQ | Estado | Documentos SDB actualizados |
|----|--------|-----------------------------|
| OQ-EW-001 | RESOLVED | DDD-007, DDD-013, DAT-006, DAT-016, API-011, BIZ-006, BIZ-021, BIZ-026, SPEC-009, UC-018 |
| OQ-EW-005 | RESOLVED | BIZ-010, BIZ-016, DDD-010, UC-010, SPEC-006, WF-006, SEC-017, V05-perm-matrix |
| OQ-EW-006 | RESOLVED | BIZ-008, DDD-011, DDD-018, WF-005, V04-state-matrix, V04-OQ-WF |
| OQ-EW-007 | RESOLVED | DDD-007, DDD-009, DAT-006, DAT-016, API-011, UC-018, SPEC-009 |
| DEC-EW-STATE-001 | ACCEPTED | DDD-012, DDD-013, BIZ-007, V04-state-matrix, API-011, APP-003, TQ-003, TQ-010 |

Estas decisiones están disponibles para consumo directo en expediente-workspace v0.3.1.
No se requiere política conservadora temporal para ninguna de ellas.

## Authorization gaps de T-04 (2026-08-15)

`AUTH-GAP-001` a `AUTH-GAP-013` están cerrados para T-04 mediante
`docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.
OQ-EW-003 permanece abierta y no bloqueante; el permiso del tab Auditoría queda
fuera de las capabilities operativas.

## Read model composition de T-05 (2026-08-15)

`OQ-EW-DESIGN-004` está RESOLVED a favor de un endpoint/read model agregado compuesto
server-side. La decisión y los contratos canónicos están en
`docs/decisions/expediente-workspace/READ-MODEL-COMPOSITION-DECISION.md`.

READ-EW-008..012 resuelven para T-05 el origen contractual de las fuentes habilitantes:
`ExitEnablingSourceQueryPort` devuelve `0..N` contextos mínimos y el provider determina
`validada`. La infraestructura concreta de Agenda/SM 1-14 no se decide aquí.

CTX-EW-001..004 y AUD-EW-003..006 resuelven el bloqueo de request/audit context:
`RequestContext` es el contexto inmutable construido server-side, `GetExpediente` lo
recibe como input y `AuditWriter` enriquece el `AuditEntry` semántico hasta el
`AuditRecord` persistido.

`OQ-EW-DESIGN-003` y `OQ-DOM-001` están RESOLVED por TL-EW-001..017: cursor pagination
y ownership de Movimiento en Archive Operations/schema tenant. Permanece abierta
`OQ-EW-010` sobre retención; T-06 no define ni ejecuta esa política.

También permanecen abiertas `OQ-EW-002`, `OQ-EW-003` y `OQ-EW-004`.

## DispatchExpediente T-07 (v0.3.12)

DSP-EW-001..011 define semántica, input, evento, MovimientoWriter, timestamps, UoW y
audit. DSP-GAP-001/002 están CLOSED: intendedCustodian type/reference son obligatorios
y no vacíos;
optimistic conflict usa AuditResult `conflict` después del rollback.
El gap temporal está CLOSED mediante DOM-EVENT-001: Application pasa
operationOccurredAt explícitamente a `Expediente.dispatch`; evento y movimiento usan
exactamente el mismo instante.
AUD-EW-010..013 cierran el audit de transición inválida: usa `invalid-transition` fuera
de la UoW después del rollback; `conflict` permanece exclusivo de optimistic locking.
DSP-EW-014..016 cierran la construcción de Custodia en traslado mediante custodio
previsto type/reference explícito y service/location/acceptedAt null.

## AcceptCustody T-08 (v0.3.13)

CST-EW-001..010 define input, custodia efectiva, ubicación, evento, UoW y movimiento.
CST-GAP-001/002 están CLOSED mediante businessReference explícita y audit
`CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId`.

## PostgreSQL physical model T-10 (v0.3.15)

DB-EW-001..014 cierran los gaps de nombres, tenant/HospitalId, PacienteReferencia,
Ubicacion, Custodia inline, rowVersion, ExpedienteNumero no unique, tipos de Movimiento,
RequestSource, FKs y mapping Repository. T-10 queda listo para implementación conforme a
`POSTGRES-PHYSICAL-MODEL-DECISION.md`; no se abre una OQ nueva.

## Tenant transaction/audit T-09 (v0.3.17)

TX-EW-001..012 aprueba TenantDatabaseRouter, transacción tenant única, ownership y
storage tenant-local de audit_log, AuditWriter transaction-bound, UoW y audit standalone.
AUD-DB-EW-001..013 cierra `AUD-DB-GAP`: DDL, checks, mapping, exclusión de
source_ip_hash y migration ownership quedan definidos. T-09 está ready.

## HTTP boundary T-11 (v0.3.18–0.3.19)

HTTP-EW-001, API-BIGINT-001 y API-EW-021 cierran los cuatro bloqueos conocidos:
RequestContext autenticado server-side, tenant membership/tracing, representación
decimal de bigint y scope de controller limitado a Use Cases existentes. La búsqueda
por número y los sub-recursos/command sin Use Case se difieren explícitamente y no son
gaps bloqueantes de T-11. No quedan OQs bloqueantes conocidas para T-11.

API-EW-024..026 y API-EW-030 cierran adicionalmente los outcomes HTTP de commands, la
taxonomía de validación y el wiring configurable. El montaje productivo se difiere a la
task de composition/integration si aún faltan adapters reales; no es gap de T-11.
