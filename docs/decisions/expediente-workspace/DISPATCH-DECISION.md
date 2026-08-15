# DispatchExpediente Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.9 / T-07

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
  readonly intendedCustodianRef: string;
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
  readonly intendedCustodianRef: string;
  readonly businessReference: {
    readonly type: string;
    readonly id: string | null;
  };
}): ExpedienteDispatched;
```

La transición valida `APARTADO`, cambia a `EN_TRASLADO`, establece destino y custodia
pendiente con `acceptedAt=null`, y no persiste ni conoce audit. La comprobación de
`expectedRowVersion` pertenece al Repository/UoW al guardar.

`intendedCustodianRef` es obligatorio y no vacío. `Custodia.enTraslado` conserva
`custodianReference: string` obligatorio; la referencia no se deriva de `destination`.

## DSP-EW-005 — Domain Event

```typescript
interface ExpedienteDispatchedPayload {
  readonly expedienteId: ExpedienteId;
  readonly originLocation: Ubicacion | null;
  readonly destinationLocation: Ubicacion;
  readonly originCustodianRef: string | null;
  readonly intendedCustodianRef: string;
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
type AuditResult = 'success' | 'denied' | 'not-found' | 'conflict';
```

`denied` representa falta de permission, `not-found` recurso ausente en el tenant,
`conflict` optimistic lock mismatch y `success` una mutación confirmada.

Ante `OPTIMISTIC_LOCK_CONFLICT`, la UoW mutante hace rollback completo. Fuera de esa
UoW fallida y después del rollback, `AuditWriter` registra
`EXPEDIENTE_DISPATCH/EXPEDIENTE/expedienteId` con `result=conflict`. No se persisten
cambio de aggregate, Movimiento ni audit success.

## DSP-EW-011 — Separación

`Domain Event != MovimientoExpediente != AuditRecord`. Son representaciones distintas;
ninguna sustituye a otra.

## Gaps resueltos

### DSP-GAP-001 — CLOSED

El command exige `intendedCustodianRef: string` no vacío. La misma referencia alimenta
`Custodia.enTraslado({ custodianReference })`; no se deriva de `destination`.

### DSP-GAP-002 — CLOSED

`AuditResult` incorpora `conflict`. El append ocurre fuera de la UoW mutante, después
del rollback, sin persistir Movimiento ni cambio del aggregate.
