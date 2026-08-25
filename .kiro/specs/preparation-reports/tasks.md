---
spec: preparation-reports
version: "0.1.1"
status: "Approved for Implementation"
date: "2026-08-26"
amended: "2026-08-26 — ADR-0031 Agenda Shift Determination"
requires:
  - "requirements.md v0.1.0"
  - "design.md v0.1.0"
parent_spec: "agenda-preparation v0.1.7"
prerequisite_tasks: "T-00..T-08 de agenda-preparation en PASS"
---

# Preparation Reports — Tasks

## 1. Reglas de ejecución

- La precedencia es: decisiones aprobadas (ADR-0030, esta spec) → spec padre
  `agenda-preparation` → esta spec → código existente.
- Las tareas T-20..T-27 se ejecutan después de que T-00..T-08 de `agenda-preparation`
  estén en PASS.
- Antes de cada task se leen sus fuentes y se comprueban todas sus dependencias.
- No se implementa una task dependiente si su predecesora no está en PASS.
- Cada cambio de comportamiento incluye tests proporcionales.
- No se introduce ningún Aggregate nuevo de dominio.
- Todos los fixtures usan datos sintéticos desidentificados.
- TenantContext siempre es server-resolved; no existen queries ni transacciones cross-tenant.
- El motor PDF (PDFKit) vive exclusivamente en `packages/platform/pdf`; el dominio y
  Application no importan PDFKit.

## 2. STOP_AND_ESCALATE

Detener la implementación y no avanzar a tasks dependientes si es necesario:

- agregar campos de PII a `PreparationItem` sin spec aprobada;
- crear un nuevo Aggregate de dominio para PDF o reportes;
- escribir el PDF a filesystem o storage sin aprobación;
- inventar permisos distintos a `AGENDA_PRINT`;
- cambiar invariantes de `agenda-preparation`;
- cruzar tenants en cualquier query;
- añadir datos clínicos (diagnósticos, notas, signos vitales) al PDF;
- introducir Turno, Consultorio, Destino;
- contradecir ADR-0030 usando un motor PDF distinto a PDFKit.
- agregar campo `turno` a la tabla `citas` o persistirlo en cualquier tabla.
- leer turno desde SIMEF o desde cualquier campo de base de datos.
- reimplementar `deriveShift` dentro del adapter PDF en lugar de importarla
  desde `@sigac/agenda-preparation` (ADR-0031 v1.1: vive en Application).
- exponer `shift` en la API JSON sin un ADR de cambio de contrato (aplazado a T-28+).

## 3. Dependency graph

```
T-20 (AGENDA_PRINT en catálogo)
  |
  v
T-21 (PreparationReportGeneratorPort + GeneratePreparationReport)
  |
  v
T-22 (PDFKitPreparationReportGenerator adapter)
  |
  v
T-23 (API endpoint + OpenAPI)
  |
  +-------> T-24 (Frontend: PreparationTable + ReportWizard)
  |
  v
T-25 (Security + privacy + tenant hardening)
  |
  v
T-26 (Integration tests con PostgreSQL real)
  |
  v
T-27 (E2E + cierre)
```

## 4. Tasks

---

### T-20 — Agregar permiso AGENDA_PRINT al catálogo

**Dependencias:** T-08 de `agenda-preparation` en PASS.

**Fuentes:** REQ-PR-005, design.md §6.3.

**Objetivo:** registrar `AGENDA_PRINT` como permission explícita en el catálogo de
`packages/platform/tenant/src/index.ts`, sin modificar permisos existentes ni derivar
acceso automático desde roles.

**Entregables:**
- Constante `AGENDA_PRINT` exportada desde `@sigac/tenant`.
- Documentación inline: qué autoriza y qué no autoriza.

**Tests:**
- Typecheck: `AGENDA_PRINT` es accesible desde `@sigac/tenant`.
- Unit: verificar que la constante tiene el valor de string exacto `'AGENDA_PRINT'`.
- Verificar que no existe colisión con los permisos existentes
  (`AGENDA_VIEW`, `AGENDA_IMPORT`, `AGENDA_INCIDENT_VIEW`).

**Criterio de done (gate):** `pnpm typecheck` y `pnpm test --filter @sigac/tenant` en PASS.
`AGENDA_PRINT` está en el catálogo y es importable.

---

### T-21 — Application: port `PreparationReportGeneratorPort` y use case `GeneratePreparationReport`

**Dependencias:** T-20.

**Fuentes:** REQ-PR-002, REQ-PR-006, REQ-PR-007, REQ-PR-008, design.md §5.

**Objetivo:** implementar el contrato del port de generación y el use case de
Application que orquesta: obtener items, filtrar por servicio, validar que existen citas
activas, invocar el generator port y escribir el audit log.

**Entregables:**

1. `packages/modules/agenda-preparation/src/application/ports/PreparationReportGeneratorPort.ts`
   — interfaces `ReportGenerationRequest`, `ReportGenerationResult`,
   `PreparationReportGeneratorPort`.
2. `packages/modules/agenda-preparation/src/application/use-cases/GeneratePreparationReport.ts`
   — use case con dependencias inyectadas: `PreparationListQueryPort`,
   `PreparationReportGeneratorPort`, `AuditWriter`.
3. Clase de error `NoActiveAppointmentsError` (error de dominio de Application).
4. **`packages/modules/agenda-preparation/src/application/deriveShift.ts`**
   — función pura `deriveShift(appointmentTime): AgendaShift` y tipo `AgendaShift`
   (ADR-0031 v1.1). Tests en `deriveShift.test.ts` del mismo directorio.
5. Actualización de `packages/modules/agenda-preparation/src/index.ts` con los nuevos exports
   incluyendo `deriveShift` y `AgendaShift`.

**Flujo a implementar (ver design.md §5.2):**
1. `listForPrint()` → array de `PreparationItem`.
2. Filtrar por `services` si se provee.
3. Si vacío → `NoActiveAppointmentsError`.
4. `generate()` → `{ stream, filename }`.
5. `auditWriter.write(...)` con campos aprobados y sin PII.
6. Return `{ stream, filename }`.

**El use case NO debe:**
- importar PDFKit ni ninguna clase de `packages/platform`.
- conocer HTTP, NestJS o React.
- escribir en filesystem.
- crear un Aggregate nuevo.

**Tests (unit con mocks):**

| Caso | Comportamiento esperado |
|---|---|
| Items disponibles, sin filtro de servicios | Llama `generate()` con todos los items, escribe audit SUCCESS |
| Items disponibles, con filtro de servicios | Solo pasa items del servicio solicitado a `generate()` |
| Filtro deja items vacíos | Lanza `NoActiveAppointmentsError`, no llama `generate()` |
| `listForPrint()` retorna vacío | Lanza `NoActiveAppointmentsError` |
| Audit entry | No contiene nombre, folio ni CURP; contiene agendaDate y recordCount |
| Tenant propagation | `listForPrint()` recibe el TenantContext correcto |
| deriveShift MATUTINO | `deriveShift('07:00')` → `'MATUTINO'` |
| deriveShift VESPERTINO | `deriveShift('14:00')` → `'VESPERTINO'` |
| deriveShift límite 13:59 | `deriveShift('13:59')` → `'MATUTINO'` (no cruza a VESPERTINO) |
| deriveShift borde 00:00 | `deriveShift('00:00')` → `'MATUTINO'` |
| deriveShift es función pura | Mismo input siempre produce mismo output; sin I/O |

**Criterio de done (gate):** typecheck + tests unit en PASS; ninguna dependencia de infra
en el use case.

---

### T-22 — Infrastructure: `PDFKitPreparationReportGenerator` adapter

**Dependencias:** T-21.

**Fuentes:** REQ-PR-002, REQ-PR-003, REQ-PR-004, REQ-PR-009, design.md §6, ADR-0030, ADR-0031.

**Objetivo:** implementar el adapter PDFKit que recibe `PreparationItem[]` y genera el
PDF estructurado conforme al formato aprobado en design.md §6.1 y ADR-0031. El adapter
implementa `PreparationReportGeneratorPort` e incluye `deriveShift()` como función
pura interna para calcular el turno desde `appointmentTime`.

**Entregables:**

1. `packages/platform/pdf/src/PDFKitPreparationReportGenerator.ts`
   — implementa `PreparationReportGeneratorPort`.
2. `packages/platform/pdf/src/index.ts` — export del adapter.
3. `packages/platform/pdf/package.json` — nombre `@sigac/pdf`, dependencia
   `pdfkit` con versión exacta (`^0.15.x` — verificar latest estable antes de fijar).
4. Agregar `@sigac/pdf` como workspace dependency en el módulo que lo necesite.

**Comportamiento requerido:**

- Ordenar items: `servicioEspecialidad.codigo ASC` → `medico.numeroEmpleado ASC` →
  `appointmentTime ASC`.
- Por cada grupo servicio+médico: nueva página (excepto primera), encabezado, tabla,
  total de expedientes.
- Encabezado: título institucional, fecha (`DD/MM/YYYY`), servicio (nombre + código),
  médico (nombre + número empleado).
- Tabla columnas: Hora, Expediente, Derechohabiente, Folio.
- Pie de página: `Página P de TOTAL` (usar `bufferPages: true` para conocer el total).
- Stream readable como resultado.
- `filename = "lista-preparacion-{YYYY-MM-DD}.pdf"`.

**El adapter NO debe:**
- incluir CURP, fecha de nacimiento, teléfono, email, edad, sexo.
- escribir en filesystem.
- importar nada de `apps/`.
- reimplementar `deriveShift` — debe importarla desde `@sigac/agenda-preparation`
  (ADR-0031 v1.1). Si la función no existe en el paquete, STOP_AND_ESCALATE.
- agregar campo `turno` al contrato de `PreparationItem`.

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| PDF básico 1 médico | Unit | Genera PDF > 0 bytes con un item sintético |
| PDF múltiples médicos | Unit | Cada médico genera al menos una página separada |
| Agrupación correcta | Unit | Items del mismo médico aparecen en el mismo bloque |
| Turno en encabezado | Unit | Encabezado de bloque incluye MATUTINO o VESPERTINO |
| Orden de columnas | Unit | Columnas Hora, Expediente, Derechohabiente, Folio presentes |
| Privacidad — sin patrones CURP | Unit (PBT) | Para todo array de items sintéticos generados por fast-check, el PDF extraído como texto no contiene patrones CURP (`/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/`) |
| Array vacío | Unit | Lanza error descriptivo (el use case evita esto, pero el adapter es defensivo) |
| filename correcto | Unit | `lista-preparacion-2026-08-26.pdf` para fecha `2026-08-26` |
| Turno en encabezado PDF matutino | Unit | Bloque con hora 07:00 muestra 'MATUTINO' en encabezado |
| Turno en encabezado PDF vespertino | Unit | Bloque con hora 14:00 muestra 'VESPERTINO' en encabezado |
| Sin reimplementación de deriveShift | Unit | El adapter NO define una función `deriveShift` propia |

**Criterio de done (gate):** typecheck + tests en PASS; PDFKit no importado fuera de
`packages/platform/pdf`.

---

### T-23 — API: endpoint `POST /api/v1/agendas/{date}/preparation-report` + OpenAPI

**Dependencias:** T-22.

**Fuentes:** REQ-PR-002, REQ-PR-005, design.md §7, contrato HTTP aprobado en requirements.md §4.

**Objetivo:** exponer el endpoint HTTP en NestJS, validar permisos server-side, conectar
el use case y actualizar el contrato OpenAPI.

**Entregables:**

1. Nuevo método en `AgendaPreparationController`:
   - `@Post(':date/preparation-report')`.
   - Verifica `AGENDA_VIEW` + `AGENDA_PRINT` desde `RequestContext`.
   - Delega a `GeneratePreparationReport` use case.
   - Escribe headers `Content-Type: application/pdf` y `Content-Disposition`.
   - Hace pipe del stream hacia `Response`.
2. `GeneratePreparationReportDto` con validaciones class-validator.
3. Registro de `GeneratePreparationReport` y `PDFKitPreparationReportGenerator` en
   `AgendaPreparationModule`.
4. Actualización del contrato OpenAPI con el nuevo endpoint (ver design.md §9).

**El controller NO debe:**
- acceder a Repositories, queries, TenantRouter ni PDFKit directamente.
- calcular autorización con lógica propia.
- generar el PDF.

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| 200 con citas activas | Integration (mock use case) | Respuesta PDF con headers correctos |
| 403 sin AGENDA_PRINT | Integration | Rechaza antes de llamar use case |
| 403 sin AGENDA_VIEW | Integration | Rechaza antes de llamar use case |
| 422 sin citas activas | Integration | `NoActiveAppointmentsError` → 422 con RFC 7807 |
| 422 fecha inválida | Integration | Fecha mal formada → 422 |
| Body válido con services | Integration | DTO deserializado correctamente |
| OpenAPI válido | Contract | `openapi-validator` en PASS |

**Criterio de done (gate):** typecheck + API tests + OpenAPI validation en PASS.

---

### T-24 — Frontend: `PreparationTable.tsx` + `ReportWizard.tsx` + tab "Paquetes"

**Dependencias:** T-23.

**Fuentes:** REQ-PR-001, REQ-PR-002, design.md §8.

**Objetivo:** reemplazar la vista de acordeones actual con la tabla plana paginada,
añadir el asistente de generación PDF y añadir el tab "Paquetes" en
`AgendaPreparationWorkspace.tsx`. Eliminar el uso de `window.print()`.

**Entregables:**

1. `apps/web/src/agenda-preparation/components/PreparationTable.tsx`:
   - Tabla plana accesible (`role="table"`, headers `scope`, `aria-label`).
   - Columnas: Hora, Expediente, Folio, Derechohabiente, Tipo consulta, Médico, Servicio.
   - Filtros: fecha, servicio (select), médico (select).
   - Búsqueda de texto libre por folio / expediente.
   - Paginación offset de 50 registros por página.
   - Selector de orden con reset de paginación.
   - Estados: cargando, vacío, error.

2. `apps/web/src/agenda-preparation/components/ReportWizard.tsx`:
   - Lista de servicios disponibles (derivada de los items actuales).
   - Selección múltiple de servicios.
   - Selector de orden.
   - Botón "Generar PDF" visible según permiso `AGENDA_PRINT` en claims del token.
   - `POST /api/v1/agendas/{date}/preparation-report` → descarga del blob.
   - Mensajes de error accesibles para 403, 422 y error genérico.

3. `AgendaPreparationWorkspace.tsx`: nuevo tab "Paquetes" con `ReportWizard`.

4. Eliminar cualquier llamada a `window.print()` del módulo.

**El frontend NO debe:**
- calcular autorización de permisos.
- generar PDF localmente.
- acceder al DOM para imprimir.

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| Tabla renderiza items | Unit (Vitest + Testing Library) | Datos aparecen en filas |
| Filtro por servicio | Unit | Solo las filas del servicio seleccionado son visibles |
| Paginación | Unit | Página 2 muestra registros 51-100 |
| Búsqueda por folio | Unit | Solo filas con folio coincidente son visibles |
| Cambiar orden reinicia paginación | Unit | Primera página al cambiar orden |
| Estado vacío | Unit | Mensaje accesible cuando no hay datos |
| ReportWizard: botón deshabilitado sin AGENDA_PRINT | Unit | Botón no visible / deshabilitado |
| ReportWizard: descarga en éxito | Unit (mock fetch) | Blob descargado con filename correcto |
| ReportWizard: 422 muestra mensaje | Unit | Mensaje de error accesible |
| Accesibilidad tabla | Accessibility (axe) | Sin violaciones WCAG 2.1 AA |
| Build | Build | `pnpm build --filter apps/web` en PASS |

**Criterio de done (gate):** typecheck + tests UI + build en PASS; `window.print()` eliminado.

---

### T-25 — Security, privacidad y tenant hardening

**Dependencias:** T-24.

**Fuentes:** REQ-PR-004, REQ-PR-007, INV-PR-001..INV-PR-008, design.md §10.2.

**Objetivo:** verificar que los permisos, aislamiento tenant, minimización de datos en el
PDF y controles de privacidad son correctos y no hay regresiones de seguridad.

**Verificaciones:**

1. **Permisos:**
   - Actor sin `AGENDA_PRINT` → 403. ✓
   - Actor sin `AGENDA_VIEW` → 403. ✓
   - Actor con ambos permisos → 200. ✓

2. **Tenant isolation:**
   - Tenant B no puede obtener el PDF con datos del Tenant A. ✓
   - El body de la petición no puede establecer el tenant. ✓

3. **Minimización / privacidad del PDF:**
   - El PDF generado con datos sintéticos no contiene patrones CURP. ✓
   - El PDF no contiene campos que no sean: hora, expediente, nombrePaciente, folio, turno derivado. ✓
   - El turno no proviene de la DB ni de SIMEF (solo derivado de hora). ✓
   - El filename no contiene datos de paciente. ✓

4. **Logs:**
   - El audit log no contiene nombre de paciente, folio individual ni CURP. ✓
   - Los logs de error no exponen PII. ✓

5. **Sin escritura en filesystem:**
   - El PDF no se escribe en disco en ningún escenario. ✓

**Tests:**

| Caso | Tipo | Descripción |
|---|---|---|
| Cross-tenant | Integration | Tenant B recibe 403 al intentar acceder a agenda de Tenant A |
| Permisos parciales | Integration | Solo AGENDA_VIEW → 403 |
| Privacy scan PDF | Unit (PBT) | Búsqueda de patrones CURP, teléfono en PDF generado |
| Audit sin PII | Unit | Entry de audit no contiene nombre, folio ni expediente individual |
| filename sin PII | Unit | filename no contiene datos de paciente |

**Criterio de done (gate):** todos los tests de seguridad y privacidad en PASS;
revisión de código sin hallazgos bloqueantes.

---

### T-26 — Integration tests con PostgreSQL real

**Dependencias:** T-25.

**Fuentes:** AC-PR-001..AC-PR-013, design.md §10.2.

**Objetivo:** validar el flujo completo `controller → use case → PreparationListQueryPort
→ PostgreSQL real → PDFKitPreparationReportGenerator → stream` con tenant isolation
obligatorio y migrations vigentes.

**Entregables:**

- Suite de integration tests contra PostgreSQL real con tenant de test.
- Fixtures sintéticos desidentificados para la base de datos de test.

**Tests:**

| Caso | Descripción |
|---|---|
| PDF para fecha con citas | POST genera PDF > 0 bytes; Content-Type y Content-Disposition correctos |
| 422 para fecha sin citas | POST con fecha sin citas activas → 422 RFC 7807 |
| Filtro por servicios | POST con services=["CL05"] solo incluye citas de CL05 |
| Tenant isolation real | Tenant B no obtiene datos de Tenant A en PostgreSQL real |
| Audit log escrito | Entrada en audit_log con action AGENDA_REPORT_GENERATED |
| PDF con múltiples médicos | Orden correcto en el PDF agrupado |

**Prerrequisito:** tenant de test con migrations de `agenda-preparation` aplicadas;
fixtures sintéticos insertados.

**Criterio de done (gate):** todos los integration tests con PostgreSQL real en PASS;
tenant isolation verificado con DB real.

---

### T-27 — E2E + cierre de spec

**Dependencias:** T-26.

**Fuentes:** AC-PR-001..AC-PR-013, REQ-PR-001..REQ-PR-008.

**Objetivo:** ejecutar flujo real de punta a punta con Playwright, verificar todos los
quality gates y cerrar la trazabilidad de la spec.

**Tests E2E (Playwright):**

| Escenario | Descripción |
|---|---|
| Descarga autorizada | Actor con AGENDA_VIEW + AGENDA_PRINT: navega, hace clic en "Generar PDF", descarga comienza |
| 403 sin AGENDA_PRINT | Actor con solo AGENDA_VIEW: botón "Generar PDF" no visible o deshabilitado; si accede directo al endpoint → 403 |
| Tabla paginada funciona | Actor visualiza la tabla plana, filtra por servicio, navega páginas |
| Filtro por médico | Actor filtra por médico, solo las filas correspondientes son visibles |
| Tab "Paquetes" visible | Tab "Paquetes" aparece en AgendaPreparationWorkspace |

**Quality gates mínimos para cierre:**

```
□ pnpm lint           — sin errores bloqueantes
□ pnpm typecheck      — sin errores de tipos
□ pnpm test --run     — unit + integration en PASS
□ pnpm build          — build completo en PASS
□ OpenAPI validation  — contrato válido
□ Playwright E2E      — escenarios de la lista en PASS
□ Privacy scan        — sin PII en PDF generado
□ Tenant isolation    — verificado con DB real
□ git diff --check    — sin archivos no comprometidos
```

**Entregables de cierre:**

- Actualización del bloque Readiness en `requirements.md` y `design.md`:
  `implementation_ready: true`.
- Trazabilidad REQ-PR-001..REQ-PR-008 → AC-PR-001..AC-PR-013 → tasks T-20..T-27.

**Criterio de done (gate):** todos los quality gates en PASS; spec marcada como
`implementation: COMPLETE`.

---

## 5. Checkpoints

| Grupo | Tasks | Gate mínimo |
|---|---|---|
| Permisos | T-20 | Typecheck + unit test de catálogo |
| Application | T-21 | Typecheck + unit tests con mocks |
| PDF adapter | T-22 | Typecheck + unit + PBT privacy |
| API / OpenAPI | T-23 | API tests + OpenAPI validation |
| Frontend | T-24 | Typecheck + UI tests + build |
| Security / Privacy | T-25 | Tests de permisos + tenant + privacy scan |
| Integration | T-26 | PostgreSQL real + tenant isolation |
| E2E / Cierre | T-27 | Playwright + pipeline completo |

## 6. Estado inicial

| Task | Estado |
|---|---|
| T-20 | NOT STARTED |
| T-21 | NOT STARTED |
| T-22 | NOT STARTED |
| T-23 | NOT STARTED |
| T-24 | NOT STARTED |
| T-25 | NOT STARTED |
| T-26 | NOT STARTED |
| T-27 | NOT STARTED |

No puede declararse `preparation-reports implementation: COMPLETE` hasta que T-27 y
todos sus quality gates estén en PASS.
