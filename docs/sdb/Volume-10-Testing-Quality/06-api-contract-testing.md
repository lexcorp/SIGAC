# TQ-006 — API Contract Testing

Verificar OpenAPI, schemas, Problem Details, auth, status codes, pagination, idempotency y compatibilidad.

Para el scope base T-11/T-12 de Expediente Workspace se verifica:

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

Para la extensión SEARCH-EW-006..008 se verifica GET `/expedientes?numero=` requerido,
respuesta `{ items: [...] }` 0..N sin `total`/paginación, 400 para ausente/vacío/inválido,
403 sin `EXPEDIENT_VIEW`, tenant server-side y controller delegado exclusivamente al
Use Case. OpenAPI no declara unicidad del número.

La extensión pre-T-22 verifica GET `/expedientes/{id}/audit`, cursor opaco,
`items/nextCursor`, ausencia de total/changeSummary/securityContext y 401/403/404.
Debe comprobar el orden determinista de Audit y que el cursor se trata como opaco.
GET `/ubicaciones` exige 401/403 canónicos, responde `{items}` sin paginación y retorna
200 `{items:[]}` para catálogo vacío. Su OpenAPI se implementa en T-21A.

GET `/session` responde 401 sin autenticación y, con RequestContext válido, únicamente
actorId/permissions. El contrato excluye roles, tenantIds, claims y capabilities.

Agenda Preparation deberá probar multipart de un archivo, key requerida, RequestContext
server-side, permission antes de lectura, límite streaming, inspección content/layout,
201/Location/summary, replay idempotente, 400/401/403/409/413/415/422/500/504 y Problem
Details sin datos SIMEF. OpenAPI no se modifica durante AP-OQ-003.

Agenda Preparation v0.1.1 añade contract tests futuros para GET `/agenda-imports` con
fecha opcional, limit requerido, cursor opaco, empty 200 y campos mínimos; y GET
`/agendas/{date}` con `AgendaDayReadModel` exacto y `AGENDA_NOT_FOUND`/404. OpenAPI se
actualiza únicamente en su task futura.
