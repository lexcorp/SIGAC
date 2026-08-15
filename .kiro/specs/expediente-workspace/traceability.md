---
spec: expediente-workspace
version: "0.2.0"
status: "Draft — pending stakeholder validation"
date: "2026-08-14"
traceability_model: "OS-007 / SDD-006"
chain: "Source/SDB → Business Rule → Workflow → Use Case → SPEC → API → UI → Test"
requires:
  - requirements.md (v0.2.0)
  - design.md (v0.2.0)
  - tasks.md (v0.2.0)
---

# Expediente Workspace — Traceability

> **Modelo de referencia (OS-007, SDD-006):**
> `Source/SDB → Business Rule → Workflow → Use Case → SPEC → API → UI → Test`
>
> Toda capacidad primaria del Workspace debe tener una cadena completa.
> Las celdas marcadas `[PENDIENTE]` indican que el eslabón existe en el SDB pero
> no ha sido confirmado/detallado aún, o depende de un OQ abierto.
> **No implementar** ninguna capacidad con eslabones `[PENDIENTE]` en BR, UC o SPEC.

---

## Leyenda de columnas

| Columna | Contenido |
|---------|-----------|
| **ID** | Identificador de la cadena de trazabilidad en este workspace |
| **Source / SDB** | Documento SDB de origen (norma, NOM, política institucional o decisión de dominio) |
| **Business Rule** | Invariante o regla de negocio del dominio (DDD-009) |
| **Workflow** | Flujo de trabajo del dominio (Volume-04 / V05-41) |
| **Use Case** | Use Case del Volume-05 |
| **SPEC** | Spec funcional del Volume-05 |
| **REQ** | Requisito en este spec (requirements.md) |
| **API** | Endpoint o contrato (Volume-08 / API-011) |
| **UI** | Componente / pantalla (Volume-09 / APP-003, design.md) |
| **Test** | Tipo y referencia de test requerido (Volume-10 / tasks.md) |

---

## Cadenas de trazabilidad

### TR-001 — Consultar situación operativa del expediente

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DDD-013, DAT-006, NOM-004-SSA3-2012 (custodia de expediente), LGPDPPSO | Expediente tiene identificador institucional y situación operativa coherente |
| **Business Rule** | INV-EXP-001, INV-EXP-002 | (1) Expediente tiene identificador institucional. (2) Mantiene situación operativa coherente entre disponibilidad, ubicación y custodia |
| **Workflow** | WF (Read Models — V05-41 fila SPEC-009) | Flujo de consulta de situación actual |
| **Use Case** | UC-018 — Consultar Situación del Expediente | Read model: número, paciente mínimo, estado, ubicación, custodia, préstamo activo, solicitud activa, incidencias, historial |
| **SPEC** | SPEC-009 FR-VIEW-001, FR-VIEW-002, FR-VIEW-003, FR-VIEW-004, FR-VIEW-005, FR-VIEW-006 | Búsqueda por identificador; situación actual; ubicación; custodia; préstamo activo; incidencias |
| **REQ** | REQ-EW-001, REQ-EW-002, REQ-EW-003, REQ-EW-004, REQ-EW-005, REQ-EW-006, REQ-EW-007 | Recuperar expediente; búsqueda; ubicación; custodia; préstamo activo; solicitud activa; incidencias |
| **API** | `GET /api/v1/expedientes/{id}` (API-011) | Read model completo con `capabilities[]` |
| **UI** | `ExpedienteHeader` (design.md §5.1/5.2), `ResumenTab` (APP-003) | Header above-the-fold; tab Resumen |
| **Test** | AC-EW-001 (requirements.md); T-05/T-09/T-12 (tasks.md); TQ-010 E2E "abrir workspace" | Unit: GetExpediente UC. Integration: PostgresRepo. API contract: 200. E2E: Playwright escenario 1 |

---

### TR-002 — Búsqueda por número de expediente

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SPEC-009 FR-VIEW-001, DAT-006 (`expediente_numero` UNIQUE per tenant), OQ-EW-001 | Búsqueda rápida por identificadores permitidos |
| **Business Rule** | INV-EXP-001 | Expediente tiene identificador institucional único por tenant |
| **Workflow** | WF (Read Models) | — |
| **Use Case** | UC-018 | — |
| **SPEC** | SPEC-009 FR-VIEW-001 | Búsqueda rápida por identificadores permitidos |
| **REQ** | REQ-EW-002 | Búsqueda por número de expediente |
| **API** | `GET /api/v1/expedientes?numero={n}` (API-011) | Retorna lista o apertura directa |
| **UI** | Búsqueda global / entrada del workspace (Volume-09 §39) | [PENDIENTE — diseño de flujo de entrada al workspace no detallado en APP-003] |
| **Test** | T-05/T-09 (tasks.md) | Unit: findByNumero. API contract: happy path, not found. OQ-EW-001 bloquea validación de formato |

> ⚠️ **OQ-EW-001 abierta:** El formato exacto del identificador (regex, longitud, prefijo) no
> está confirmado. La validación de entrada no puede finalizarse hasta resolución.

---

### TR-003 — Historial de movimientos operativos (Timeline)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DDD-020, DAT-011, DDD-024 (Movimiento ≠ Audit) | MovimientoExpediente registra trayectoria física/operativa |
| **Business Rule** | DDD-020 (append-oriented); "Movimiento no es Audit" (DDD-024, DAT-012) | Trayectoria es distinta del audit técnico y del préstamo |
| **Workflow** | WF (Read Models — V05-41 SPEC-009) | — |
| **Use Case** | UC-018 (historial relevante) | — |
| **SPEC** | SPEC-009 FR-VIEW-007 | Historial relevante del expediente |
| **REQ** | REQ-EW-008 | Mostrar historial de movimientos; separado de audit |
| **API** | `GET /api/v1/expedientes/{id}/timeline` (API-011) | Movimientos paginados por `occurred_at DESC` |
| **UI** | `MovimientosTab` (design.md §5.2, APP-003) | Solo trayectoria operativa; no eventos técnicos |
| **Test** | AC-EW-007 (requirements.md); T-06/T-18 (tasks.md) | Unit: GetExpedienteTimeline. Integration: no cross-tenant; no mezcla audit. E2E: Playwright |

---

### TR-004 — Barra de comandos contextual (capabilities)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DDD-010 (Commands), DDD-012 (State Machines), SDD-005 (Permission Model), INT-001, DS-014, DEL-002 | Comandos válidos derivados de estado + rol + contexto; no calculados en frontend |
| **Business Rule** | INV-EXP-002 (coherencia operativa); permiso = `sujeto + acción + tenant + recurso + contexto` (SEC-017) | Solo transiciones válidas en el estado actual + permisos del actor |
| **Workflow** | DDD-012 (máquinas de estado Solicitud y Préstamo) | Transiciones válidas por estado |
| **Use Case** | UC-018 (capabilities derivadas del estado) | — |
| **SPEC** | SPEC-009 + V05-39 (Permission × Action Matrix) | Acciones según rol |
| **REQ** | REQ-EW-009 | Barra de comandos contextual; capabilities calculadas server-side |
| **API** | `capabilities[]` en respuesta de `GET /api/v1/expedientes/{id}` (API-011, design.md §4.3) | Array de nombres de capability calculado en `ExpedienteCapabilityService` |
| **UI** | `CommandBar` (design.md §5.3, §7.1 DEL-002) | Renderiza solo capabilities recibidas; no calcula dominio |
| **Test** | AC-EW-003 (requirements.md); T-04/T-13 (tasks.md) | Unit: CapabilityService (por estado y rol). Component: CommandBar renderiza según capabilities. E2E: Playwright escenario 3 |

> ⚠️ **OQ-EW-005 abierta:** Permisos exactos para `ABRIR_PRESTAMO` según tipo de solicitud
> no están confirmados. `ExpedienteCapabilityService` debe implementarse con política
> conservadora hasta resolución.

---

### TR-005 — Control de acceso y autorización (EXPEDIENT_VIEW)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-017 (RBAC + Contextual), SDD-005, V05-39, NOM-004-SSA3-2012, LGPDPPSO | Autorización = sujeto + permiso + tenant + recurso + contexto negocio |
| **Business Rule** | `EXPEDIENT_VIEW` requerido; backend re-verifica siempre | Sin delegación al frontend (AGENTS.md) |
| **Workflow** | — | Transversal a todos los flujos |
| **Use Case** | UC-018 (precondición: usuario autorizado) | — |
| **SPEC** | SDD-005 acción `EXPEDIENT_VIEW` | — |
| **REQ** | REQ-EW-001 (precondición), REQ-EW-013 (tenant isolation) | — |
| **API** | Middleware de autenticación/autorización en todos los endpoints `/api/v1/expedientes/*` | 403 si falta permiso; 404 si cross-tenant |
| **UI** | — (aplicado server-side; UI solo recibe 403/404) | — |
| **Test** | AC-EW-002, AC-EW-005 (requirements.md); T-16 (tasks.md); TQ-007 | Unit: UC lanza error sin permiso. API: 403 sin token; 404 cross-tenant. Tenant isolation gate |

---

### TR-006 — Aislamiento multi-tenant

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-032, API-005, AGENTS.md (non-negotiable) | database-per-tenant; TenantContext server-side; no cross-tenant queries |
| **Business Rule** | "Tenant database access requires server-resolved TenantContext. No cross-tenant queries." (AGENTS.md) | Ningún valor de tenant del body de la petición |
| **Workflow** | — | Transversal |
| **Use Case** | Todos los use cases del workspace | TenantContext como argumento; no de HTTP body |
| **SPEC** | — | Transversal a toda la spec |
| **REQ** | REQ-EW-013 | Aislamiento multi-tenant |
| **API** | API-005 (Tenant Resolution); resolución en controller antes de llamar use case | Tenant del host/subdomain o claim de sesión validado contra control DB |
| **UI** | — | — |
| **Test** | AC-EW-005 (requirements.md); T-16 (tasks.md); TQ-007 (gate crítico) | Actor Tenant-A no obtiene expediente Tenant-B; forged tenant rechazado; caches/exports scoped |

---

### TR-007 — Concurrencia optimista (conflictos de estado)

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | DAT-019, API-006, INT-006 | `row_version` en aggregate roots; conflicto → HTTP 409 con metadata |
| **Business Rule** | INV-EXP-002, INV-LOAN-002 (Préstamo cerrado no vuelve a activo) | Transiciones críticas no pueden sobreescribirse silenciosamente |
| **Workflow** | Transversal a TransferCustody, OpenLoan, ResolveIncident | — |
| **Use Case** | UC-018 (read), UC-016 (resolver), UC-010 (abrir préstamo) | Acciones de comando requieren versión del cliente |
| **SPEC** | SPEC-005, SPEC-006, SPEC-004 | Transferencia custodia, Préstamo, Incidencias |
| **REQ** | REQ-EW-012 | Manejo de concurrencia y conflictos |
| **API** | HTTP 409 con `currentVersion` (API-006, DAT-019); cliente envía `row_version` en comandos críticos | — |
| **UI** | Estado `conflict` + banner + botón "Recargar" (design.md §5.4, INT-006); `useExpediente` invalida cache | `ConcurrencyBanner` dentro del Workspace |
| **Test** | AC-EW-004 (requirements.md); T-15 (tasks.md) | Component: simular 409 → banner aparece, datos preservados. E2E: Playwright escenario 4 |

---

### TR-008 — Integridad del audit trail

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-038, DAT-012, NOM-004-SSA3-2012 (trazabilidad de acceso) | Append-only; actor y tenant obligatorios; sin UPDATE/DELETE desde rol aplicación |
| **Business Rule** | "Toda acción registra actor, tenant, recurso y resultado" (SEC-038) | — |
| **Workflow** | Transversal | — |
| **Use Case** | Paso 8 de GetExpediente (design.md §7.2); paso equivalente en GetTimeline | — |
| **SPEC** | SPEC-010 (Auditoría Operativa) | — |
| **REQ** | NFR-EW-003 | Audit de toda acción de comando |
| **API** | INSERT a `audit_log` dentro de cada Use Case (no en controller) | Campos: actor_ref, action, resource_type, resource_id, result, occurred_at, request_id |
| **UI** | `AuditoriaTab` (design.md §5.2) — muestra DAT-012; separado de `MovimientosTab` | Solo roles autorizados (OQ-EW-003) |
| **Test** | AC-EW-006, AC-EW-007 (requirements.md); T-17 (tasks.md) | Integration: verificar inserción en audit_log tras GET expediente. Component: AuditoriaTab oculto sin permiso |

> ⚠️ **OQ-EW-003 abierta:** Lista exacta de roles con acceso al tab Auditoría pendiente
> de confirmación (OQ-UX-008). Implementar con capability flag hasta resolución.

---

### TR-009 — Privacidad de datos C3 en presentación

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | SEC-003 (C3 Restricted), INT-009, LGPDPPSO, NOM-004-SSA3-2012 | Datos de paciente son C3; minimización en display |
| **Business Rule** | "Display minimum patient data required for task" (INT-009); datos C3 no en logs | — |
| **Workflow** | — | Transversal |
| **Use Case** | UC-018 ("paciente mínimo" en read model) | — |
| **SPEC** | SPEC-009 Non-goal: "No mostrar diagnósticos o notas clínicas" | — |
| **REQ** | REQ-EW-011, NFR-EW-005 | Privacidad en presentación; datos C3 fuera de logs |
| **API** | Campo `pacienteRef.displayLabel` mínimo en read model (OQ-EW-002); no diagnósticos en ningún endpoint | — |
| **UI** | `ExpedienteHeader` (design.md §5.2); datos C3 no en `document.title`, URL, toasts, exports | — |
| **Test** | AC-EW-001 (non-goal), AC-EW-008 (requirements.md); T-12 (tasks.md) | Component: verificar ausencia de datos clínicos en render. Unit: UC no devuelve campos clínicos |

> ⚠️ **OQ-EW-002 abierta:** Campo mínimo de referencia de paciente permitido en el
> Workspace pendiente de confirmación (OQ-SPEC-012, SEC-003, INT-009).

---

### TR-010 — Accesibilidad y navegación por teclado

| Eslabón | Referencia | Detalle |
|---------|-----------|---------|
| **Source / SDB** | Volume-09 §07 (keyboard-ux), DEL-005 (UX acceptance criteria), §04 (accessibility) | Todos los flujos core alcanzables con teclado; foco visible |
| **Business Rule** | — | Requisito de accesibilidad operativa |
| **Workflow** | — | Transversal |
| **Use Case** | — | — |
| **SPEC** | — | — |
| **REQ** | REQ-EW-014 | Accesibilidad y navegación por teclado |
| **API** | — | — |
| **UI** | `CommandBar` (Enter/Space), tabs (Tab/flechas), `ExpedienteHeader` (ARIA), `AuditoriaTab` (foco) | design.md §5.3 |
| **Test** | AC-EW-009 (requirements.md); T-13/T-19 (tasks.md); TQ-012 (Volume-10) | Component: keyboard nav en CommandBar. E2E: Playwright escenario 6 (teclado + foco visible) |

---

## Matriz de cobertura REQ → Cadena

| REQ | Cadena(s) que lo cubre(n) | Estado |
|-----|--------------------------|--------|
| REQ-EW-001 | TR-001, TR-005 | ✅ Cubierto |
| REQ-EW-002 | TR-002 | ⚠️ OQ-EW-001 bloquea validación |
| REQ-EW-003 | TR-001 | ⚠️ OQ-EW-008 (ubicaciones temporales) |
| REQ-EW-004 | TR-001 | ⚠️ OQ-EW-004 / OQ-DOM-003 |
| REQ-EW-005 | TR-001 | ✅ Cubierto |
| REQ-EW-006 | TR-001 | ✅ Cubierto |
| REQ-EW-007 | TR-001 | ⚠️ OQ-EW-004 (NoLocalizado → Incidencia) |
| REQ-EW-008 | TR-003 | ⚠️ OQ-DOM-001 (schema de Movimiento) |
| REQ-EW-009 | TR-004 | ⚠️ OQ-EW-005 (permisos préstamo) |
| REQ-EW-010 | TR-008 | ⚠️ OQ-EW-003 (roles de Auditoría) |
| REQ-EW-011 | TR-009 | ⚠️ OQ-EW-002 (campo mínimo paciente) |
| REQ-EW-012 | TR-007 | ✅ Cubierto |
| REQ-EW-013 | TR-006 | ✅ Cubierto |
| REQ-EW-014 | TR-010 | ✅ Cubierto |
| NFR-EW-001 | TR-001 (performance) | [PENDIENTE — SLA confirmación en UAT] |
| NFR-EW-002 | TR-005 | ✅ Cubierto |
| NFR-EW-003 | TR-008 | ✅ Cubierto |
| NFR-EW-004 | TR-006 | ✅ Cubierto |
| NFR-EW-005 | TR-009 | ✅ Cubierto |
| NFR-EW-006 | TR-007 | ✅ Cubierto |

---

## Matriz de cobertura AC → Test

| AC | Tipo de test | Tarea | Estado |
|----|-------------|-------|--------|
| AC-EW-001 | E2E Playwright | T-19 | [PENDIENTE implementación] |
| AC-EW-002 | API contract (404); Integration | T-09, T-16 | [PENDIENTE] |
| AC-EW-003 | Unit CapabilityService; E2E | T-04, T-19 | [PENDIENTE] |
| AC-EW-004 | Component (409 banner); E2E | T-15, T-19 | [PENDIENTE] |
| AC-EW-005 | Tenant isolation test (TQ-007) | T-16 | [PENDIENTE] |
| AC-EW-006 | Component AuditoriaTab; API 403 | T-14, T-16 | [PENDIENTE — OQ-EW-003] |
| AC-EW-007 | Integration + Component | T-06, T-14, T-17 | [PENDIENTE] |
| AC-EW-008 | Component (no C3 en toasts) | T-12 | [PENDIENTE — OQ-EW-002] |
| AC-EW-009 | E2E Playwright (keyboard) | T-19 | [PENDIENTE] |

---

## Eslabones faltantes / pendientes de completar

Los siguientes eslabones de la cadena SDB→Test están parcialmente vacíos porque
dependen de OQ abiertos o de documentos SDB marcados como `[PENDIENTE]`.
**No son bugs de esta spec; son trabajo pendiente de validación.**

| ID | Eslabón faltante | OQ asociado | Acción requerida |
|----|-----------------|-------------|-----------------|
| GAP-001 | BR exacta de `MarkNotLocated` → apertura automática de Incidencia | OQ-EW-004, OQ-DOM-006 | Validar con dominio; actualizar TR-001/TR-004 |
| GAP-002 | Permisos exactos por tipo de solicitud para `ABRIR_PRESTAMO` | OQ-EW-005, OQ-SPEC-001 | Validar con stakeholders; actualizar TR-004, CapabilityService |
| GAP-003 | Flujo de confirmación digital de custodia por receptor | OQ-EW-006, OQ-SPEC-011 | Definir si requiere endpoint adicional; actualizar TR-004 y comandos |
| GAP-004 | Formato de `pacienteRef.displayLabel` en read model | OQ-EW-002, OQ-SPEC-012 | Confirmar campo mínimo; actualizar TR-009 y `ExpedienteHeader` |
| GAP-005 | Lista de roles con acceso a `AuditoriaTab` | OQ-EW-003, OQ-UX-008 | Confirmar con sec team; actualizar TR-008 y `AuditoriaTab` |
| GAP-006 | Schema exacto de `MovimientoExpediente` (en módulo Expediente vs. separado) | OQ-DOM-001, OQ-DAT-004 | Decisión de arquitectura; actualizar TR-003 y T-07 |
| GAP-007 | Formato y regex del identificador de expediente | OQ-EW-001, OQ-DAT-001 | Confirmar con hospital; actualizar TR-002 y validación de búsqueda |
| GAP-008 | Codificación de ubicaciones temporales oficiales | OQ-EW-008, OQ-DOM-009 | Confirmar con Archivo Clínico; actualizar TR-001 / DAT-019 |
| GAP-009 | SLA de performance para read model (≤ 1 s) | NFR-EW-001 | Confirmar en UAT con carga real; actualizar NFR y test de performance |
| GAP-010 | Política de retención para `MovimientoExpediente` en timeline | OQ-EW-010, OQ-DAT-005, OQ-API-006 | Confirmar con compliance; actualizar TR-003 y paginación |

---

## Historial de cambios de esta traceability

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 0.1.0 | — | Bootstrap vacío (placeholder) |
| 0.2.0 | 2026-08-14 | Primera versión completa: 10 cadenas TR, matrices REQ/AC, 10 GAPs registrados |
