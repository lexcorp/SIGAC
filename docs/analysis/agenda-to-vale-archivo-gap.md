# GAP Analysis — Agenda Preparation → Vale Archivo

**Fecha:** 2026-08-27  
**Baseline:** `main` en `4a9e66f`, release `v0.3.0`  
**Estado:** análisis previo a implementación

## 1. Propósito y límites

Este documento analiza cómo convertir una Agenda preparada en solicitudes operativas de
expedientes sin introducir una dependencia entre los bounded contexts
`agenda-preparation` y `vale-archivo`. No aprueba código, endpoints, schema ni una
semántica de negocio que las fuentes actuales no definan.

## 2. Estado actual de Agenda Preparation

### 2.1 Modelo Domain

| Concepto | Tipo | Responsabilidad / identidad |
|---|---|---|
| `ImportacionAgenda` | Aggregate root | Accountability de una ejecución de importación; identidad técnica, fecha, resultados, incidencias y métricas. |
| `Agenda` | Aggregate root | Agenda lógica tenant-scoped identificada por `AgendaFecha`; reconcilia Citas por FOLIO. No tiene `AgendaId`. |
| `Cita` | Entity | Identidad `FolioCita` dentro de tenant + fecha; lifecycle `ACTIVA` o `RETIRADA_DE_AGENDA`. |
| `RegistroImportadoAgenda` | Entity | Evidencia allow-listed original/interpretada y resultado explícito por registro. |
| `IncidenciaImportacion` | Entity | Incidencia sanitizada asociada al procesamiento. |

La reconciliación soporta `ADD`, `UPDATE`, `UNCHANGED`,
`RETIRADA_DE_AGENDA` y `RESTORE`. Una retirada no es cancelación clínica.

### 2.2 Datos disponibles para integración

Una Cita/`PreparationItem` vigente proporciona:

- `folio`;
- `agendaDate`, `appointmentTime`;
- nombre operativo del paciente;
- referencia original de Expediente y referencia resuelta nullable;
- tipo de derechohabiente y tipo de consulta;
- médico: número de empleado y nombre;
- Servicio/Especialidad: código y nombre.

No proporciona número de vale, unidad solicitante, solicitante, autorizador, fecha de
recepción ni política para fusionar varias Citas del mismo Expediente.

### 2.3 Ports Application

- Write side: `ImportacionAgendaRepository`, `AgendaRepository`,
  `ImportArtifactMetadataRepository` y `AgendaPreparationUnitOfWork`.
- Ingestion/ACL: `AgendaFileInterpreterPort`, `MedicoDirectoryQueryPort`,
  `ExpedienteReferenceQueryPort`, `IdempotencyKeyRepository`.
- Read side: `PreparationListQueryPort`, `AgendaImportHistoryQueryPort`,
  `AgendaDayQueryPort`, `AgendaImportResultQueryPort` y
  `AgendaImportIncidentsQueryPort`.
- Report: `PreparationReportGeneratorPort`.

Todos los accesos relevantes son tenant-scoped. `PreparationListQueryPort` ya puede
obtener la colección vigente completa mediante `listForPrint`, pero ese contrato es un
read model de pantalla/impresión, no un contrato de integración aprobado.

### 2.4 Persistence y adapters

| Tabla tenant-local | Contenido relevante |
|---|---|
| `agendas` | `agenda_date` como PK lógica dentro de la database del tenant. |
| `citas` | Estado vigente/histórico; PK `(agenda_date, folio)`, lifecycle, Expediente, médico y Servicio. |
| `agenda_imports` | Importación, outcome y métricas. |
| `agenda_registros` | Evidencia allow-listed por registro. |
| `agenda_incidencias` | Incidencias de importación. |
| `agenda_artifact_metadata` | Fingerprint técnico asociado a importación. |
| `agenda_idempotency_keys` | Idempotencia HTTP de importación. |

Adapters PostgreSQL existentes: `PostgresAgendaRepository`,
`PostgresImportacionAgendaRepository`, `PostgresImportArtifactMetadataRepository` y
`PostgresAgendaReadQueryPorts`. La importación SIMEF usa
`SimefAgendaParserAdapter` como ACL del formato externo.

### 2.5 Superficie API actual

- importar/listar/consultar importaciones e incidencias;
- consultar resumen de Agenda por fecha;
- consultar/imprimir lista de preparación;
- generar paquete PDF.

No existe una operación para producir solicitudes o Vales.

## 3. Estado actual de Vale Archivo

### 3.1 Modelo Domain

`ValeArchivo` es Aggregate root de una solicitud extraordinaria SM 1-14. Contiene
`ValeArchivoItem` y los Value Objects `ValeArchivoId`, `NumeroVale`,
`SolicitanteReferencia`, `EstadoVale` y `EstadoBusqueda`.

Estados del Vale:

`RECIBIDA → EN_BUSQUEDA → COMPLETA | PARCIAL | NO_LOCALIZADA → ENTREGADA → CERRADA`.

Cada item contiene número de Expediente, nombre operativo del paciente, especialidad,
estado de búsqueda, ubicación encontrada y observaciones. No contiene FOLIO, fecha de
Agenda, número de empleado ni identificador de origen.

### 3.2 Application existente

- `RegistrarVale`, `ConsultarVale` y `ListarVales`;
- `IniciarBusqueda`, `RegistrarLocalizacion`, `RegistrarEntrega` y
  `CerrarValeAdministrativo`;
- `GenerarPdfVale`.

Ports: `ValeArchivoRepository`, `ValeArchivoQueryPort` y
`ValeArchivoReportGeneratorPort`. Los Use Cases reciben `RequestContext`, usan
`TenantContext` server-resolved y escriben audit mediante el contrato compartido.

`RegistrarVale` requiere `REQUEST_CREATE` y recibe datos SM 1-14 completos:
`numeroVale`, fechas de solicitud/recepción, unidad solicitante, solicitante,
autorizador e items. No acepta una clave de origen ni una idempotency key de Agenda.

### 3.3 Persistence

| Tabla tenant-local | Contenido relevante |
|---|---|
| `vale_archivo` | Encabezado, actores nominales, estado y timestamps. `numero_vale` es UNIQUE. |
| `vale_archivo_items` | Expediente, paciente, especialidad y estado de búsqueda. |

Adapters existentes: `PostgresValeArchivoRepository` y
`PostgresValeArchivoQueryAdapter`. No hay columnas o tabla de enlace hacia Agenda.

### 3.4 API y capacidades

Endpoints implementados: crear, listar y consultar Vale; iniciar búsqueda; registrar
localización; registrar entrega; cierre administrativo; y generar PDF.

Permisos existentes: `REQUEST_CREATE`, `ARCHIVE_REQUEST_VIEW`,
`ARCHIVE_REQUEST_PROCESS` y `ARCHIVE_REQUEST_DELIVER`. No existe un permiso aprobado
específico para generación desde Agenda.

## 4. GAP de integración

| ID | Falta | Impacto |
|---|---|---|
| GAP-AV-001 | Contrato publicado de Citas preparables para integración. | No debe reutilizarse accidentalmente un read model de UI/PDF como API entre contextos. |
| GAP-AV-002 | Orquestador neutral entre contextos. | Agenda no debe importar Vale y Vale no debe importar Agenda. |
| GAP-AV-003 | Fuente de `numeroVale`. | `NumeroVale` es obligatorio y único; no puede inventarse un algoritmo. |
| GAP-AV-004 | Fuente de unidad, solicitante, autorizador y fecha de recepción. | Son invariantes de creación del Vale actual y no existen en Agenda. |
| GAP-AV-005 | Identidad/idempotencia cross-context. | Repetir la generación puede crear Vales duplicados. |
| GAP-AV-006 | Modelo persistente de trazabilidad Agenda → Vale. | Hoy no puede conocerse qué Agenda/importación/grupo originó un Vale. |
| GAP-AV-007 | Semántica tras reconciliar una Agenda ya convertida. | No está definido si UPDATE/RESTORE/RETIRADA modifica un Vale RECIBIDA o crea otra solicitud. |
| GAP-AV-008 | Citas del mismo grupo que refieren al mismo Expediente. | No está definido si producen uno o varios items. |
| GAP-AV-009 | Citas sin Expediente resuelto. | Debe decidirse exclusión, bloqueo o resultado explícito. |
| GAP-AV-010 | Permiso y audit actions de generación. | No debe asumirse que `AGENDA_VIEW` o `REQUEST_CREATE` basta. |
| GAP-AV-011 | Atomicidad entre creación de Vale y vínculo de trazabilidad. | Debe definirse transacción tenant-local o consistencia eventual recuperable. |
| GAP-AV-012 | Contrato API/UX. | No están definidos comando, preview, respuesta, errores ni selección de grupos. |

Además, `vale-archivo v0.1.0` declara expresamente fuera de alcance la integración con
Agenda Preparation. La versión v0.4 debe enmendar esa frontera antes de implementar.

## 5. Evaluación de patrones DDD

### Domain Event

No se recomienda como mecanismo inicial. Importar/reconciliar no equivale necesariamente
a una decisión de generar Vales y Agenda no tiene un evento aprobado para esa intención.

### Integration Event

Es viable sólo si se aprueban outbox, entrega/idempotencia, versionado y consistencia
eventual. SIGAC no tiene broker aprobado y no debe introducirse sin ADR.

### Application Service / Process Manager

Es la opción recomendada: una operación explícita y síncrona, tenant-scoped, coordina
la lectura de una proyección de Agenda y la creación de uno o más Vales. Reside en un
módulo de integración/composición, nunca dentro de Domain de los contextos.

### Anti-Corruption Layer

Es obligatoria en ambos extremos:

- un `PreparedAgendaSourcePort` conceptual expone DTOs mínimos sin entidades Domain;
- un `ValeRequestCreationPort` conceptual acepta un comando neutral y un adapter lo
  traduce al Use Case de Vale Archivo;
- el orquestador no comparte Aggregates ni accede directamente a tablas ajenas.

## 6. Propuesta DDD

```text
API / explicit command
        |
        v
AgendaToValeApplicationService (integration/application)
   |                         |
   v                         v
PreparedAgendaSourcePort     ValeRequestCreationPort
   | adapter/ACL             | adapter/ACL
   v                         v
Agenda Preparation           Vale Archivo
read projection              creation Use Case
        \___________________________/
             tenant database
      traceability + idempotency record
```

El servicio agrupa por `(agendaDate, servicioCodigo, medicoNumeroEmpleado)`. Los nombres
son descriptivos; código de Servicio y número de empleado son identidades estables.

La clave de deduplicación conceptual mínima es tenant + fecha + código de Servicio +
número de empleado. Todavía debe decidirse si incluye versión/importación y cómo se
comporta ante reconciliaciones; no se aprueba aún un constraint SQL.

La trazabilidad debe persistirse mediante una relación explícita con fecha de Agenda,
grupo y `ValeArchivoId`. Incluir FOLIOs o importación de origen, y el ownership físico de
esa relación, permanecen como decisiones de diseño.

## 7. Decisiones humanas requeridas

1. ¿Cómo se asigna `NumeroVale` a cada grupo generado?
2. ¿De dónde proceden unidad, solicitante, autorizador y fecha de recepción?
3. ¿La generación es manual explícita, automática o ambas?
4. ¿Qué ocurre si la Agenda cambia después de generar Vales?
5. ¿Un Expediente repetido en un grupo genera uno o varios items?
6. ¿Qué ocurre con una Cita sin Expediente resoluble?
7. ¿Qué permiso y audit action autorizan/registran la generación?
8. ¿Transacción tenant-local o consistencia eventual con outbox aprobada por ADR?
9. ¿La trazabilidad apunta a fecha, importación, FOLIOs o combinación versionada?

## 8. Recomendación

Adoptar el Application Service síncrono con ACLs y registro idempotente de trazabilidad,
pero mantener la implementación bloqueada hasta cerrar las decisiones anteriores. No
introducir imports entre contextos, broker, acceso cross-tenant ni lectura de tablas
desde controllers.
