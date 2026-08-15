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

Además, Dispatch y AcceptCustody success retornan 204 con body vacío; UUID, bigint y
campos inválidos retornan 400 `HTTP_VALIDATION_ERROR` sin reflejar valores; y el módulo
configurable acepta providers de test explícitos mientras `AppModule` productivo no
registra fake auth/projections.
