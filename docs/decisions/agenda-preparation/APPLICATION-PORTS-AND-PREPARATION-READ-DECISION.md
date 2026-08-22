# Application Ports and Preparation Read Decision

**Estado:** APPROVED  
**Fecha:** 2026-08-21  
**Scope:** contratos Application de T-05 y enmienda funcional de PreparationList para
`agenda-preparation v0.1.7`

## PORT-AP-001 — Input agnóstico del artefacto

```ts
interface AgendaFileInput {
  readonly sizeBytes: number | null;
  open(): AsyncIterable<Uint8Array>;
}
```

`sizeBytes`, cuando existe, es entero no negativo; `null` significa tamaño no conocido
antes del streaming. El contrato no contiene filename, MIME confiable, path, tenant,
actor, requestId, databaseName, HTTP, Multer ni filesystem concreto. El nombre temporal
puede existir en la frontera de selección/upload, pero nunca forma parte de este input.

`AgendaArtifactStream` de API-AP-001 es un alias conceptual anterior de esta misma
abstracción; T-05 adopta `AgendaFileInput` como nombre canónico y no crea dos ports.

## PORT-AP-002 — Fingerprint e inspección

`ImportFingerprint` es un valor técnico Application opaco cuyo `value` es un string no
vacío. Application no interpreta ni normaliza destructivamente ese valor. Se calcula
después de autorización; su algoritmo permanece diferido.

No es AgendaId, ImportacionAgendaId, Idempotency-Key o filename; no se deriva del nombre
del archivo y no forma parte de ningún Aggregate Domain.

```ts
interface ImportFingerprint {
  readonly value: string;
}

interface AgendaFileInspection {
  readonly fingerprint: ImportFingerprint;
  readonly layout: string;
  readonly agendaDate: AgendaFecha;
  readonly receivedRecords: number;
}
```

`layout` es un identificador técnico no vacío del layout reconocido; esta decisión no
cierra su catálogo. `receivedRecords` es entero >= 0. Artefacto no soportado o layout
rechazado no produce `AgendaFileInspection`; conserva los errores de API-AP-003/007.
Inspection no contiene raw, rows, filename o datos personales.

## PORT-AP-003 — Parser/inspection port

```ts
interface AgendaFileInterpreterPort {
  inspect(input: AgendaFileInput): Promise<AgendaFileInspection>;
}
```

El port pertenece a Application y el Adapter futuro implementará streaming/HTML/encoding.
No expone DOM, `.xls`, ISO-8859, MIME, filesystem o tipos de framework. Para T-05 este
contrato cubre exclusivamente la inspección aprobada; la interpretación de registros es
responsabilidad posterior del Adapter/ACL y debe respetar la allow-list ya aprobada.

## PORT-AP-004 — Resolución de médico

```ts
type MedicoResolution =
  | { readonly kind: 'RESOLVED'; readonly medico: MedicoReferencia }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'AMBIGUOUS' };

interface MedicoDirectoryQueryPort {
  findByEmployeeNumber(
    numero: NumeroEmpleado,
    tenant: TenantContext,
  ): Promise<MedicoResolution>;

  findControlledFallback(
    nombreOriginal: string,
    tenant: TenantContext,
  ): Promise<MedicoResolution>;
}
```

El fallback no realiza fuzzy matching ni selecciona silenciosamente entre varios
candidatos. `AMBIGUOUS` permanece resultado explícito, no resolución singular.

## PORT-AP-005 — Referencia cross-context de Expediente

```ts
interface ExpedienteReferenceInput {
  readonly expedienteNumero: string;
}

interface ExpedienteReferenceMatch {
  readonly reference: ExpedienteReferencia;
}

interface ExpedienteReferenceQueryPort {
  resolve(
    input: ExpedienteReferenceInput,
    tenant: TenantContext,
  ): Promise<readonly ExpedienteReferenceMatch[]>;
}
```

`expedienteNumero` es obligatorio/no vacío después de trim exterior, sin asumir UUID ni
unicidad. Cardinalidad `0..N`; Application decide el resultado explícito y nunca elige
ambiguamente. Agenda Preparation no importa el Aggregate ni Domain de Archive Operations.

## PORT-AP-006 — Repository ports Domain

```ts
interface ImportacionAgendaRepository {
  save(
    importacion: ImportacionAgenda,
    tenant: TenantContext,
  ): Promise<void>;
}

interface AgendaRepository {
  findByFecha(
    fecha: AgendaFecha,
    tenant: TenantContext,
  ): Promise<Agenda | null>;

  save(
    agenda: Agenda,
    tenant: TenantContext,
  ): Promise<void>;
}
```

Los ports reciben siempre TenantContext server-resolved. No exponen SQL, Drizzle,
PostgreSQL ni constraints físicos. `ImportacionAgendaRepository` no conoce fingerprint.

## PORT-AP-007 — Metadata técnica separada

```ts
interface ImportEquivalentReference {
  readonly importacionId: ImportacionAgendaId;
  readonly importedAt: Date;
}

interface ImportArtifactMetadataRepository {
  findEquivalent(
    input: {
      readonly agendaDate: AgendaFecha;
      readonly fingerprint: ImportFingerprint;
    },
    tenant: TenantContext,
  ): Promise<ImportEquivalentReference | null>;

  associateConfirmedImport(
    input: {
      readonly importacionId: ImportacionAgendaId;
      readonly agendaDate: AgendaFecha;
      readonly fingerprint: ImportFingerprint;
    },
    tenant: TenantContext,
  ): Promise<void>;
}
```

`findEquivalent` considera sólo asociaciones confirmadas en la misma tenant database,
AgendaFecha y fingerprint. Cardinalidad `0..1`; si existen varias, selecciona por
`importedAt DESC, ImportacionAgendaId DESC`. No existe UNIQUE conceptual de fingerprint.

Una Idempotency-Key nueva con artefacto idéntico puede producir una nueva
`ImportacionAgenda` `ALREADY_IMPORTED`. Fingerprint no es estado Domain y no se agrega a
`ImportacionAgendaRepository.save`. Algoritmo y schema físico permanecen diferidos.

## PORT-AP-008 — Shared Audit ownership

`AuditWriter`, `AuditEntry` y `AuditResult` son contratos Application compartidos de
Security/Audit. Ownership canónico: `packages/platform/audit`, package `@sigac/audit`,
siguiendo las convenciones workspace existentes.

No se crea una segunda definición. Una tarea técnica previa a T-05 extraerá/moverá el
contrato existente desde `@sigac/archive-operations` y actualizará sus consumidores sin
cambiar shape o semántica. Ambos bounded contexts dependerán del contrato compartido:

```text
Archive Operations ─┐
                    ├──> @sigac/audit
Agenda Preparation ─┘
```

`AuditResult` permanece exactamente `success|denied|not-found|conflict|invalid-transition`.
No cambian `AuditEntry`, PostgresAuditWriter ni audit_log. Agenda Preparation nunca
depende de Archive Operations para auditar.

## PORT-AP-009 — Unit of Work

```ts
interface AgendaPreparationTransaction {
  readonly importacionAgendaRepository: ImportacionAgendaRepository;
  readonly agendaRepository: AgendaRepository;
  readonly importArtifactMetadataRepository: ImportArtifactMetadataRepository;
  readonly auditWriter: AuditWriter;
  readonly importedAt: Date;
}

interface AgendaPreparationUnitOfWork {
  execute<T>(
    tenant: TenantContext,
    operation: (transaction: AgendaPreparationTransaction) => Promise<T>,
  ): Promise<T>;
}
```

Se adopta `execute` por la convención existente de UnitOfWork. `importedAt` se genera una
sola vez al iniciar la UoW, server-side, y se entrega explícitamente a Domain.

Success usa una única transacción tenant-scoped:

```text
BEGIN
  save ImportacionAgenda
  save/reconcile Agenda
  associate confirmed import metadata
  append audit success
COMMIT
```

Cualquier fallo ejecuta `ROLLBACK ALL`. No se define SQL, transaction handle ni
distributed/cross-tenant transaction.

## PORT-AP-010 — Read ports ya aprobados

`AgendaImportHistoryQueryPort` y `AgendaDayQueryPort` conservan las firmas/read models
aprobados en UX-GAP-004/005. No se redefinen en esta decisión. Todos los puertos de T-05
son tenant-scoped y Application-only.

## PREP-AP-001 — PreparationItem

```ts
interface PreparationItem {
  readonly folio: string;
  readonly nombrePaciente: string;
  readonly expediente: {
    readonly original: string;
    readonly reference: string | null;
  };
  readonly tipoDerechohabiente: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly medico: {
    readonly numeroEmpleado: string;
    readonly nombre: string;
  };
  readonly servicioEspecialidad: {
    readonly codigo: string;
    readonly nombre: string;
  };
}
```

Es un read model Application minimizado. Sólo representa Citas vigentes/resolubles y no
contiene Turno, Consultorio, Destino, raw, contacto, vigencia, sexo, edad, CURP, préstamo,
capabilities ni contenido asistencial.

## PREP-AP-002 — Agrupación y órdenes

```ts
type PreparationOrder =
  | 'APPOINTMENT_TIME_ASC'
  | 'PATIENT_NAME_ASC';
```

Orden global determinista:

1. Servicio: `ServicioEspecialidad.nombre ASC`, después `codigo ASC`.
2. Médico dentro del Servicio: `MedicoReferencia.nombre ASC`, después
   `NumeroEmpleado ASC`.
3. Registros dentro del Médico según `PreparationOrder`:
   - `APPOINTMENT_TIME_ASC`: `HoraCita ASC`, después `FolioCita ASC`;
   - `PATIENT_NAME_ASC`: `nombrePaciente ASC`, después `FolioCita ASC`.

Default: `APPOINTMENT_TIME_ASC`. Los órdenes por nombre representan orden alfabético
humano coherente; no se fija collation SQL y no se modifica destructivamente ningún
nombre. La misma secuencia aplica a pantalla e impresión.

## PREP-AP-003 — Screen query y cursor

```ts
interface PreparationPagination {
  readonly cursor?: string;
  readonly limit: number;
}

interface PreparationPage {
  readonly items: readonly PreparationItem[];
  readonly nextCursor: string | null;
}

interface PreparationListQueryPort {
  findPage(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    pagination: PreparationPagination,
    tenant: TenantContext,
  ): Promise<PreparationPage>;

  listForPrint(
    agendaDate: AgendaFecha,
    order: PreparationOrder,
    tenant: TenantContext,
  ): Promise<readonly PreparationItem[]>;
}
```

Pantalla mantiene `{items,nextCursor}`, sin total/hasMore. El cursor es opaco y contiene
conceptualmente las claves de Servicio, Médico, order seleccionado y FOLIO. Está ligado
al `PreparationOrder` que lo produjo; cambiar order descarta el cursor y reinicia desde
el principio.

## PREP-AP-004 — Impresión

La lista se usa en pantalla y se imprime para la búsqueda física. Impresión es un concern
de presentación/read, no command Domain, Domain Event, estado persistente o AuditResult.

`listForPrint` devuelve la colección vigente completa, sin cursor/paginación, usando el
mismo `PreparationItem`, agrupación y order seleccionado que pantalla. No se fija PDF;
browser print/CSS puede ser una implementación posterior. No genera SM10-1.

Consultar e imprimir exige únicamente `AGENDA_VIEW`; no se introduce `AGENDA_PRINT`.

## Readiness

- `AUDIT-CONTRACT-OWNERSHIP-GAP`: CLOSED documentalmente; extracción física pendiente.
- `PREPARATION-GROUP-ORDER-GAP`: CLOSED.
- `IMPORT-FINGERPRINT-PERSISTENCE-GAP`: CLOSED.
- T-05 documentary blocker: RESOLVED.
- T-05 implementation: NOT STARTED.
- T-06: NOT STARTED.
