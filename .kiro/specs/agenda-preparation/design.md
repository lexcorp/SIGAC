---
spec: agenda-preparation
version: "0.1.3"
status: "Approved for Implementation"
date: "2026-08-20"
requires:
  - "requirements.md v0.1.3"
bounded_context: "Agenda / Appointment Preparation"
open_questions_blocking: []
---

# Agenda Preparation — Design

## 1. Principios

| Principio | Aplicación |
|---|---|
| Clean Architecture | Domain no conoce HTML, archivos, NestJS, Drizzle, HTTP ni React. |
| Fail-closed ingestion | Layout no reconocido no produce registros interpretados ni reconciliación. |
| Source preservation | Original, interpretación y resolución son distinguibles. |
| Explicit outcomes | Ningún registro recibido queda sin resultado. |
| Tenant isolation | Todos los puertos reciben TenantContext/RequestContext canónicos. |
| Privacy by minimization | Sólo se normalizan/persisten campos con finalidad aprobada. |
| No Excel-shaped domain | Hojas, bloques de 30 filas, macros y MATUTINO/VESPERTINO no son entidades. |
| Bounded contexts separated | Agenda Preparation referencia Archive Operations; no redefine Expediente. |

## 2. Context map

```text
SIMEF export (.xls containing HTML)
        |
        v
SimefAgendaParserAdapter / Anti-Corruption Layer
        |
        v
Agenda Preparation Application
  |-- ImportacionAgenda (ingestion accountability)
  |-- Agenda + Cita (logical current agenda/reconciliation)
  |-- explicit results/incidents/read models
        |
        v
Archive Operations contracts (reference/query only)
```

SIMEF es upstream. Agenda Preparation traduce el formato externo. Archive Operations permanece separado y no depende del parser.

## 3. Modelo de dominio recomendado

### 3.1 Aggregate root `ImportacionAgenda`

Recomendado como Aggregate root de la ingestión. Representa una ejecución concreta y garantiza:

- tenant e identidad técnica de importación;
- metadata técnica sanitizada del artefacto; no conserva referencia descargable al binario;
- fecha declarada/interpretada;
- fingerprint técnico;
- registros recibidos y su posición de origen;
- resultado explícito por registro;
- conteos consistentes;
- incidencias derivadas de estructura, contenido o resolución.

No es la Agenda lógica ni usa checksum como identidad de negocio.

### 3.2 Aggregate root `Agenda`

Representa la Agenda vigente identificada por tenant + fecha. Es responsable de reconciliar `Cita` por FOLIO:

- incorporar nuevas;
- actualizar campos permitidos;
- conservar sin cambio;
- retirar de preparación sin borrar;
- restaurar la misma Cita si reaparece.

La coordinación atómica entre `ImportacionAgenda` y `Agenda` pertenece a Application/UnitOfWork tenant-scoped; no se diseña SQL en esta versión.

### 3.3 Entity `Cita`

Identidad: FOLIO dentro del tenant. Atributos funcionales:

- nombre original del derechohabiente;
- referencia de Expediente original y resolución opcional;
- tipo de derechohabiente;
- indicador primera vez/subsecuente;
- fecha y hora;
- `MedicoReferencia`;
- `ServicioEspecialidad`;
- vigencia en la preparación y evidencia de reconciliación.

`RETIRADA_DE_AGENDA` expresa ausencia de la preparación vigente, no estado clínico.

### 3.4 Entity `RegistroImportadoAgenda`

Pertenece a `ImportacionAgenda`. Contiene posición de origen, valores originales permitidos, interpretación y resultado. No es copia irrestricta de todas las columnas del archivo.

### 3.5 `IncidenciaImportacion`

Entidad hija o Value Object identificado dentro de `ImportacionAgenda`; la decisión exacta puede tomarse al implementar Domain. Representa cero/múltiples candidatos, referencia requerida no resuelta, duplicado o fallo de contenido. No equivale a `Incidencia` de Archive Operations.

### 3.6 Value Objects aprobados

- `AgendaFecha`: fecha civil gregoriana `YYYY-MM-DD`, sin tiempo/zona.
- `FolioCita`: string requerido, trim exterior e igualdad exacta.
- `NumeroEmpleado`: string requerido, trim exterior e igualdad exacta; preserva ceros.
- `ServicioEspecialidad` (`codigo`, `nombre`): ambos requeridos; identidad por código.
- `MedicoReferencia` (`numeroEmpleado`, `nombreOriginal`, resolución).
- `PosicionRegistroOrigen`: ordinal lógico entero positivo base 1.
- `FingerprintLayout`.
- `ResultadoRegistroAgenda`.

No se crean VOs de Turno, Consultorio o Destino.

Los VOs no duplican original/normalized. `RegistroImportadoAgenda` será propietario de
`originalValues` e `interpretedValues`. El parser traduce representaciones SIMEF; Domain
no conoce formato externo. Véase `DOMAIN-VALUE-OBJECTS-DECISION.md`.

Errores de construcción usan el `DomainError` canónico y exclusivamente los cinco codes
de VO-AP-009. Los messages no forman parte del contrato HTTP.

## 4. Lifecycle conceptual

### ImportacionAgenda

```text
recibida -> layout validado -> interpretada -> reconciliada -> finalizada
                    \-> rechazada estructuralmente
```

Este flujo describe fases de procesamiento, no un enum Domain. El resultado confirmado
es `IMPORTED | ALREADY_IMPORTED | RECONCILED`. Reprocesamiento y reapertura detallados
permanecen fuera del alcance inicial.

### Cita en Agenda vigente

```text
FOLIO nuevo ------------------> vigente
FOLIO vigente + cambios ------> vigente actualizada
FOLIO vigente + sin cambios --> vigente sin mutación
FOLIO ausente ----------------> retirada de preparación
FOLIO retirado reaparece -----> vigente (misma identidad)
```

No existe transición automática a `CANCELADA`.

## 5. Commands y Domain Events

| Tipo | Nombre conceptual | Nota |
|---|---|---|
| Command | RegistrarImportacionAgenda | Crea la ejecución; no parsea HTML en Domain. |
| Command | RegistrarResultadoImportado | Asigna exactamente un resultado a la fila. |
| Command | ReconciliarAgenda | Aplica comparación por FOLIO sobre Agenda. |
| Event | `AgendaImported` | Primera Agenda confirmada; sin contenido personal. |
| Event | `AgendaReconciled` | Reconciliación confirmada; conteos agregados. |
| Event | `CitaWithdrawnFromAgenda` | Semántica operacional, no clínica. |
| Event | `CitaRestored` | Misma identidad FOLIO. |

No se emite evento por fila, métrica, incidencia, ADD o UPDATE. El rechazo estructural
no produce evento Domain. No se introduce broker ni Event Sourcing.

## 6. Reconciliation model

```text
previousByFolio + incomingByFolio
  incoming only     -> ADD       -> ADDED
  both, changed     -> UPDATE    -> UPDATED
  both, identical   -> UNCHANGED -> UNCHANGED
  previous only     -> RETIRADA_DE_AGENDA (effect, not incoming row)
  incoming + prior withdrawn -> RESTORE -> RESTORED
```

Duplicados incompatibles dentro del snapshot no se eligen arbitrariamente. Los campos comparables/mutables son los aprobados en REQ-AP-012, excepto FOLIO; fecha debe ser coherente con la Agenda tenant+fecha.

## 7. Ports conceptuales

Los nombres finales seguirán convenciones del módulo; ningún port expone HTTP, NestJS, Drizzle o PostgreSQL.

```ts
interface AgendaFileInterpreterPort {
  inspect(input: AgendaFileInput): Promise<AgendaFileInspection>;
}

interface ImportacionAgendaRepository {
  findEquivalent(fingerprint: ImportFingerprint, tenant: TenantContext): Promise<ImportacionAgenda | null>;
  save(importacion: ImportacionAgenda, tenant: TenantContext): Promise<void>;
}

interface AgendaRepository {
  findByFecha(fecha: AgendaFecha, tenant: TenantContext): Promise<Agenda | null>;
  save(agenda: Agenda, tenant: TenantContext): Promise<void>;
}

interface MedicoDirectoryQueryPort {
  findByEmployeeNumber(numero: NumeroEmpleado, tenant: TenantContext): Promise<MedicoResolution | null>;
  findControlledFallback(nombreOriginal: string, tenant: TenantContext): Promise<readonly MedicoResolution[]>;
}

interface ExpedienteReferenceQueryPort {
  resolve(reference: ExpedienteReferenceInput, tenant: TenantContext): Promise<readonly ExpedienteReferenceMatch[]>;
}

interface AgendaPreparationUnitOfWork {
  execute<T>(tenant: TenantContext, work: (tx: AgendaPreparationTransaction) => Promise<T>): Promise<T>;
}

interface AgendaImportHistoryQueryPort {
  findAll(
    agendaDate: string | undefined,
    pagination: { readonly cursor?: string; readonly limit: number },
    tenant: TenantContext,
  ): Promise<AgendaImportHistoryPage>;
}

interface AgendaDayQueryPort {
  findByDate(fecha: AgendaFecha, tenant: TenantContext): Promise<AgendaDayReadModel | null>;
}
```

El fallback por nombre nunca elige entre N>1. `ExpedienteReferenceQueryPort` admite 0..N porque ExpedienteNumero no es único.

## 8. Application Use Cases candidatos

| Use Case | Input conceptual | Output |
|---|---|---|
| `ImportAgenda` | ImportAttemptId + AgendaArtifactStream + Idempotency-Key + RequestContext | `ImportAgendaResponse` |
| `GetAgendaImportResult` | importacionId + context | resumen + resultados sanitizados |
| `GetAgendaPreparationList` | fecha + context | lista inicial vigente |
| `GetAgendaImportIncidents` | importacionId + context | incidencias pendientes |
| `ListAgendaImports` | agendaDate opcional + pagination + context | `AgendaImportHistoryPage` |

El contrato HTTP y la modalidad síncrona se definen en API-AP-001..014.

`ImportAgenda` exige `AGENDA_IMPORT`; las consultas de importación/resultados, Agenda y
preparación exigen `AGENDA_VIEW`; incidencias exige `AGENDA_INCIDENT_VIEW`. No existen
capabilities contextuales ni resolución manual de incidencias en el slice inicial.

Una UoW tenant-scoped confirma ImportacionAgenda + reconciliación + resultados +
incidencias/métricas + audit. Application no conoce HTTP, Multer, filesystem ni database.

## 9. Read models

### ImportacionAgendaSummary

- importacionId;
- fechaAgenda;
- estado conceptual;
- recibidos, procesados, sinCambios, actualizados, retirados, incidencias, errores;
- `hasChanges`.

### RegistroImportadoResult

- posición/referencia no sensible;
- FOLIO sólo para usuario autorizado;
- resultado;
- código de incidencia sanitizado;
- no incluye contacto, vigencia, sexo, edad o raw completo.

### AgendaPreparationItem

Los campos exactos de REQ-AP-012. No contiene Turno, Consultorio, Destino, Custodia, capabilities ni datos de SM10-1 adicionales.

### AgendaImportIncidentSummary

- referencia al registro;
- categoría aprobada;
- estado de resolución conceptual;
- candidatos no sensibles cuando estén autorizados.

### AgendaImportHistoryPage

Cursor-based, orden `importedAt DESC, importacionId DESC`; cursor conceptual
`importedAt + importacionId`, opaco para Application/API/UI. `items` contiene sólo
importacionId, agendaDate, importedAt, outcome y métricas; `nextCursor` nullable. Sin
total, hasMore, raw, filename, fingerprint, actorRef o datos personales.

```ts
interface ListAgendaImportsInput {
  readonly agendaDate?: string;
  readonly pagination: { readonly cursor?: string; readonly limit: number };
  readonly context: RequestContext;
}

interface AgendaImportHistoryItem {
  readonly importacionId: string;
  readonly agendaDate: string;
  readonly importedAt: Date;
  readonly outcome: 'IMPORTED' | 'ALREADY_IMPORTED' | 'RECONCILED';
  readonly metrics: AgendaImportMetrics;
}

interface AgendaImportHistoryPage {
  readonly items: readonly AgendaImportHistoryItem[];
  readonly nextCursor: string | null;
}
```

### AgendaDayReadModel

Contiene exactamente agendaDate, latestImportacionId, latestImportedAt, latestOutcome,
activeAppointments, physicians, services e incidentCount. Los conteos se calculan sobre
el estado vigente: Citas retiradas quedan fuera; médico se distingue por número de
empleado y Servicio/Especialidad por el concepto operacional del bounded context. No se
modela `openIncidents` porque no existe lifecycle de resolución inicial.

```ts
interface AgendaDayReadModel {
  readonly agendaDate: string;
  readonly latestImportacionId: string;
  readonly latestImportedAt: Date;
  readonly latestOutcome: 'IMPORTED' | 'ALREADY_IMPORTED' | 'RECONCILED';
  readonly activeAppointments: number;
  readonly physicians: number;
  readonly services: number;
  readonly incidentCount: number;
}
```

## 10. Layout validation boundary

El Adapter interpreta el artefacto externo en tres pasos:

1. **Structural:** tipo físico, encoding, tablas, encabezados y bloques requeridos.
2. **Content:** tipos, fechas, FOLIO y campos mínimos legibles.
3. **Business resolution:** médico, Servicio/Especialidad y referencia de Expediente.

`AgendaFileInspection` entrega filas neutrales a Application y nunca objetos DOM/Excel. El parser no implementa reconciliación ni autorización.

## 11. Taxonomía contractual

| Nivel | Catálogo cerrado / semántica |
|---|---|
| `ImportOutcome` | `IMPORTED`, `ALREADY_IMPORTED`, `RECONCILED` |
| `RecordProcessingResult` | `ADDED`, `UPDATED`, `UNCHANGED`, `RESTORED`, `PENDING_REVIEW`, `REJECTED`, `DUPLICATE_FOLIO` |
| `ImportIncident` | `PHYSICIAN_NOT_RESOLVED`, `PHYSICIAN_AMBIGUOUS`, `SERVICE_NOT_RESOLVED`, `EXPEDIENT_NOT_RESOLVED`, `REQUIRED_DATA_MISSING`, `ROW_INCONSISTENT`, `DUPLICATE_FOLIO_IN_SNAPSHOT` |
| `ApplicationError` | `AGENDA_IMPORT_NOT_FOUND`, `AGENDA_NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED`; reutiliza `PERMISSION_DENIED` y códigos de frontera aprobados |

Los niveles no son intercambiables y ninguno amplía `AuditResult`. Los errores de fila
son resultado/incidencia, no excepción Application.

## 12. Tenant, privacy y audit

- RequestContext/TenantContext existentes se reutilizan.
- Repositories, directories, UoW y parser orchestration operan dentro de un tenant ya validado.
- No se acepta tenant desde el archivo.
- Métricas/logs no incluyen FOLIO, nombres ni Expedientes.
- Archivo y fila raw son Infrastructure staging C3 transitorio, tenant-namespaced y
  protegido; se eliminan al outcome terminal y no se ofrecen para vista/descarga.
- Persistencia conserva sólo allow-list original + interpretación/resolución y metadata
  técnica sanitizada. No persiste filename cliente.
- Se reutiliza `AuditWriter.append(AuditEntry, RequestContext)` sin modificar el port.
- Actions: `AGENDA_IMPORT`, `AGENDA_VIEW`, `AGENDA_PREPARATION_VIEW` y
  `AGENDA_INCIDENT_VIEW`; resources: `AGENDA_IMPORT_ATTEMPT`, `AGENDA_IMPORT`, `AGENDA`.
- Import denegado usa `ImportAttemptId/denied`; import confirmado usa
  `ImportacionAgenda.id/success`. Layout rechazado no genera AuditEntry.
- Queries usan `success|denied|not-found`; empty sobre recurso existente es success.
- Audit no contiene archivo, raw, filas ni datos personales de Agenda.

`ImportAttemptId` se crea en la frontera después de resolver RequestContext y antes de
autorizar/leer. No integra RequestContext ni equivale a tracing, fingerprint, filename,
fechaAgenda o IDs persistidos.

## 13. Integration boundary con Archive Operations

Agenda Preparation puede consultar referencias de Expediente con cardinalidad 0..N y producir una necesidad/lista de preparación. No ejecuta transiciones de Expediente, no cambia EstadoOperativo y no crea MovimientoExpediente. Una futura integración deberá decidir si genera Solicitud, proyección o `RequerimientoExpediente`.

## 14. Persistencia conceptual

La futura persistencia deberá soportar:

- importación y fingerprint técnico;
- Agenda tenant+fecha;
- Cita por FOLIO;
- valores originales permitidos e interpretados;
- resultado por registro;
- historia de retirada/restauración;
- incidencias y conteos.

`ImportArtifactMetadata` conserva fingerprint/layout metadata sanitizada y pertenece al
ingestion/Application boundary, no al Domain. `RegistroImportadoAgenda` guarda sólo la
allow-list original más interpretación/resolución. Bytes y filas raw no son durables.
Fingerprint no identifica Agenda ni ImportacionAgenda; su algoritmo queda para un
estándar técnico posterior.

No se definen tablas, columnas, índices, JSONB ni migrations en esta draft. T-09 exige decisión física explícita y profiling del layout.

## 15. Open decisions

| ID | Decisión requerida | Bloquea |
|---|---|---|
| AP-OQ-001 | RESOLVED — AUTH-AP-001..003 | Cerrado |
| AP-OQ-002 | RESOLVED — RAW-AP-001..012 | Cerrado |
| AP-OQ-003 | RESOLVED — API-AP-001..014 | Cerrado |
| AP-OQ-004 | RESOLVED — RESULT-AP-001..014 | Cerrado |
| AP-OQ-005 | Solicitud/proyección/RequerimientoExpediente | Integración posterior; no bloquea importación inicial |
| AP-OQ-006 | Reapertura/cierre operativo de importaciones | Puede diferirse si no se expone comando de reapertura |

## 16. SDB propagation required

AUTH-AP-001..003, RAW-AP-001..012, API-AP-001..014 y RESULT-AP-001..014 fueron
propagados. `AP-OQ-005/006` permanecen abiertos y no bloquean el alcance inicial.

## 17. Readiness

- `requirements_ready: true`
- `design_ready: true`
- `tasks_ready: true`
- `implementation_ready: true`
