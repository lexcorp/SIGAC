# Import API Decision — Agenda Preparation

**Estado:** APPROVED

**Fecha:** 2026-08-20

**Scope:** `agenda-preparation v0.1.0-draft` / cierre de `AP-OQ-003`

## API-AP-001 — Application input

Contrato conceptual, agnóstico de HTTP/framework:

```ts
interface ImportAgendaInput {
  readonly importAttemptId: ImportAttemptId;
  readonly artifact: AgendaArtifactStream;
  readonly idempotencyKey: string;
  readonly context: RequestContext;
}

interface AgendaArtifactStream {
  readonly open: () => AsyncIterable<Uint8Array>;
}
```

La sintaxis final seguirá convenciones del repositorio. Application no recibe request
HTTP, Multer/Express, tenant/actor/tracing desde formulario, database name, filesystem
path controlado por cliente, filename ni fechaAgenda confiable.

La frontera resuelve RequestContext, genera `ImportAttemptId` opaco, valida el envelope
HTTP y entrega el stream. `ImportAttemptId` no integra RequestContext ni se deriva de
filename, fingerprint, fechaAgenda, requestId o correlationId.

## API-AP-002 — Endpoint y upload

`POST /api/v1/agenda-imports` crea el recurso de una importación aceptada.

- `multipart/form-data`.
- exactamente una parte binaria requerida llamada `file`;
- header `Idempotency-Key` requerido y no vacío;
- ningún otro campo de formulario funcional;
- tenant, actor, permissions, tracing y fechaAgenda nunca forman parte del request.

Falta/multiplicidad de `file`, multipart malformado, parte vacía o key ausente/inválida
usa `HTTP_VALIDATION_ERROR`/400 con errores seguros. No se refleja valor recibido.

## API-AP-003 — Artefacto soportado

Único formato exterior admitido: `.xls` de Agenda SIMEF. Extensión y MIME del cliente
son señales no confiables y sólo permiten rechazo temprano; nunca prueban compatibilidad.

Después de autorización, el ingestion adapter valida por contenido:

- documento HTML real bajo extensión `.xls`;
- encoding observado ISO-8859 compatible con el layout aprobado;
- encabezados/campos requeridos y bloques Médico/Servicio reconocidos.

No se aceptan `.xlsx`, `.csv`, `.xlsm` ni un archivo BIFF arbitrario. MIME declarado no
anula la inspección de contenido. Macros nunca se ejecutan.

## API-AP-004 — Límite y streaming

La plataforma exige un límite de upload positivo, configurado por deployment y aplicado
durante streaming antes de cargar el archivo completo en memoria. No existe número de
negocio aprobado. El servicio no inicia si falta configuración válida y no adopta un
default ilimitado.

La evidencia observada (aprox. 256–401 KB y cientos de citas; el `.xlsm` de 1.8 MB queda
fuera del formato) sirve para pruebas/capacity planning, no como máximo contractual.
Exceder el límite produce 413 `AGENDA_UPLOAD_TOO_LARGE` y disposición del staging.

## API-AP-005 — Orden fail-closed

```text
authenticate/resolve RequestContext
→ generate ImportAttemptId
→ validate HTTP envelope and Idempotency-Key
→ authorize AGENDA_IMPORT
→ only then open/read the stream
→ enforce limit and stage tenant-scoped
→ fingerprint + inspect content/layout
→ process atomically
→ dispose raw staging
```

La permission se valida antes de abrir el stream. El fingerprint se calcula después de
autorización durante ingestion streaming, sirve para duplicado/trazabilidad y no
sustituye reconciliación por FOLIO ni identifica Agenda/ImportacionAgenda.

## API-AP-006 — Ejecución síncrona

El primer slice es síncrono. La escala observada no justifica queue/worker ni lifecycle
de job. La respuesta se emite sólo después de confirmar o rechazar la operación.

Timeout total y timeouts de infraestructura son configurables por deployment. Un timeout
cancela/aborta, revierte la UoW y produce 504 `AGENDA_IMPORT_TIMEOUT`, sin importación o
Agenda parcialmente confirmada. Cambiar a async requiere decisión posterior basada en
medición; no es fallback silencioso.

## API-AP-007 — Atomicidad y lifecycle mínimo

Para layout reconocido se ejecuta una UoW tenant-scoped ALL OR NOTHING que confirma:

1. `ImportacionAgenda` durable;
2. reconciliación completa de Agenda/Citas;
3. resultados durables de todos los registros;
4. incidencias y métricas consistentes;
5. audit success conforme AUTH-AP-003.

Persistence failure, parser failure posterior a inspección o reconciliación incompleta
revierte todo. No queda `ImportacionAgenda`, Agenda parcial, resultados parciales,
métricas parciales ni audit success. El `ImportAttemptId` sigue siendo el correlato
técnico del intento, no una importación durable.

Lifecycle conceptual, sin fijar la taxonomía de fila de AP-OQ-004:

- intento denegado;
- rechazo estructural sin `ImportacionAgenda`;
- fallo técnico sin `ImportacionAgenda` confirmada;
- importación confirmada inicial;
- reimportación idéntica confirmada;
- reconciliación con cambios confirmada.

Una reimportación idéntica crea una nueva `ImportacionAgenda` como ejecución trazable,
pero no duplica ni muta Agenda/Cita. Layout rechazado conserva sólo evidencia técnica
sanitizada conforme RAW-AP-001..012, nunca `ImportacionAgenda`.

## API-AP-008 — Success contract

Toda importación aceptada —inicial, idéntica o reconciliada— responde `201 Created`,
header `Location: /api/v1/agenda-imports/{importacionId}` y:

```ts
interface ImportAgendaResponse {
  readonly importacionId: string;
  readonly agendaDate: string; // YYYY-MM-DD interpretado del artefacto
  readonly importedAt: string; // RFC 3339
  readonly outcome: 'IMPORTED' | 'ALREADY_IMPORTED' | 'RECONCILED';
  readonly metrics: AgendaImportMetrics;
}

interface AgendaImportMetrics {
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

El response no incluye `ImportAttemptId`, fingerprint, filename, raw, filas, Domain
Events ni datos personales. Los tres outcomes comparten status/body shape. Las métricas
usan los campos aprobados por RESULT-AP-001..014; ImportOutcome, resultado de fila e
incidencia permanecen contratos separados.

## API-AP-009 — Idempotency y retries

`Idempotency-Key` es requerido para el POST conforme API-009. Su scope es actor + tenant
+ operación durante una ventana configurable y acotada.

- misma key + mismo artefacto: devuelve el status/body/Location originales, no vuelve a
  procesar, no crea otra ImportacionAgenda ni otro audit success;
- misma key + artefacto distinto: 409 `IDEMPOTENCY_KEY_REUSED`;
- key nueva + archivo idéntico: reimportación funcional; crea ImportacionAgenda con
  `ALREADY_IMPORTED` sin duplicar Agenda/Cita.

La infraestructura calcula fingerprint después de autorización para comparar payloads.
La ventana concreta es configuración operacional y nunca indefinida. Un retry por
timeout/red debe reutilizar la key; `ImportAttemptId` puede ser nuevo en cada request HTTP
y no reemplaza la key.

## API-AP-010 — Structural/error boundary

| Caso | HTTP/code | ImportacionAgenda durable |
|---|---|---|
| Request/multipart/key malformado, file missing/empty/multiple | 400 `HTTP_VALIDATION_ERROR` | No |
| No autenticado | 401 `AUTHENTICATION_REQUIRED` | No |
| Sin `AGENDA_IMPORT` | 403 `PERMISSION_DENIED` | No |
| Upload excede límite | 413 `AGENDA_UPLOAD_TOO_LARGE` | No |
| Extensión/formato exterior no soportado | 415 `AGENDA_ARTIFACT_UNSUPPORTED` | No |
| HTML/layout SIMEF incompatible o estructura obligatoria incompleta | 422 `AGENDA_LAYOUT_REJECTED` | No |
| Idempotency-Key reutilizada con otro artefacto | 409 `IDEMPOTENCY_KEY_REUSED` | No nueva |
| Timeout | 504 `AGENDA_IMPORT_TIMEOUT` | No nueva; rollback |
| Fallo técnico inesperado | 500 `AGENDA_IMPORT_FAILED` | No nueva; rollback |
| Layout válido con incidencias de fila | 201, outcome confirmado | Sí |

Los Problem Details de 413/415/422/409/500/504 pueden incluir `importAttemptId` como
extensión opaca para soporte, pero nunca filename, contenido, fecha inferida, fingerprint,
parser/DB internals, stack trace o datos SIMEF. Layout rejected no genera AuditEntry y no
agrega AuditResult. Los códigos de resultado por fila son los de RESULT-AP-001..014.

Timeout/fallo técnico no se fuerzan dentro de un AuditResult incorrecto: no generan
AuditEntry de negocio y usan observabilidad sanitizada. Permission denied conserva el
audit aprobado por AUTH-AP-001.

## API-AP-011 — Query contracts

| Endpoint conceptual | Permission | Response |
|---|---|---|
| `GET /api/v1/agenda-imports/{id}` | `AGENDA_VIEW` | `ImportacionAgendaSummary` |
| `GET /api/v1/agenda-imports/{id}/results` | `AGENDA_VIEW` | página de resultados sanitizados |
| `GET /api/v1/agenda-imports/{id}/incidents` | `AGENDA_INCIDENT_VIEW` | página de incidencias sanitizadas |
| `GET /api/v1/agendas/{date}` | `AGENDA_VIEW` | resumen de Agenda vigente |
| `GET /api/v1/agendas/{date}/preparation-items` | `AGENDA_VIEW` | página de lista inicial |

`ImportacionAgendaSummary` contiene únicamente importacionId, agendaDate, importedAt,
actorRef, outcome de API-AP-008, layoutVersion y métricas. Tenant es implícito. No expone
fingerprint, raw, filename ni datos de filas.

Resultados/incidencias son necesarios para cumplir trazabilidad y atención de pendientes;
no se difieren. Sus item schemas y códigos son los aprobados por RESULT-AP-001..014.

Queries usan 400 para id/fecha/cursor/limit malformado, 401 sin autenticación, 403 sin
permission y 404 `AGENDA_IMPORT_NOT_FOUND` o `AGENDA_NOT_FOUND` cuando el recurso no
existe en el tenant activo. El mismo 404 cubre existencia física en otro tenant.

## API-AP-012 — Pagination

Resultados, incidencias y preparation-items usan cursor pagination `{items,nextCursor}`
sin `total` ni `hasMore`. `limit` es entero positivo requerido y está sujeto a máximo
configurable server-side; no se inventa un máximo numérico.

Orden/cursor conceptual:

- resultados: posición de origen ASC + registroId ASC;
- incidencias: posición de origen ASC + incidenciaId ASC;
- preparation-items: agrupación Servicio nombre/código y médico nombre/número de
  empleado; default `APPOINTMENT_TIME_ASC` (hora + FOLIO), con
  `PATIENT_NAME_ASC` (nombrePaciente + FOLIO) también aprobado. El cursor queda ligado
  al order y cambiarlo reinicia la paginación. Véase PREP-AP-002/003.

Cursor encoding es opaco; API/UI sólo lo reciben y reenvían. Las métricas del resumen
aportan conteos agregados, no un total de paginación.

## API-AP-013 — Composition boundary

El módulo API futuro será configurable con Use Cases construidos por el composition root.
Controller sólo resuelve RequestContext, genera ImportAttemptId, valida el envelope y
llama Application. No accede directamente a Repository, parser, filesystem, database ni
TenantDatabaseRouter.

`AgendaArtifactStream` pertenece al contrato Application consumidor; un ingestion adapter
de Infrastructure lo implementa sobre el stream temporal. Parser y persistence adapters
se inyectan al Use Case, no al Controller.

## API-AP-014 — Tenant y raw

RequestContext.tenant es la única autoridad. Ninguna ruta acepta tenant selector. La
política cross-tenant es no divulgativa: un id/fecha no visible en el tenant activo usa el
not-found canónico del recurso Agenda correspondiente, sin `CROSS_TENANT_*`.

RAW-AP-001..012 permanece sin cambios. Esta decisión no crea UI, OpenAPI, schema,
migration, worker ni algoritmo de fingerprint.

## Estado de OQs

- `AP-OQ-001`: RESOLVED.
- `AP-OQ-002`: RESOLVED.
- `AP-OQ-003`: RESOLVED.
- `AP-OQ-004`: OPEN.
- `implementation_ready`: false.

> Estado posterior: `AP-OQ-004` fue resuelto por RESULT-AP-001..014 en
> `IMPORT-RESULT-TAXONOMY-DECISION.md`. Esta sección conserva el estado histórico al
> aprobar API-AP; la readiness vigente de la spec es `true`.
