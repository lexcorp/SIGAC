# Read Model Composition Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.3 / T-04 a T-08

## READ-EW-001 — Composición server-side

`GetExpediente` compone server-side un único `ExpedienteReadModel`. El endpoint del
Workspace devuelve el read model agregado; el frontend no consulta ni orquesta varios
dominios para reconstruirlo. Esto resuelve `OQ-EW-DESIGN-004`.

## READ-EW-002 — Ownership de los query ports

Préstamo, Solicitud e Incidencia conservan la propiedad de sus aggregates y reglas. Como
consumidor de sus proyecciones, Expediente Workspace es propietario de tres puertos
mínimos en su Application Layer:

- `ActiveLoanQueryPort`;
- `ActiveRequestQueryPort`;
- `OpenIncidentsQueryPort`.

Son contratos de consulta de proyección. No exponen aggregates ajenos ni transfieren la
propiedad del dominio al Workspace. Sus adapters serán provistos por los módulos o la
infraestructura propietaria de los datos.

Todos reciben `ExpedienteId` y `TenantContext`. El tenant es obligatorio, llega resuelto
server-side y nunca se obtiene del body.

## READ-EW-003 — ActiveRequestQueryPort

```typescript
interface ActiveRequestQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveRequestSummary | null>;
}

interface ActiveRequestSummary {
  solicitudId: string;
  tipo: string;
  origen: string;
  estado: EstadoSolicitud;
  asignadoA: string | null;
}
```

Cardinalidad: `0..1`. La ausencia se representa con `null`. `EstadoSolicitud` reutiliza
exclusivamente `Pendiente`, `Asignada`, `EnBusqueda`, `Localizada`, `Preparada`,
`Entregada`, `Cancelada`, `NoLocalizada`.

## READ-EW-004 — ActiveLoanQueryPort

```typescript
interface ActiveLoanQueryPort {
  findActiveByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<ActiveLoanSummary | null>;
}

interface ActiveLoanSummary {
  prestamoId: string;
  finalidad: string;
  custodioRef: string;
  destinoTipo: string;
  destinoRef: string;
  dueAt: Date;
  fuenteHabilitanteSalida: FuenteHabilitanteSalida;
  estado: 'Activo' | 'Vencido';
}
```

Cardinalidad: `0..1`. La ausencia se representa con `null`. Los campos proceden de
DDD-015, DAT-009, SPEC-006 y UC-018/REQ-EW-005. La fuente habilitante es obligatoria en
la proyección porque SPEC-006 exige registrarla y SPEC-009 exige mostrarla.

## READ-EW-005 — OpenIncidentsQueryPort

```typescript
interface OpenIncidentsQueryPort {
  findOpenByExpedienteId(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<readonly OpenIncidentSummary[]>;
}

interface OpenIncidentSummary {
  incidenciaId: string;
  tipo: string;
  severidad: string;
  estado: 'Abierta' | 'EnInvestigacion' | 'Escalada';
  resumen: string;
  asignadoA: string | null;
  openedAt: Date;
}
```

Cardinalidad: `0..N`. La ausencia se representa con un array vacío. Sólo
`Abierta|EnInvestigacion|Escalada` son abiertas; `Resuelta` no forma parte del resultado.
Los campos son la proyección mínima de DDD-017/DAT-010 para indicador y listado. Esta
decisión no automatiza la creación de incidencias: `NO_LOCALIZADO` no abre una
Incidencia mientras `OQ-EW-004` permanezca abierta.

## READ-EW-006 — ExpedienteReadModel

`GetExpediente` obtiene el aggregate Expediente mediante `ExpedienteRepository`, consulta
los tres puertos anteriores, calcula `capabilities[]` mediante
`ExpedienteCapabilityService` y devuelve un único `ExpedienteReadModel` con:

- identidad y situación operativa del Expediente;
- `prestamoActivo: ActiveLoanSummary | null`;
- `solicitudActiva: ActiveRequestSummary | null`;
- `incidenciasAbiertas: readonly OpenIncidentSummary[]`;
- `capabilities: readonly ExpedienteCapability[]`;
- `rowVersion`.

El campo mínimo de presentación de paciente sigue bajo `OQ-EW-002`; se conserva el
`nombreOperativo` ya disponible en `PacienteReferencia` hasta su resolución.

## READ-EW-007 — Contrato de salida

`GetExpediente` devuelve un solo `ExpedienteReadModel` compuesto al API. No devuelve una
colección de respuestas parciales ni delega al controller o al frontend la composición.

## READ-EW-008 — ExitEnablingSourceQueryPort

Application de Expediente Workspace posee el contrato consumidor:

```typescript
interface ExitEnablingSourceQueryPort {
  findAvailableByExpediente(
    expedienteId: ExpedienteId,
    tenant: TenantContext,
  ): Promise<readonly FuenteHabilitanteSalidaContext[]>;
}

interface FuenteHabilitanteSalidaContext {
  tipo: FuenteHabilitanteSalida;
  validada: boolean;
}
```

El puerto no expone aggregates ni evidencia/documentación completa de Agenda o SM 1-14.

## READ-EW-009 — Cardinalidad

El resultado tiene cardinalidad `0..N`. La ausencia se representa exclusivamente con
`[]`. Pueden coexistir fuentes de tipos distintos o más de una evidencia disponible.

## READ-EW-010 — Responsabilidad de validación

`validada` es determinada por el provider/adapter que consulta la evidencia de la fuente
habilitante. `ExpedienteCapabilityService` nunca valida agenda, vale ni documentación;
sólo consume el resultado del puerto. Esta decisión no prescribe adapters concretos.

## READ-EW-011 — Uso en GetExpediente

`GetExpediente` consulta `ExitEnablingSourceQueryPort` internamente con el mismo
`ExpedienteId` y `TenantContext` de los demás query ports. Su input público permanece:
`expedienteId + actor + tenant`.

## READ-EW-012 — Evaluación y selección

Pueden coexistir varias fuentes válidas. `ExpedienteCapabilityService` sólo determina si
existe al menos una fuente habilitante para ofrecer `ABRIR_PRESTAMO`; no selecciona cuál
se utilizará. La selección y el registro de la fuente concreta pertenecen al command/use
case `OpenLoan`.

## AUTH-EW-006 — Fuentes que habilitan ABRIR_PRESTAMO

Además de permission, rol, EstadoOperativo y ausencia de préstamo activo,
`ABRIR_PRESTAMO` requiere al menos un elemento con `validada: true` y `tipo` igual a
`CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14`.

## AUTH-EW-007 — ORDEN_SUPERIOR fail-closed

`ORDEN_SUPERIOR` nunca habilita `ABRIR_PRESTAMO` en esta spec, incluso si el provider la
retorna con `validada: true`. Permanecerá fail-closed hasta contar con su spec específica.

## AUD-EW-001 — AuditWriter

Expediente Workspace es propietario del puerto `AuditWriter` en Application Layer:

```typescript
interface AuditWriter {
  append(record: AuditRecord, tenant: TenantContext): Promise<void>;
}

interface AuditRecord {
  actorRef: string;
  action: string;
  resourceType: string;
  resourceId: string;
  result: 'success' | 'denied' | 'not-found';
  occurredAt: Date;
  requestId: string;
  correlationId: string | null;
  source: string;
  metadata: Readonly<Record<string, string>> | null;
}
```

El adapter implementa escritura append-only. Actor y tenant son obligatorios; el
timestamp es server-side. `metadata` sólo admite metadata operacional permitida y nunca
datos C3, payloads clínicos, tokens o secretos. El puerto no ofrece update ni delete.

## AUD-EW-002 — Enforcement en Application

`GetExpediente`, `GetExpedienteTimeline` y los comandos del Workspace consumen
`AuditWriter`. El controller no escribe audit.

Para `GetExpediente`:

- `action = EXPEDIENTE_VIEW`;
- `resourceType = EXPEDIENTE`;
- `result = success` cuando devuelve el read model;
- `result = denied` cuando falta autorización;
- `result = not-found` cuando no existe en el tenant.

Los intentos se registran sin `expedienteNumero`, referencia de paciente ni otros datos C3.

## OQs

`OQ-EW-DESIGN-004` queda RESOLVED. Permanecen abiertas `OQ-EW-002`, `OQ-EW-003`,
`OQ-EW-004`, las decisiones de retención/paginación del timeline y el ownership físico
de `MovimientoExpediente`.
