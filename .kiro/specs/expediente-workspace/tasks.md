---
spec: expediente-workspace
version: "0.3.23"
status: "Draft — pending stakeholder validation"
date: "2026-08-15"
requires:
  - requirements.md (v0.3.23)
  - design.md (v0.3.23)
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
  - "TL-EW-001..017 APPROVED"
  - "OQ-EW-DESIGN-003 RESOLVED"
  - "OQ-DOM-001 RESOLVED"
  - "DISPATCH-DECISION DSP-EW-001..011 APPROVED; DSP-GAP-001/002 CLOSED"
  - "DOM-EVENT-001 APPROVED"
  - "AUD-EW-010..013 APPROVED"
  - "DSP-EW-014..016 APPROVED"
  - "CST-EW-001..010 APPROVED; CST-GAP-001/002 CLOSED"
  - "POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014 APPROVED"
  - "TENANT-TRANSACTION-AUDIT-DECISION TX-EW-001..012 APPROVED"
  - "AUDIT-PHYSICAL-MODEL-DECISION AUD-DB-EW-001..013 APPROVED; AUD-DB-GAP CLOSED"
  - "HTTP-REQUEST-CONTEXT-DECISION HTTP-EW-001, API-BIGINT-001, API-EW-021 APPROVED"
  - "HTTP-COMMAND-CONTRACT-DECISION API-EW-024..026, API-EW-030 APPROVED"
  - "EXPEDIENT-SEARCH-DECISION SEARCH-EW-001..010 APPROVED"
  - "EXPEDIENT-AUDIT-AND-COMMAND-UX-DECISION APPROVED"
  - "OQ-EW-003 RESOLVED"
  - "LOC-AUTH-001..010 APPROVED; LOCATION-PERMISSION-GAP CLOSED"
  - "AUD-PAGE-EW-001/002 APPROVED"
  - "AUTH-UI-EW-001..005 APPROVED"
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
| OQ-EW-003 | RESOLVED | EXPEDIENT-AUDIT-AND-COMMAND-UX-DECISION, SDD-005, SEC-017 |

OQ no bloqueantes (implementación avanza con decisión provisional):
OQ-EW-002, OQ-EW-004, OQ-EW-008, OQ-EW-009, OQ-EW-010,
OQ-EW-DESIGN-001, OQ-EW-DESIGN-002 y OQ-EW-DESIGN-005.

`LOCATION-PERMISSION-GAP` está CLOSED mediante `LOCATION_VIEW`; T-21A puede avanzar.

---

## Grupo 0 — Trazabilidad

### T-00 Completar traceability.md
- **Descripción:** Verificar que traceability.md v0.3.23 tiene cadenas completas
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
  - Input: `{ expedienteId, pagination: { cursor?: string; limit: number }, context: RequestContext }`.
  - Define/consume `ExpedienteTimelineQueryPort.findByExpediente(expedienteId,
    pagination, context.tenant): Promise<TimelinePage>` en Application de Archive Operations.
  - `TimelinePage = { items: readonly MovimientoExpedienteSummary[];
    nextCursor: string | null }`; ausencia `[]/null`, sin total.
  - Cursor opaco conceptual `occurredAt + movimientoId`; orden canónico
    `occurredAt DESC, movimientoId DESC`. El Use Case no interpreta el encoding.
  - Summary exacto DAT-011/TL-EW-006; sin datos clínicos.
  - Requiere EXPEDIENT_VIEW; cross-tenant usa EXPEDIENTE_NOT_FOUND sin divulgación.
  - Dependencias: `ExpedienteRepository`, `ExpedienteTimelineQueryPort`, `AuditWriter`
    y `RequestContext`.
  - Autorizar antes de queries. Sin permiso: audit
    `EXPEDIENTE_TIMELINE_VIEW/EXPEDIENTE/denied` y `PERMISSION_DENIED`.
  - Comprobar después `ExpedienteRepository.findById(id, context.tenant)`. Null: audit
    `not-found`, `EXPEDIENTE_NOT_FOUND` y no invocar timeline port.
  - Página vacía o no vacía: audit `success`; resourceId = expedienteId.
  - NO mezcla con audit_log.
  - `AuditWriter.append(AuditEntry, context)`; el writer enriquece y establece occurredAt.
  - No elimina movimientos ni decide retención; OQ-EW-010 permanece abierta.
- **Tests requeridos (Vitest):**
  - Actor autorizado -> lista de movimientos ordenada.
  - Incluye movement_type DISPATCHED y CUSTODY_ACCEPTED cuando existen.
  - Cross-tenant -> sin movimientos de otro tenant.
  - Resultado no contiene filas de audit_log.
  - Cursor se propaga opaco; ausencia -> items [] y nextCursor null; no total.
  - Audit separado y mismo RequestContext.
  - Autorización precede a Repository y query port.
  - Expediente inexistente no consulta timeline; página vacía existente sí es success.
  - Audit no crea MovimientoExpediente.
- **Fuente SDB:** DDD-020, DAT-011, SPEC-009 FR-VIEW-007, INT-008.
- **Dependencias:** T-03.

### T-07 Implementar Use Case DispatchExpediente
- **Descripción:** `packages/modules/expediente/application/DispatchExpediente.ts`.
  - Input: `{ expedienteId, destination: Ubicacion,
    intendedCustodian: {type:string,reference:string},
    businessReference: {type:string,id:string|null}, expectedRowVersion: bigint,
    context: RequestContext }`.
  Pasos:
  1. Verificar permiso EXPEDIENT_DISPATCH en tenant.
  2. findById con rowVersion -> 409 si conflicto.
  3. Validar EstadoOperativo = APARTADO -> 409 si no.
  4. EstadoOperativo -> EN_TRASLADO.
     Invocar `Expediente.dispatch` con
     `occurredAt: transaction.operationOccurredAt` (DOM-EVENT-001).
  5. custodio_accepted_at -> null.
  6. save con rowVersion+1.
  7. Append MovimientoExpediente (movement_type = DISPATCHED) mediante writer.
  8. UoW: save + movimiento + audit `EXPEDIENTE_DISPATCH` success, ALL OR NOTHING.
  9. Denied/not-found fuera de la transacción mutante. Ante optimistic conflict,
     rollback completo y audit `conflict` fuera de la UoW fallida; sin aggregate ni
     Movimiento persistidos.
  10. Ante estado incompatible, rollback completo; audit `invalid-transition` fuera de
      la UoW y `ApplicationError(REQUEST_INVALID_TRANSITION)`. No reutilizar `conflict`.
- **Tests requeridos (Vitest):**
  - APARTADO -> EN_TRASLADO exitoso.
  - EstadoOperativo != APARTADO -> 409.
  - Estado incompatible -> audit `invalid-transition`, sin persistencia parcial.
  - rowVersion incorrecto -> 409.
  - custodio_accepted_at = null tras dispatch.
  - intendedCustodian type/reference obligatorios/no vacíos; Custodia resultante conserva
    ambos y deja service/location/acceptedAt null, sin derivarlos de destination.
  - `DomainEvent.occurredAt`, Movimiento.occurredAt y operationOccurredAt son el mismo
    instante; el aggregate no genera timestamps.
  - Evento conserva intendedCustodian type/reference; Movimiento DISPATCHED usa
    destinationCustodianRef = intendedCustodian.reference, sin añadir type.
  - Cross-tenant -> rechazado.
- **Fuente SDB:** DDD-010, DDD-011, WF-005 v0.2.0, DAT-019,
  DECISION-REGISTER OQ-EW-006.
- **Dependencias:** T-03, T-04.

### T-08 Implementar Use Case AcceptCustody
- **Descripción:** `packages/modules/expediente/application/AcceptCustody.ts`.
  - Input: `{ expedienteId, receptor: {type,reference,service},
    ubicacionDestino: Ubicacion, businessReference: {type,id}, expectedRowVersion,
    context: RequestContext }`.
  Pasos:
  1. Verificar permiso CUSTODY_ACCEPT en tenant (actor = receptor autorizado).
  2. findById con rowVersion -> 409 si conflicto.
  3. Validar EN_TRASLADO, Custodia no aceptada y ubicación coincidente -> 409 si no.
  4. EstadoOperativo -> EN_CONSULTA.
  5. custodio_accepted_at -> transaction.operationOccurredAt.
  6. Custodia efectiva desde receptor; location -> ubicacionDestino.id.
  7. save con rowVersion+1.
  8. INSERT MovimientoExpediente (movement_type = CUSTODY_ACCEPTED).
  9. `AuditWriter.append(AuditEntry, context)` (acción autenticada y auditable).
  10. Movimiento toma businessReference del input; audit usa
      `CUSTODY_ACCEPTED/EXPEDIENTE/expedienteId` y los cinco resultados canónicos.
- **Tests requeridos (Vitest):**
  - EN_TRASLADO -> EN_CONSULTA exitoso.
  - EstadoOperativo != EN_TRASLADO -> 409.
  - rowVersion incorrecto -> 409.
  - custodio_accepted_at establecido con timestamp.
  - receptor efectivo puede diferir del previsto; ubicación usa ID del VO.
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
  - Opera en la database resuelta por TenantContext; no filtra ni persiste hospital_id.
  - Join `expedientes.ubicacion_actual_id -> ubicaciones.id` para rehidratar
    `Ubicacion {id,codigo,descripcion}`.
  - Rehidrata las cuatro columnas de PacienteReferencia, las cinco de Custodia y
    rowVersion como bigint; HospitalId procede de TenantContext.
  - Implementa/reutiliza `TenantDatabaseRouter` en platform/database: sólo TenantContext
    validado, pools allow-listed, sin tipos DB hacia Application.
  - Implementa `PostgresArchiveOperationsUnitOfWork` sobre una única transaction tenant.
    Repository, MovimientoWriter y AuditWriter transaction-bound comparten el handle;
    operationOccurredAt se crea una vez.
  - Security / Audit proporciona el binder de AuditWriter; Archive Operations no
    ejecuta SQL directo contra audit_log. Audits de fallo usan transaction standalone.
  - Sin lógica de negocio en el adapter.
- **Tests requeridos (Vitest + PostgreSQL real):**
  - findByNumero con / -> normaliza y encuentra.
  - findByNumero con - -> normaliza y encuentra el mismo.
  - findByNumero sin sep -> normaliza y encuentra el mismo.
  - findByNumero con número que tiene 2 derechohabientes -> retorna array de 2.
  - Tenant-A no ve expediente de Tenant-B.
  - save con rowVersion incorrecto -> error de concurrencia.
- **Fuente SDB:** DAT-006 v0.2.0, DAT-016 v0.2.0, SEC-032, AGENTS.md,
  POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014,
  TENANT-TRANSACTION-AUDIT-DECISION TX-EW-001..012,
  AUDIT-PHYSICAL-MODEL-DECISION AUD-DB-EW-001..013, DAT-012, DAT-020.
- **Dependencias:** T-03, T-10 (migración de esquema).
- **Readiness:** `AUD-DB-GAP` CLOSED; la migration tenant posterior de audit_log y su
  adapter pertenecen a Security / Audit.

### T-10 Migración de esquema
- **Descripción:** Migración para tablas `expediente` y `movimientos_expediente`.
  - Nombres definitivos: `ubicaciones`, `expedientes`, `movimientos_expediente`.
  - Aplicar exactamente el DDL conceptual DB-EW-012: cuatro columnas TEXT NOT NULL de
    PacienteReferencia; cinco columnas inline nullable de Custodia; sin hospital_id.
  - `row_version BIGINT NOT NULL DEFAULT 0`; Drizzle no usa mode number.
  - `expediente_numero` NO UNIQUE e índice btree no unique exclusivamente sobre
    `expediente_numero_normalizado`.
  - CHECK exacto de seis EstadoOperativo; `source` CHECK WEB/INTERNAL; movement_type y
    business_reference_type sin CHECK.
  - Movimiento usa `business_reference_id TEXT NULL` y `correlation_id TEXT NULL`.
  - FKs únicamente según DB-EW-011; recorded_at usa default CURRENT_TIMESTAMP.
  - Sin datos clínicos en ninguna tabla.
- **Regla (AGENTS.md):** Todo cambio de schema requiere migración.
- **Fuente SDB:** DAT-006 v0.2.0, DAT-011, DDD-012 v0.2.0, BR-017, INV-EXP-003,
  POSTGRES-PHYSICAL-MODEL-DECISION DB-EW-001..014.
- **Dependencias:** T-03.

---

## Grupo 4 — API / Controller

### T-11 Implementar ExpedienteController
- **Descripción:** `apps/api/src/expediente/ExpedienteController.ts`.
  Endpoints:
  - GET /api/v1/expedientes/:id -> GetExpediente.
  - GET /api/v1/expedientes/:id/timeline -> GetExpedienteTimeline.
  - POST /api/v1/expedientes/:id/dispatch -> DispatchExpediente.
  - POST /api/v1/expedientes/:id/accept-custody -> AcceptCustody.
  - Scope base completado: búsqueda por número se añade únicamente mediante T-12A;
    current-custody, active-loan y rearchive siguen diferidos hasta contar con Use Case.
  - El controller NO escribe repositorios directamente.
  - Un resolver de infraestructura autenticado construye un único `RequestContext`
    (`WEB`) por request. Tenant trusted/allow-listed debe pertenecer a actor.tenantIds;
    body/query no aportan actor, tenant ni IDs de trazabilidad.
  - requestId siempre existe; correlationId sólo se propaga de fuente trusted o se
    genera, y nunca reutiliza requestId.
  - rowVersion y expectedRowVersion cruzan HTTP como string decimal `^[0-9]+$`; la
    frontera convierte a/desde bigint sin JavaScript number.
  - Dispatch y AcceptCustody success -> 204 No Content; no serializar DomainEvent.
  - UUID/body/bigint inválidos -> 400 `HTTP_VALIDATION_ERROR`; errors opcional sólo
    expone field y `REQUIRED|INVALID_FORMAT|INVALID_TYPE|OUT_OF_RANGE`.
  - Implementar módulo NestJS configurable con resolver y cuatro Use Cases construidos.
    Tests pueden registrar fakes explícitos; AppModule productivo no registra fakes ni
    monta el módulo hasta que composition/integration aporte dependencias reales.
  - Errores: RFC7807; sin stack trace, sin nombre DB, sin datos clínicos.
  - Mapear `ApplicationError.code` según ERR-EW-002; `code` es extensión estable.
    Cross-tenant usa 404 `EXPEDIENTE_NOT_FOUND`, nunca un code público específico.
- **Tests requeridos (contract):**
  - GET /:id success con rowVersion string decimal.
  - Timeline vacío y con nextCursor opaco.
  - GET /:id con id inexistente -> 404.
  - GET /:id sin autenticación -> 401 AUTHENTICATION_REQUIRED.
  - GET /:id autenticado sin permission -> 403 PERMISSION_DENIED.
  - POST /dispatch con rowVersion incorrecto -> 409.
  - POST /dispatch con estado incorrecto -> 409.
  - POST /accept-custody success/conflict/invalid-transition.
  - Dispatch success -> 204 y body vacío.
  - AcceptCustody success -> 204 y body vacío.
  - UUID inválido, bigint inválido y campo requerido ausente -> 400
    `HTTP_VALIDATION_ERROR`; Problem Details no contiene el valor recibido.
  - El módulo configurable acepta providers de test explícitos y AppModule productivo
    no registra fake auth/projections.
  - RequestContext se propaga y body/query no pueden falsificar tenant ni trazabilidad.
  - Tenant isolation: Hospital-A no accede a Hospital-B -> 404.
- **Fuente SDB:** API-001, API-005, API-006, API-011 v0.2.0, AGENTS.md.
- **Dependencias:** T-05, T-06, T-07, T-08.

### T-12 Actualizar contrato OpenAPI
- **Descripción:** Actualizar `openapi/` para reflejar T-11:
  - Schema ExpedienteReadModel: estadoOperativo como enum de 6 valores exactos;
    custodiaActual.aceptadaEn nullable; prestamoActivo.fuenteHabilitante como enum.
  - Endpoints /dispatch y /accept-custody.
  - Success 204 sin response content para ambos commands.
  - Timeline `{items,nextCursor}`, sin total.
  - rowVersion/expectedRowVersion string decimal `^[0-9]+$`.
  - RFC7807: 401 AUTHENTICATION_REQUIRED; 403 PERMISSION_DENIED o
    INSUFFICIENT_ENABLING_SOURCE; 404 y 409 canónicos.
  - 400 `HTTP_VALIDATION_ERROR` con errors opcional y field codes cerrados.
  - En T-12 base no publicar endpoints sin Use Case; la búsqueda se incorpora después
    mediante T-12A. current-custody, active-loan y rearchive continúan diferidos.
- **Regla (AGENTS.md, steering/api.md):** Todo cambio de API requiere actualizar OpenAPI.
- **Fuente SDB:** API-001, API-011 v0.2.0.
- **Dependencias:** T-11.

### T-12A Implementar búsqueda canónica por número y sincronizar boundaries
- **Descripción:** Extensión trazable sin renumerar tasks completadas. Ejecutar en orden:
  1. Application: implementar `SearchExpedientesByNumero` con input
     `{ numero: ExpedienteNumero; context: RequestContext }`, permiso
     `EXPEDIENT_VIEW`, `ExpedienteRepository.findByNumero(numero, context.tenant)` y
     output `readonly ExpedienteSearchItem[]` 0..N. El summary contiene únicamente
     expedienteId, expedienteNumero, PacienteReferencia canónica, EstadoOperativo y
     Ubicacion nullable.
  2. Audit: `EXPEDIENTE_SEARCH/EXPEDIENTE/{numeroNormalizado}`, success para 0..N y sin
     datos/resultados C3 en changeSummary.
  3. API: extender el módulo configurable/controller con el Use Case y publicar
     `GET /api/v1/expedientes?numero={numero}`. `numero` requerido; ausente/vacío/VO
     inválido -> 400 `HTTP_VALIDATION_ERROR`. Controller no accede al Repository.
  4. HTTP response: `{ items: readonly ExpedienteSearchItem[] }`; sin singular, total
     ni paginación.
  5. OpenAPI: documentar endpoint, query requerido, schemas y 400/401/403; no marcar
     expedienteNumero unique.
- **Tests requeridos:**
  - Application 0/1/N, normalización por VO, permission, tenant propagation y audit.
  - API 200 `{items:[]|[...]}`, 400 ausente/vacío/inválido y 403 sin permission.
  - Controller delega sólo al Use Case; tenant/context no proceden del query.
  - Contract gate mantiene paridad OpenAPI y ausencia de `total`/paginación/unique.
- **Fuente:** EXPEDIENT-SEARCH-DECISION SEARCH-EW-001..010, UC-018, SPEC-009,
  API-011, SEC-017, SEC-038.
- **Dependencias:** T-03, T-09, T-11, T-12.

---

## Grupo 5 — Frontend

### T-13 Implementar feature module — estructura y hooks
- **Descripción:** Crear estructura de `apps/web/src/features/expediente-workspace/`
  definida en design.md §6.
  - `useExpedienteSearch`: normaliza separadores del input antes de llamar al API;
    consume `{items}` y retorna `{items, isDisambiguating: items.length > 1}`.
  - `useExpediente`: fetch + cache; invalida en 409.
  - `useExpedienteTimeline`: fetch paginado DAT-011.
  - `useCapabilities`: derivado del read model; no calcula dominio.
  - Tipos derivados del OpenAPI contract generado.
- **Fuente SDB:** DEL-002, INT-001.
- **Dependencias:** T-12A.

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
  - AuditoriaTab: visible sólo con `EXPEDIENT_AUDIT_VIEW`, fuera de capabilities operativas.
- **Tests requeridos:**
  - ResumenTab: muestra acceptedAt solo si EN_CONSULTA.
  - MovimientosTab: muestra DISPATCHED y CUSTODY_ACCEPTED; no muestra login/config.
  - AuditoriaTab: oculto sin `EXPEDIENT_AUDIT_VIEW`.
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
  - AuditoriaTab sin `EXPEDIENT_AUDIT_VIEW` -> no visible y el endpoint deniega acceso.
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

### T-21A Implementar contratos pre-T-22 — Audit, ubicaciones y command dialogs
- **Descripción:** Implementar, sin alterar la semántica de tasks completadas:
  - Permission/configuración `EXPEDIENT_AUDIT_VIEW`; no es capability.
  - `GetExpedienteAudit` y `ExpedienteAuditQueryPort` tenant-scoped, cursor-based,
    con comprobación previa de permission y existencia del Expediente.
  - Orden Audit `occurredAt DESC, auditId DESC`; cursor conceptual
    `occurredAt + auditId`, opaco y sólo reenviado por capas consumidoras.
  - Adapter PostgreSQL de consulta exclusiva de `audit_log` por
    `resource_type=EXPEDIENTE` y `resource_id=expedienteId`.
  - `GET /api/v1/expedientes/{id}/audit`, response sanitizada
    `{ items, nextCursor }`, sin `changeSummary`, `securityContext` ni total.
  - `GetSessionAuthorization`, GET `/api/v1/session` y
    `SessionAuthorizationReadModel {actorId,permissions}`;
    autenticación obligatoria, sin permission adicional, roles/tenantIds/capabilities.
  - `ListUbicaciones` con input `{context}`, `LOCATION_VIEW` antes del query y
    `UbicacionesQueryPort.findAll(context.tenant)`; GET `/api/v1/ubicaciones` responde
    `{items}` con shape exacto `id`, `codigo`, `descripcion`, sin paginación.
  - `DispatchExpedienteDialog` y `AcceptCustodyDialog` con los campos aprobados;
    `expectedRowVersion` proviene del Workspace como string decimal y no es editable.
  - Tras success 204, refrescar el Workspace. No enviar actor, tenant, timestamps ni tracing.
- **Tests requeridos:**
  - Audit: permission denied, tenant-scoped not-found, página vacía/no vacía,
    orden determinista, cursor opaco occurredAt+auditId y sanitización estricta.
  - Sesión: 401, actorId/permissions exactos y ausencia de roles, tenantIds, claims y
    capabilities; frontend no inspecciona roles.
  - Ubicaciones: `LOCATION_VIEW`, autorización antes de query, 401/403, vacío 200
    `{items:[]}`, shape exacto y tenant routing; sin audit identifier nuevo.
  - Dialogs: apertura sólo por capability, payload editable completo, rowVersion no
    editable, success 204 + refresh y ausencia de metadata server-side.
  - API/OpenAPI: ambos endpoints y sus errores canónicos.
- **Fuente SDB:** SDD-005, UC-018/SPEC-009, SEC-017, SEC-038, DAT-012,
  API-020, APP-003, EXPEDIENT-AUDIT-AND-COMMAND-UX-DECISION.
- **Dependencias:** T-09, T-11, T-12, T-17, T-18, T-20, T-21.

### T-22 Tests E2E Playwright
- **Descripción:** Escenarios mínimos (TQ-010 v0.2.0 + nuevos):
  1. Archivista busca PERR810604/10 -> workspace abre directamente.
  2. Archivista busca PERR810604-10 -> misma normalización, mismo expediente.
  3. Búsqueda con N=2 -> lista de desambiguación; sin auto-selección.
  4. Búsqueda con N=0 -> estado vacío.
  5. Expediente DISPONIBLE -> badge correcto; EN_BUSQUEDA NO aparece como badge.
  6. Abrir Dispatch dialog desde capability, capturar payload, recibir 204, refrescar
     -> EstadoOperativo cambia a EN_TRASLADO; acceptedAt null.
  7. Abrir AcceptCustody dialog desde capability, capturar payload, recibir 204,
     refrescar -> EstadoOperativo cambia a EN_CONSULTA; acceptedAt visible.
  8. CommandBar con CONSULTA_PROGRAMADA + Archivista -> ABRIR_PRESTAMO disponible.
  9. CommandBar con VALE_ARCHIVO_SM_1_14 validada + Archivista con LOAN_OPEN -> ABRIR_PRESTAMO disponible; no validada -> ausente.
  10. Conflicto 409 -> banner de conflicto visible; datos preservados.
  11. Sin `EXPEDIENT_AUDIT_VIEW`, tab Auditoría oculto. Con permission, tab visible,
      consulta GET `/audit` y muestra únicamente registros sanitizados.
  12. Navegación completa por teclado.
- **Fuente SDB:** TQ-010 v0.2.0, DEL-005, Volume-09 §07.
- **Dependencias:** T-19, T-21A.

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
        T-11 (controller) <- T-12 (OpenAPI base)
          T-12A (Search Application -> API -> OpenAPI)
            T-13 (FE estructura)
              T-14 (Header)
              T-15 (DisambiguationList)
              T-16 (CommandBar)
                T-17 (Tabs)
                  T-18 (Concurrency UX)

T-19 (auth/tenant tests) <- T-05, T-07, T-08, T-11
T-20 (audit trail) <- T-05, T-07, T-08, T-11
T-21 (integration PG) <- T-09, T-10
T-21A (pre-T-22 audit/location/dialogs) <- T-09, T-11, T-12, T-17, T-18, T-20, T-21
T-22 (E2E) <- T-19, T-21A
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
- Las OQ no bloqueantes (OQ-EW-002, OQ-EW-004, OQ-EW-008..010) tienen decisiones provisionales
  documentadas en requirements.md §6; implementar con esas provisiones.
- OQ-EW-003 está resuelta con `EXPEDIENT_AUDIT_VIEW` y LOCATION-PERMISSION-GAP está
  cerrado con `LOCATION_VIEW`. T-21A no conserva bloqueos conocidos.
- Ninguna tarea debe inventar comportamiento fuera del SDB o las decisiones resueltas.

---

## Implementation Readiness

```yaml
spec_version: "0.3.23"
blocking_open_questions: []
non_blocking_open_questions:
  - OQ-EW-002
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
  - OQ-EW-DESIGN-001
  - OQ-EW-DESIGN-002
  - OQ-EW-DESIGN-005
contradictions_found: []
implementation_ready: true
```
