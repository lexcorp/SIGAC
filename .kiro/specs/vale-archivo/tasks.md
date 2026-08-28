---
spec: vale-archivo
version: "0.1.0"
status: "Approved for Implementation"
date: "2026-08-26"
requires:
  - "requirements.md v0.1.0"
  - "design.md v0.1.0"
bounded_context: "Vale Archivo / Solicitudes Extraordinarias"
prerequisite_tasks: "ninguna task de otro spec en PASS requerida antes de T-30"
---

# Implementation Plan: Vale Archivo

## Overview

### 1. Reglas de ejecución

- La precedencia es: decisiones aprobadas (ADR-0032, ADR-0033, ADR-0034, esta spec) → código
  existente → esta spec → implementación.
- Las tareas T-30..T-39 se ejecutan en el orden indicado; ninguna task dependiente se
  inicia si su predecesora no está en PASS.
- Antes de cada task se leen sus fuentes (requirements.md, design.md, ADRs) y se
  comprueban todas sus dependencias.
- Cada cambio de comportamiento incluye tests proporcionales.
- No se introduce ningún Aggregate nuevo fuera de `ValeArchivo`.
- Todos los fixtures usan datos sintéticos desidentificados.
- `TenantContext` siempre es server-resolved; no existen queries ni transacciones
  cross-tenant.
- El motor PDF (PDFKit) vive exclusivamente en `packages/platform/pdf`; el dominio y
  Application no importan PDFKit.
- Este spec está `Approved for Implementation` desde 2026-08-26. Las tareas T-30..T-39
  pueden ejecutarse en el orden indicado.

## Notes

### 2. STOP_AND_ESCALATE

Detener la implementación y no avanzar a tasks dependientes si es necesario:

- agregar campos de PII (CURP, teléfono, fecha de nacimiento) a `ValeArchivoItem` sin spec aprobada;
- crear un nuevo Aggregate de dominio para PDF o reportes;
- escribir el PDF a filesystem o storage sin aprobación;
- inventar permisos distintos a los definidos en design.md §ADR-0033;
- crear permisos distintos a `ARCHIVE_REQUEST_VIEW`, `ARCHIVE_REQUEST_PROCESS`, `ARCHIVE_REQUEST_DELIVER` y `REQUEST_CREATE` para Vale Archivo (ADR-0033);
- cruzar tenants en cualquier query;
- añadir datos clínicos (diagnósticos, notas, signos vitales) al PDF o al dominio;
- importar `@sigac/agenda-preparation` desde `@sigac/vale-archivo` (ADR-0032);
- retroceder el estado de un `ValeArchivo` (INV-VA-010);
- contradecir ADR-0032 mezclando bounded contexts;
- contradecir ADR-0033 creando permisos redundantes;
- introducir el concepto de Turno (MATUTINO/VESPERTINO) en cualquier campo, filtro, PDF o respuesta de Vale Archivo (INV-VA-011 — el turno pertenece exclusivamente a Agenda Preparation);
- agregar una columna `tenant_id` a las tablas `vale_archivo` o `vale_archivo_items` (ADR-0034 — el aislamiento es database-per-tenant).

## 3. Dependency graph

```
T-30 (ARCHIVE_REQUEST_VIEW en catálogo)
  │
  ▼
T-31 (ValeArchivo aggregate + value objects + errors)
  │
  ▼
T-32 (Application: ports + use cases VA-001, VA-003, VA-004)
  │
  ▼
T-33 (Application: use cases VA-005, VA-006, VA-007)
  │
  ▼
T-34 (Infrastructure: migration + PostgresValeArchivoRepository)
  │
  ▼
T-35 (API: VA-001, VA-003 + OpenAPI)
  │
  ▼
T-36 (API: VA-004, VA-005, VA-006, VA-007 + OpenAPI)
  │
  ▼
T-37 (PDF: PDFKitValeArchivoGenerator SM 1-14)
  │
  ▼
T-38 (Security + integration tests)
  │
  ▼
T-39 (E2E + cierre de spec)
```

## Tasks

### 4. Tasks

---

### T-30 — Agregar permisos específicos de Vale Archivo al catálogo

**Dependencias:** ninguna.

**Fuentes:** REQ-VA-003..REQ-VA-006, design.md §ADR-0033.

**Objetivo:** agregar los tres permisos específicos del bounded context Vale Archivo al
array `PERMISSIONS` en `packages/platform/tenant/src/index.ts`. Los permisos existentes
(`REQUEST_CREATE`, `REQUEST_ASSIGN`, `SEARCH_START`, `SEARCH_MARK_LOCATED`,
`SEARCH_MARK_NOT_LOCATED`, `CUSTODY_TRANSFER`) se verifican como presentes y **no se
modifican**.

**Entregables:**
- `ARCHIVE_REQUEST_VIEW` en el array `PERMISSIONS`:
  - Qué autoriza: consultar la lista de vales SM 1-14, obtener el detalle de un vale y
    generar el PDF SM 1-14. No autoriza crear ni modificar vales.
  - No se deriva automáticamente de ningún rol.
- `ARCHIVE_REQUEST_PROCESS` en el array `PERMISSIONS`:
  - Qué autoriza: iniciar la búsqueda de un vale y registrar la localización por ítem
    (LOCALIZADO / NO_LOCALIZADO). Específico para el procesamiento de vales SM 1-14.
  - No se deriva automáticamente de ningún rol.
- `ARCHIVE_REQUEST_DELIVER` en el array `PERMISSIONS`:
  - Qué autoriza: registrar la entrega de expedientes y transicionar el vale a
    ENTREGADA o CERRADA. Específico para el cierre del ciclo del vale SM 1-14.
  - No se deriva automáticamente de ningún rol.
- Comentario inline en el catálogo identificando estos tres permisos como pertenecientes
  al bounded context Vale Archivo (ADR-0033).

**Tests:**
- Typecheck: los tres permisos son accesibles como `Permission` desde `@sigac/tenant`.
- Unit: cada constante tiene su valor exacto (`'ARCHIVE_REQUEST_VIEW'`, etc.).
- Unit: los permisos existentes del catálogo (`REQUEST_CREATE`, `SEARCH_START`,
  `CUSTODY_TRANSFER`, etc.) no fueron eliminados ni renombrados.
- Unit: no existe colisión de valores entre ningún par de permisos del catálogo.

**Criterio de done (gate):** `pnpm typecheck` y `pnpm test --filter @sigac/tenant` en PASS.
Los tres permisos están en el catálogo y son importables.

---

### T-31 — Domain: ValeArchivo aggregate + value objects + errores

**Dependencias:** T-30.

**Fuentes:** REQ-VA-001..REQ-VA-007, INV-VA-001..INV-VA-010, design.md §5.

**Objetivo:** implementar el Aggregate `ValeArchivo` con su máquina de estados completa,
la entity `ValeArchivoItem`, todos los value objects y los errores de dominio. El Domain
no importa NestJS, Drizzle, PDFKit ni HTTP.

**Estructura a crear:**

```
packages/modules/vale-archivo/
  src/
    domain/
      aggregates/ValeArchivo.ts         ← Aggregate root con transiciones
      entities/ValeArchivoItem.ts       ← Entity dentro del Aggregate
      value-objects/
        EstadoVale.ts                   ← union type + guard isEstadoVale()
        EstadoBusqueda.ts               ← union type + guard
        SolicitanteReferencia.ts        ← { nombre, cargo } + validación
        ValeArchivoId.ts                ← branded string UUID
        NumeroVale.ts                   ← branded string texto libre
      errors/ValeArchivoErrors.ts       ← ValeRequiereItemsError, InvalidStateTransitionError,
                                           ValeArchivoNotFoundError, ValeArchivoItemNotFoundError
      index.ts
    index.ts
  package.json                          ← "name": "@sigac/vale-archivo"
  tsconfig.json
```

**Comportamiento requerido del Aggregate (ver design.md §5.4):**

- `ValeArchivo.create(props): ValeArchivo` → estado `RECIBIDA`; falla si `items` vacío.
- `vale.iniciarBusqueda(actorId, occurredAt)` → `RECIBIDA` → `EN_BUSQUEDA`.
- `vale.registrarLocalizacion(itemId, estadoBusqueda, ubicacion, observaciones, now)` →
  actualiza ítem; si todos resueltos, transiciona el vale automáticamente.
- `vale.registrarEntrega(actorId, receptor, itemIds, entregadoAt)` →
  `COMPLETA|PARCIAL` → `ENTREGADA`.
- `vale.cerrarAdministrativamente(actorId, motivo, now)` → `NO_LOCALIZADA` → `CERRADA`.
- Transiciones inválidas lanzan `InvalidStateTransitionError`.

**Tests (unit puros, sin mocks de infra):**

| Caso | Comportamiento esperado |
|---|---|
| Crear con ítems válidos | Estado `RECIBIDA`, ítems en `PENDIENTE` |
| Crear con 0 ítems | `ValeRequiereItemsError` |
| `iniciarBusqueda` desde `RECIBIDA` | Estado → `EN_BUSQUEDA` |
| `iniciarBusqueda` desde `EN_BUSQUEDA` | `InvalidStateTransitionError` |
| Todos localizados → COMPLETA | Transición automática correcta |
| Todos no localizados → NO_LOCALIZADA | Transición automática correcta |
| Mezcla → PARCIAL | Transición automática correcta |
| `registrarEntrega` desde `COMPLETA` | Estado → `ENTREGADA` |
| `registrarEntrega` desde `RECIBIDA` | `InvalidStateTransitionError` |
| `cerrarAdministrativamente` desde `NO_LOCALIZADA` | Estado → `CERRADA` |
| `cerrarAdministrativamente` desde `ENTREGADA` | `InvalidStateTransitionError` |
| Observaciones > 500 chars | Error de dominio o truncamiento según diseño |
| Property 1: combinaciones de ítems | Estado resultante siempre correcto |
| Property 2: no retroceso | Ninguna transición lleva a estado anterior |
| Property 4: items vacío | `ValeRequiereItemsError` siempre |

**Criterio de done (gate):** `pnpm typecheck` y `pnpm test --filter @sigac/vale-archivo`
para tests de dominio en PASS. Sin dependencias de infra en el Domain layer.

---

### T-32 — Application: ports + use cases VA-001, VA-003, VA-004

**Dependencias:** T-31.

**Fuentes:** REQ-VA-001, REQ-VA-003, REQ-VA-004, design.md §6.

**Objetivo:** implementar los ports de escritura y lectura, y los use cases
`RegistrarVale`, `ConsultarVales` e `IniciarBusqueda`. El Application no importa PDFKit
ni clases de `packages/platform`.

**Entregables:**

1. `packages/modules/vale-archivo/src/application/ports/ValeArchivoRepository.ts`
2. `packages/modules/vale-archivo/src/application/ports/ValeArchivoQueryPort.ts`
   (interfaces `ValeArchivoPageFilter`, `ValeArchivoSummary`, `ValeArchivoPage`).
3. `packages/modules/vale-archivo/src/application/ports/ValeArchivoReportGeneratorPort.ts`
4. `packages/modules/vale-archivo/src/application/use-cases/RegistrarVale.ts`
5. `packages/modules/vale-archivo/src/application/use-cases/ConsultarVales.ts`
6. `packages/modules/vale-archivo/src/application/use-cases/IniciarBusqueda.ts`
7. Actualización de `packages/modules/vale-archivo/src/application/index.ts`.

**Tests (unit con mocks):**

| Caso | Comportamiento esperado |
|---|---|
| `RegistrarVale` con ítems válidos | Llama `repository.save()`; retorna `{ id, estado: 'RECIBIDA' }` |
| `RegistrarVale` con 0 ítems | Lanza `ValeRequiereItemsError`; no llama `save()` |
| `RegistrarVale` audit entry | Contiene `valeId`, `actorId`, `itemCount`; sin nombres de pacientes |
| `RegistrarVale` tenant propagation | `repository.save()` recibe el TenantContext correcto |
| `ConsultarVales` filtra por estado | `queryPort.findPage()` recibe filtro correcto |
| `ConsultarVales` cursor paginación | `nextCursor` propagado correctamente |
| `IniciarBusqueda` desde RECIBIDA | Llama `repository.save()` con estado `EN_BUSQUEDA` |
| `IniciarBusqueda` desde EN_BUSQUEDA | Lanza `InvalidStateTransitionError` |
| `IniciarBusqueda` audit entry | Contiene `valeId`, `actorId`; sin PII |
| `IniciarBusqueda` vale no existe | Lanza `ValeArchivoNotFoundError` |

**Criterio de done (gate):** typecheck + unit tests en PASS; ninguna dependencia de infra
en los use cases.

---

### T-33 — Application: use cases VA-005, VA-006, VA-007

**Dependencias:** T-32.

**Fuentes:** REQ-VA-005, REQ-VA-006, REQ-VA-007, design.md §6.2.

**Objetivo:** implementar `RegistrarLocalizacion`, `RegistrarEntrega`,
`CerrarValeAdministrativo` y `GenerarPdfVale`.

**Entregables:**

1. `packages/modules/vale-archivo/src/application/use-cases/RegistrarLocalizacion.ts`
2. `packages/modules/vale-archivo/src/application/use-cases/RegistrarEntrega.ts`
3. `packages/modules/vale-archivo/src/application/use-cases/CerrarValeAdministrativo.ts`
4. `packages/modules/vale-archivo/src/application/use-cases/GenerarPdfVale.ts`
5. Actualización de `index.ts` con los nuevos exports.

**Tests (unit con mocks):**

| Caso | Comportamiento esperado |
|---|---|
| `RegistrarLocalizacion` ítem LOCALIZADO | Actualiza ítem; si es el último, transiciona vale |
| `RegistrarLocalizacion` último ítem mezcla | Estado vale → `PARCIAL` |
| `RegistrarLocalizacion` último ítem todos NO_LOCALIZADO | Estado vale → `NO_LOCALIZADA` |
| `RegistrarLocalizacion` vale no EN_BUSQUEDA | `InvalidStateTransitionError` |
| `RegistrarLocalizacion` audit solo cuando cambia estado vale | Audit escrito únicamente en transición |
| `RegistrarEntrega` desde COMPLETA | Estado → `ENTREGADA`; audit sin PII |
| `RegistrarEntrega` desde PARCIAL | Estado → `ENTREGADA`; audit sin PII |
| `RegistrarEntrega` desde RECIBIDA | `InvalidStateTransitionError` |
| `CerrarValeAdministrativo` desde NO_LOCALIZADA | Estado → `CERRADA` |
| `CerrarValeAdministrativo` desde ENTREGADA | `InvalidStateTransitionError` |
| `GenerarPdfVale` vale existe | Llama `pdfGenerator.generate()`; retorna stream + filename |
| `GenerarPdfVale` vale no existe | Lanza error 404 equivalente |
| `GenerarPdfVale` audit entry | Contiene `valeId`, `actorId`; sin PII |

**Criterio de done (gate):** typecheck + unit tests en PASS.

---

### T-34 — Infrastructure: migration + PostgresValeArchivoRepository

**Dependencias:** T-33.

**Fuentes:** design.md §8.

**Objetivo:** crear la migration SQL con las tablas `vale_archivo` y
`vale_archivo_items`, e implementar los adapters PostgreSQL.

**Entregables:**

1. Migration SQL en `packages/platform/database/migrations/` (o path equivalente del
   proyecto) con nombre descriptivo `create_vale_archivo_tables`.
   - Tablas: `vale_archivo`, `vale_archivo_items` con constraints y check constraints
     del diseño.
   - Índices: `idx_vale_archivo_estado`, `idx_vale_archivo_fecha_sol`,
     `idx_vale_archivo_unidad`, `idx_vale_archivo_items_vale_id`.
2. `packages/modules/vale-archivo/src/infrastructure/PostgresValeArchivoRepository.ts`
   — implementa `ValeArchivoRepository` usando `TenantSessionExecutor`.
3. `packages/modules/vale-archivo/src/infrastructure/PostgresValeArchivoQueryAdapter.ts`
   — implementa `ValeArchivoQueryPort` con cursor-based pagination.
4. `packages/modules/vale-archivo/src/infrastructure/ValeArchivoMapper.ts`
   — mapea rows de DB a `ValeArchivoSnapshot` y viceversa.

**Tests (integration básicos con PostgreSQL real):**

| Caso | Comportamiento esperado |
|---|---|
| Migration aplica sin errores | `pnpm db:migrate` en PASS para tenant de test |
| `save` + `findById` round-trip | Vale recuperado con todos sus ítems intactos |
| `findPage` sin filtros | Devuelve página de vales en orden determinístico |
| `findPage` filtro estado | Solo vales en el estado indicado |
| `findPage` cursor paginación | Segunda página no repite ítems de la primera |
| Tenant isolation (DB real) | Tenant B no puede recuperar vales de Tenant A |

**Criterio de done (gate):** migration aplica + integration tests en PASS con
PostgreSQL real.

---

### T-35 — API: endpoints VA-001, VA-003 + OpenAPI

**Dependencias:** T-34.

**Fuentes:** REQ-VA-001, REQ-VA-003, design.md §9.

**Objetivo:** exponer `POST /api/v1/vale-archivo` y
`GET /api/v1/vale-archivo` en NestJS, validar permisos server-side y actualizar
el contrato OpenAPI.

**Entregables:**

1. `apps/api/src/vale-archivo/ValeArchivoModule.ts` — registra todos los providers.
2. `apps/api/src/vale-archivo/controllers/ValeArchivoController.ts` — métodos
   `crearVale` y `listarVales`.
3. `apps/api/src/vale-archivo/dtos/CreateValeArchivoDto.ts` con validaciones
   class-validator.
4. Registro de `ValeArchivoModule` en el módulo raíz de la aplicación.
5. Actualización del contrato OpenAPI con los dos nuevos endpoints.

**Tests (API con mock del use case):**

| Caso | Tipo | Descripción |
|---|---|---|
| 201 con cuerpo válido | Integration | Vale creado; respuesta incluye `id` y `estado` |
| 403 sin REQUEST_CREATE | Integration | Rechaza antes de llamar use case |
| 422 sin ítems | Integration | `ValeRequiereItemsError` → 422 RFC 7807 |
| 422 cuerpo inválido | Integration | DTO mal formado → 422 |
| 200 GET lista | Integration | Respuesta paginada con cursor |
| 403 GET sin ARCHIVE_REQUEST_VIEW | Integration | Rechaza antes de llamar use case |
| Filtro estado | Integration | DTO query params deserializados correctamente |
| OpenAPI válido | Contract | `openapi-validator` en PASS |

**Criterio de done (gate):** typecheck + API tests + OpenAPI validation en PASS.

---

### T-36 — API: endpoints VA-004, VA-005, VA-006, VA-007 + OpenAPI

**Dependencias:** T-35.

**Fuentes:** REQ-VA-004..REQ-VA-007, design.md §9.

**Objetivo:** exponer los endpoints de transición de estado y actualizar el contrato
OpenAPI.

**Entregables:**

1. Métodos en `ValeArchivoController`:
   - `POST /:id/iniciar-busqueda` (ARCHIVE_REQUEST_PROCESS)
   - `PATCH /:id/items/:itemId` (ARCHIVE_REQUEST_PROCESS)
   - `POST /:id/entrega` (ARCHIVE_REQUEST_DELIVER)
   - `POST /:id/cerrar` (REQUEST_CREATE | REQUEST_ASSIGN)
   - `GET /:id` — detalle completo
2. DTOs: `UpdateValeArchivoItemDto`, `RegistrarEntregaDto`.
3. Actualización del contrato OpenAPI con los cinco nuevos endpoints.

**Tests (API con mock del use case):**

| Caso | Tipo | Descripción |
|---|---|---|
| 200 iniciar búsqueda | Integration | Estado → EN_BUSQUEDA |
| 403 iniciar búsqueda sin ARCHIVE_REQUEST_PROCESS | Integration | Rechaza antes de use case |
| 422 iniciar búsqueda estado inválido | Integration | `InvalidStateTransitionError` → 422 |
| 200 PATCH ítem LOCALIZADO | Integration | Ítem actualizado; estado vale si cambia |
| 403 PATCH ítem sin ARCHIVE_REQUEST_PROCESS | Integration | Rechaza correctamente |
| 200 entrega desde COMPLETA | Integration | Estado → ENTREGADA |
| 403 entrega sin ARCHIVE_REQUEST_DELIVER | Integration | Rechaza |
| 422 entrega estado inválido | Integration | `InvalidStateTransitionError` → 422 |
| 200 cerrar NO_LOCALIZADA | Integration | Estado → CERRADA |
| 404 vale inexistente | Integration | 404 RFC 7807 |
| OpenAPI válido | Contract | `openapi-validator` en PASS |

**Criterio de done (gate):** typecheck + API tests + OpenAPI validation en PASS.

---

### T-37 — PDF: PDFKitValeArchivoGenerator (SM 1-14)

**Dependencias:** T-36.

**Fuentes:** REQ-VA-002, INV-VA-004, INV-VA-008, INV-VA-009, design.md §7.

**Objetivo:** implementar el adapter PDFKit que genera la representación digital del
formato SM 1-14 a partir de `ValeArchivoSnapshot`. Reutiliza `@sigac/pdf` (ya creado
en preparation-reports). El adapter implementa `ValeArchivoReportGeneratorPort`.

**Entregables:**

1. `packages/platform/pdf/src/PDFKitValeArchivoGenerator.ts`
   — implementa `ValeArchivoReportGeneratorPort`.
2. Actualización de `packages/platform/pdf/src/index.ts` con el nuevo export.

**Comportamiento requerido:**

- Encabezado institucional: `ISSSTE — [HOSPITAL]`, `ARCHIVO CLÍNICO`,
  `SOLICITUD DE PRÉSTAMO DE EXPEDIENTE CLÍNICO (SM 1-14)`.
- Sección de identificación: número de vale, fechas (`DD/MM/YYYY`), unidad,
  solicitante (nombre + cargo), autorizador (nombre + cargo).
- Tabla de expedientes: columnas `#`, `Expediente`, `Derechohabiente`, `Especialidad`.
- Total de expedientes al final.
- Sección de entrega (si `receptorEntrega` está presente): nombre del receptor y fecha.
- Numeración `Página P de TOTAL` en pie (`bufferPages: true`).
- `filename = "sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf"` donde la fecha es `fechaSolicitud`.
- Stream readable como resultado.

**El adapter NO debe:**
- incluir CURP, teléfono, fecha de nacimiento, correo, edad, sexo.
- escribir en filesystem.
- importar nada de `apps/` ni de `@sigac/agenda-preparation`.
- usar `estadoBusqueda` individual de los ítems en el documento (no es parte del SM 1-14).

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| PDF básico 1 expediente | Unit | Genera PDF > 0 bytes con un ítem sintético |
| PDF múltiples ítems | Unit | Tabla incluye todos los ítems |
| Encabezado correcto | Unit | Número de vale y fechas presentes en contenido extraído |
| Columnas presentes | Unit | `Expediente`, `Derechohabiente`, `Especialidad` en el texto |
| filename correcto | Unit | `sm1-14-VA-2026-00142-2026-08-26.pdf` para datos de ejemplo |
| Sección entrega con datos | Unit | `receptorEntrega` presente cuando hay entrega registrada |
| Array vacío | Unit | Lanza error descriptivo (defensivo) |
| Property 3: sin patrones CURP | Unit (PBT) | Para todo array sintético → PDF sin CURP, teléfono |
| Property 5: filename sin PII | Unit (PBT) | filename no contiene `pacienteNombre` ni expediente |
| Sin `estadoBusqueda` en PDF | Unit | El campo no aparece en el texto extraído del PDF |

**Criterio de done (gate):** typecheck + unit tests + PBT privacy en PASS.

---

### T-38 — Security + integration tests

**Dependencias:** T-37.

**Fuentes:** REQ-VA-005.7, REQ-VA-007 (todos los criterios de seguridad),
INV-VA-005..INV-VA-010, design.md §11 (testing strategy).

**Objetivo:** verificar que permisos, tenant isolation, minimización de datos en el PDF
y controles de privacidad son correctos y sin regresiones.

**Verificaciones:**

1. **Permisos:**
   - Sin `REQUEST_CREATE` → 403 al crear.
   - Sin `ARCHIVE_REQUEST_VIEW` → 403 al listar.
   - Sin `ARCHIVE_REQUEST_PROCESS` → 403 al iniciar búsqueda o registrar localización.
   - Sin `ARCHIVE_REQUEST_DELIVER` → 403 al registrar entrega.
   - Con permisos correctos → operación exitosa.

2. **Tenant isolation:**
   - Tenant B no puede leer vales de Tenant A (403 o 404).
   - El body de la petición no puede establecer el tenant.
   - Creación de vale con datos de Tenant A no aparece en consulta de Tenant B.

3. **Minimización / privacidad del PDF:**
   - PDF generado con datos sintéticos no contiene patrones CURP.
   - PDF no contiene teléfono, fecha de nacimiento, correo.
   - Filename no contiene datos de paciente.
   - `estadoBusqueda` individual no aparece en el PDF.

4. **Audit log:**
   - Cada transición de estado tiene entrada en `audit_log`.
   - Ninguna entrada contiene nombres de pacientes individuales ni CURP.
   - Los logs de error no exponen PII.

5. **Sin escritura en filesystem:**
   - El PDF no se escribe en disco en ningún escenario de test.

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| Cross-tenant vale | Integration | Tenant B → 403/404 al leer vale de Tenant A |
| Cross-tenant lista | Integration | Tenant B → lista vacía o 403 (no ve vales de Tenant A) |
| Permiso parcial | Integration | Solo `ARCHIVE_REQUEST_PROCESS` sin `ARCHIVE_REQUEST_VIEW` → 403 en lista |
| Privacy scan PDF | Unit (PBT) | Patrones CURP, teléfono ausentes en todo PDF sintético |
| Audit sin PII | Unit | Ninguna entry de audit tiene `pacienteNombre`, expediente individual |
| filename sin PII | Unit | filename sigue patrón exacto sin PII de paciente |
| Estado en audit | Integration | Cada transición → entry en `audit_log` con `valeId` y `actorId` |

**Criterio de done (gate):** todos los tests de seguridad y privacidad en PASS;
revisión de código sin hallazgos bloqueantes.

---

### T-39 — E2E + cierre de spec

**Dependencias:** T-38.

**Fuentes:** AC-VA-001..AC-VA-015, REQ-VA-001..REQ-VA-007.

**Objetivo:** ejecutar flujo real de punta a punta con Playwright, verificar todos los
quality gates y cerrar la trazabilidad de la spec.

**Tests E2E (Playwright):**

| Escenario | Descripción |
|---|---|
| Flujo completo VA-001 → VA-006 | Crear vale → iniciar búsqueda → localizar ítems → entregar → cerrar |
| Flujo NO_LOCALIZADA → CERRADA | Crear → iniciar búsqueda → todos no localizados → cierre administrativo |
| Actor sin REQUEST_CREATE | Botón "Crear Vale" no visible o endpoint retorna 403 |
| Actor sin ARCHIVE_REQUEST_VIEW | Lista de vales retorna 403 |
| PDF descargado | Actor autorizado descarga PDF con filename correcto |
| Filtro por estado | Lista filtrada por `estado=EN_BUSQUEDA` muestra solo vales en ese estado |
| Paginación cursor | Navegar a segunda página no repite vales de la primera |

**Quality gates mínimos para cierre:**

```
□ pnpm lint                — sin errores bloqueantes
□ pnpm typecheck           — sin errores de tipos
□ pnpm test --run          — unit + integration en PASS
□ pnpm build               — build completo en PASS
□ OpenAPI validation       — contrato válido
□ Playwright E2E           — escenarios de la lista en PASS
□ Privacy scan             — sin CURP/teléfono/DOB en PDF generado
□ Tenant isolation         — verificado con DB real
□ Audit log                — entrada por cada transición de estado
□ git diff --check         — sin archivos no comprometidos
```

**Entregables de cierre:**

- Actualización del bloque `Implementation Readiness` en `requirements.md`:
  `implementation_ready: true`.
- Actualización de `design.md` §14: `implementation_ready: true`.
- Actualización de `tasks.md` frontmatter: `status: "Approved for Implementation"`.
- Trazabilidad completa: REQ-VA-001..REQ-VA-007 → AC-VA-001..AC-VA-015 → T-30..T-39.

**Criterio de done (gate):** todos los quality gates en PASS; spec marcada como
`implementation: COMPLETE`.

---

## 5. Checkpoints

| Grupo | Tasks | Gate mínimo |
|---|---|---|
| Permisos | T-30 | Typecheck + unit test de catálogo |
| Domain | T-31 | Typecheck + unit tests de máquina de estados |
| Application (creación + consulta) | T-32 | Typecheck + unit tests con mocks |
| Application (transiciones + PDF) | T-33 | Typecheck + unit tests con mocks |
| Infrastructure | T-34 | Migration + integration tests PostgreSQL básicos |
| API (crear + listar) | T-35 | API tests + OpenAPI validation |
| API (transiciones) | T-36 | API tests + permisos + OpenAPI validation |
| PDF adapter | T-37 | Unit tests + PBT privacy |
| Security / Privacy | T-38 | Tests de permisos + tenant + privacy scan |
| E2E / Cierre | T-39 | Playwright + pipeline completo |

## 6. Estado inicial

| Task | Estado |
|---|---|
| T-30 | NOT STARTED |
| T-31 | NOT STARTED |
| T-32 | NOT STARTED |
| T-33 | NOT STARTED |
| T-34 | NOT STARTED |
| T-35 | NOT STARTED |
| T-36 | NOT STARTED |
| T-37 | NOT STARTED |
| T-38 | NOT STARTED |
| T-39 | NOT STARTED |

No puede declararse `vale-archivo implementation: COMPLETE` hasta que T-39 y
todos sus quality gates estén en PASS.

## Task Dependency Graph

### 7. Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["T-30"] },
    { "id": 1, "tasks": ["T-31"] },
    { "id": 2, "tasks": ["T-32"] },
    { "id": 3, "tasks": ["T-33"] },
    { "id": 4, "tasks": ["T-34"] },
    { "id": 5, "tasks": ["T-35"] },
    { "id": 6, "tasks": ["T-36"] },
    { "id": 7, "tasks": ["T-37"] },
    { "id": 8, "tasks": ["T-38"] },
    { "id": 9, "tasks": ["T-39"] }
  ]
}
```
