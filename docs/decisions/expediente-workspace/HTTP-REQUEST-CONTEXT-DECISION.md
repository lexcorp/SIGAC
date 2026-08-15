# HTTP Request Context and API Boundary Decision

Status: **APPROVED**
Scope: Expediente Workspace v0.3.23

## HTTP-EW-001 — Authenticated Request Context

La frontera server-side posee un resolver conceptualmente equivalente a:

```typescript
interface AuthenticatedRequestContextResolver {
  resolve(request: HttpRequestContext): Promise<RequestContext>;
}
```

`HttpRequestContext` es un tipo de infraestructura y no cruza hacia Application. El
resolver produce el único `RequestContext` canónico con `actor`, `tenant`, `requestId`,
`correlationId` y `source: 'WEB'` antes de invocar un Use Case.

La infraestructura de autenticación aporta un actor autenticado con `actorId`, `roles`,
`permissions` y `tenantIds`. Esta decisión no fija nombres de claims OIDC mientras el
proveedor no esté definido.

`TenantContext` se obtiene exclusivamente de fuentes server-side trusted y allow-listed,
y debe corresponder a uno de `actor.tenantIds`. Una selección ambigua entre múltiples
tenants se resuelve antes de Application. Body, query y valores arbitrarios de
`databaseName`, connection string o tenant nunca seleccionan una database.

`requestId` identifica una petición HTTP individual y la frontera garantiza que exista.
`correlationId` identifica el flujo lógico: sólo se propaga desde una fuente trusted
aprobada y, si no existe, la frontera genera uno. Son valores distintos; ninguno procede
del body y `requestId` nunca sustituye a `correlationId`.

## API-BIGINT-001 — Bigint en JSON/OpenAPI

Application conserva `bigint`. La frontera JSON representa `rowVersion` y
`expectedRowVersion` como string decimal no negativo:

```json
{ "rowVersion": "42", "expectedRowVersion": "42" }
```

El contrato OpenAPI es `type: string` con `pattern: '^[0-9]+$'`. La API convierte
string decimal a `bigint` al entrar y `bigint` a string decimal al salir. Nunca usa
JavaScript `number` para estas versiones.

## API-EW-021 — Controller boundary y scope T-11

Un controller sólo expone operaciones respaldadas por un Use Case/contrato Application
canónico. No accede a Repository para compensar contratos ausentes.

T-11 queda limitado a:

- `GET /api/v1/expedientes/{id}` → `GetExpediente`;
- `GET /api/v1/expedientes/{id}/timeline` → `GetExpedienteTimeline`;
- `POST /api/v1/expedientes/{id}/dispatch` → `DispatchExpediente`;
- `POST /api/v1/expedientes/{id}/accept-custody` → `AcceptCustody`.

En el scope base T-11 se difirieron búsqueda por número, `current-custody`, `active-loan`
y `rearchive` hasta contar con Use Cases Application. SEARCH-EW-001..010 aprueba ahora
`SearchExpedientesByNumero` y su extensión T-12A; los otros tres continúan diferidos.
La búsqueda mantiene 0..N y nunca se implementa mediante acceso directo del controller
a `findByNumero`.

## Authentication y RFC7807

| Situación/code | HTTP |
|---|---:|
| request no autenticada / `AUTHENTICATION_REQUIRED` | 401 |
| `PERMISSION_DENIED` | 403 |
| `INSUFFICIENT_ENABLING_SOURCE` | 403 |
| `EXPEDIENTE_NOT_FOUND` | 404 |
| `OPTIMISTIC_LOCK_CONFLICT` | 409 |
| `REQUEST_INVALID_TRANSITION` | 409 |

`AUTHENTICATION_REQUIRED` pertenece a API/BFF; no se añade a `ApplicationError`. La
respuesta usa RFC7807 con `code` estable y sin datos sensibles, detalles internos ni
existencia cross-tenant.

## Extensión v0.3.19

API-EW-024..026 y API-EW-030, definidos en
`HTTP-COMMAND-CONTRACT-DECISION.md`, completan success 204, validación HTTP 400 y el
módulo configurable requerido por T-11. No alteran el contrato de RequestContext.

## Extensión v0.3.20

`EXPEDIENT-SEARCH-DECISION.md` añade el Use Case y endpoint de búsqueda sin alterar la
resolución server-side de RequestContext. `numero` es dato funcional de búsqueda; nunca
selecciona tenant, actor ni conexión.

## Extensión v0.3.23 — Session authorization read model

GET `/api/v1/session` proyecta desde el `RequestContext` autenticado exclusivamente
`{ actorId, permissions }`. No requiere permission adicional; request no autenticada
produce `AUTHENTICATION_REQUIRED`/401. No acepta selección de tenant y no expone roles,
tenantIds, configuración de database, claims OIDC, tokens/cookies ni capabilities.

El endpoint invoca el Use Case mínimo `GetSessionAuthorization`, cuyo input es
`{context: RequestContext}`. Así el controller conserva API-EW-021 y no interpreta
claims ni accede a infraestructura de autorización directamente.

El frontend usa estas permissions server-derived únicamente para presentación
fail-closed. No las calcula ni deriva de roles. Las capabilities contextuales del
Expediente conservan un contrato separado.
