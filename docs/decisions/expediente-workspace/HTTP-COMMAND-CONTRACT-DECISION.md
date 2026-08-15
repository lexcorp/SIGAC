# HTTP Command and Composition Contract Decision

Status: **APPROVED**
Scope: Expediente Workspace v0.3.19 / T-11

## API-EW-024 — Dispatch success

`POST /api/v1/expedientes/{id}/dispatch` responde `204 No Content` después de completar
sincrónica y transaccionalmente la operación. No existe response body.
`ExpedienteDispatched` permanece como DomainEvent interno y no es contrato HTTP.

## API-EW-025 — AcceptCustody success

`POST /api/v1/expedientes/{id}/accept-custody` responde `204 No Content` después de
completar sincrónica y transaccionalmente la operación. No existe response body.
`CustodyAccepted` permanece como DomainEvent interno y no es contrato HTTP.

No aplica 201 porque no se crea un recurso HTTP independiente, ni 202 porque ambas
operaciones son síncronas. El cliente puede refrescar posteriormente
`GET /api/v1/expedientes/{id}`.

## API-EW-026 — HTTP validation

Los errores estructurales o de formato usan `HTTP_VALIDATION_ERROR` y HTTP 400. Incluyen
UUID inválido, decimal bigint inválido, campos requeridos ausentes, tipos JSON
incorrectos y límites fuera de rango cuando exista una regla aplicable.

```json
{
  "type": "https://sigac/errors/http-validation",
  "title": "Invalid request",
  "status": 400,
  "code": "HTTP_VALIDATION_ERROR",
  "detail": "The request contains invalid or malformed values.",
  "errors": [{ "field": "expectedRowVersion", "code": "INVALID_FORMAT" }]
}
```

`errors` es opcional. Sus códigos cerrados iniciales son `REQUIRED`, `INVALID_FORMAT`,
`INVALID_TYPE` y `OUT_OF_RANGE`. No incluye el valor recibido, datos C3, tokens,
cookies, stack traces, SQL, nombres de database ni connection strings. La API no expone
automáticamente mensajes internos/default de NestJS.

`HTTP_VALIDATION_ERROR` (400) describe una request estructuralmente inválida;
`REQUEST_INVALID_TRANSITION` (409) describe una operación estructuralmente válida pero
incompatible con el estado de negocio.

## API-EW-030 — Configurable API module

T-11 implementa un módulo NestJS configurable por dependencias con semántica equivalente
a:

```typescript
interface ExpedienteApiModuleDependencies {
  requestContextResolver: AuthenticatedRequestContextResolver;
  getExpediente: GetExpediente;
  getExpedienteTimeline: GetExpedienteTimeline;
  dispatchExpediente: DispatchExpediente;
  acceptCustody: AcceptCustody;
}
```

El mecanismo concreto puede usar `register`, providers/tokens u otra convención NestJS.
El controller recibe Use Cases ya construidos y no conoce query ports, repositories,
adapters ni UoW.

El composition root/infrastructure posee el wiring:

`authentication adapter + tenant resolver + projection adapters + persistence adapters
+ UoW → Use Cases → ExpedienteApiModule`.

Los tests pueden registrar fakes explícitos mediante el módulo configurable. Producción
no registra fakes. Mientras falten autenticación o proyecciones productivas, T-11 puede
implementar y probar completamente el módulo/controller, pero `AppModule` productivo no
lo monta hasta que la task de composition/integration suministre dependencias reales.
