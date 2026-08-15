# TQ-006 — API Contract Testing

Verificar OpenAPI, schemas, Problem Details, auth, status codes, pagination, idempotency y compatibilidad.

Para T-11/T-12 de Expediente Workspace se verifica:

- sólo las cuatro rutas respaldadas por GetExpediente, GetExpedienteTimeline,
  DispatchExpediente y AcceptCustody;
- construcción server-side de RequestContext y rechazo de tenant/tracing desde body;
- request no autenticada → 401 y actor autenticado sin permission → 403;
- `rowVersion`/`expectedRowVersion` como string decimal, sin conversión a number;
- RFC7807 y ausencia de información cross-tenant;
- paridad exacta entre implementación y OpenAPI.
