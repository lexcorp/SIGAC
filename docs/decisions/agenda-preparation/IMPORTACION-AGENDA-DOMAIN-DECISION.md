# ImportacionAgenda Domain Decision

**Estado:** APPROVED  
**Fecha:** 2026-08-21  
**Scope:** contratos Domain de T-02 para `agenda-preparation v0.1.4`

## IMP-AP-001 — Identidades opacas

`ImportacionAgendaId`, `RegistroImportadoAgendaId` e `IncidenciaImportacionId` son Value
Objects Domain distintos. Cada uno contiene un string obligatorio, aplica únicamente trim
de whitespace exterior, rechaza vacío y compara por valor canónico exacto. Domain no los
genera: Application/Infrastructure los proporciona antes de crear el objeto correspondiente.

No se derivan de filename, fingerprint, requestId, correlationId, fechaAgenda, tenant,
`sourcePosition`, FOLIO ni contenido raw. Domain no exige UUID.

Errores contractuales:

| VO | `DomainError.code` |
|---|---|
| `ImportacionAgendaId` | `IMPORTACION_AGENDA_ID_INVALID` |
| `RegistroImportadoAgendaId` | `REGISTRO_IMPORTADO_AGENDA_ID_INVALID` |
| `IncidenciaImportacionId` | `INCIDENCIA_IMPORTACION_ID_INVALID` |

Los tres VOs se construyen con `parse(value: string)`. El valor almacenado es el string
tras trim exterior; no existe otra normalización.

## IMP-AP-002 — Ownership temporal

`importedAt` es el instante efectivo de la importación, lo proporciona Application/UoW y
se entrega a `ImportacionAgenda.create`. Debe ser un `Date` válido; el Aggregate conserva
una copia defensiva. No procede del cliente ni del archivo. Domain no ejecuta `Date.now()`
ni `new Date()` para generar el instante. Esta decisión no fija `occurredAt` de eventos
posteriores ni presupone que sea igual a `importedAt`.

## IMP-AP-003 — Metadata del artefacto fuera de Domain

`ImportArtifactMetadata` pertenece a Application/ingestion/Infrastructure. Incluye
fingerprint, staging, filename temporal y detalles técnicos de ingestion. No forma parte
de `ImportacionAgenda`, `RegistroImportadoAgenda` ni `IncidenciaImportacion`.

El Aggregate no almacena ni garantiza fingerprint, filename, bytes, raw row o metadata de
staging. RAW-AP-012 es canónico y supersede cualquier descripción anterior que atribuyera
esa metadata al Aggregate.

## IMP-AP-004 — Lifecycle y shape de `ImportacionAgenda`

El Aggregate tiene dos fases internas, no un enum persistente nuevo:

```text
BUILDING --finalize(outcome)--> FINALIZED
```

Durante `BUILDING`, `outcome` y `metrics` son `null`; se agregan registros/incidencias y
se finalizan registros. `FINALIZED` es inmutable. Shape Domain mínima:

```ts
interface ImportacionAgendaState {
  readonly id: ImportacionAgendaId;
  readonly agendaFecha: AgendaFecha;
  readonly importedAt: Date;
  readonly outcome: ImportOutcome | null;
  readonly registros: readonly RegistroImportadoAgenda[];
  readonly incidencias: readonly IncidenciaImportacion[];
  readonly metrics: ImportacionAgendaMetrics | null;
}
```

Firma de creación:

```ts
ImportacionAgenda.create({
  id: ImportacionAgendaId,
  agendaFecha: AgendaFecha,
  importedAt: Date,
}): ImportacionAgenda
```

`rehydrate` se difiere hasta el contrato de persistencia; T-02 no lo implementa.

## IMP-AP-005 — Evidencia original allow-listed

`RegistroImportadoAgendaOriginalValues` contiene exactamente estos campos, todos
`string | null` porque una fila reconocida puede omitir o invalidar un dato:

```ts
interface RegistroImportadoAgendaOriginalValues {
  readonly folio: string | null;
  readonly patientName: string | null;
  readonly expedienteReference: string | null;
  readonly beneficiaryType: string | null;
  readonly firstTimeMarker: string | null;
  readonly subsequentMarker: string | null;
  readonly agendaDate: string | null;
  readonly appointmentTime: string | null;
  readonly physicianEmployeeNumber: string | null;
  readonly physicianName: string | null;
  readonly serviceCode: string | null;
  readonly serviceName: string | null;
}
```

No admite índice abierto, `Record<string, unknown>`, raw row, contacto, vigencia, sexo,
edad, CURP, contenido clínico, Turno, Consultorio o Destino.
Los strings no nulos se conservan tal como fueron recibidos en la allow-list; Domain no
los normaliza. `null` representa ausencia en la fila reconocida.

## IMP-AP-006 — Valores interpretados y referencias resueltas

```ts
type AppointmentKind = 'FIRST_TIME' | 'SUBSEQUENT';

interface RegistroImportadoAgendaInterpretedValues {
  readonly folio: FolioCita | null;
  readonly agendaFecha: AgendaFecha | null;
  readonly beneficiaryType: string | null;
  readonly appointmentKind: AppointmentKind | null;
  readonly appointmentTime: string | null;
  readonly numeroEmpleado: NumeroEmpleado | null;
  readonly servicioEspecialidad: ServicioEspecialidad | null;
}

interface RegistroImportadoAgendaResolvedReferences {
  readonly expedienteId: string | null;
  readonly physicianReference: string | null;
}
```

Las referencias no nulas son opacas y no vacías. No cargan objetos de otros bounded
contexts. `ServicioEspecialidad` resuelto ya identifica el servicio por código y no
requiere una referencia paralela. T-02 no implementa matching ni parser.

## IMP-AP-007 — Entity `RegistroImportadoAgenda`

Shape exacta:

```ts
interface RegistroImportadoAgendaState {
  readonly id: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly originalValues: RegistroImportadoAgendaOriginalValues;
  readonly interpretedValues: RegistroImportadoAgendaInterpretedValues;
  readonly resolvedReferences: RegistroImportadoAgendaResolvedReferences;
  readonly processingResult: RecordProcessingResult | null;
  readonly incidentIds: readonly IncidenciaImportacionId[];
}
```

Se crea con `processingResult: null` e `incidentIds: []`:

```ts
RegistroImportadoAgenda.create({ id, sourcePosition, originalValues,
  interpretedValues, resolvedReferences }): RegistroImportadoAgenda
```

`finalize(result: RecordProcessingResult): void` asigna el resultado exactamente una
vez. Una segunda llamada, incluso con el mismo valor, lanza
`REGISTRO_IMPORTADO_RESULTADO_YA_ASIGNADO`.

`attachIncident(id: IncidenciaImportacionId): void` es una operación interna al límite
del Aggregate; agrega una identidad una sola vez y sólo antes de finalizar el registro.

## IMP-AP-008 — `IncidenciaImportacion`

Una fila admite 0..N incidencias. Cada incidencia tiene identidad propia y shape mínima:

```ts
interface IncidenciaImportacionState {
  readonly id: IncidenciaImportacionId;
  readonly registroId: RegistroImportadoAgendaId;
  readonly sourcePosition: PosicionRegistroOrigen;
  readonly type: ImportIncident;
}
```

Se crea mediante `IncidenciaImportacion.create({ id, registroId, sourcePosition, type })`.
No contiene metadata libre, raw, datos clínicos, filename, parser details o stack trace.

## IMP-AP-009 — Operaciones del Aggregate

Firmas exactas de T-02:

```ts
addRegistro(registro: RegistroImportadoAgenda): void;
addIncidencia(incidencia: IncidenciaImportacion): void;
finalizeRegistro(
  registroId: RegistroImportadoAgendaId,
  result: RecordProcessingResult,
): void;
recordWithdrawnFromAgenda(count: number): void;
finalize(outcome: ImportOutcome): void;
```

`addRegistro` rechaza ID duplicado. `addIncidencia` exige que su registro exista, que
ambos compartan `sourcePosition`, rechaza ID de incidencia duplicado y enlaza su ID al
registro una sola vez. No agrega incidencias a un registro ya finalizado. La misma clase
de incidencia puede aparecer varias veces sólo con identidades distintas y en filas
válidamente relacionadas.

Al finalizar un registro, resultado e incidencias deben ser compatibles con RESULT-AP-005:

- `ADDED|UPDATED|UNCHANGED|RESTORED`: cero incidencias;
- `PENDING_REVIEW`: una o más incidencias, todas del grupo de resolución;
- `REJECTED`: una o más, todas `REQUIRED_DATA_MISSING|ROW_INCONSISTENT`;
- `DUPLICATE_FOLIO`: una o más, todas `DUPLICATE_FOLIO_IN_SNAPSHOT`.

Una combinación incompatible usa `IMPORTACION_AGENDA_INVALID` y no asigna resultado.

`recordWithdrawnFromAgenda` puede ejecutarse como máximo una vez durante `BUILDING`,
recibe un entero >= 0 y no crea filas sintéticas. Si no se invoca, el conteo es cero.
Representa Citas previas ausentes del snapshot y no implementa su lifecycle (T-03).

`finalize` recibe explícitamente uno de los tres `ImportOutcome`; no lo deriva. Exige que
todos los registros tengan resultado, calcula métricas y cambia a `FINALIZED`. Una
segunda finalización o cualquier mutación posterior se rechaza.

## IMP-AP-010 — Métricas derivadas

El Aggregate no acepta métricas externas. En `finalize` deriva un snapshot inmutable:

```ts
interface ImportacionAgendaMetrics {
  readonly receivedRecords: number;
  readonly processed: number;
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly restored: number;
  readonly pendingReview: number;
  readonly rejected: number;
  readonly duplicateFolio: number;
  readonly withdrawnFromAgenda: number;
  readonly incidents: number;
  readonly errors: number;
}
```

`incidents` se conserva porque RESULT-AP-009 ya lo define canónicamente. Todos los
conteos son enteros >= 0 y cumplen:

```text
processed = added + updated + unchanged + restored
receivedRecords = processed + pendingReview + rejected + duplicateFolio
errors = rejected + duplicateFolio
incidents = número de IncidenciaImportacion
withdrawnFromAgenda ∉ receivedRecords
```

## IMP-AP-011 — Idempotencia interna

Idempotencia interna no significa setter/finalización repetible. Significa que un ID de
registro o incidencia no puede agregarse dos veces, un registro no puede finalizarse dos
veces y ninguna operación puede contribuir dos veces a métricas. HTTP Idempotency-Key
pertenece a Application/API. Toda repetición inválida falla antes de producir efectos.

## IMP-AP-012 — Domain errors cerrados para T-02

| Código | Uso |
|---|---|
| `IMPORTACION_AGENDA_ID_INVALID` | ID de Aggregate inválido |
| `REGISTRO_IMPORTADO_AGENDA_ID_INVALID` | ID de registro inválido |
| `INCIDENCIA_IMPORTACION_ID_INVALID` | ID de incidencia inválido |
| `IMPORTACION_AGENDA_INVALID` | fecha/instante, referencia o relación estructural Domain inválida |
| `REGISTRO_IMPORTADO_RESULTADO_YA_ASIGNADO` | segunda finalización de fila |
| `IMPORTACION_AGENDA_METRICAS_INCONSISTENTES` | snapshot derivado viola ecuaciones |
| `IMPORTACION_AGENDA_YA_FINALIZADA` | finalización repetida o mutación posterior |
| `REGISTRO_IMPORTADO_DUPLICADO` | ID de registro ya agregado |
| `INCIDENCIA_IMPORTACION_DUPLICADA` | ID de incidencia ya agregado |

Todos usan `DomainError(code, message)`. El message no es contrato HTTP y no contiene
raw ni datos personales. Relaciones inexistentes, `sourcePosition` discordante, retiro
inválido o registros pendientes al finalizar usan `IMPORTACION_AGENDA_INVALID`; no se
crean códigos adicionales en T-02.

## IMP-AP-013 — Layout fail-closed

`AGENDA_LAYOUT_REJECTED` ocurre antes de construir `ImportacionAgenda`. No es invariant
del Aggregate, no crea Aggregate, registro, incidencia, Cita, evento ni audit success.
Su test pertenece a Application/parser, no a los unit tests puros de T-02.

## IMP-AP-014 — Scope y readiness

T-02 implementará únicamente estos contratos Domain. No implementará rehydration,
parser, persistence, events, Application, API o UI. El bloqueo documental queda resuelto
y no se introducen cambios a las taxonomías RESULT-AP-001..014.

## Trazabilidad de invariantes verificables

Los contratos `IMP-AP-001..014` permanecen como decisiones Domain. Sus invariantes
verificables usan un namespace distinto para no colisionar con las invariantes globales
`INV-AP-001..012` de la spec:

| Invariante | Contrato principal | Semántica |
|---|---|---|
| `INV-IMP-AP-001` | IMP-AP-001/002 | IDs e importedAt son externos a Domain |
| `INV-IMP-AP-002` | IMP-AP-007/009 | Resultado único por registro |
| `INV-IMP-AP-003` | IMP-AP-008/009/011 | Deduplicación interna de registros e incidencias |
| `INV-IMP-AP-004` | IMP-AP-004/009 | Finalización única e inmutable |
| `INV-IMP-AP-005` | IMP-AP-010 | Métricas derivadas y ecuaciones canónicas |
| `INV-IMP-AP-006` | IMP-AP-003 | Metadata técnica fuera de Domain |

`INV-IMP-AP-*` no renombra ni sustituye `IMP-AP-*`.
