# First Codex Task — Bootstrap Verification

## Goal
Convert the repository bootstrap into a verified development baseline without implementing new
business behavior.

## Read
- AGENTS.md
- TECHNICAL-DECISIONS.md
- SDB Volume 06 Architecture & ADR
- SDB Volume 07 Security
- SDB Volume 08 Data & API
- SDB Volume 09 UI/UX
- SDB Volume 10 Implementation & Engineering

## Tasks
1. Run `pnpm install`.
2. Generate the first pnpm lockfile and commit it.
3. Run `pnpm typecheck`, `pnpm test`, `pnpm build`.
4. Fix bootstrap-only tooling/configuration errors without changing architecture.
5. Run local PostgreSQL/Keycloak compose.
6. Verify `/api/v1/health`.
7. Verify React shell.
8. Generate the initial reviewed Drizzle migration for tenant schema.
9. Do **not** implement authentication or SPEC-009 yet if OIDC session design is unresolved in environment.
10. Report all version/tooling compatibility issues.

## Acceptance
No business rule is invented and the repository becomes reproducibly installable/buildable.
