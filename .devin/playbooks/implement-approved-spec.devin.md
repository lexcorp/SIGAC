# Implement an Approved SIGAC Spec
## Procedure
1. Read AGENTS.md, approved SPEC, UC, workflow, domain, ADR, OpenAPI, UI and security docs.
2. Stop for ambiguity affecting behavior, auth, tenancy or data.
3. Inspect existing patterns.
4. Implement smallest complete vertical change.
5. Add applicable unit/integration/auth/tenant/E2E tests.
6. Update OpenAPI/migration/docs when required.
7. Run lint, typecheck, tests and build.
8. Review diff for spec/architecture/privacy drift.
9. Create PR with traceability and impacts.
## Forbidden
Do not invent rules/transitions; alter accepted ADRs; weaken security; use production patient data; or merge PR.
