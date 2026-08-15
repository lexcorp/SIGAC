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

`OQ-EW-DESIGN-003` y `OQ-DOM-001` están RESOLVED por TL-EW-001..009: cursor pagination
y ownership de Movimiento en Archive Operations/schema tenant. Permanece abierta
`OQ-EW-010` sobre retención; T-06 no define ni ejecuta esa política.

También permanecen abiertas `OQ-EW-002`, `OQ-EW-003` y `OQ-EW-004`.
