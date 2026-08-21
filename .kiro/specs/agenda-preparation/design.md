---
spec: agenda-preparation
version: "0.1.0-draft"
status: "Draft — design ready; implementation decisions pending"
date: "2026-08-20"
requires:
  - "requirements.md v0.1.0-draft"
bounded_context: "Agenda / Appointment Preparation"
open_questions_blocking:
  - AP-OQ-001
  - AP-OQ-002
  - AP-OQ-003
  - AP-OQ-004
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
- referencia segura al archivo físico, sin decidir almacenamiento binario;
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

### 3.6 Value Objects candidatos

- `AgendaFecha`.
- `FolioCita`.
- `NumeroEmpleado`.
- `ServicioEspecialidad` (`codigo`, `nombreOriginal`).
- `MedicoReferencia` (`numeroEmpleado`, `nombreOriginal`, resolución).
- `PosicionRegistroOrigen`.
- `FingerprintLayout`.
- `ResultadoRegistroAgenda`.

No se crean VOs de Turno, Consultorio o Destino.

## 4. Lifecycle conceptual

### ImportacionAgenda

```text
recibida -> layout validado -> interpretada -> reconciliada -> finalizada
                    \-> rechazada estructuralmente
```

Los nombres son conceptuales; no son enum aprobado hasta cerrar AP-OQ-004. Reprocesamiento y reapertura detallados quedan para una decisión posterior.

### Cita en Agenda vigente

```text
FOLIO nuevo ------------------> vigente
FOLIO vigente + cambios ------> vigente actualizada
FOLIO vigente + sin cambios --> vigente sin mutación
FOLIO ausente ----------------> retirada de preparación
FOLIO retirado reaparece -----> vigente (misma identidad)
```

No existe transición automática a `CANCELADA`.

## 5. Commands y Domain Events candidatos

| Tipo | Nombre conceptual | Nota |
|---|---|---|
| Command | RegistrarImportacionAgenda | Crea la ejecución; no parsea HTML en Domain. |
| Command | RegistrarResultadoImportado | Asigna exactamente un resultado a la fila. |
| Command | ReconciliarAgenda | Aplica comparación por FOLIO sobre Agenda. |
| Event | ImportacionAgendaRegistrada | Sin contenido personal. |
| Event | ImportacionAgendaRechazada | Motivo estructural sanitizado. |
| Event | AgendaReconciliada | Conteos agregados, sin payload personal. |
| Event | CitaRetiradaDeAgenda | Semántica operacional, no clínica. |
| Event | CitaRestauradaEnAgenda | Misma identidad FOLIO. |

Son candidatos de diseño; payloads y catálogo definitivo se cierran antes de implementación. No se introduce broker ni Event Sourcing.

## 6. Reconciliation model

```text
previousByFolio + incomingByFolio
  incoming only     -> ADD       -> PROCESADO
  both, changed     -> UPDATE    -> ACTUALIZADO
  both, identical   -> UNCHANGED -> SIN_CAMBIOS
  previous only     -> RETIRADA_DE_AGENDA (effect, not incoming row)
  incoming + prior withdrawn -> RESTORE -> PROCESADO
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
```

El fallback por nombre nunca elige entre N>1. `ExpedienteReferenceQueryPort` admite 0..N porque ExpedienteNumero no es único.

## 8. Application Use Cases candidatos

| Use Case | Input conceptual | Output |
|---|---|---|
| `ImportAgenda` | archivo/referencia + `RequestContext` | `ImportacionAgendaSummary` |
| `GetAgendaImportResult` | importacionId + context | resumen + resultados sanitizados |
| `GetAgendaPreparationList` | fecha + context | lista inicial vigente |
| `GetAgendaImportIncidents` | importacionId + context | incidencias pendientes |

El contrato HTTP y la modalidad sync/async no se deciden hasta AP-OQ-003.

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

## 10. Layout validation boundary

El Adapter interpreta el artefacto externo en tres pasos:

1. **Structural:** tipo físico, encoding, tablas, encabezados y bloques requeridos.
2. **Content:** tipos, fechas, FOLIO y campos mínimos legibles.
3. **Business resolution:** médico, Servicio/Especialidad y referencia de Expediente.

`AgendaFileInspection` entrega filas neutrales a Application y nunca objetos DOM/Excel. El parser no implementa reconciliación ni autorización.

## 11. Error/taxonomy candidates

| Código candidato | Capa/semántica |
|---|---|
| `AGENDA_LAYOUT_UNSUPPORTED` | Application: archivo incompatible, fail-closed |
| `AGENDA_CONTENT_INVALID` | Application: contenido mínimo inválido |
| `AGENDA_IMPORT_ALREADY_EXISTS` | Resultado idempotente sin diferencias, no error de negocio necesariamente |
| `AGENDA_IMPORT_NOT_FOUND` | Application query |
| `AGENDA_NOT_FOUND` | Application query |
| `AGENDA_PERMISSION_DENIED` | Sólo si AP-OQ-001 aprueba código específico; no implementar aún |

La relación con `ApplicationError`, RFC7807 y statuses HTTP se decide con AP-OQ-003; no se inventa aquí.

## 12. Tenant, privacy y audit

- RequestContext/TenantContext existentes se reutilizan.
- Repositories, directories, UoW y parser orchestration operan dentro de un tenant ya validado.
- No se acepta tenant desde el archivo.
- Métricas/logs no incluyen FOLIO, nombres ni Expedientes.
- Full raw binary storage queda sin diseñar hasta AP-OQ-002.
- Audit actions/results requieren decisión junto con permissions; no se inventan identifiers.

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

No se definen tablas, columnas, índices, JSONB ni migrations en esta draft. T-09 exige decisión física explícita y profiling del layout.

## 15. Open decisions

| ID | Decisión requerida | Bloquea |
|---|---|---|
| AP-OQ-001 | Permissions, roles y audit identifiers/resultados | Domain/Application/API implementation |
| AP-OQ-002 | Retención/cifrado/acceso del archivo y raw completo | Persistencia/importer |
| AP-OQ-003 | API, límites, sync/async, upload/storage y RFC7807 | API/OpenAPI/frontend |
| AP-OQ-004 | Taxonomía técnica final de outcomes e incidencias | Domain implementation |
| AP-OQ-005 | Solicitud/proyección/RequerimientoExpediente | Integración posterior; no bloquea importación inicial |
| AP-OQ-006 | Reapertura/cierre operativo de importaciones | Puede diferirse si no se expone comando de reapertura |

## 16. SDB propagation required

La propagación requerida es la indicada en requirements.md §10. Debe completarse y aprobarse antes de T-01; esta ejecución no modifica SDB.
