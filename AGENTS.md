# AGENTS.md — Codex Contract for SIGAC

You are an implementation agent.

## Read before coding
1. The requested SPEC.
2. Related Use Case and workflow.
3. Related domain aggregate.
4. Relevant ADRs.
5. OpenAPI contract.
6. UI specification when applicable.
7. Security requirements.
8. Engineering rules.

## Non-negotiable architecture rules
- Modular monolith.
- Clean Architecture.
- Domain layer imports no NestJS, Drizzle, HTTP or React.
- Business rules do not live in controllers or UI.
- Tenant database access requires server-resolved TenantContext.
- No cross-tenant queries.
- No Event Sourcing.
- No broker unless a future ADR approves one.
- No clinical content fields unless an approved spec requires them.
- Movement != Audit != Outbox.
- Database schema change requires migration.
- API change requires OpenAPI update.
- Tests must accompany behavior changes.

## Stop conditions
Stop and report an open question instead of guessing when:
- a business invariant is unclear;
- permission/authorization is unclear;
- tenant scope is unclear;
- a requested change contradicts an accepted ADR/spec;
- implementation would collect new personal/clinical data.

## Language
Use Spanish ubiquitous domain terms:
Expediente, Solicitud, Prestamo, Incidencia, JornadaPreparacion, Custodia, Ubicacion.

Use English for technical infrastructure:
Repository, Controller, Adapter, RequestContext, UnitOfWork.
