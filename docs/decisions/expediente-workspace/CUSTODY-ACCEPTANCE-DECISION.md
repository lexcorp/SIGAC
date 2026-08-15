# Custody Acceptance Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.14 / T-08

## CST-EW-001 — Input

```typescript
interface AcceptCustodyInput {
  readonly expedienteId: ExpedienteId;
  readonly receptor: {
    readonly type: string;
    readonly reference: string;
    readonly service: string | null;
  };
  readonly ubicacionDestino: Ubicacion;
  readonly businessReference: {
    readonly type: string;
    readonly id: string | null;
  };
  readonly expectedRowVersion: bigint;
  readonly context: RequestContext;
}
```

`receptor.type` y `receptor.reference` son obligatorios y no vacíos. `service` es
información confirmada y puede ser null. No existe todavía catálogo para receptor.type.

## CST-EW-002 — Receptor efectivo

La custodia final usa exclusivamente el receptor efectivo:

- `custodianType = receptor.type`;
- `custodianReference = receptor.reference`;
- `service = receptor.service`.

El receptor previsto y el efectivo pueden diferir. No se conserva automáticamente el
type/reference previsto ni se exige igualdad entre ambos.

La firma canónica del aggregate es:

```typescript
acceptCustody(input: {
  readonly receptor: {
    readonly type: string;
    readonly reference: string;
    readonly service: string | null;
  };
  readonly ubicacionDestino: Ubicacion;
  readonly occurredAt: Date;
}): CustodyAccepted;
```

## CST-EW-003/004 — Ubicación y Custodia aceptada

`ubicacionDestino` usa el VO `Ubicacion`. `Custodia.location` almacena su identificador
canónico mediante el acceso existente `ubicacionDestino.id`; no usa código, descripción
ni texto arbitrario.

```typescript
Custodia.aceptada({
  custodianType: receptor.type,
  custodianReference: receptor.reference,
  service: receptor.service,
  location: ubicacionDestino.id,
  acceptedAt: transaction.operationOccurredAt,
});
```

El timestamp no procede del cliente y sigue DOM-EVENT-001.

## CST-EW-005 — Precondiciones

`AcceptCustody` exige estado `EN_TRASLADO`, Custodia existente y `acceptedAt = null`.
`ubicacionDestino` debe ser igual por valor a la ubicación actual del aggregate. Una
diferencia no actualiza ubicación ni crea una segunda transferencia; produce
`ApplicationError(REQUEST_INVALID_TRANSITION)` y audit `invalid-transition` conforme a
la taxonomía vigente.

## CST-EW-006 — Estado resultante

En success cambia `EN_TRASLADO → EN_CONSULTA`, conserva `ubicacionDestino` como ubicación
actual, reemplaza la custodia prevista por la efectiva aceptada e incrementa rowVersion.

## CST-EW-007 — Domain Event

```typescript
interface CustodyAcceptedPayload {
  readonly expedienteId: ExpedienteId;
  readonly location: Ubicacion;
  readonly intendedCustodian: {
    readonly type: string;
    readonly reference: string;
  };
  readonly acceptedCustodian: {
    readonly type: string;
    readonly reference: string;
    readonly service: string | null;
  };
}
```

`CustodyAccepted` usa `transaction.operationOccurredAt` como occurredAt del envelope.
No contiene RequestContext, recordedAt ni metadata técnica.

## CST-EW-008 — Movimiento CUSTODY_ACCEPTED

El movimiento deriva del estado previo/posterior y RequestContext:

- movementType = `CUSTODY_ACCEPTED`;
- originLocation = ubicación previa estable;
- destinationLocation = `ubicacionDestino.id`;
- originCustodianRef = referencia del custodio previsto previo;
- destinationCustodianRef = `receptor.reference`;
- businessReferenceType = `input.businessReference.type`;
- businessReferenceId = `input.businessReference.id`;
- occurredAt = `transaction.operationOccurredAt`;
- actorRef/source/correlationId = RequestContext.

No se añade tipo de custodio al movimiento.

La business reference sólo satisface DAT-011. No se copia desde Dispatch, no se deriva
de correlationId, no forma parte de Custodia, autorización ni TenantContext, y no se
exige igualdad con la usada en Dispatch mientras el aggregate no la preserve.

## CST-EW-009 — UoW

Reutiliza `ArchiveOperationsUnitOfWork`: save aggregate + append Movimiento
`CUSTODY_ACCEPTED` + append audit success en una única transacción tenant-scoped ALL OR
NOTHING. No crea otra UoW ni otro writer.

## CST-EW-010 — Audit

Los identificadores canónicos son `action=CUSTODY_ACCEPTED`,
`resourceType=EXPEDIENTE`, `resourceId=expedienteId`. Se reutiliza el único identifier
`CUSTODY_ACCEPTED` ya registrado por T-20.

- falta de CUSTODY_ACCEPT → `denied`;
- Expediente ausente tenant-scoped → `not-found`;
- rowVersion mismatch → `conflict`;
- estado/custodia/ubicación incompatibles → `invalid-transition`;
- aceptación confirmada → `success`.

Success se escribe dentro de la UoW con save y Movimiento. Los demás resultados se
escriben fuera de la UoW mutante correspondiente.

## Gaps resueltos

### CST-GAP-001 — CLOSED

AcceptCustodyInput incorpora businessReference y el Movimiento copia exclusivamente sus
campos type/id. No se introduce una entidad CustodyTransfer.

### CST-GAP-002 — CLOSED

Audit usa `CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId` y los cinco resultados canónicos.
