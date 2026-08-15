# SIGAC — Technical Decisions for Repository Bootstrap

Status: Approved baseline for bootstrap, subject to ADR review before production.

| Area | Decision |
|---|---|
| Package manager | pnpm workspaces |
| Monorepo orchestration | Nx |
| Node.js | 24 LTS |
| Backend | NestJS + TypeScript |
| Frontend | React + Vite + TypeScript |
| Database access | Drizzle ORM + PostgreSQL |
| Migrations | drizzle-kit + reviewed SQL migrations |
| Unit/integration tests | Vitest |
| E2E | Playwright |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| UI primitives | Radix UI primitives + SIGAC custom Design System |
| Authentication pattern | BFF-style OIDC session |
| OAuth/OIDC | Authorization Code flow; tokens remain server-side |
| API contract | REST + OpenAPI |
| Tenant isolation | database-per-tenant |
| Language convention | Spanish ubiquitous domain terms; English technical/infrastructure terms |

## Rationale

### pnpm + Nx
pnpm manages workspaces and dependencies efficiently. Nx adds project/task graphs, caching,
affected-project execution and architecture visibility. We use Nx as orchestration, not as an
application framework.

### Drizzle over Prisma/TypeORM
Drizzle keeps the persistence layer close to PostgreSQL and SQL while remaining typed. This fits
Clean Architecture because domain entities do not need ORM decorators or generated persistence
types. Database-per-tenant routing remains controlled by SIGAC's infrastructure layer.

### Vitest + Playwright
Vitest is used consistently for TypeScript unit/integration/component tests. Playwright owns
browser-level E2E tests.

### TanStack Query
TanStack Query owns asynchronous server-state lifecycle in the React app. Business state remains
on the server/domain.

### BFF over browser-held OAuth tokens
The browser receives a secure application session cookie. The NestJS backend performs OIDC/OAuth
responsibilities and keeps access/refresh tokens out of frontend JavaScript. This is preferred for
SIGAC's sensitive hospital context.

## Explicitly not selected

- npm alone: workable, but pnpm gives stronger workspace ergonomics for this monorepo.
- Nx as a code-generation mandate: no; only orchestration/graph/caching initially.
- Prisma: excellent DX but less direct control for our repository/DB-per-tenant style.
- TypeORM: valid NestJS option, but decorators/entity mapping can tempt persistence-domain coupling.
- Jest: mature, but Vitest gives one modern test runner across Vite frontend and TypeScript backend.
- SPA direct-token PKCE: standards-compliant option, but BFF reduces token exposure in browser JS.
