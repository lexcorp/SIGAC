---
spec: expediente-workspace
version: "0.3.5"
status: "Draft — pending stakeholder validation"
date: "2026-08-15"
requires:
  - requirements.md (v0.3.5)
  - design.md (v0.3.5)
decisions_applied:
  - "OQ-EW-001 RESOLVED"
  - "OQ-EW-005 RESOLVED"
  - "OQ-EW-006 RESOLVED"
  - "OQ-EW-007 RESOLVED"
  - "DEC-EW-STATE-001 ACCEPTED"
  - "AUTHORIZATION-DECISION APPROVED"
  - "READ-MODEL-COMPOSITION-DECISION APPROVED"
  - "OQ-EW-DESIGN-004 RESOLVED"
  - "READ-EW-008..012 APPROVED"
  - "AUTH-EW-006/007 APPROVED"
  - "CTX-EW-001..004 APPROVED"
  - "AUD-EW-003..006 APPROVED"
  - "READ-EW-013 APPROVED"
  - "ERR-EW-001..004 APPROVED"
ready_gate: "READY-GATE.md — todos los ítems deben estar marcados antes de iniciar T-01"
done_gate: "OS-018 — spec + tests + API/migrations + auth/tenant/audit + traceability"
---

# Expediente Workspace — Tasks

> **Regla de oro (AGENTS.md):** No inventar comportamiento faltante.
> Si durante la implementación aparece ambigüedad de invariante, permiso o tenant
> scope -> STOP_AND_ESCALATE como open question.

---

## Estado de prerequisitos

Las OQs que eran bloqueantes en v0.2.0 están resueltas. La implementación puede comenzar.

| OQ | Estado | Resolución disponible en |
|----|--------|--------------------------|
| OQ-EW-001 | RESOLVED | DECISION-REGISTER, DDD-007, DAT-006, DAT-016 |
| OQ-EW-005 | RESOLVED | DECISION-REGISTER, BIZ-010, BIZ-016, UC-010, SPEC-006 |
| OQ-EW-006 | RESOLVED | DECISION-REGISTER, DDD-018, WF-005, BIZ-008 |
| OQ-EW-007 | RESOLVED | DECISION-REGISTER, DDD-009 INV-EXP-003, BR-017 |
| DEC-EW-STATE-001 | ACCEPTED | DECISION-REGISTER, DDD-012 |
| OQ-EW-DESIGN-004 | RESOLVED | READ-MODEL-COMPOSITION-DECISION, UC-018, SPEC-009 |

OQ no bloqueantes (implementación avanza con decisión provisional):
OQ-EW-002, OQ-EW-003, OQ-EW-004, OQ-EW-008, OQ-EW-009, OQ-EW-010,
OQ-EW-DESIGN-001 a OQ-EW-DESIGN-005.

---

## Grupo 0 — Trazabilidad

### T-00 Completar traceability.md
- **Descripción:** Verificar que traceability.md v0.3.5 tiene cadenas completas
  para todas las capacidades. Confirmar que GAP-002, GAP-003, GAP-007 están cerrados
  y que no quedan eslabones PENDIENTE en BR, UC o SPEC para las decisiones resueltas.
- **Criterio de done:** Ningún REQ-EW-* sin cadena completa; matrices actualizadas.
- **Fuente SDB:** OS-007, SDD-006.
- **Dependencias:** Ninguna.

---

## Grupo 1 — Dominio y puerto

### T-01 Implementar value objects de dominio
- **Descripción:** Implementar en `packages/modules/expediente/domain/value-objects/`:
  - `ExpedienteNumero` — VO con:
    - Validación del patrón RFC_BASE_10 + SEP + COD_2.
    - Catálogo de códigos aceptados: 10, 20, 30, 40, 50, 60, 70, 80, 90.
    - Método de normalización (sin separador) para búsqueda.
    - Método de presentación (con / preferente).
    - Acepta /, - o sin separador en construcción.
  - `EstadoOperativo` — enum con exactamente 6 valores:
    DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO.
    Rechaza EN_BUSQUEDA y PRESTADO explícitamente.
  - `FuenteHabilitanteSalida` — enum:
    CONSULTA_PROGRAMADA, VALE_ARCHIVO_SM_1_14, ORDEN_SUPERIOR.
  - `Custodia` — VO: custodianType, custodianReference, service, location, acceptedAt.
    acceptedAt es null cuando EN_TRASLADO sin CustodyAccepted.
  - `Ubicacion` — VO: id, codigo, descripcion.
- **Tests requeridos (Vitest):**
  - ExpedienteNumero: construir con /, -, sin sep -> misma normalización.
  - ExpedienteNumero: código fuera de catálogo -> inválido.
  - ExpedienteNumero: RFC con menos de 10 chars -> inválido.
  - EstadoOperativo: los 6 valores son válidos.
  - EstadoOperativo: EN_BUSQUEDA -> excepción.
  - EstadoOperativo: PRESTADO -> excepción.
  - FuenteHabilitanteSalida: los 3 valores son válidos.
  - Custodia: acceptedAt null cuando no aceptada.
- **Fuente SDB:** DDD-007 v0.2.0, DDD-009 INV-EXP-003/004, DDD-012 v0.2.0.
- **Dependencias:** Ninguna.

### T-02 Implementar Aggregate Expediente
- **Descripción:** `packages/modules/expediente/domain/Expediente.ts`.
  - Campos: ExpedienteId (UUID), ExpedienteNumero, PacienteReferencia (mínima),
    HospitalId, EstadoOperativo (6 valores), Ubicacion, Custodia, rowVersion.
  - Hacer cumplir INV-EXP-001, INV-EXP-002, INV-EXP-003, INV-EXP-004, INV-EXP-005.
  - No campos clínicos.
  - expedienteNumero NO es unique constraint en el aggregate.
- **Tests requeridos (Vitest):**
  - Construcción válida con todos los campos.
  - Intento de establecer EstadoOperativo = EN_BUSQUEDA -> error.
  - Intento de establecer EstadoOperativo = PRESTADO -> error.
  - No acepta campos clínicos.
- **Fuente SDB:** DDD-013 v0.2.0, DDD-009.
- **Dependencias:** T-01.

### T-03 Definir puerto ExpedienteRepository
- **Descripción:** `packages/modules/expediente/domain/ports/ExpedienteRepository.ts`.
  ```typescript
  findById(id: UUID, tenant: TenantContext): Promise<Expediente | null>
  findByNumero(numero: ExpedienteNumero, tenant: TenantContext): Promise<Expediente[]>
  // findByNumero devuelve ARRAY — puede haber 0, 1 o N coincidencias
  save(expediente: Expediente, tenant: TenantContext): Promise<void>
  ```
- **Regla:** Solo interface; sin importar Drizzle ni PostgreSQL.
- **Fuente SDB:** AGENTS.md, steering/structure.md, BR-017, INV-EXP-003.
- **Dependencias:** T-02.

---

## Grupo 2 — Aplicación

### T-04 Implementar ExpedienteCapabilityService
- **Descripción:** `packages/modules/expediente/application/ExpedienteCapabilityService.ts`.
  Calcula capabilities[] según:
  - EstadoOperativo (6 valores aceptados).
  - Estado de SolicitudActiva.
  - Estado de PrestamoActivo.
  - actor.roles, actor.permissions.
  - ActorContext y TenantContext ya validados server-side; el servicio no resuelve tenant.
  - `readonly FuenteHabilitanteSalidaContext[]` provisto por el query port aprobado.
  - Estados canónicos de Solicitud: Pendiente, Asignada, EnBusqueda, Localizada,
    Preparada, Entregada, Cancelada, NoLocalizada.
  - Estados canónicos de Préstamo: Activo, Vencido, Renovado, Devuelto, Cerrado.

  Mapeo obligatorio Capability -> Permission:
  - SOLICITAR -> REQUEST_CREATE
  - INICIAR_BUSQUEDA -> SEARCH_START
  - MARCAR_LOCALIZADO -> SEARCH_MARK_LOCATED
  - MARCAR_NO_LOCALIZADO -> SEARCH_MARK_NOT_LOCATED
  - DISPATCH -> EXPEDIENT_DISPATCH
  - ACCEPT_CUSTODY -> CUSTODY_ACCEPT
  - ABRIR_PRESTAMO -> LOAN_OPEN
  - RENOVAR_PRESTAMO -> LOAN_RENEW
  - RECIBIR_DEVOLUCION -> RETURN_RECEIVE
  - CONFIRMAR_REARCHIVO -> REARCHIVE_CONFIRM
  - REPORTAR_INCIDENCIA -> INCIDENT_OPEN
  
  Reglas de ABRIR_PRESTAMO (OQ-EW-005 RESOLVED — sin política provisional):
  - CONSULTA_PROGRAMADA: existe elemento `validada=true` + Archivo/Jefatura -> habilitada.
  - VALE_ARCHIVO_SM_1_14: existe elemento `validada=true` + ARCHIVISTA/ARCHIVO_JEFE
    con LOAN_OPEN -> habilitada. DIRECCION/COORDINACION_MEDICA emite/autoriza y no
    obtiene LOAN_OPEN por esa emisión.
  - ORDEN_SUPERIOR: fail-closed -> no incluir aunque llegue `validada=true`.
  - Puede haber 0..N fuentes; basta una habilitante validada.
  - CapabilityService no valida evidencia ni selecciona fuente; OpenLoan selecciona.
  
  Reglas de DISPATCH:
  - EstadoOperativo = APARTADO + actor es Archivo/Jefatura -> habilitada.
  
  Reglas de ACCEPT_CUSTODY:
  - EstadoOperativo = EN_TRASLADO + actor es receptor autorizado -> habilitada.
  
  Regla: ningún estado debe producir EN_BUSQUEDA ni PRESTADO como valor de EstadoOperativo.

- **Tests requeridos (Vitest):**
  - DISPONIBLE + Archivista -> SOLICITAR incluida; DISPATCH no incluida.
  - APARTADO + Archivista -> DISPATCH incluida; ABRIR_PRESTAMO no.
  - EN_TRASLADO + receptor autorizado -> ACCEPT_CUSTODY incluida.
  - CONSULTA_PROGRAMADA + Archivista -> ABRIR_PRESTAMO incluida.
  - VALE_ARCHIVO_SM_1_14 no validada + Archivista -> ABRIR_PRESTAMO NO incluida.
  - VALE_ARCHIVO_SM_1_14 validada + Archivista -> ABRIR_PRESTAMO incluida.
  - DIRECCION/COORDINACION_MEDICA emisor -> ABRIR_PRESTAMO NO incluida.
  - ORDEN_SUPERIOR -> ABRIR_PRESTAMO NO incluida.
  - Colección vacía o sólo fuentes no validadas -> ABRIR_PRESTAMO NO incluida.
  - Múltiples fuentes con al menos una habilitante validada -> incluida.
  - Sin EXPEDIENT_VIEW -> capabilities vacías.
  - AUDITOR_CONSULTA + EXPEDIENT_VIEW -> capabilities vacías.
- **Fuente SDB:** SEC-017, SDD-005, DDD-010, DDD-012 v0.2.0, PERM-MATRIX v0.2.0,
  DECISION-REGISTER OQ-EW-005, READ-MODEL-COMPOSITION-DECISION READ-EW-008..012,
  AUTH-EW-006/007.
- **Dependencias:** T-02.

### T-05 Implementar Use Case GetExpediente
- **Descripción:** `packages/modules/expediente/application/GetExpediente.ts`.
  Pasos:
  1. Recibir `{ expedienteId, context: RequestContext }` y verificar
     EXPEDIENT_VIEW mediante `context.actor` -> `ApplicationError(PERMISSION_DENIED)`.
  2. Usar exclusivamente `context.tenant`, resuelto server-side.
  3. findById(id, context.tenant) -> 404 si no existe.
  4. Consultar los puertos Application propiedad del Workspace:
     - `ActiveLoanQueryPort.findActiveByExpedienteId(id, context.tenant)` ->
       `ActiveLoanSummary | null` (0..1).
     - `ActiveRequestQueryPort.findActiveByExpedienteId(id, context.tenant)` ->
       `ActiveRequestSummary | null` (0..1).
     - `OpenIncidentsQueryPort.findOpenByExpedienteId(id, context.tenant)` ->
       `readonly OpenIncidentSummary[]` (0..N; vacío = `[]`).
     - `ExitEnablingSourceQueryPort.findAvailableByExpediente(id, context.tenant)` ->
       `readonly FuenteHabilitanteSalidaContext[]` (0..N; vacío = `[]`).
     Los summaries tienen exactamente los campos de READ-EW-003..005 y no exponen
     aggregates ajenos. `ExpedienteId` y `TenantContext` son obligatorios.
  5. ExpedienteCapabilityService.
  6. `AuditWriter.append(entry, context)` con `action=EXPEDIENTE_VIEW`,
     `resourceType=EXPEDIENTE`, resultado `success|denied|not-found`; el writer establece
     `occurredAt` y enriquece el AuditRecord sin datos C3. El controller no escribe audit.
  7. Retornar ExpedienteReadModel con capabilities[].
     Incluye `rowVersion`; no incluye `updatedAt` y no crea un port para obtenerlo.
- **Tests requeridos (Vitest):**
  - Actor autorizado + expediente existente -> read model completo.
  - Actor sin EXPEDIENT_VIEW -> 403; no loguear datos del expediente en error.
  - Expediente inexistente -> 404; audit registra intento.
  - Tenant-A no obtiene expediente de Tenant-B (INV-EXP-003 verificación).
  - estadoOperativo en respuesta es uno de los 6 valores válidos.
  - Ausencia de préstamo/solicitud -> ambos `null`; ausencia de incidencias -> `[]`.
  - Cada query port recibe el mismo ExpedienteId y TenantContext server-side.
  - El input público es `{ expedienteId, context }`; fuentes se consultan dentro.
  - AuditWriter recibe el mismo RequestContext y requestId/correlationId no se sustituyen.
  - Los intentos success/denied/not-found escriben audit sin datos C3.
  - Falta de permission usa `PERMISSION_DENIED`, nunca
    `INSUFFICIENT_ENABLING_SOURCE`.
  - ID existente sólo en otro tenant produce `EXPEDIENTE_NOT_FOUND` sin divulgación.
  - Read model no contiene `updatedAt` y conserva `rowVersion`.
- **Fuente SDB:** UC-018 v0.2.0, SPEC-009 v0.2.0, SEC-017, SEC-032, SEC-038,
  DAT-012, READ-MODEL-COMPOSITION-DECISION.
- **Dependencias:** T-03, T-04.

### T-06 Implementar Use Case GetExpedienteTimeline
- **Descripción:** `packages/modules/expediente/application/GetExpedienteTimeline.ts`.
  - Input auditable: `{ expedienteId, limit, context: RequestContext }`.
  - Carga MovimientoExpediente[] (DAT-011) por expediente_id; occurred_at DESC.
  - Paginación con limit (cursor-based o offset según OQ-EW-DESIGN-003; usar limit mínimo).
  - NO mezcla con audit_log.
  - `AuditWriter.append(AuditEntry, context)`; el writer enriquece y establece occurredAt.
- **Tests requeridos (Vitest):**
  - Actor autorizado -> lista de movimientos ordenada.
  - Incluye movement_type DISPATCHED y CUSTODY_ACCEPTED cuando existen.
  - Cross-tenant -> sin movimientos de otro tenant.
  - Resultado no contiene filas de audit_log.
- **Fuente SDB:** DDD-020, DAT-011, SPEC-009 FR-VIEW-007, INT-008.
- **Dependencias:** T-03.

### T-07 Implementar Use Case DispatchExpediente
- **Descripción:** `packages/modules/expediente/application/DispatchExpediente.ts`.
  - Input: `{ expedienteId, destinoRef, rowVersion, context: RequestContext }`.
  Pasos:
  1. Verificar permiso EXPEDIENT_DISPATCH en tenant.
  2. findById con rowVersion -> 409 si conflicto.
  3. Validar EstadoOperativo = APARTADO -> 409 si no.
  4. EstadoOperativo -> EN_TRASLADO.
  5. custody_accepted_at -> null.
  6. save con rowVersion+1.
  7. INSERT MovimientoExpediente (movement_type = DISPATCHED).
  8. `AuditWriter.append(AuditEntry, context)`.
- **Tests requeridos (Vitest):**
  - APARTADO -> EN_TRASLADO exitoso.
  - EstadoOperativo != APARTADO -> 409.
  - rowVersion incorrecto -> 409.
  - custody_accepted_at = null tras dispatch.
  - Cross-tenant -> rechazado.
- **Fuente SDB:** DDD-010, DDD-011, WF-005 v0.2.0, DAT-019,
  DECISION-REGISTER OQ-EW-006.
- **Dependencias:** T-03, T-04.

### T-08 Implementar Use Case AcceptCustody
- **Descripción:** `packages/modules/expediente/application/AcceptCustody.ts`.
  - Input: `{ expedienteId, receptorRef, ubicacionDestino, rowVersion, context: RequestContext }`.
  Pasos:
  1. Verificar permiso CUSTODY_ACCEPT en tenant (actor = receptor autorizado).
  2. findById con rowVersion -> 409 si conflicto.
  3. Validar EstadoOperativo = EN_TRASLADO -> 409 si no.
  4. EstadoOperativo -> EN_CONSULTA.
  5. custody_accepted_at -> now().
  6. custodio_ref -> receptorRef.
  7. save con rowVersion+1.
  8. INSERT MovimientoExpediente (movement_type = CUSTODY_ACCEPTED).
  9. `AuditWriter.append(AuditEntry, context)` (acción autenticada y auditable).
- **Tests requeridos (Vitest):**
  - EN_TRASLADO -> EN_CONSULTA exitoso.
  - EstadoOperativo != EN_TRASLADO -> 409.
  - rowVersion incorrecto -> 409.
  - custody_accepted_at establecido con timestamp.
  - Actor no autorizado -> 403.
  - Cross-tenant -> rechazado.
- **Fuente SDB:** DDD-018 v0.2.0, WF-005 v0.2.0 Fase 3, DAT-019,
  DECISION-REGISTER OQ-EW-006.
- **Dependencias:** T-03, T-04.

---

## Grupo 3 — Infraestructura / Persistencia

### T-09 Implementar PostgresExpedienteRepository
- **Descripción:** `packages/platform/persistence/PostgresExpedienteRepository.ts`.
  - findById: query por id + tenant; retorna Expediente | null.
  - findByNumero: query por expediente_numero_normalizado + tenant;
    retorna Expediente[] (0..N). NO retorna escalar.
  - save: UPDATE con rowVersion check; 409 si conflicto.
  - Sin lógica de negocio en el adapter.
- **Tests requeridos (Vitest + PostgreSQL real):**
  - findByNumero con / -> normaliza y encuentra.
  - findByNumero con - -> normaliza y encuentra el mismo.
  - findByNumero sin sep -> normaliza y encuentra el mismo.
  - findByNumero con número que tiene 2 derechohabientes -> retorna array de 2.
  - Tenant-A no ve expediente de Tenant-B.
  - save con rowVersion incorrecto -> error de concurrencia.
- **Fuente SDB:** DAT-006 v0.2.0, DAT-016 v0.2.0, SEC-032, AGENTS.md.
- **Dependencias:** T-03, T-10 (migración de esquema).

### T-10 Migración de esquema
- **Descripción:** Migración para tablas `expediente` y `movimientos_expediente`.
  - expediente: incluir expediente_numero_normalizado varchar; estado_operativo CHECK
    con exactamente los 6 valores de DEC-EW-STATE-001; custody_accepted_at timestamptz null;
    row_version bigint NOT NULL DEFAULT 0.
  - NO crear UNIQUE(expediente_numero, hospital_id) sin profiling de SIMEF (BR-017).
  - INDEX ON expediente (expediente_numero_normalizado).
  - movimientos_expediente: incluir movement_type que admita DISPATCHED, CUSTODY_ACCEPTED.
  - Sin datos clínicos en ninguna tabla.
- **Regla (AGENTS.md):** Todo cambio de schema requiere migración.
- **Fuente SDB:** DAT-006 v0.2.0, DDD-012 v0.2.0, BR-017, INV-EXP-003.
- **Dependencias:** T-03.

---

## Grupo 4 — API / Controller

### T-11 Implementar ExpedienteController
- **Descripción:** `apps/api/src/expediente/ExpedienteController.ts`.
  Endpoints:
  - GET /api/v1/expedientes/:id -> GetExpediente.
  - GET /api/v1/expedientes?numero= -> findByNumero; retorna colección {data[], total}.
    Normaliza el parámetro antes de llamar al use case.
  - GET /api/v1/expedientes/:id/timeline -> GetExpedienteTimeline.
  - GET /api/v1/expedientes/:id/current-custody -> sub-recurso de custodia.
  - GET /api/v1/expedientes/:id/active-loan -> sub-recurso de préstamo activo.
  - POST /api/v1/expedientes/:id/dispatch -> DispatchExpediente.
  - POST /api/v1/expedientes/:id/accept-custody -> AcceptCustody.
  - POST /api/v1/expedientes/:id/rearchive -> ConfirmRearchive.
  - El controller NO escribe repositorios directamente.
  - La frontera server-side construye un único `RequestContext` (`WEB`) por request y lo
    entrega a los Use Cases; body/query no aportan actor, tenant ni IDs de trazabilidad.
  - Errores: RFC7807; sin stack trace, sin nombre DB, sin datos clínicos.
  - Mapear `ApplicationError.code` según ERR-EW-002; `code` es extensión estable.
    Cross-tenant usa 404 `EXPEDIENTE_NOT_FOUND`, nunca un code público específico.
- **Tests requeridos (contract):**
  - GET ?numero= con N=0 -> 200 {data:[], total:0}.
  - GET ?numero= con N=1 -> 200 {data:[...], total:1}.
  - GET ?numero= con N=2 -> 200 {data:[...,...], total:2}.
  - GET /:id con id inexistente -> 404.
  - GET /:id sin token -> 403.
  - POST /dispatch con rowVersion incorrecto -> 409.
  - POST /dispatch con estado incorrecto -> 409.
  - Tenant isolation: Hospital-A no accede a Hospital-B -> 404.
- **Fuente SDB:** API-001, API-005, API-006, API-011 v0.2.0, AGENTS.md.
- **Dependencias:** T-05, T-06, T-07, T-08.

### T-12 Actualizar contrato OpenAPI
- **Descripción:** Actualizar `openapi/` para reflejar T-11:
  - Schema ExpedienteSearchResponse: {data: ExpedienteListItem[], total: integer}.
  - Schema ExpedienteReadModel: estadoOperativo como enum de 6 valores exactos;
    custodiaActual.aceptadaEn nullable; prestamoActivo.fuenteHabilitante como enum.
  - Endpoints /dispatch y /accept-custody.
  - Errores 403 con code INSUFFICIENT_ENABLING_SOURCE.
- **Regla (AGENTS.md, steering/api.md):** Todo cambio de API requiere actualizar OpenAPI.
- **Fuente SDB:** API-001, API-011 v0.2.0.
- **Dependencias:** T-11.

---

## Grupo 5 — Frontend

### T-13 Implementar feature module — estructura y hooks
- **Descripción:** Crear estructura de `apps/web/src/features/expediente-workspace/`
  definida en design.md §6.
  - `useExpedienteSearch`: normaliza separadores del input antes de llamar al API;
    retorna {data[], total, isDisambiguating: total > 1}.
  - `useExpediente`: fetch + cache; invalida en 409.
  - `useExpedienteTimeline`: fetch paginado DAT-011.
  - `useCapabilities`: derivado del read model; no calcula dominio.
  - Tipos derivados del OpenAPI contract generado.
- **Fuente SDB:** DEL-002, INT-001.
- **Dependencias:** T-12.

### T-14 Implementar ExpedienteHeader
- **Descripción:** Renderiza el bloque above the fold.
  - Número de expediente en formato con / (presentación preferente).
  - Referencia mínima de paciente (OQ-EW-002 no bloqueante; usar campo disponible).
  - Badge de EstadoOperativo — exactamente 6 valores; EN_BUSQUEDA y PRESTADO
    nunca deben aparecer como badge del expediente.
  - Ubicación actual.
  - Custodio actual: mostrar acceptedAt si EN_CONSULTA; omitir o mostrar null si EN_TRASLADO.
  - Indicadores: préstamo activo, incidencias abiertas.
  - Datos C3 no en document.title ni atributos visibles al scraper.
  - Estados: loading (skeleton), loaded, empty.
- **Tests requeridos (Vitest + Testing Library):**
  - Render con cada uno de los 6 EstadoOperativo -> badge correcto.
  - EN_BUSQUEDA pasado como estado -> no se renderiza (o error).
  - EN_TRASLADO: acceptedAt no visible.
  - EN_CONSULTA: acceptedAt visible.
  - Loading: skeleton visible.
  - Sin datos clínicos en el DOM.
- **Fuente SDB:** APP-003 v0.2.0, IA-005, INT-009, SEC-003, DEL-005.
- **Dependencias:** T-13.

### T-15 Implementar DisambiguationList
- **Descripción:** Componente de selección cuando useExpedienteSearch.isDisambiguating = true.
  - Muestra lista con: expedienteNumero, nombre, CURP, número ISSSTE.
  - Usuario selecciona manualmente; NO hay auto-selección.
  - Navegación por teclado; foco visible.
- **Tests requeridos (Vitest + Testing Library):**
  - Con N=2 resultados -> muestra lista, ninguno auto-seleccionado.
  - Con N=0 -> estado vacío descriptivo (no este componente).
  - Con N=1 -> no muestra lista (hook navega directo).
  - Selección manual -> navega al workspace del expediente elegido.
- **Fuente SDB:** APP-003 v0.2.0, SPEC-009 v0.2.0 FR-VIEW-001, BIZ-016/017.
- **Dependencias:** T-13.

### T-16 Implementar CommandBar
- **Descripción:** Renderiza capabilities[].
  - Comando presente -> botón habilitado.
  - Comando ausente -> no se renderiza.
  - Navegación por teclado (Enter/Space); foco visible.
  - Deshabilita durante vuelo de petición para evitar doble-click.
- **Tests requeridos (Vitest + Testing Library):**
  - capabilities=['SOLICITAR'] -> solo botón Solicitar.
  - capabilities=[] -> ningún botón.
  - capabilities=['DISPATCH'] -> botón Despachar visible.
  - capabilities=['ABRIR_PRESTAMO'] -> botón Abrir Préstamo visible.
  - Teclado: Tab y Enter activan comando.
- **Fuente SDB:** DS-014, INT-001, INT-003, DEL-005.
- **Dependencias:** T-13.

### T-17 Implementar tabs del Workspace
- **Descripción:** Los 6 tabs de design.md §5.2.
  - ResumenTab: estado expandido; custodia con/sin acceptedAt; préstamo con FuenteHabilitante.
  - MovimientosTab: timeline MovimientoExpediente; incluye DISPATCHED y CUSTODY_ACCEPTED;
    paginado; no mezcla audit.
  - SolicitudesTab, PrestamosTab, IncidenciasTab: listados; scope = solo listado.
  - AuditoriaTab: sujeto al permiso pendiente OQ-EW-003, fuera de capabilities operativas.
- **Tests requeridos:**
  - ResumenTab: muestra acceptedAt solo si EN_CONSULTA.
  - MovimientosTab: muestra DISPATCHED y CUSTODY_ACCEPTED; no muestra login/config.
  - AuditoriaTab: oculto sin el permiso de auditoría que defina OQ-EW-003.
  - Cada tab: loading/empty/error states.
- **Fuente SDB:** APP-003 v0.2.0, INT-008, TQ-009.
- **Dependencias:** T-14, T-16.

### T-18 Implementar manejo de concurrencia en UI
- **Descripción:** Estado conflict (409 optimistic lock).
  - Banner persistente al recibir 409 de cualquier comando.
  - Botón Recargar; preservar datos previos en pantalla.
  - Al recargar: invalidar cache; recalcular capabilities.
  - No sobreescribir silenciosamente.
- **Tests requeridos:**
  - Simular 409 -> banner aparece; datos anteriores visibles.
  - Botón Recargar -> invalida cache y recarga.
- **Fuente SDB:** DAT-019, INT-006, API-006.
- **Dependencias:** T-14, T-16, T-17.

---

## Grupo 6 — Seguridad, aislamiento y audit

### T-19 Tests de autorización y tenant isolation
- **Descripción:**
  - Sin EXPEDIENT_VIEW -> UC lanza error; controller 403.
  - Tenant-A solicita expediente Tenant-B -> 404.
  - Token forjado / tenant forjado en body -> rechazado.
  - VALE_ARCHIVO_SM_1_14 no validada + Archivista -> 403.
  - DIRECCION/COORDINACION_MEDICA emisor sin LOAN_OPEN -> no ejecuta OpenLoan.
  - AuditoriaTab sin permiso (OQ-EW-003) -> no retorna datos.
  - Dispatch sin permiso EXPEDIENT_DISPATCH -> 403.
  - AcceptCustody sin permiso CUSTODY_ACCEPT o por actor no receptor -> 403.
- **Fuente SDB:** SEC-017, SEC-032, TQ-007, AGENTS.md,
  DECISION-REGISTER OQ-EW-005, OQ-EW-006.
- **Dependencias:** T-05, T-07, T-08, T-11.

### T-20 Verificar audit trail completo
- **Descripción:** Confirmar INSERT en audit_log para:
  - GET /expedientes/{id} -> EXPEDIENTE_VIEW.
  - POST /dispatch -> EXPEDIENTE_DISPATCHED.
  - POST /accept-custody -> CUSTODY_ACCEPTED.
  - Intento sin autorización -> intento fallido registrado.
  - Verificar que audit_log no contiene datos C3 en campos de log.
- **Tests requeridos (integration):** Verificar inserción tras cada operación.
- **Fuente SDB:** SEC-038, DAT-012, AGENTS.md.
- **Dependencias:** T-05, T-07, T-08, T-11.

---

## Grupo 7 — E2E y calidad final

### T-21 Tests de integración PostgreSQL
- **Descripción:**
  - findByNumero: PERR810604/10, PERR810604-10, PERR81060410 -> misma normalización.
  - findByNumero con número que tiene 2 coincidencias -> array de 2.
  - findByNumero con número inexistente -> array vacío.
  - row_version en optimistic locking.
  - Tenant isolation en queries.
- **Fuente SDB:** TQ-005, TQ-007, steering/testing.md.
- **Dependencias:** T-09, T-10.

### T-22 Tests E2E Playwright
- **Descripción:** Escenarios mínimos (TQ-010 v0.2.0 + nuevos):
  1. Archivista busca PERR810604/10 -> workspace abre directamente.
  2. Archivista busca PERR810604-10 -> misma normalización, mismo expediente.
  3. Búsqueda con N=2 -> lista de desambiguación; sin auto-selección.
  4. Búsqueda con N=0 -> estado vacío.
  5. Expediente DISPONIBLE -> badge correcto; EN_BUSQUEDA NO aparece como badge.
  6. Dispatch -> EstadoOperativo cambia a EN_TRASLADO; acceptedAt null.
  7. AcceptCustody -> EstadoOperativo cambia a EN_CONSULTA; acceptedAt visible.
  8. CommandBar con CONSULTA_PROGRAMADA + Archivista -> ABRIR_PRESTAMO disponible.
  9. CommandBar con VALE_ARCHIVO_SM_1_14 validada + Archivista con LOAN_OPEN -> ABRIR_PRESTAMO disponible; no validada -> ausente.
  10. Conflicto 409 -> banner de conflicto visible; datos preservados.
  11. Tab Auditoría oculto sin permiso; visible con permiso.
  12. Navegación completa por teclado.
- **Fuente SDB:** TQ-010 v0.2.0, DEL-005, Volume-09 §07.
- **Dependencias:** T-17, T-18, T-19.

### T-23 Ejecutar pipeline CI y quality gates
- **Descripción:** Pipeline completo y verificar:
  - Build sin errores.
  - Todos los tests pasan.
  - Sin violaciones de lint/type-check.
  - Sin datos C3 en logs de test.
  - Todos los ítems del READY-GATE.md marcados.
  - AC-EW-001 a AC-EW-017 cubiertas.
- **Fuente SDB:** TQ-017, OS-018.
- **Dependencias:** Todas las tareas anteriores.

---

## Resumen de dependencias

```
T-00 (trazabilidad) -- independiente

T-01 (VOs)
  T-02 (aggregate)
    T-03 (port)
      T-07 (DispatchExpediente UC) --|
      T-08 (AcceptCustody UC) -------|
      T-09 (adapter) <- T-10 (migración)
      T-06 (timeline UC)
      T-04 (capabilities) <- T-05 (GetExpediente UC)
        T-11 (controller) <- T-12 (OpenAPI)
          T-13 (FE estructura)
            T-14 (Header)
            T-15 (DisambiguationList)
            T-16 (CommandBar)
              T-17 (Tabs)
                T-18 (Concurrency UX)

T-19 (auth/tenant tests) <- T-05, T-07, T-08, T-11
T-20 (audit trail) <- T-05, T-07, T-08, T-11
T-21 (integration PG) <- T-09, T-10
T-22 (E2E) <- T-17, T-18, T-19
T-23 (CI pipeline) <- todas
```

---

## Notas de implementación

- T-01 ya tiene las decisiones de OQ-EW-001 y DEC-EW-STATE-001 para implementar
  directamente. No hay TODO provisional para esas decisiones.
- T-04 ya tiene la lógica de FuenteHabilitanteSalida para implementar directamente
  (OQ-EW-005 RESOLVED). No hay política conservadora temporal.
- T-07 y T-08 implementan los nuevos comandos de despacho y aceptación de custodia
  (OQ-EW-006 RESOLVED).
- T-09 devuelve array en findByNumero (nunca escalar). OQ-EW-007 RESOLVED.
- Las OQ no bloqueantes (OQ-EW-002..004, OQ-EW-008..010) tienen decisiones provisionales
  documentadas en requirements.md §6; implementar con esas provisiones.
- Ninguna tarea debe inventar comportamiento fuera del SDB o las decisiones resueltas.

---

## Implementation Readiness

```yaml
spec_version: "0.3.5"
blocking_open_questions: []
non_blocking_open_questions:
  - OQ-EW-002
  - OQ-EW-003
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
  - OQ-EW-DESIGN-001
  - OQ-EW-DESIGN-002
  - OQ-EW-DESIGN-003
  - OQ-EW-DESIGN-005
contradictions_found: []
implementation_ready: true
```
