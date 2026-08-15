# OS-017 — Definition of Ready

Approved spec, permissions, AC, ADR, API/UI deps, blocking OQs resolved.

Para Expediente Workspace T-04, AUTH-GAP-001..013 están cerrados por
`docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.
OQ-EW-003 permanece abierta y no bloqueante porque el tab Auditoría queda fuera de
las capabilities operativas de T-04.

Para T-05, `READ-EW-001..012`, `AUTH-EW-006/007`, `CTX-EW-001..004` y
`AUD-EW-001..006` definen
composición server-side, query ports de proyección, colección de fuentes habilitantes y
RequestContext/audit append-only. `OQ-EW-DESIGN-004` está RESOLVED por
READ-MODEL-COMPOSITION-DECISION. T-05 no tiene gaps bloqueantes conocidos.
