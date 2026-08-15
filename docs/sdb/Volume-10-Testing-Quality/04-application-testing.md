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
- colección de fuentes vacía -> `ABRIR_PRESTAMO` ausente;
- una o varias fuentes: basta una validada `CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14`;
- fuentes no validadas -> `ABRIR_PRESTAMO` ausente;
- `ORDEN_SUPERIOR` validada -> `ABRIR_PRESTAMO` ausente;
- CapabilityService no selecciona una fuente ni valida evidencia.

Para `GetExpediente` y sus puertos de proyección, cubrir al menos:
- composición server-side del read model único;
- cardinalidad `0..1` y ausencia `null` para Solicitud/Préstamo activos;
- cardinalidad `0..N` y ausencia `[]` para Incidencias abiertas;
- `ExpedienteId` y `TenantContext` obligatorios en cada query port;
- ningún query port retorna aggregates ajenos;
- audit `EXPEDIENTE_VIEW` con `success`, `denied`, `not-found`;
- ningún registro de audit contiene datos C3;
- el controller no escribe audit.
- `ExitEnablingSourceQueryPort` recibe el mismo ExpedienteId/TenantContext, devuelve
  `0..N` y usa `[]` como ausencia.
