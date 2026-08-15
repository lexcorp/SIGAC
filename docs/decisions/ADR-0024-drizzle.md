# ADR-0024 — Drizzle ORM

Status: Accepted for bootstrap.

Use Drizzle in infrastructure/persistence adapters. Domain entities remain persistence-ignorant.
Use drizzle-kit to generate migration candidates; SQL migrations must be reviewed.
