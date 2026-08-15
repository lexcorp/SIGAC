# OS-017 — Definition of Ready

Approved spec, permissions, AC, ADR, API/UI deps, blocking OQs resolved.

Para Expediente Workspace T-04, AUTH-GAP-001..013 están cerrados por
`docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.
OQ-EW-003 permanece abierta y no bloqueante porque el tab Auditoría queda fuera de
las capabilities operativas de T-04.

Para T-11, HTTP-EW-001, API-BIGINT-001 y API-EW-021 cierran los contratos de resolver
HTTP autenticado, tenant membership, tracing, bigint decimal en JSON, scope limitado a
Use Cases existentes y distinción 401/403. La selección concreta de claims OIDC no se
inventa ni bloquea este contrato de frontera.

Para T-05, `READ-EW-001..013`, `AUTH-EW-006/007`, `CTX-EW-001..004`,
`AUD-EW-001..006` y `ERR-EW-001..004` definen
composición server-side, query ports de proyección, colección de fuentes habilitantes y
RequestContext/audit append-only. `OQ-EW-DESIGN-004` está RESOLVED por
READ-MODEL-COMPOSITION-DECISION. T-05 no tiene gaps bloqueantes conocidos.

Para T-06, `TL-EW-001..017` define ownership, query port, summary, cursor pagination,
tenant, autorización y audit. `OQ-EW-DESIGN-003` y `OQ-DOM-001` están RESOLVED.
`OQ-EW-010` permanece abierta y no bloquea porque T-06 no decide retención.

T-07 está ready: DSP-GAP-001/002 están cerrados. intendedCustodian type/reference son
obligatorios y no vacíos; AuditResult incorpora conflict y su append ocurre después del
rollback fuera de la UoW mutante.
DSP-EW-014..016 cierran la construcción de Custodia: Dispatch recibe type/reference
explícitos; service/location/acceptedAt quedan null y nada se deriva de destination.
El gap temporal también está cerrado por DOM-EVENT-001: Application pasa
operationOccurredAt al aggregate y evento/movimiento comparten exactamente el instante.
El audit de estado incompatible está cerrado por AUD-EW-010..013:
`REQUEST_INVALID_TRANSITION` usa `invalid-transition`; `conflict` queda reservado al
optimistic lock mismatch. T-07 no tiene gaps bloqueantes conocidos.

T-08 está ready: CST-GAP-001/002 están cerrados. businessReference procede del input y
audit usa `CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId` con los cinco resultados canónicos.

T-10 está ready mediante POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014: nombres
físicos, DDL, nullability, índices, CHECKs, FKs, tenant/HospitalId y mapping VO ↔ DB
quedan definidos. OQ-DAT-004 está RESOLVED; no quedan gaps bloqueantes conocidos para
la migración.

T-09 tiene definidos routing, transaction binding, ownership de audit_log, UoW y
operationOccurredAt mediante TX-EW-001..012. AUD-DB-EW-001..013 cierra AUD-DB-GAP con
DDL, mapping y migration ownership completos. T-09 está ready y no tiene gaps
bloqueantes conocidos.
