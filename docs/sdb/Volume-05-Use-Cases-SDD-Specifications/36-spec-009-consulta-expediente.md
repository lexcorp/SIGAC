---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007: FR-VIEW-001 actualizado para 0..N"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# SPEC-009 — Consulta del Expediente

## Requisitos funcionales

FR-VIEW-001 Búsqueda por número de expediente con resultado 0..N.
  - Acepta variantes de separador: `RFC/10`, `RFC-10`, `RFC10`.
  - Si N = 0: estado vacío descriptivo.
  - Si N = 1: abre workspace directamente.
  - Si N > 1: muestra lista con datos mínimos de desambiguación (nombre, CURP, núm. ISSSTE);
    nunca selecciona automáticamente (INV-EXP-003, BR-017).
  - Application usa `SearchExpedientesByNumero` con `ExpedienteNumero` y
    `RequestContext`; autoriza `EXPEDIENT_VIEW` y consulta el Repository tenant-scoped.
  - El resultado es `readonly ExpedienteSearchItem[]`; el summary contiene sólo ID y
    número del Expediente, los cuatro campos canónicos de PacienteReferencia,
    EstadoOperativo y Ubicacion nullable.
  - Una búsqueda válida audita `EXPEDIENTE_SEARCH/EXPEDIENTE/{numeroNormalizado}` como
    success incluso con cero resultados, sin datos C3 en changeSummary.

FR-VIEW-002 Situación actual del expediente: `EstadoOperativo` con los valores aceptados
  (DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO).
  `EN_BUSQUEDA` no es un estado del Expediente.

FR-VIEW-003 Ubicación actual.

FR-VIEW-004 Custodia actual: tipo, referencia, `acceptedAt` si aplica.
  Distinguir entre estado `EN_TRASLADO` (transporte sin custodia aceptada) y
  `EN_CONSULTA` (custodia formalmente aceptada por receptor).

FR-VIEW-005 Préstamo activo si existe (con fuente habilitante visible).

FR-VIEW-006 Incidencias abiertas si existen.

FR-VIEW-007 Historial de movimientos operativos (`MovimientoExpediente`).
  Separado del audit log (Movimiento ≠ Audit).
  Usa cursor pagination opaca con orden `occurredAt DESC, movimientoId DESC`, respuesta
  `{ items, nextCursor }`, sin `total`; ausencia `{ items: [], nextCursor: null }`.

FR-VIEW-008 `capabilities[]` — acciones válidas para el actor en el estado actual.

FR-VIEW-009 El backend compone un único `ExpedienteReadModel`. El Workspace consume
proyecciones 0..1 de Solicitud activa y Préstamo activo, y 0..N de Incidencias abiertas,
siempre por `ExpedienteId` y `TenantContext`. El frontend no compone el read model desde
múltiples dominios.

FR-VIEW-010 Los contratos de proyección son propiedad de Application de Expediente
Workspace y no exponen aggregates ajenos. Sus schemas exactos están definidos en
READ-MODEL-COMPOSITION-DECISION READ-EW-003..012.

FR-VIEW-011 La consulta registra audit append-only en Application mediante `AuditWriter`;
el resultado es `success`, `denied` o `not-found` y el registro no contiene datos C3.

FR-VIEW-012 `GetExpediente` consulta `ExitEnablingSourceQueryPort` con `ExpedienteId` y
`TenantContext`. El puerto retorna `readonly FuenteHabilitanteSalidaContext[]` (`0..N`,
ausencia `[]`), cuyos únicos campos son `tipo` y `validada`.

FR-VIEW-013 El provider determina `validada`. Capabilities sólo evalúa existencia de una
fuente validada `CONSULTA_PROGRAMADA|VALE_ARCHIVO_SM_1_14`; no valida evidencia ni elige
la fuente de OpenLoan. `ORDEN_SUPERIOR` permanece fail-closed incluso validada.

FR-VIEW-014 Timeline requiere `EXPEDIENT_VIEW`, `RequestContext` y TenantContext
server-side. Cross-tenant responde como no encontrado. El acceso se audita sin mezclar
audit entries con movimientos. La retención permanece fuera del alcance.

FR-VIEW-015 Timeline autoriza antes de queries y verifica el Expediente con el Repository
tenant-scoped antes del query port. Audita `EXPEDIENTE_TIMELINE_VIEW` sobre
`EXPEDIENTE/{expedienteId}`: denied sin permission, not-found sin recurso tenant-scoped y
success tanto para página vacía como no vacía. El audit no crea movimientos.

## Non-goals
- No mostrar diagnósticos, notas clínicas, tratamientos ni estudios.
- No seleccionar automáticamente entre coincidencias múltiples.

## Acceptance criteria (selección)

```gherkin
Given un archivista con EXPEDIENT_VIEW
When busca por número "PERR810604/10"
Then el sistema devuelve el expediente único
And muestra EstadoOperativo, ubicación y custodia above the fold

Given un archivista con EXPEDIENT_VIEW
When busca por número "PERR810604-10"
Then el sistema normaliza la variante y devuelve el mismo expediente

Given un número que corresponde a dos derechohabientes distintos
When el archivista busca
Then el sistema muestra lista de desambiguación con nombre/CURP/núm. ISSSTE
And no abre ningún expediente automáticamente

Given un número que no existe en el tenant
When el archivista busca
Then el sistema muestra estado vacío descriptivo
And no revela información de otros tenants

Given un expediente EN_TRASLADO
When el archivista abre el workspace
Then el estado muestra EN_TRASLADO (no EN_CONSULTA)
And la custodia no muestra acceptedAt hasta que CustodyAccepted ocurra
```

## Fuente
UC-018, DDD-013, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007,
DEC-EW-STATE-001, READ-MODEL-COMPOSITION-DECISION.

## API slice v0.3.20

La búsqueda 0..N está respaldada por `SearchExpedientesByNumero` y se publica como
`GET /api/v1/expedientes?numero={numero}`. Retorna siempre `{ items: [...] }`, sin
respuesta singular, total ni paginación. `numero` es obligatorio; ausencia, vacío o
valor inválido produce `HTTP_VALIDATION_ERROR`/400. El controller no consume
`ExpedienteRepository` directamente.
