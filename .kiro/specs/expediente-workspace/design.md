---
spec: expediente-workspace
version: "0.2.0"
status: "Draft — pending stakeholder validation"
date: "2026-08-14"
sdb_sources:
  - "Volume-03 / DDD-009–013, DDD-018–020"
  - "Volume-05 / UC-018, SPEC-009, SDD-005, SDD-006"
  - "Volume-07 / SEC-003, SEC-017, SEC-032, SEC-038"
  - "Volume-08 / DAT-006, DAT-011, DAT-012, DAT-019, API-001, API-005, API-006, API-011, DAT-030"
  - "Volume-09 / APP-003, IA-005, DS-014, DEL-002, INT-001–INT-009"
  - "Volume-12 / OS-004, OS-017, OS-018"
requires:
  - requirements.md (v0.2.0)
open_questions_blocking: []
open_questions_non_blocking:
  - OQ-EW-001, OQ-EW-002, OQ-EW-003, OQ-EW-004, OQ-EW-007, OQ-EW-008, OQ-EW-009, OQ-EW-010
---

# Expediente Workspace — Design

---

## 1. Principios de diseño

Estos principios derivan directamente del SDB y no pueden ser violados durante la implementación.

| Principio | Regla | Fuente |
|-----------|-------|--------|
| **Dominio puro** | El dominio no importa NestJS, Drizzle, React ni HTTP | AGENTS.md, steering/structure.md |
| **Autorización server-side** | El backend re-verifica cada petición; el frontend solo recibe `capabilities` | SEC-017, DEL-002 |
| **Tenant immutable** | TenantContext se resuelve server-side; ningún valor de tenant proviene del body | SEC-032, API-005 |
| **Movimiento ≠ Audit** | Trayectoria física y audit log son tablas y read paths distintos | DDD-020, DAT-011, DAT-012 |
| **Sin contenido clínico** | Ningún campo clínico (diagnóstico, nota, tratamiento) en ninguna capa | DDD-013, V05-43 r.10 |
| **UI refleja estado** | El frontend no calcula transiciones; las recibe del API como `capabilities` | INT-001, DEL-002 |
| **Concurrencia explícita** | Comandos críticos requieren `row_version`; conflicto → 409 con metadata | DAT-019 |
| **Audit append-only** | El rol de aplicación no puede UPDATE/DELETE filas de audit | SEC-038, DAT-012 |

---

## 2. Arquitectura por capas

La ruta de datos fluye estrictamente en una sola dirección:

```
Browser (React)
  └─ API Client (generated / typed)
       └─ BFF / Controller  [apps/api]
            └─ Application Use Case  [packages/modules/expediente/application]
                 └─ Repository Port (interface)  [packages/modules/expediente/domain]
                      └─ PostgreSQL Repository Adapter  [packages/platform/persistence]
                           └─ Tenant Database (database-per-tenant)
```

Cada capa tiene responsabilidades estrictamente acotadas:

| Capa | Responsabilidad | Prohibido |
|------|----------------|-----------|
| **Domain** | Aggregate `Expediente`, invariantes, value objects `Custodia`, `Ubicacion`, `MovimientoExpediente` | Importar NestJS, Drizzle, React, HTTP |
| **Application** | Use Cases (`GetExpediente`, `GetExpedienteTimeline`); orquestación; cálculo de `capabilities` | Lógica de infraestructura; acceso directo a DB |
| **Controller (API)** | Deserializar request, resolver TenantContext, llamar Use Case, serializar respuesta | Escribir repositorios directamente; lógica de negocio |
| **React Feature** | Renderizar read model; mostrar `capabilities` como comandos; enviar comandos vía API client | Calcular transiciones de dominio; almacenar estado mutable de negocio |
| **Audit / Outbox** | Registrar eventos con append-only; correlacionar | Mezclar con Movimiento o lógica de negocio |

---

## 3. Modelo de datos relevante (read model)

### 3.1 Aggregate Expediente — campos operativos (DAT-006)

```
expediente
  id                   UUID  PK
  expediente_numero    varchar  UNIQUE per tenant  ← INV-EXP-001
  paciente_ref_id      UUID | null
  paciente_nombre_busqueda  varchar | null        ← dato C3; solo búsqueda
  estado_operativo     varchar  (enum/check)       ← INV-EXP-002
  ubicacion_actual_id  UUID | null  FK → ubicaciones
  custodio_tipo        varchar | null
  custodio_ref         varchar | null
  last_movement_id     UUID | null  FK → movimientos_expediente
  created_at           timestamptz
  updated_at           timestamptz
  row_version          bigint                      ← optimistic concurrency DAT-019
```

**Estado operativo — valores candidatos** (DDD-012, INT-001):

| Valor | Descripción |
|-------|-------------|
| `DISPONIBLE` | En archivo, sin préstamo activo |
| `EN_BUSQUEDA` | Solicitud activa en búsqueda |
| `EN_PREPARACION` | En jornada de preparación |
| `PRESTADO` | Bajo custodia externa formal |
| `EN_TRANSITO` | Movimiento en curso |
| `INCIDENCIA_ABIERTA` | Con incidencia sin resolver |
| `NO_LOCALIZADO` | No encontrado; no declarado extraviado |

> **OQ-EW-OPEN:** La lista exacta y las transiciones válidas entre estados deben ser
> confirmadas por el dominio antes de implementar. Ver DDD-012, OQ-DOM pendientes.

### 3.2 MovimientoExpediente (DAT-011)

```
movimientos_expediente
  id                        UUID  PK
  expediente_id             UUID  FK → expediente
  movement_type             varchar
  origin_location_id        UUID | null
  destination_location_id   UUID | null
  origin_custodian_ref      varchar | null
  destination_custodian_ref varchar | null
  business_reference_type   varchar          ← 'SOLICITUD' | 'PRESTAMO' | 'INCIDENCIA' | ...
  business_reference_id     UUID | null
  occurred_at               timestamptz
  recorded_at               timestamptz
  actor_ref                 varchar
  source                    varchar
  correlation_id            UUID | null
```

Este modelo **no** contiene datos de login, configuración ni audit técnico.

### 3.3 Audit Log (DAT-012) — separado de Movimiento

```
audit_log
  id               UUID  PK
  actor_ref        varchar
  action           varchar
  resource_type    varchar
  resource_id      UUID
  result           varchar
  occurred_at      timestamptz
  request_id       UUID
  correlation_id   UUID | null
  source_ip_hash   varchar | null
  source           varchar
  change_summary   jsonb | null
  security_context jsonb | null   ← minimal; sin payload clínico completo
```

Acceso de la aplicación: **INSERT** únicamente. No UPDATE, no DELETE.

---

## 4. API — Contratos relevantes (API-011)

### 4.1 Endpoints para el Workspace

| Método | Ruta | Propósito | Use Case |
|--------|------|-----------|----------|
| `GET` | `/api/v1/expedientes/{id}` | Read model completo del expediente | UC-018 |
| `GET` | `/api/v1/expedientes?numero={n}` | Búsqueda por número | SPEC-009 FR-VIEW-001 |
| `GET` | `/api/v1/expedientes/{id}/timeline` | Historial de movimientos | SPEC-009 FR-VIEW-007 |
| `GET` | `/api/v1/expedientes/{id}/current-custody` | Custodia actual (sub-resource) | SPEC-009 FR-VIEW-004 |
| `GET` | `/api/v1/expedientes/{id}/active-loan` | Préstamo activo si existe | SPEC-009 FR-VIEW-005 |

### 4.2 Comandos disponibles desde el Workspace (INT-003)

Estos endpoints son invocados desde la barra de comandos contextual.
El Workspace **no** los implementa; los dispara a sus respectivos módulos.

| Intento UI | API endpoint candidato | Comando de dominio |
|------------|----------------------|--------------------|
| Solicitar expediente | `POST /api/v1/solicitudes` | `CreateRequest` |
| Iniciar búsqueda | `POST /api/v1/solicitudes/{id}/start-search` | `StartSearch` |
| Marcar localizado | `POST /api/v1/solicitudes/{id}/mark-located` | `MarkLocated` |
| Marcar no localizado | `POST /api/v1/solicitudes/{id}/mark-not-located` | `MarkNotLocated` |
| Abrir préstamo | `POST /api/v1/prestamos` | `OpenLoan` |
| Renovar préstamo | `POST /api/v1/prestamos/{id}/renew` | `RenewLoan` |
| Recibir devolución | `POST /api/v1/devoluciones` | `ReceiveReturn` |
| Confirmar rearchivo | `POST /api/v1/expedientes/{id}/rearchive` | `ConfirmRearchive` |
| Transferir custodia | `POST /api/v1/expedientes/{id}/custody-transfers` | `TransferCustody` |
| Reportar incidencia | `POST /api/v1/incidencias` | `OpenIncident` |

> Estos comandos son de otros módulos y tienen sus propias specs. El Workspace
> solo consume su resultado y refresca el read model.

### 4.3 Modelo de respuesta — Read Model (candidato)

```jsonc
// GET /api/v1/expedientes/{id}
{
  "id": "uuid",
  "expedienteNumero": "string",
  "pacienteRef": {              // C3 — mínimo necesario para identificación operativa
    "id": "uuid",
    "displayLabel": "string"   // formato exacto: OQ-EW-002
  },
  "estadoOperativo": "DISPONIBLE | EN_BUSQUEDA | ...",
  "ubicacionActual": {
    "id": "uuid",
    "codigo": "string",
    "descripcion": "string"
  },
  "custodiaActual": {
    "custodioTipo": "ARCHIVO | SERVICIO | PERSONAL | ...",
    "custodioRef": "string",
    "servicio": "string | null",
    "aceptadaEn": "ISO8601 | null"
  },
  "prestamoActivo": { ... } | null,
  "solicitudActiva": { ... } | null,
  "incidenciasAbiertas": [ ... ],
  "capabilities": ["SOLICITAR", "INICIAR_BUSQUEDA", "REPORTAR_INCIDENCIA", ...],
  "rowVersion": 42,
  "updatedAt": "ISO8601"
}
```

El campo `capabilities` es calculado server-side por el Use Case considerando:
estado operativo + rol del actor + contexto del negocio (SEC-017).
El frontend solo renderiza lo que `capabilities` contiene.

### 4.4 Manejo de errores (API-006)

```jsonc
// Ejemplo: recurso no encontrado
{ "type": "https://sigac/errors/not-found", "status": 404,
  "code": "EXPEDIENTE_NOT_FOUND", "traceId": "..." }

// Ejemplo: conflicto de concurrencia
{ "type": "https://sigac/errors/conflict", "status": 409,
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "detail": "El expediente fue modificado. Recarga antes de reintentar.",
  "currentVersion": 43, "traceId": "..." }

// Ejemplo: transición inválida
{ "type": "https://sigac/errors/invalid-transition", "status": 409,
  "code": "INVALID_STATE_TRANSITION", "traceId": "..." }
```

Sin stack trace, sin nombre de DB, sin datos clínicos en errores.

---

## 5. Diseño de la UI (APP-003 / IA-005)

### 5.1 Anatomía de la página

```
┌─────────────────────────────────────────────────────┐
│ 1. Global Shell (navegación global, tenant, usuario) │
├─────────────────────────────────────────────────────┤
│ 2. Breadcrumb: Archivo > Expediente > {numero}       │
├─────────────────────────────────────────────────────┤
│ 3. Header del Expediente (above the fold)            │
│    ┌─────────────────────────────────────────────┐   │
│    │ Nº Expediente  | Ref. Paciente (mínima) C3  │   │
│    │ Estado: badge  | Ubicación actual            │   │
│    │ Custodio actual | Indicador Préstamo/Incid.  │   │
│    └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ 4. Barra de Comandos Contextual (capabilities)       │
│    [Solicitar] [Iniciar búsqueda] [Reportar incid.]  │
├─────────────────────────────────────────────────────┤
│ 5. Tabs                                              │
│    Resumen | Movimientos | Solicitudes | Préstamos   │
│            | Incidencias | Auditoría*                │
├─────────────────────────────────────────────────────┤
│ 6. Superficie de trabajo (tab activo)                │
├─────────────────────────────────────────────────────┤
│ 7. Región persistente de feedback / error            │
└─────────────────────────────────────────────────────┘
  * Tab Auditoría: visible solo si capabilities lo incluye
```

### 5.2 Tabs y contenido

| Tab | Contenido | Fuente SDB | Restricción |
|-----|-----------|------------|-------------|
| **Resumen** | Estado operativo expandido, ubicación, custodia detallada, préstamo activo, solicitud activa | APP-003, UC-018 | Todos los roles con `EXPEDIENT_VIEW` |
| **Movimientos** | Timeline de trayectoria física/operativa (DAT-011) | SPEC-009 FR-VIEW-007, DDD-020 | Archivista, Jefatura; Auditor (lectura) |
| **Solicitudes** | Historial de solicitudes del expediente | DDD-014, SPEC-001 | Según permisos de solicitud |
| **Préstamos** | Historial de préstamos (activo + cerrados) | DDD-015, SPEC-006 | Según permisos de préstamo |
| **Incidencias** | Incidencias abiertas y cerradas | DDD-017, SPEC-004 | Según permisos de incidencia |
| **Auditoría** | Registros de audit log (DAT-012) | SEC-038, INT-008 | Roles autorizados — OQ-EW-003 |

### 5.3 Barra de comandos contextual (DS-014)

- Renderiza exactamente los items de `capabilities` del read model.
- Un comando deshabilitado **no** se muestra (no se muestra en gris con tooltip).
  Excepción: si la política de UX decide mostrarlo con explicación — esto debe acordarse.
- Comandos que abren otro flujo/módulo (ej. Abrir Préstamo) navegan al módulo
  correspondiente o abren un drawer/dialog, dependiendo del patrón de interacción acordado.
  > **OQ-EW-DESIGN-001:** ¿Drawer inline vs. navegación a módulo para comandos de estado?
  > Pendiente de decisión de UX.

### 5.4 Estados de la UI (INT-001)

La UI tiene estados derivados, no propios:

| Estado UI | Condición | Comportamiento |
|-----------|-----------|----------------|
| `loading` | Petición en vuelo | Skeleton / spinner; comandos deshabilitados |
| `loaded` | Datos recibidos | Render normal |
| `empty` | Expediente no encontrado (404) | Estado vacío descriptivo (Volume-09 §32) |
| `error` | Error de red / 5xx | Región de error persistente; no sobreescribir datos previos |
| `conflict` | 409 optimistic lock | Banner de conflicto; botón "Recargar"; preservar contexto (INT-006) |
| `stale` | Datos recargados tras conflicto | Recalcular capabilities antes de habilitar comandos |

### 5.5 Privacidad en presentación (INT-009)

- El **número de expediente** es dato C3; no aparece en `document.title`, URL de navegador
  ni en logs de frontend.
- La **referencia de paciente** muestra solo el campo mínimo necesario para identificación
  operativa (formato exacto pendiente: OQ-EW-002).
- Toasts y notificaciones no contienen datos C3.
- Nombres de archivos exportados no contienen datos de paciente.

---

## 6. Módulos del frontend (DEL-002)

```
apps/web/src/features/expediente-workspace/
  ├── index.ts                  # barrel export
  ├── ExpedienteWorkspace.tsx   # page component (routing entry)
  ├── components/
  │   ├── ExpedienteHeader.tsx      # número, ref paciente, estado, ubicación, custodia
  │   ├── CommandBar.tsx            # capabilities → acciones habilitadas
  │   ├── tabs/
  │   │   ├── ResumenTab.tsx
  │   │   ├── MovimientosTab.tsx    # timeline DAT-011
  │   │   ├── SolicitudesTab.tsx
  │   │   ├── PrestamosTab.tsx
  │   │   ├── IncidenciasTab.tsx
  │   │   └── AuditoriaTab.tsx      # solo si capability presente
  ├── hooks/
  │   ├── useExpediente.ts          # fetch + cache del read model
  │   ├── useExpedienteTimeline.ts  # fetch DAT-011 timeline
  │   └── useCapabilities.ts        # derivado del read model; no calcula dominio
  ├── api/
  │   └── expedienteApi.ts          # funciones tipadas sobre el cliente OpenAPI
  └── types/
      └── expediente.types.ts       # tipos derivados del OpenAPI contract
```

**Regla (DEL-002):** El frontend no contiene lógica de transición de dominio autorizada.
`capabilities` viene del API; los hooks derivan de él.

---

## 7. Módulos del backend

### 7.1 Estructura de módulo (steering/structure.md)

```
packages/modules/expediente/
  ├── domain/
  │   ├── Expediente.ts              # aggregate root
  │   ├── ports/
  │   │   └── ExpedienteRepository.ts  # interface (port)
  │   └── value-objects/
  │       ├── Custodia.ts
  │       ├── Ubicacion.ts
  │       └── EstadoOperativo.ts
  ├── application/
  │   ├── GetExpediente.ts           # use case — query
  │   ├── GetExpedienteTimeline.ts   # use case — query
  │   └── ExpedienteCapabilityService.ts  # calcula capabilities
  └── infrastructure/               # (en packages/platform o co-ubicado)
      └── PostgresExpedienteRepository.ts  # adapter

apps/api/src/expediente/
  └── ExpedienteController.ts        # NestJS controller; llama use cases
```

### 7.2 Use Case: GetExpediente

```
Input:  { expedienteId: string, actor: ActorContext, tenant: TenantContext }
Output: ExpedienteReadModel {
          expediente: ...,
          custodiaActual: ...,
          prestamoActivo: ... | null,
          solicitudActiva: ... | null,
          incidenciasAbiertas: [...],
          capabilities: string[]
        }

Pasos:
  1. Verificar autorización: actor tiene EXPEDIENT_VIEW en tenant  → 403 si no
  2. Resolver conexión tenant (server-side, never from body)        → TenantContext
  3. Cargar Expediente por id/numero                               → 404 si no existe
  4. Cargar préstamo activo (si existe)
  5. Cargar solicitud activa (si existe)
  6. Cargar incidencias abiertas (si existen)
  7. Calcular capabilities según estado + actor + contexto
  8. Registrar acceso en audit log
  9. Devolver read model
```

### 7.3 Use Case: GetExpedienteTimeline

```
Input:  { expedienteId: string, actor: ActorContext, tenant: TenantContext,
          pagination: { cursor?, limit } }
Output: MovimientoExpediente[]  (append-only; ordered by occurred_at DESC)

Pasos:
  1. Verificar autorización: actor tiene EXPEDIENT_VIEW en tenant
  2. Cargar movimientos por expediente_id (DAT-011)
  3. NO mezclar con audit_log
  4. Devolver resultado paginado
```

### 7.4 ExpedienteCapabilityService

Calcula el array `capabilities` para un actor dado y un estado de Expediente.
La lógica vive en la capa de **aplicación** (no en el dominio puro, porque requiere
conocer el actor; no en el controller, porque es lógica de negocio).

Entradas: `EstadoOperativo`, `SolicitudActiva?`, `PrestamoActivo?`, `actor.roles`, `actor.permisos`.
Salida: `string[]` — nombres de capabilities válidas.

> Esta lista es la fuente de verdad que el API serializa como `capabilities[]`.

---

## 8. Seguridad y privacidad

| Control | Implementación | Fuente SDB |
|---------|----------------|------------|
| Autenticación | OIDC/BFF; token validado en cada petición | API-034, SEC |
| Autorización | Server-side en Use Case; re-verificación completa | SEC-017, AGENTS.md |
| Tenant isolation | TenantContext server-side; connection pool por tenant | SEC-032, API-005 |
| Datos C3 en logs | No loguear pacienteRef, expedienteNumero, custodioRef | SEC-003, AGENTS.md |
| Audit append | INSERT-only desde rol aplicación; nunca UPDATE/DELETE | SEC-038, DAT-012 |
| Concurrencia | `row_version` en aggregate roots críticos; 409 en conflicto | DAT-019 |
| Errores | RFC7807; sin stack trace, sin nombre DB, sin datos clínicos | API-006 |
| CORS / CSRF | Según Volume 07 §27/28 | SEC-027, SEC-028 |

---

## 9. Testing — capas requeridas (TQ-002)

| Capa | Qué probar | Framework |
|------|-----------|-----------|
| **Domain unit** | Invariantes de Expediente; transiciones de estado válidas/inválidas; cálculo de capabilities | Vitest |
| **Application use case** | GetExpediente con actor autorizado/no autorizado; cálculo de capabilities por estado/rol | Vitest |
| **PostgreSQL integration** | Repository adapter; queries de read model; no cross-tenant | Vitest + PostgreSQL real |
| **API contract** | GET /expedientes/{id} happy path; 404; 403; 409; tenant isolation | Vitest / contract test |
| **Tenant isolation** | Actor de Tenant-A no obtiene expediente de Tenant-B; forged tenant → 403/404 | TQ-007 |
| **Frontend component** | ExpedienteHeader (estados: loading, loaded, empty, error, conflict); CommandBar (capabilities → botones); AuditoriaTab (oculto sin permiso) | Vitest + Testing Library |
| **E2E** | Abrir workspace; ver estado/ubicación/custodia; ejecutar comando disponible; ver conflicto de concurrencia | Playwright |
| **Accesibilidad** | Navegación por teclado; foco visible; ARIA en header y tabs | Playwright / axe |

---

## 10. Dependencias entre módulos

El Workspace consume datos de otros módulos pero **no los implementa**:

| Dato mostrado | Módulo propietario | API consumida |
|---------------|--------------------|---------------|
| Préstamo activo | Módulo Préstamo | `GET /expedientes/{id}/active-loan` |
| Solicitud activa | Módulo Solicitud | (join en read model o sub-query) |
| Incidencias abiertas | Módulo Incidencia | (join en read model) |
| Historial de movimientos | Módulo Expediente / Movimiento | `GET /expedientes/{id}/timeline` |
| Capabilities de préstamo | Módulo Préstamo / AppService | incluidas en `capabilities[]` |

> **OQ-DOM-001** abierta: ¿`MovimientoExpediente` vive en el schema del módulo
> `expediente` o en un schema dedicado? Impacta la estructura del repository adapter.

---

## 11. Preguntas de diseño abiertas

| ID | Pregunta | Impacto |
|----|----------|---------|
| OQ-EW-DESIGN-001 | ¿Comandos de transición abren drawer inline o navegan a otro módulo? | Diseño de CommandBar y flujo UX |
| OQ-EW-DESIGN-002 | ¿`capabilities[]` incluye metadatos de por qué está deshabilitado un comando? | Diseño del read model y UX de comandos no disponibles |
| OQ-EW-DESIGN-003 | ¿El timeline usa cursor-based pagination o offset? | DAT-030, OQ-API-006 |
| OQ-EW-DESIGN-004 | ¿El read model de expediente es un endpoint único o compuesto (BFF aggregate)? | Performance vs. complejidad; relacionado con OQ-API-002 |
| OQ-EW-DESIGN-005 | ¿Dónde vive `ExpedienteCapabilityService`: en application layer del módulo Expediente o es un servicio de orquestación cross-module? | Estructura de packages/modules |
