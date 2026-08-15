# Expediente Audit and Command UX Decision

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.22 / pre-T-22

## AUDIT-UX-EW-001 — Permission de Auditoría

La permission canónica es `EXPEDIENT_AUDIT_VIEW`.

- `EXPEDIENT_VIEW` autoriza Workspace y Timeline.
- `EXPEDIENT_AUDIT_VIEW` autoriza el tab Auditoría y su query Application/API.
- La UI no deriva acceso desde roles.
- Sin la permission, el tab queda fail-closed y no consulta datos.
- `EXPEDIENT_AUDIT_VIEW` no es capability ni command.

OQ-EW-003 queda RESOLVED. La asignación de esta permission a actores se recibe en
`ActorContext.permissions`; no se añade a las capabilities operativas.

## AUDIT-UX-EW-002 — GetExpedienteAudit

Application de Expediente Workspace posee el Use Case consumidor:

```typescript
interface GetExpedienteAuditInput {
  readonly expedienteId: ExpedienteId;
  readonly pagination: { readonly cursor?: string; readonly limit: number };
  readonly context: RequestContext;
}
```

Orden de ejecución: comprobar `EXPEDIENT_AUDIT_VIEW`; comprobar existencia tenant-scoped
con `ExpedienteRepository.findById(expedienteId, context.tenant)`; consultar el puerto
con `context.tenant`; retornar la página sanitizada. Falta de permission produce
`PERMISSION_DENIED`/403 antes de queries. Ausencia en el tenant activo, incluido un ID
existente físicamente en otro tenant, produce `EXPEDIENTE_NOT_FOUND`/404 sin disclosure.

## AUDIT-UX-EW-003 — Query port y resultado

```typescript
interface ExpedienteAuditQueryPort {
  findByExpediente(
    expedienteId: ExpedienteId,
    pagination: ExpedienteAuditPagination,
    tenant: TenantContext,
  ): Promise<ExpedienteAuditPage>;
}

interface ExpedienteAuditPage {
  readonly items: readonly ExpedienteAuditEntrySummary[];
  readonly nextCursor: string | null;
}

interface ExpedienteAuditEntrySummary {
  readonly auditId: string;
  readonly action: string;
  readonly result: 'success' | 'denied' | 'not-found' | 'conflict' | 'invalid-transition';
  readonly actorRef: string;
  readonly occurredAt: Date;
  readonly source: 'WEB' | 'INTERNAL';
  readonly requestId: string;
  readonly correlationId: string;
}
```

El puerto pertenece a Application del Workspace como consumidor y su adapter consulta
Security/Audit tenant-local. Filtra exclusivamente `resource_type = EXPEDIENTE` y
`resource_id = expedienteId`. Ausencia devuelve `items=[]`, `nextCursor=null`. La
paginación es cursor-based, el cursor es opaco para API/UI y no se devuelve `total`.
El summary excluye `changeSummary`, `securityContext` y metadata interna. Audit continúa
separado de `MovimientoExpediente`.

## AUDIT-UX-EW-004 — API

`GET /api/v1/expedientes/{id}/audit` invoca exclusivamente `GetExpedienteAudit` y
responde `{ items: readonly ExpedienteAuditEntrySummary[]; nextCursor: string | null }`.
Documenta 401, 403 y 404 canónicos. El cursor no se interpreta en frontend.

## CMD-UX-EW-001 — DispatchExpedienteDialog

La CommandBar abre el diálogo sólo cuando recibe `DISPATCH` en `capabilities[]`.
El formulario captura `destination` mediante una opción de Ubicación,
`intendedCustodian.type`, `intendedCustodian.reference`, `businessReference.type` y
`businessReference.id` opcional. `expectedRowVersion` procede del Workspace actual, no
es editable y conserva representación decimal string. No acepta actor, tenant,
`occurredAt`, requestId ni correlationId. Type/reference se capturan explícitamente; no
hay directorio de personal, catálogo de tipos ni valores hardcoded.

## CMD-UX-EW-002 — AcceptCustodyDialog

La CommandBar abre el diálogo sólo cuando recibe `ACCEPT_CUSTODY`. Captura
`receptor.type`, `receptor.reference`, `receptor.service` nullable,
`ubicacionDestino` mediante una opción de Ubicación, `businessReference.type` y
`businessReference.id` opcional. `expectedRowVersion` procede del Workspace, no es
editable. No acepta metadata server-side. No exige que receptor efectivo coincida con
el previsto salvo regla de dominio posterior explícita.

## CMD-UX-EW-003 — BusinessReference y errores

`businessReference.type` se captura como string requerido y `id` como string opcional;
no se crea catálogo universal. Los diálogos preservan valores ante errores recuperables,
asocian errores a campos y no muestran mensajes técnicos. Success 204 cierra el diálogo
y refresca `GET /api/v1/expedientes/{id}`; conflicto conserva datos y usa el flujo de
recarga aprobado.

## LOC-EW-001 — ListUbicaciones

Se aprueba conceptualmente el Use Case Application `ListUbicaciones`, tenant-scoped,
sin paginación para este slice:

```typescript
interface UbicacionOption {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;
}
```

`GET /api/v1/ubicaciones` retorna `readonly UbicacionOption[]` usando exclusivamente la
tabla canónica `ubicaciones`. No admite campos adicionales. Los diálogos presentan las
opciones y envían el VO/DTO aprobado; el usuario nunca captura UUID manualmente.

## LOC-AUTH-001..010 — Autorización y contrato definitivo de ubicaciones

La permission canónica `LOCATION_VIEW` autoriza exclusivamente `ListUbicaciones` y
GET `/api/v1/ubicaciones`. No es capability y la UI no la deriva de roles.

- `LOCATION_VIEW`: consultar/listar el catálogo operativo de ubicaciones.
- `ADMIN_CONFIGURE`: administración/configuración futura del catálogo, fuera de este slice.
- `EXPEDIENT_VIEW`: consultar Expediente y Timeline.
- `EXPEDIENT_AUDIT_VIEW`: consultar Audit del Expediente.

`ListUbicaciones` recibe `{ context: RequestContext }`, autoriza `LOCATION_VIEW` antes
de consultar y usa exclusivamente `context.tenant`. Sin permission produce
`PERMISSION_DENIED`/403. No acepta tenant desde body/query ni realiza lecturas cross-tenant.

```typescript
interface UbicacionesQueryPort {
  findAll(tenant: TenantContext): Promise<readonly UbicacionOption[]>;
}
```

El controller invoca el Use Case y nunca Drizzle ni el adapter. HTTP responde
`{ items: readonly UbicacionOption[] }`, sin total, cursor o paginación. Catálogo vacío
produce 200 `{ "items": [] }`; request no autenticada produce 401
`AUTHENTICATION_REQUIRED` y falta de permission produce 403 `PERMISSION_DENIED`.

Los dialogs consumen el endpoint para poblar sus selectores. No evalúan `LOCATION_VIEW`;
un 403 usa el manejo Problem Details vigente. La política canónica actual no exige un
audit identifier para esta lectura de reference data, por lo que no se crea uno ni se
amplía `AuditWriter`.

`LOCATION-PERMISSION-GAP` queda CLOSED.

## E2E-EW-001 — Flujo operativo

El escenario E2E canónico es búsqueda → selección/apertura → Dispatch dialog → 204 →
refresh → `EN_TRASLADO` → AcceptCustody dialog → 204 → refresh → `EN_CONSULTA`.
Los payloads proceden de interacción real con formularios y opciones; no son hardcoded.
Con `EXPEDIENT_AUDIT_VIEW`, Auditoría es visible y consume GET `/audit`; sin ella queda
oculta y no hace request.

## Grafo

Se introduce `T-21A` antes de T-22. Implementa permission/config de Auditoría,
GetExpedienteAudit/port/adapter/API/OpenAPI, ListUbicaciones/API/OpenAPI con
`LOCATION_VIEW`, ambos diálogos y sus tests. T-22 depende de T-21A.
