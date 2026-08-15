# TQ-004 — Application Testing

Cada Use Case valida autorización, aggregate, reglas, persistencia, audit/outbox, errores y concurrencia/idempotencia cuando aplique.

Para `ExpedienteCapabilityService`, cubrir al menos:
- Role, Permission, Capability y Command no se sustituyen entre sí.
- Sin `EXPEDIENT_VIEW`, resultado vacío.
- `AUDITOR_CONSULTA` con `EXPEDIENT_VIEW`, operational capabilities vacías.
- Cada capability requiere su permission canónica y estado/contexto válido.
- ActorContext/TenantContext llegan ya validados; el servicio no resuelve tenant.
- SM 1-14: emisor y ejecutante separados; ejecución por Archivo/Jefatura con fuente validada.
- `ORDEN_SUPERIOR` no habilita `ABRIR_PRESTAMO` (fail-closed).
