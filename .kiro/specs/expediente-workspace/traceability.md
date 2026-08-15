---
spec: expediente-workspace
version: "0.3.12"
status: "Draft — pending stakeholder validation"
date: "2026-08-15"
traceability_model: "OS-007 / SDD-006"
chain: "Source/SDB -> BR -> WF -> UC -> SPEC -> REQ -> API -> UI -> Test"
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
requires:
  - requirements.md (v0.3.12)
  - design.md (v0.3.12)
  - tasks.md (v0.3.12)
---

# Expediente Workspace — Traceability

> **Modelo de referencia (OS-007, SDD-006):**
> `Source/SDB -> BR -> WF -> UC -> SPEC -> REQ -> API -> UI -> Test`
>
> Las celdas marcadas [PENDIENTE] dependen de OQ no bloqueantes.
> Las cadenas con [RESUELTO] indican que el eslabón fue completado en v0.3.0.

---

## Cadenas de trazabilidad

### TR-001 — Consultar situación operativa del expediente

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DDD-013, DAT-006 v0.2.0, READ-MODEL-COMPOSITION-DECISION, NOM-004-SSA3-2012, LGPDPPSO | Expediente con identificador institucional y composición server-side |
| **Business Rule** | INV-EXP-001, INV-EXP-002, INV-EXP-004 | Identificador institucional; coherencia operativa; EstadoOperativo con 6 valores válidos |
| **Workflow** | WF (Read Models — V05-41 SPEC-009) | Flujo de consulta |
| **Use Case** | UC-018 v0.2.0 | GetExpediente compone read model; query ports tenant-scoped, incl. fuentes 0..N |
| **SPEC** | SPEC-009 v0.2.0 FR-VIEW-001..013 | Situación, proyecciones, fuentes y audit Application |
| **REQ** | REQ-EW-001, REQ-EW-003..007 | Recuperar; ubicación; custodia; préstamo; solicitud; incidencias |
| **API** | GET /api/v1/expedientes/{id} (API-011 v0.2.0) | Read model con capabilities[] |
| **UI** | ExpedienteHeader (design.md §5.1), ResumenTab (APP-003 v0.2.0) | Header above-the-fold; badges de 6 estados |
| **Test** | AC-EW-001; T-05/T-11/T-14; TQ-010 E2E escenario 5 | Unit UC, integration PG, E2E Playwright |

---

### TR-002 — Búsqueda por número con normalización y desambiguación

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-001, OQ-EW-007 | Formato RFC_BASE_10+SEP+COD_2; múltiples derechohabientes posibles |
| **Business Rule** | BR-016 (formato), BR-017 (no único; desambiguación), INV-EXP-003 | No asumir unicidad; nunca auto-seleccionar si N>1 |
| **Workflow** | WF (Read Models) | — |
| **Use Case** | UC-018 v0.2.0 | Búsqueda 0..N; desambiguación manual |
| **SPEC** | SPEC-009 v0.2.0 FR-VIEW-001 | 0..N; variantes de separador; desambiguación |
| **REQ** | REQ-EW-002 | Búsqueda 0..N; normalización; desambiguación |
| **API** | GET /api/v1/expedientes?numero= -> {data[], total} (API-011 v0.2.0) | Colección; N=0 HTTP 200 vacío |
| **UI** | useExpedienteSearch (normaliza), DisambiguationList (N>1), apertura directa (N=1) | design.md §5.3, APP-003 v0.2.0 |
| **Test** | AC-EW-002/003/004; T-09/T-11/T-15/T-21/T-22 (escenarios 1..4) | Unit VO normalización; integration findByNumero; E2E variantes |

---

### TR-003 — EstadoOperativo correcto (DEC-EW-STATE-001)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DECISION-REGISTER DEC-EW-STATE-001, DDD-012 v0.2.0, BIZ-007 v0.2.0 | 6 valores aceptados; EN_BUSQUEDA y PRESTADO excluidos |
| **Business Rule** | INV-EXP-004 | EstadoOperativo solo con los 6 valores; EN_BUSQUEDA en Solicitud; PRESTADO en Préstamo |
| **Workflow** | V04 workflow-state-matrix v0.2.0 | DISPONIBLE->APARTADO->EN_TRASLADO->EN_CONSULTA->EN_TRASLADO->DISPONIBLE |
| **Use Case** | UC-018 v0.2.0 | estadoOperativo en read model |
| **SPEC** | SPEC-009 v0.2.0 FR-VIEW-002 | EstadoOperativo con 6 valores |
| **REQ** | REQ-EW-001, REQ-EW-009 | Estado en read model; capabilities por estado |
| **API** | estadoOperativo en GET /expedientes/{id} como enum de 6 valores | — |
| **UI** | ExpedienteHeader badges; CommandBar por estado | design.md §5.2 |
| **Test** | AC-EW-005/006/007; T-01/T-02/T-04/T-14/T-22 (escenarios 5..7) | Unit VO/aggregate rechaza EN_BUSQUEDA/PRESTADO; E2E badges correctos |

---

### TR-004 — Despacho (DispatchExpediente -> EN_TRASLADO)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DECISION-REGISTER OQ-EW-006, BIZ-008 v0.2.0, SRC-INT-002 | Salida física de Archivo; mensajero porta hoja diaria |
| **Business Rule** | BR-019, INV-EXP-005 | Despacho y aceptación son eventos distintos |
| **Workflow** | WF-005 v0.2.0 Fase 1 | DispatchExpediente -> ExpedienteDispatched -> EN_TRASLADO |
| **Use Case** | UC (DispatchExpediente — design.md §7.3) | DSP-EW-001..011; UoW atómica; DOM-EVENT-001; DSP-GAP-001/002 cerrados |
| **SPEC** | WF-005 v0.2.0 | — |
| **REQ** | REQ-EW-011 | Despacho con evento y transición de estado |
| **API** | POST /api/v1/expedientes/{id}/dispatch (API-011 v0.2.0) | 409 si rowVersion o estado incorrecto |
| **UI** | CommandBar capability DISPATCH; badge EN_TRASLADO; acceptedAt null en ResumenTab | — |
| **Test** | AC-EW-005/011; T-07/T-11/T-19/T-22 (escenario 6) | Unit UC; API contract; E2E despacho |

---

### TR-005 — Aceptación de custodia (AcceptCustody -> EN_CONSULTA)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DECISION-REGISTER OQ-EW-006, DDD-018 v0.2.0, WF-005 v0.2.0 Fase 3 | Receptor autorizado confirma recepción; acción autenticada y auditable |
| **Business Rule** | BR-019, INV-EXP-005 | CustodyAccepted es momento distinto de despacho |
| **Workflow** | WF-005 v0.2.0 Fase 3 | AcceptCustody -> CustodyAccepted -> EN_CONSULTA |
| **Use Case** | UC (AcceptCustody — design.md §7.4) | Validar EN_TRASLADO; rowVersion; custody_accepted_at -> now() |
| **SPEC** | WF-005 v0.2.0, SPEC-009 v0.2.0 FR-VIEW-004 | Custodia con acceptedAt |
| **REQ** | REQ-EW-004, REQ-EW-012 | Custodia con distinción traslado/aceptada |
| **API** | POST /api/v1/expedientes/{id}/accept-custody (API-011 v0.2.0) | — |
| **UI** | Badge EN_CONSULTA; acceptedAt visible en ResumenTab; ACCEPT_CUSTODY en capabilities receptor | — |
| **Test** | AC-EW-005; T-08/T-11/T-19/T-22 (escenario 7) | Unit UC; E2E custodia aceptada |

---

### TR-006 — Autorización por FuenteHabilitanteSalida

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DECISION-REGISTER OQ-EW-005, BIZ-010 v0.2.0, BIZ-016 v0.2.0, SRC-INT-003 | CONSULTA_PROGRAMADA / VALE_ARCHIVO_SM_1_14 / ORDEN_SUPERIOR |
| **Business Rule** | BR-018, INV-LOAN-003, AUTH-EW-006/007 | Al menos una fuente validada permitida; ORDEN_SUPERIOR fail-closed |
| **Workflow** | WF-006 v0.2.0 | OpenLoan evalúa FuenteHabilitanteSalida |
| **Use Case** | UC-010 v0.2.0 | Capability no selecciona; OpenLoan selecciona/registra fuente concreta |
| **SPEC** | SPEC-006 v0.2.0 FR-LOAN-007 | Autorización por fuente |
| **REQ** | REQ-EW-010 | Préstamo con fuente habilitante |
| **API** | POST /api/v1/prestamos con fuenteHabilitante; 403 INSUFFICIENT_ENABLING_SOURCE | — |
| **UI** | CommandBar: ABRIR_PRESTAMO incluida/excluida según FuenteHabilitante + rol; ResumenTab muestra fuente | — |
| **Test** | AC-EW-008/009/010; T-04/T-11/T-19/T-22 (escenarios 8/9) | Unit CapabilityService por fuente; E2E actor correcto/incorrecto |

---

### TR-007 — Historial de movimientos operativos

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DDD-020, DAT-011, DDD-011 v0.2.0 | MovimientoExpediente append-only; distinto de audit_log |
| **Business Rule** | DDD-020; TL-EW-011..017; "Movimiento != Audit" | Autorizar, comprobar existencia, audit específico; incluye DISPATCHED/CUSTODY_ACCEPTED |
| **Workflow** | WF (Read Models) | — |
| **Use Case** | UC-018 v0.2.0 (historial relevante) | — |
| **SPEC** | SPEC-009 v0.2.0 FR-VIEW-007 | Trayectoria física/operativa |
| **REQ** | REQ-EW-008 | Historial separado de audit |
| **API** | GET /api/v1/expedientes/{id}/timeline | Cursor opaco; occurredAt DESC, movimientoId DESC; items/nextCursor, sin total |
| **UI** | MovimientosTab (design.md §5.2); muestra DISPATCHED, CUSTODY_ACCEPTED | — |
| **Test** | AC-EW-015; T-06/T-17/T-21 | denied/not-found/empty/non-empty; audit no-mezcla; Component MovimientosTab |

---

### TR-008 — Barra de comandos contextual

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | AUTHORIZATION-DECISION, DDD-010 v0.2.0, DDD-012 v0.2.0, SDD-005 v0.2.0, DS-014 | Capability -> Permission aprobado; estados canónicos de Solicitud/Préstamo |
| **Business Rule** | INV-EXP-002, SEC-017 v0.3.0 | Role != Permission != Capability != Command; contexto y fuente previamente validados |
| **Workflow** | DDD-012 v0.2.0 (máquinas de estado) | — |
| **Use Case** | UC-018 (capabilities derivadas) | — |
| **SPEC** | SPEC-009 + PERM-MATRIX v0.2.0 | — |
| **REQ** | REQ-EW-009 | capabilities[] server-side |
| **API** | capabilities[] en GET /expedientes/{id} | — |
| **UI** | CommandBar (design.md §5.3) | Renderiza solo capabilities recibidas |
| **Test** | AC-EW-011; T-04/T-16/T-22 (escenario 8/9/10) | Unit CapabilityService; Component CommandBar |

---

### TR-009 — Autorización y control de acceso

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | AUTHORIZATION-DECISION, SEC-017 v0.3.0, SDD-005 v0.2.0 | Tupla y asignación mínima Role -> Permission aprobadas |
| **Business Rule** | EXPEDIENT_VIEW requerido; capabilities operativas separadas; auditor recibe [] | — |
| **Workflow** | Transversal | — |
| **Use Case** | UC-018 paso 1 | — |
| **REQ** | REQ-EW-001 (precondición), REQ-EW-016 (tenant) | — |
| **API** | `PERMISSION_DENIED` -> 403; `EXPEDIENTE_NOT_FOUND` -> 404, incluido cross-tenant | RFC7807 futuro en T-11/T-12 |
| **Test** | AC-EW-013; T-19; TQ-007 | Unit UC; API contract; Tenant isolation gate |

---

### TR-010 — Aislamiento multi-tenant

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-032, API-005, AGENTS.md | database-per-tenant; TenantContext server-side |
| **Business Rule** | "No cross-tenant queries"; actor -> tenant validado antes de CapabilityService | — |
| **REQ** | REQ-EW-016 | — |
| **API** | API-005; tenant del host/claim de sesión | — |
| **Test** | AC-EW-013; T-19; T-21; TQ-007 | Integration PG; E2E; tenant isolation gate |

---

### TR-011 — Concurrencia optimista

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DAT-019, API-006, INT-006 | row_version; conflicto -> HTTP 409 |
| **Business Rule** | INV-EXP-002, INV-LOAN-002 | Transiciones críticas no sobreescriben |
| **REQ** | REQ-EW-015 | — |
| **API** | HTTP 409 con currentVersion (API-006) | DispatchExpediente, AcceptCustody, OpenLoan, etc. |
| **UI** | Banner de conflicto; Recargar; preservar contexto (design.md §5.4) | — |
| **Test** | AC-EW-012; T-18/T-22 (escenario 10) | Component 409; E2E concurrencia |

---

### TR-012 — Integridad del audit trail

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-038, DAT-012, CTX-EW-001..004, AUD-EW-001..006, NOM-004-SSA3-2012 | RequestContext canónico; AuditEntry semántico; AuditWriter append-only |
| **Business Rule** | "Toda acción registra actor, tenant, recurso y resultado" | — |
| **REQ** | NFR-EW-003 | — |
| **API** | Application usa AuditWriter; controller no escribe audit | — |
| **UI** | AuditoriaTab (solo roles autorizados) | — |
| **Test** | AC-EW-014/015; T-20 | Integration: INSERT tras cada operación |

---

### TR-013 — Privacidad de datos C3

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-003, INT-009, LGPDPPSO | C3 minimización |
| **Business Rule** | "Mínimo necesario para tarea operativa" | — |
| **REQ** | REQ-EW-014, NFR-EW-005 | — |
| **API** | pacienteRef.displayLabel mínimo (OQ-EW-002) | — |
| **UI** | ExpedienteHeader; no en document.title, URL, toasts, exports | — |
| **Test** | AC-EW-016; T-14 | Component: sin datos clínicos en DOM |

---

### TR-014 — NO_LOCALIZADO != EXTRAVIADO

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | BIZ-006 BR-004, INV-INC-002, DDD-012 v0.2.0 | Distinción obligatoria |
| **Business Rule** | BR-004 (No localizado != perdido), INV-INC-002 | EXTRAVIADO requiere proceso formal |
| **Use Case** | UC (DeclareLost) | Fuera de scope de este workspace slice |
| **REQ** | REQ-EW-007 | — |
| **API** | EstadoOperativo = NO_LOCALIZADO no implica EXTRAVIADO en capabilities | — |
| **UI** | Badge NO_LOCALIZADO distinto de EXTRAVIADO; transición a EXTRAVIADO solo en capabilities | — |
| **Test** | AC-EW-007; T-01 (EstadoOperativo unit) | Unit VO; E2E escenario 7 |

---

### TR-015 — Accesibilidad y teclado

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | Volume-09 §07, DEL-005 | Teclado; foco visible |
| **REQ** | REQ-EW-017 | — |
| **UI** | CommandBar (Enter/Space); tabs (Tab/flechas); DisambiguationList (teclado); ARIA | — |
| **Test** | AC-EW-017; T-16/T-22 (escenario 12) | Component keyboard nav; E2E keyboard |

---

## Matriz de cobertura REQ -> Cadena

| REQ | Cadena(s) | Estado |
|-----|-----------|--------|
| REQ-EW-001 | TR-001, TR-009 | Cubierto |
| REQ-EW-002 | TR-002 | Cubierto — OQ-EW-001/007 RESUELTAS |
| REQ-EW-003 | TR-001 | Cubierto (OQ-EW-008 no bloqueante) |
| REQ-EW-004 | TR-005 | Cubierto — OQ-EW-006 RESUELTA |
| REQ-EW-005 | TR-001, TR-006 | Cubierto |
| REQ-EW-006 | TR-001 | Cubierto |
| REQ-EW-007 | TR-001, TR-014 | Cubierto (OQ-EW-004 no bloqueante) |
| REQ-EW-008 | TR-007 | Cubierto — OQ-DOM-001 y OQ-EW-DESIGN-003 resueltas |
| REQ-EW-009 | TR-008 | Cubierto — OQ-EW-005 RESUELTA |
| REQ-EW-010 | TR-006 | Cubierto — OQ-EW-005 RESUELTA |
| REQ-EW-011 | TR-004 | Cubierto — OQ-EW-006 RESUELTA |
| REQ-EW-012 | TR-005 | Cubierto — OQ-EW-006 RESUELTA |
| REQ-EW-013 | TR-012 | Cubierto (OQ-EW-003 no bloqueante) |
| REQ-EW-014 | TR-013 | Cubierto (OQ-EW-002 no bloqueante) |
| REQ-EW-015 | TR-011 | Cubierto |
| REQ-EW-016 | TR-010 | Cubierto |
| REQ-EW-017 | TR-015 | Cubierto |
| NFR-EW-001 | TR-001 | [PENDIENTE SLA en UAT] |
| NFR-EW-002 | TR-009, TR-006 | Cubierto |
| NFR-EW-003 | TR-012 | Cubierto |
| NFR-EW-004 | TR-010 | Cubierto |
| NFR-EW-005 | TR-013 | Cubierto |
| NFR-EW-006 | TR-011 | Cubierto |
| NFR-EW-007 | TR-012 | Cubierto — AuditWriter Application append-only |

---

## Matriz de cobertura AC -> Test

| AC | Tipo | Tarea | Estado |
|----|------|-------|--------|
| AC-EW-001 | E2E | T-22 | Pendiente implementación |
| AC-EW-002 | Unit VO + E2E | T-01, T-21, T-22 | Pendiente |
| AC-EW-003 | Unit + E2E | T-09, T-15, T-22 | Pendiente |
| AC-EW-004 | API contract + E2E | T-11, T-22 | Pendiente |
| AC-EW-005 | Unit UC + E2E | T-07, T-08, T-22 | Pendiente |
| AC-EW-006 | Unit aggregate + E2E | T-02, T-22 | Pendiente |
| AC-EW-007 | Unit VO + E2E | T-01, T-14, T-22 | Pendiente |
| AC-EW-008 | Unit CapService + E2E | T-04, T-22 | Pendiente |
| AC-EW-009 | Unit CapService + API | T-04, T-19 | Pendiente |
| AC-EW-010 | Unit CapService + E2E | T-04, T-22 | Pendiente |
| AC-EW-011 | Unit CapService + Component | T-04, T-16 | Pendiente |
| AC-EW-012 | Component + E2E | T-18, T-22 | Pendiente |
| AC-EW-013 | Integration + E2E | T-19, T-22 | Pendiente |
| AC-EW-014 | Component + API | T-17, T-19 | Pendiente (OQ-EW-003) |
| AC-EW-015 | Integration + Component | T-06, T-17, T-20 | Pendiente |
| AC-EW-016 | Component | T-14 | Pendiente (OQ-EW-002) |
| AC-EW-017 | Component + E2E | T-16, T-22 | Pendiente |

---

## GAPs resueltos en v0.3.0

| GAP v0.2.0 | Resolución |
|------------|------------|
| GAP-002 — permisos ABRIR_PRESTAMO | RESUELTO — FuenteHabilitanteSalida en TR-006, T-04, SPEC-006 v0.2.0 |
| GAP-003 — flujo confirmación custodia | RESUELTO — AcceptCustody en TR-005, T-08, WF-005 v0.2.0 |
| GAP-007 — formato identificador | RESUELTO — ExpedienteNumero VO en TR-002, T-01, DDD-007 v0.2.0 |

## GAPs que permanecen (OQ no bloqueantes)

| ID | Descripción | OQ | Estado |
|----|------------|-----|--------|
| GAP-001 | Condición exacta de MarkNotLocated -> Incidencia automática | OQ-EW-004 | Abierto; no automático hasta resolución |
| GAP-004 | Campo de pacienteRef.displayLabel en read model | OQ-EW-002 | Abierto; usar nombre corto operativo provisional |
| GAP-005 | Permiso exacto del tab Auditoría | OQ-EW-003 | Abierto; fuera de capabilities operativas; no bloquea T-04 |
| GAP-006 | Schema de MovimientoExpediente (módulo o dedicado) | OQ-DOM-001 | CERRADO — Archive Operations, schema tenant junto con Expediente |
| GAP-008 | Codificación de ubicaciones temporales | OQ-EW-008 | Abierto; categoría genérica provisional |
| GAP-009 | SLA de performance (<= 1 s) | NFR-EW-001 | Pendiente UAT con carga real |
| GAP-010 | Política de retención del timeline | OQ-EW-010 | Abierto; sin límite provisional |

---

## Historial de cambios

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 0.1.0 | — | Bootstrap vacío |
| 0.2.0 | 2026-08-14 | Primera versión completa: 10 cadenas TR, matrices REQ/AC, 10 GAPs |
| 0.3.0 | 2026-08-14 | Decisiones OQ-EW-001/005/006/007 y DEC-EW-STATE-001 aplicadas. GAP-002/003/007 cerrados. 15 cadenas TR. REQ-EW-011/012 añadidas. Búsqueda 0..N, normalización, desambiguación, FuenteHabilitanteSalida, dispatch, custodia aceptada integrados. |
| 0.3.1 | 2026-08-15 | AUTHORIZATION-DECISION aplicada. AUTH-GAP-001..013 cerrados para T-04; roles, permissions, capabilities, estados contextuales, SM 1-14 y tenant prevalidado formalizados. |
| 0.3.2 | 2026-08-15 | READ-MODEL-COMPOSITION-DECISION aplicada. OQ-EW-DESIGN-004 resuelta; query ports de proyección y AuditWriter definidos para T-05..T-08. |
| 0.3.3 | 2026-08-15 | READ-EW-008..012 y AUTH-EW-006/007 aplicadas. ExitEnablingSourceQueryPort 0..N y capabilities por existencia de fuente validada formalizadas. |
| 0.3.4 | 2026-08-15 | CTX-EW-001..004, READ-EW-011 v2 y AUD-EW-003..006 aplicadas. RequestContext canónico y separación AuditEntry/AuditRecord formalizados. |
| 0.3.5 | 2026-08-15 | READ-EW-013 y ERR-EW-001..004 aplicadas. updatedAt eliminado; taxonomía ApplicationError, RFC7807 y no divulgación cross-tenant formalizadas. |
| 0.3.6 | 2026-08-15 | TL-EW-001..010 aplicadas. Cursor timeline y query port definidos; OQ-EW-DESIGN-003/OQ-DOM-001 cerradas; OQ-EW-010 permanece abierta. |
| 0.3.7 | 2026-08-15 | TL-EW-011..017 aplicadas. Audit identifiers, autorización previa, existencia tenant-scoped y semántica empty/success definidas para T-06. |
| 0.3.8 | 2026-08-15 | DSP-EW-001..011 formalizadas: command/event/movimiento/UoW/audit. DSP-GAP-001/002 quedan bloqueantes para T-07. |
| 0.3.9 | 2026-08-15 | DSP-GAP-001/002 cerrados: custodio destino obligatorio y audit conflict posterior al rollback formalizados. |
| 0.3.10 | 2026-08-15 | DOM-EVENT-001 aprobado: operationOccurredAt se pasa al aggregate y se comparte con Movimiento; destinationCustodianRef obligatorio para DISPATCHED. |
| 0.3.11 | 2026-08-15 | AUD-EW-010..013 aprobadas: invalid-transition para REQUEST_INVALID_TRANSITION; conflict exclusivo de optimistic locking. |
| 0.3.12 | 2026-08-15 | DSP-EW-014..016 aprobadas: custodio previsto type/reference explícito; Custodia en traslado con service/location/acceptedAt null. |

---

## Implementation Readiness

```yaml
spec_version: "0.3.12"
blocking_open_questions: []
non_blocking_open_questions:
  - OQ-EW-002
  - OQ-EW-003
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
contradictions_found: []
implementation_ready: true
```
