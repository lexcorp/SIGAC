# DispatchExpediente Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.12 / T-07

## DSP-EW-001 — Semántica

`DispatchExpediente` representa la salida física de Archivo y la transición a
`EN_TRASLADO`. No representa `CustodyAccepted`, no abre un Préstamo y no implica
recepción en destino.

## DSP-EW-002 — Custodia pendiente

Durante `EN_TRASLADO`, la custodia destino está pendiente de aceptación y
`acceptedAt = null`. Mensajero/transportista no se convierte automáticamente en custodio
externo formal. `AcceptCustody` confirma posteriormente la recepción. Se reutiliza el VO
`Custodia` existente.

## DSP-EW-003 — Command input

```typescript
interface DispatchExpedienteInput {
  readonly expedienteId: ExpedienteId;
  readonly destination: Ubicacion;
  readonly intendedCustodian: {
    readonly type: string;
    readonly reference: string;
  };
  readonly businessReference: {
    readonly type: string;
    readonly id: string | null;
  };
  readonly expectedRowVersion: bigint;
  readonly context: RequestContext;
}
```

Origen, ubicación y custodio anteriores se derivan del aggregate. No existe enum
canónico para `businessReference.type`.

## DSP-EW-004 — Aggregate transition

La firma canónica es:

```typescript
dispatch(input: {
  readonly destination: Ubicacion;
  readonly intendedCustodian: {
    readonly type: string;
    readonly reference: string;
  };
  readonly businessReference: {
    readonly type: string;
    readonly id: string | null;
  };
  readonly occurredAt: Date;
}): ExpedienteDispatched;
```

La transición valida `APARTADO`, cambia a `EN_TRASLADO`, establece destino y custodia
pendiente con `acceptedAt=null`, y no persiste ni conoce audit. La comprobación de
`expectedRowVersion` pertenece al Repository/UoW al guardar.

`intendedCustodian.type` y `intendedCustodian.reference` son obligatorios y no vacíos.
No existe todavía un enum/catálogo para `type`; ningún componente del custodio previsto
se deriva de `destination`.
`occurredAt` es proporcionado por Application desde
`ArchiveOperationsTransaction.operationOccurredAt`; no procede del cliente ni se genera
dentro del aggregate.

## DSP-EW-005 — Domain Event

```typescript
interface ExpedienteDispatchedPayload {
  readonly expedienteId: ExpedienteId;
  readonly originLocation: Ubicacion | null;
  readonly destinationLocation: Ubicacion;
  readonly originCustodianRef: string | null;
  readonly intendedCustodian: {
    readonly type: string;
    readonly reference: string;
  };
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
}
```

El payload no contiene requestId, source ni recordedAt. El evento conserva el envelope
canónico `DomainEvent.occurredAt`.

## DSP-EW-006/007 — Movimiento y writer

```typescript
interface MovimientoExpedienteAppend {
  readonly expedienteId: ExpedienteId;
  readonly movementType: 'DISPATCHED';
  readonly originLocation: string | null;
  readonly destinationLocation: string;
  readonly originCustodianRef: string | null;
  readonly destinationCustodianRef: string;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string | null;
  readonly occurredAt: Date;
  readonly actorRef: string;
  readonly source: string;
  readonly correlationId: string;
}

interface MovimientoExpedienteWriter {
  append(
    movimiento: MovimientoExpedienteAppend,
    tenant: TenantContext,
  ): Promise<void>;
}
```

`id` y `recordedAt` son completados por el writer al persistir. El movimiento se deriva
del estado pre/post, `ExpedienteDispatched` y `RequestContext`; no contiene datos C3.
El port es append-only.

## DSP-EW-008 — Timestamps

`occurredAt` es el instante efectivo de la operación. El UoW proporciona un único
`operationOccurredAt` inmutable al callback transaccional; el Domain Event envelope y
Movimiento usan ese mismo valor. `recordedAt` lo establece el writer al ejecutar el
INSERT. Ninguno procede del cliente.

No se introduce `ClockPort`. Un fake de `ArchiveOperationsUnitOfWork` puede proporcionar
un `operationOccurredAt` determinista en tests; la fuente temporal interna del adapter
queda encapsulada en infraestructura.

## DOM-EVENT-001 — Timestamp efectivo de Domain Events

Cuando un método de aggregate produce un `DomainEvent` cuyo `occurredAt` representa el
instante efectivo de la operación, Application/UoW proporciona explícitamente ese
timestamp al método de dominio. El aggregate no llama `Date.now()`, no crea `new Date()`
para fechar eventos, no obtiene un Clock y no construye timestamps implícitos.

Para Dispatch, Application invoca dentro de la UoW:

```typescript
expediente.dispatch({
  destination,
  intendedCustodian,
  businessReference,
  occurredAt: transaction.operationOccurredAt,
});
```

`DomainEvent.occurredAt`, `MovimientoExpedienteAppend.occurredAt` y
`transaction.operationOccurredAt` representan exactamente el mismo instante. No se
introduce event factory ni envelope diferido en T-07.

## DSP-EW-014 — Intended custodian

Dispatch recibe explícitamente `intendedCustodian: { type: string; reference: string }`.
Ambos valores son obligatorios y no vacíos. No se crea todavía un enum para `type` y no
se deriva ningún valor desde destination.

## DSP-EW-015 — Aggregate

La firma de DSP-EW-004 queda refinada con `intendedCustodian` y conserva
`occurredAt` explícito conforme DOM-EVENT-001.

## DSP-EW-016 — Custodia en traslado

La factory canónica es semánticamente:

```typescript
Custodia.enTraslado({
  custodianType: intendedCustodian.type,
  custodianReference: intendedCustodian.reference,
});
```

Su estado resultante es exactamente:

```typescript
{
  custodianType: intendedCustodian.type,
  custodianReference: intendedCustodian.reference,
  service: null,
  location: null,
  acceptedAt: null,
}
```

Durante `EN_TRASLADO` describe al receptor previsto, no una aceptación. No utiliza
valores sintéticos y no deriva type, reference, service ni location desde destination.
`AcceptCustody` será responsable de materializar la recepción confirmada en T-08.

## DSP-EW-009 — Unit of Work

```typescript
interface ArchiveOperationsTransaction {
  readonly expedienteRepository: ExpedienteRepository;
  readonly movimientoWriter: MovimientoExpedienteWriter;
  readonly auditWriter: AuditWriter;
  readonly operationOccurredAt: Date;
}

interface ArchiveOperationsUnitOfWork {
  execute<T>(
    context: RequestContext,
    work: (transaction: ArchiveOperationsTransaction) => Promise<T>,
  ): Promise<T>;
}
```

El adapter abre una única transacción PostgreSQL en `context.tenant`. Un Dispatch
exitoso actualiza Expediente con optimistic locking, inserta Movimiento y hace append de
audit success: ALL OR NOTHING. No existe transacción distribuida ni cross-tenant.

## DSP-EW-010 — Audit

`action = EXPEDIENTE_DISPATCH`, `resourceType = EXPEDIENTE`,
`resourceId = expedienteId`. Success pertenece a la misma UoW. Denied y not-found se
registran fuera de la transacción mutante mediante `AuditWriter`.

El resultado canónico de audit es:

```typescript
type AuditResult =
  | 'success'
  | 'denied'
  | 'not-found'
  | 'conflict'
  | 'invalid-transition';
```

`denied` representa falta de permission, `not-found` recurso ausente o no visible en el
tenant activo, `conflict` exclusivamente optimistic lock mismatch, `invalid-transition`
un recurso existente y actor autorizado cuya operación no es válida para el estado
actual, y `success` una operación confirmada.

Ante `OPTIMISTIC_LOCK_CONFLICT`, la UoW mutante hace rollback completo. Fuera de esa
UoW fallida y después del rollback, `AuditWriter` registra
`EXPEDIENTE_DISPATCH/EXPEDIENTE/expedienteId` con `result=conflict`. No se persisten
cambio de aggregate, Movimiento ni audit success.

## AUD-EW-010..013 — Transición inválida

`AuditResult` incorpora `invalid-transition`. `REQUEST_INVALID_TRANSITION` produce ese
resultado y posteriormente API lo mapea a HTTP 409. `conflict` permanece reservado
exclusivamente a `OPTIMISTIC_LOCK_CONFLICT`.

Ante una transición inválida, la UoW mutante hace rollback. No se persiste el aggregate,
no se crea MovimientoExpediente y no se escribe audit success. Después del rollback y
fuera de la UoW mutante, `AuditWriter` registra:

- `action = EXPEDIENTE_DISPATCH`;
- `resourceType = EXPEDIENTE`;
- `resourceId = expedienteId`;
- `result = invalid-transition`.

Application lanza después `ApplicationError(REQUEST_INVALID_TRANSITION)`. Varios errores
de Application pueden compartir HTTP 409 sin compartir AuditResult:

- `OPTIMISTIC_LOCK_CONFLICT` → `conflict` → HTTP 409;
- `REQUEST_INVALID_TRANSITION` → `invalid-transition` → HTTP 409.

## DSP-EW-011 — Separación

`Domain Event != MovimientoExpediente != AuditRecord`. Son representaciones distintas;
ninguna sustituye a otra.

## Gaps resueltos

### DSP-GAP-001 — CLOSED

El command exige `intendedCustodian.type/reference` no vacíos. Alimentan explícitamente
`Custodia.enTraslado`; service/location/acceptedAt quedan null y nada se deriva de
`destination`.

### DSP-GAP-002 — CLOSED

`AuditResult` incorpora `conflict`. El append ocurre fuera de la UoW mutante, después
del rollback, sin persistir Movimiento ni cambio del aggregate.
