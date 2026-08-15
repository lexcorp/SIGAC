---
spec: expediente-workspace
version: "0.2.0"
status: "Draft — pending stakeholder validation"
date: "2026-08-14"
requires:
  - requirements.md (v0.2.0)
  - design.md (v0.2.0)
ready_gate: "OS-017 — todos los OQ bloqueantes deben estar resueltos antes de iniciar T-01"
done_gate: "OS-018 — spec + tests + API/migrations + auth/tenant/audit + traceability"
---

# Expediente Workspace — Tasks

> **Regla de oro (AGENTS.md):** No inventar comportamiento faltante.
> Si durante la implementación de cualquier tarea aparece una ambigüedad de invariante,
> permiso o alcance de tenant → STOP_AND_ESCALATE como open question.

---

## Estado de prerequisitos

Antes de ejecutar cualquier tarea de implementación deben estar resueltas:

| OQ bloqueante | Pregunta | Documento |
|---------------|----------|-----------|
| OQ-EW-001 | Formato exacto del identificador de expediente | requirements.md §6 |
| OQ-EW-005 | Permisos exactos para abrir préstamo por tipo de solicitud | requirements.md §6 |
| OQ-EW-006 | ¿La aceptación de custodia requiere confirmación digital del receptor? | requirements.md §6 |

OQ no bloqueantes (pueden quedar abiertos en v1; ver notas en cada tarea):
OQ-EW-002, OQ-EW-003, OQ-EW-004, OQ-EW-007, OQ-EW-008, OQ-EW-009, OQ-EW-010,
OQ-EW-DESIGN-001 a OQ-EW-DESIGN-005.

---

## Grupo 0 — Trazabilidad y validación de spec

### T-00 Resolver trazabilidad exacta y validar spec
- **Descripción:** Revisar y completar `traceability.md`. Confirmar que todo REQ tiene
  fuente SDB, criterio de aceptación y test mapeado. Confirmar que OQ bloqueantes tienen
  respuesta registrada antes de avanzar a T-01.
- **Entregable:** `traceability.md` con todas las cadenas Source→BR→WF→UC→SPEC→API→UI→Test
  completas para las capacidades del Workspace.
- **Criterio de done:** Ningún REQ-EW-* sin trazabilidad completa; OQ bloqueantes resueltos.
- **Fuente:** OS-007, SDD-006, V05-41.
- **Dependencias:** Ninguna (puede ejecutarse en paralelo con T-01 solo si los OQ
  bloqueantes ya están resueltos).

---

## Grupo 1 — Dominio y puerto

### T-01 Implementar value objects de dominio
- **Descripción:** Implementar los value objects necesarios en
  `packages/modules/expediente/domain/value-objects/`:
  - `EstadoOperativo` — enum validado con los valores candidatos del diseño §3.1;
    solo los estados confirmados por DDD-012 y los OQ-DOM resueltos.
  - `Custodia` — VO con campos `custodioTipo`, `custodioRef`, `servicio`, `aceptadaEn`
    (DDD-018).
  - `Ubicacion` — VO con `id`, `codigo`, `descripcion` (DDD-019).
- **Regla:** El dominio no importa NestJS, Drizzle, React ni HTTP (AGENTS.md).
- **Tests requeridos:** Unit tests Vitest — construcción válida, construcción inválida,
  igualdad por valor.
- **Fuente SDB:** DDD-009 (INV-EXP-002), DDD-012, DDD-018, DDD-019.
- **OQ no bloqueante:** OQ-DOM-009 (ubicaciones temporales). Implementar solo las
  categorías confirmadas; dejar extensión abierta.

### T-02 Implementar Aggregate Expediente
- **Descripción:** Implementar `packages/modules/expediente/domain/Expediente.ts`.
  Datos: `ExpedienteId`, `ExpedienteNumero`, `PacienteReferencia` (mínima), `HospitalId`,
  `EstadoOperativo`, `Ubicacion`, `Custodia`, `rowVersion` (DAT-006).
  - Hacer cumplir INV-EXP-001 (identificador institucional) e INV-EXP-002 (coherencia
    operativa) en el constructor / métodos de fábrica.
  - No agregar campos clínicos (diagnósticos, notas, tratamientos).
- **Tests requeridos:** Unit tests Vitest — invariantes válidos; intentar construir
  con datos inválidos; verificar que no acepta campos clínicos en su API pública.
- **Fuente SDB:** DDD-013, DDD-009, DAT-006.
- **Dependencias:** T-01.

### T-03 Definir puerto ExpedienteRepository
- **Descripción:** Definir la interface (port) en
  `packages/modules/expediente/domain/ports/ExpedienteRepository.ts`.
  Métodos mínimos para este workspace:
  ```
  findById(id, tenant): Promise<Expediente | null>
  findByNumero(numero, tenant): Promise<Expediente | null>
  ```
- **Regla:** Solo interface; sin importar Drizzle ni PostgreSQL aquí.
- **Fuente SDB:** AGENTS.md (Clean Architecture), steering/structure.md.
- **Dependencias:** T-02.

---

## Grupo 2 — Aplicación

### T-04 Implementar ExpedienteCapabilityService
- **Descripción:** Implementar
  `packages/modules/expediente/application/ExpedienteCapabilityService.ts`.
  Calcula el array `capabilities[]` dados `EstadoOperativo`, estado de `SolicitudActiva`,
  estado de `PrestamoActivo` e `ActorContext` (roles + permisos).
  - La lógica refleja la Permission × Action Matrix (V05-39, INT-002) para las acciones
    de la barra de comandos del Workspace.
  - Devuelve solo capabilities cuya transición es válida en el estado actual **y** el
    actor tiene permiso para ejecutar.
- **Tests requeridos:**
  - Actor Archivista + estado `DISPONIBLE` → capabilities esperadas.
  - Actor sin `EXPEDIENT_VIEW` → capabilities vacías / error de autorización.
  - Actor Auditor → solo capabilities de lectura.
  - Estado `PRESTADO` → `ABRIR_PRESTAMO` no aparece.
- **Fuente SDB:** SEC-017, SDD-005, DDD-010, DDD-012, INT-001, V05-39.
- **OQ no bloqueante:** OQ-EW-005 (permisos exactos de préstamo). Implementar con
  la política conservadora hasta resolver; marcar como TODO en código.
- **Dependencias:** T-02.

### T-05 Implementar Use Case GetExpediente
- **Descripción:** Implementar
  `packages/modules/expediente/application/GetExpediente.ts`.
  Pasos según design.md §7.2:
  1. Verificar autorización (`EXPEDIENT_VIEW` en tenant) → lanzar error de autorización si no.
  2. Cargar `Expediente` vía `ExpedienteRepository` → 404 si no existe.
  3. Cargar préstamo activo, solicitud activa e incidencias abiertas (joins o queries
     adicionales a sus respectivos repositorios/puertos).
  4. Llamar `ExpedienteCapabilityService`.
  5. Registrar acceso en audit log (actor, acción `EXPEDIENTE_VIEW`, recurso, tenant).
  6. Devolver `ExpedienteReadModel` con `capabilities[]`.
- **Tests requeridos:**
  - Actor autorizado + expediente existente → read model completo con capabilities.
  - Actor no autorizado → error de autorización; NO registra datos del expediente en error.
  - Expediente inexistente → 404; audit registra intento.
  - Actor de Tenant-A no obtiene expediente de Tenant-B (cross-tenant IDOR).
- **Fuente SDB:** UC-018, SPEC-009, SEC-017, SEC-032, SEC-038, DAT-012.
- **Dependencias:** T-03, T-04.

### T-06 Implementar Use Case GetExpedienteTimeline
- **Descripción:** Implementar
  `packages/modules/expediente/application/GetExpedienteTimeline.ts`.
  - Carga `MovimientoExpediente[]` del repositorio (DAT-011), ordenados por
    `occurred_at DESC`.
  - Paginación cursor-based (pendiente confirmar con OQ-EW-DESIGN-003;
    implementar con parámetro `limit` como mínimo).
  - **No** mezcla con `audit_log`.
  - Registra acceso en audit log.
- **Tests requeridos:**
  - Actor autorizado → lista de movimientos correcta.
  - Actor no autorizado → error.
  - Cross-tenant → no devuelve movimientos de otro tenant.
  - Resultado no contiene filas de audit_log.
- **Fuente SDB:** DDD-020, DAT-011, SPEC-009 FR-VIEW-007, INT-008.
- **OQ no bloqueante:** OQ-DOM-001 (¿Movimiento en schema de expediente o separado?).
  Implementar en schema de expediente hasta resolución; dejar interfaz de repositorio
  abstracta para facilitar migración.
- **Dependencias:** T-03.

---

## Grupo 3 — Infraestructura / Persistencia

### T-07 Implementar PostgresExpedienteRepository
- **Descripción:** Implementar el adapter
  `packages/platform/persistence/PostgresExpedienteRepository.ts`
  que satisface el puerto definido en T-03.
  - `findById` y `findByNumero` con TenantContext (connection pool por tenant).
  - Query para `MovimientoExpediente` (timeline).
  - Sin cross-tenant queries.
  - Sin lógica de negocio en el adapter.
- **Tests requeridos:** PostgreSQL integration tests con base real (TQ-005).
  - Insertar expediente; recuperar por id; recuperar por numero.
  - Tenant-A no ve expediente de Tenant-B (clave de aislamiento TQ-007).
- **Fuente SDB:** DAT-006, DAT-011, SEC-032, AGENTS.md.
- **Dependencias:** T-03, migración de esquema (ver T-08).

### T-08 Migración de esquema — tabla expediente y movimientos
- **Descripción:** Crear la migración de base de datos para las tablas `expediente`
  y `movimientos_expediente` en el schema del tenant, con los campos de DAT-006 y
  DAT-011 confirmados.
  - `row_version bigint NOT NULL DEFAULT 0` en `expediente`.
  - Constraints: `expediente_numero UNIQUE` por tenant, `estado_operativo CHECK`.
  - Tablas `audit_log` se definen en su propia migración (fuera de scope de esta
    tarea, pero el Use Case las usa).
  - La migración no genera datos clínicos.
- **Regla (AGENTS.md):** Todo cambio de schema requiere migración; no modificar
  schema existente sin revisar migraciones previas.
- **Fuente SDB:** DAT-006, DAT-011, DAT-023 (migrations policy).
- **Dependencias:** T-03.

---

## Grupo 4 — API / Controller

### T-09 Implementar ExpedienteController
- **Descripción:** Implementar `apps/api/src/expediente/ExpedienteController.ts`
  (NestJS controller).
  Endpoints:
  - `GET /api/v1/expedientes/:id` → llama `GetExpediente`.
  - `GET /api/v1/expedientes?numero=` → llama `GetExpediente` (por numero).
  - `GET /api/v1/expedientes/:id/timeline` → llama `GetExpedienteTimeline`.
  - `GET /api/v1/expedientes/:id/current-custody` → sub-recurso de custodia.
  - `GET /api/v1/expedientes/:id/active-loan` → sub-recurso de préstamo activo.
  - El controller deserializa, resuelve TenantContext (server-side), llama use case
    y serializa la respuesta.
  - El controller **no** escribe repositorios directamente.
  - Errores: RFC7807 (API-006); sin stack trace, sin nombre de DB, sin datos clínicos.
- **Tests requeridos:** API contract tests — happy path, 404, 403, 409, tenant isolation.
- **Fuente SDB:** API-001, API-005, API-006, API-011, AGENTS.md.
- **Dependencias:** T-05, T-06.

### T-10 Actualizar contrato OpenAPI
- **Descripción:** Actualizar el contrato OpenAPI (`openapi/`) para reflejar los
  endpoints de T-09:
  - Schemas de respuesta para `ExpedienteReadModel`, `MovimientoExpediente[]`,
    `capabilities[]`.
  - Error responses (404, 403, 409) con formato RFC7807.
  - Parámetros de paginación para timeline.
- **Regla (AGENTS.md, steering/api.md):** Todo cambio de API requiere actualizar OpenAPI.
- **Fuente SDB:** API-001, API-011, API-006, DAT-019.
- **Dependencias:** T-09.

---

## Grupo 5 — Frontend

### T-11 Implementar feature module expediente-workspace (estructura)
- **Descripción:** Crear la estructura de carpetas y archivos vacíos (barrels, tipos)
  definida en design.md §6.
  - Tipos derivados del OpenAPI contract generado (no duplicar manualmente).
  - Hook `useExpediente` con fetch + invalidación.
  - Hook `useExpedienteTimeline` con paginación.
  - `useCapabilities` derivado del read model (no calcula dominio).
- **Fuente SDB:** DEL-002, INT-001.
- **Dependencias:** T-10 (necesita el contrato OpenAPI para generar tipos).

### T-12 Implementar ExpedienteHeader
- **Descripción:** Componente que renderiza el bloque "above the fold":
  número de expediente, referencia mínima de paciente (OQ-EW-002 no bloqueante;
  usar campo provisional hasta resolución), estado operativo con badge semántico,
  ubicación actual, custodio actual, indicador de préstamo activo e incidencias.
  - Datos C3 no aparecen en `document.title` ni en atributos visibles al scraper.
  - Skeleton/loading state.
  - Estado empty si expediente no encontrado.
- **Tests requeridos:** Unit tests Vitest + Testing Library — loading, loaded, empty,
  error; verificar que no se renderizan datos clínicos.
- **Fuente SDB:** APP-003, IA-005, INT-009, SEC-003, DEL-005.
- **Dependencias:** T-11.

### T-13 Implementar CommandBar
- **Descripción:** Componente que renderiza los comandos del array `capabilities[]`.
  - Un comando presente en `capabilities` → botón habilitado.
  - Un comando ausente → no se renderiza (regla de diseño; ver OQ-EW-DESIGN-002 para
    posible extensión con metadatos de deshabilitado).
  - Navegación por teclado (Enter/Space); foco visible (DEL-005, Volume-09 §07).
  - Comandos que disparan transición muestran estado de carga mientras petición
    está en vuelo; se deshabilitan para evitar doble-click.
- **Tests requeridos:**
  - `capabilities = ['SOLICITAR']` → solo botón Solicitar visible.
  - `capabilities = []` → ningún botón visible.
  - Teclado: Tab y Enter activan comando.
- **Fuente SDB:** DS-014, INT-001, INT-003, DEL-005.
- **Dependencias:** T-11.

### T-14 Implementar tabs del Workspace
- **Descripción:** Implementar los seis tabs definidos en design.md §5.2:
  - `ResumenTab` — estado expandido, custodia detallada, préstamo activo, solicitud activa.
  - `MovimientosTab` — timeline de `MovimientoExpediente`; paginado; no mezcla audit.
  - `SolicitudesTab` — historial de solicitudes del expediente (consume endpoint de
    módulo Solicitud; scope: solo listado).
  - `PrestamosTab` — historial de préstamos (consume endpoint de módulo Préstamo).
  - `IncidenciasTab` — incidencias abiertas y cerradas.
  - `AuditoriaTab` — visible **solo** si `capabilities` incluye permiso de auditoría
    (OQ-EW-003 no bloqueante; implementar con flag de capability).
- **Tests requeridos:** Cada tab tiene tests de loading/empty/error. `AuditoriaTab`
  oculto cuando capability ausente; visible cuando presente.
- **Fuente SDB:** APP-003, INT-008 (Audit ≠ Movimientos), TQ-009.
- **Dependencias:** T-12, T-13.

### T-15 Implementar manejo de concurrencia en UI
- **Descripción:** Manejar el estado `conflict` (409 optimistic lock) en el Workspace.
  - Al recibir 409 desde cualquier comando: mostrar banner persistente con mensaje
    claro (INT-006); ofrecer botón "Recargar"; preservar los datos que el usuario
    tenía en pantalla.
  - Al recargar: invalidar cache del read model; recalcular capabilities.
  - No sobreescribir silenciosamente.
- **Tests requeridos:** Simular respuesta 409; verificar que el banner aparece; que los
  datos anteriores se mantienen visibles; que el botón "Recargar" funciona.
- **Fuente SDB:** DAT-019, INT-006, API-006.
- **Dependencias:** T-12, T-13, T-14.

---

## Grupo 6 — Seguridad, aislamiento y audit

### T-16 Añadir tests de autorización y tenant isolation
- **Descripción:** Tests explícitos de seguridad:
  - Actor sin `EXPEDIENT_VIEW` → use case lanza error; controller devuelve 403.
  - Actor de Tenant-A solicita expediente de Tenant-B → 404 (no revela existencia).
  - Token forjado / tenant forjado en body → rechazado server-side.
  - `AuditoriaTab` no retorna datos a actor sin permiso de auditoría.
- **Fuente SDB:** SEC-017, SEC-032, TQ-007, AGENTS.md.
- **Dependencias:** T-05, T-09.

### T-17 Verificar audit trail completo
- **Descripción:** Confirmar que todas las acciones del Workspace generan entrada en
  `audit_log` con campos obligatorios: `actor_ref`, `action`, `resource_type`,
  `resource_id`, `result`, `occurred_at`, `tenant` (implícito en schema), `request_id`.
  - `GET /expedientes/{id}` → audit entry `EXPEDIENTE_VIEW`.
  - Comandos de transición → audit entry del comando respectivo.
  - Intentos de acceso no autorizados → audit entry de intento fallido.
  - Verificar que audit_log no contiene datos C3 en campos de log (no en
    `change_summary` sin protección).
- **Tests requeridos:** Integration tests que verifican inserción en `audit_log`
  tras cada operación.
- **Fuente SDB:** SEC-038, DAT-012, AGENTS.md.
- **Dependencias:** T-05, T-06, T-09.

---

## Grupo 7 — E2E y calidad final

### T-18 Añadir tests de integración PostgreSQL
- **Descripción:** Tests de integración con PostgreSQL real (no mock) que cubran:
  - `findById` y `findByNumero` del adapter.
  - Timeline de movimientos con múltiples entradas.
  - Verificación de `row_version` en optimistic locking.
  - Aislamiento de tenant (query en schema correcto).
- **Fuente SDB:** TQ-005, TQ-007, steering/testing.md.
- **Dependencias:** T-07, T-08.

### T-19 Añadir tests E2E Playwright
- **Descripción:** Escenarios E2E mínimos (TQ-010):
  1. Archivista abre Workspace de expediente existente → ve estado, ubicación y custodia.
  2. Archivista abre Workspace de expediente inexistente → ve estado vacío descriptivo.
  3. CommandBar muestra comando correcto según estado; comando ausente no aparece.
  4. Conflicto de concurrencia (simular 409) → banner de conflicto visible; datos preservados.
  5. Tab Auditoría oculto para rol sin permiso; visible para auditor.
  6. Navegación completa por teclado (accesibilidad).
- **Fuente SDB:** TQ-010, DEL-005, Volume-09 §07.
- **Dependencias:** T-14, T-15, T-16.

### T-20 Ejecutar pipeline CI y verificar quality gates
- **Descripción:** Ejecutar pipeline completo (`.github/workflows/ci.yml`) y confirmar:
  - Build sin errores.
  - Todos los tests pasan (unit, integration, E2E).
  - Sin violaciones de lint / type-check.
  - Sin datos C3 en logs de test.
  - Cobertura de acceptance criteria (AC-EW-001 a AC-EW-009) verificada.
- **Fuente SDB:** TQ-017 (quality gates), OS-018 (Definition of Done).
- **Dependencias:** Todas las tareas anteriores.

---

## Resumen de dependencias

```
T-00 (trazabilidad)
 └─ independiente (ejecutar antes o en paralelo)

T-01 (value objects)
 └─ T-02 (aggregate)
      ├─ T-03 (port) ──────────────────────┐
      │    ├─ T-07 (adapter) ←─ T-08       │
      │    └─ T-06 (timeline use case)     │
      └─ T-04 (capabilities service)       │
           └─ T-05 (GetExpediente UC) ─────┤
                └─ T-09 (controller) ──────┤
                     └─ T-10 (OpenAPI)     │
                          └─ T-11 (FE structure)
                               ├─ T-12 (Header)
                               ├─ T-13 (CommandBar)
                               └─ T-14 (Tabs)
                                    └─ T-15 (Concurrency UX)

T-16 (auth + tenant tests) ← T-05, T-09
T-17 (audit trail)         ← T-05, T-06, T-09
T-18 (integration tests)   ← T-07, T-08
T-19 (E2E Playwright)      ← T-14, T-15, T-16
T-20 (CI pipeline)         ← todas
```

---

## Notas de implementación

- **Ninguna tarea debe inventar comportamiento:** si un invariante, permiso o transición
  de estado no está en el SDB o en los OQ resueltos, parar y escalar (AGENTS.md).
- **Las tareas T-01 a T-09 son backend-primeras:** el frontend (T-11+) no puede
  implementar capabilities que el backend no devuelve.
- **T-08 (migración) precede a T-07 (adapter):** no adaptar a un schema que no existe.
- **T-00 no es opcional:** la trazabilidad completa es requisito de Definition of Done.
