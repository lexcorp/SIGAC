---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-024 — Domain Events vs Audit Log
Domain Event = hecho significativo para el negocio.
Audit Log = evidencia de quién ejecutó qué acción y contexto técnico.
LoanOpened es domain event; “usuario X abrió préstamo desde sesión Y” es audit record.
