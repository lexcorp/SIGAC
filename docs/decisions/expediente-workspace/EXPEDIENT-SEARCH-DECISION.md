# Expediente Search Decision

Status: **APPROVED**
Scope: Expediente Workspace v0.3.20

## SEARCH-EW-001 — Input

Application incorpora el Use Case canónico `SearchExpedientesByNumero`:

```typescript
interface SearchExpedientesByNumeroInput {
  readonly numero: ExpedienteNumero;
  readonly context: RequestContext;
}
```

`ExpedienteNumero` es el VO existente y la única autoridad para aceptar y normalizar
variantes con `/`, `-` o sin separador. El Use Case no duplica esa normalización.

## SEARCH-EW-002 — Output

```typescript
interface ExpedienteSearchItem {
  readonly expedienteId: string;
  readonly expedienteNumero: string;
  readonly paciente: {
    readonly idInstitucional: string;
    readonly curp: string;
    readonly nombreOperativo: string;
    readonly numeroIssste: string;
  };
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacion: Ubicacion | null;
}
```

El bloque `paciente` reutiliza los cuatro campos obligatorios de la
`PacienteReferencia` canónica. El resultado es `readonly ExpedienteSearchItem[]`, con
cardinalidad 0..N. No incluye custodia, préstamo, solicitud, incidencias, timeline,
capabilities ni otros datos C3.

## SEARCH-EW-003 — Repository

El Use Case invoca exclusivamente
`ExpedienteRepository.findByNumero(numero, context.tenant)`. El Repository conserva el
resultado 0..N y el aislamiento tenant-scoped. El controller no accede al Repository.

## SEARCH-EW-004 — Authorization

La búsqueda requiere `EXPEDIENT_VIEW`. No existe `EXPEDIENT_SEARCH`. La falta de
permission produce `ApplicationError(PERMISSION_DENIED)`, posteriormente HTTP 403.

## SEARCH-EW-005 — Audit

Toda búsqueda estructuralmente válida registra mediante `AuditWriter`:

- `action = EXPEDIENTE_SEARCH`;
- `resourceType = EXPEDIENTE`;
- `resourceId = ExpedienteNumero` normalizado;
- `result = success`, tanto con cero como con N resultados.

Cero resultados no es `not-found`. `changeSummary` no contiene nombres, CURP, número
ISSSTE, IDs devueltos, cantidad ni resultados sensibles. El writer conserva su contrato
append-only.

## SEARCH-EW-006/007 — HTTP endpoint y response

El boundary incorpora `GET /api/v1/expedientes?numero={numero}`. `numero` es obligatorio
y el controller invoca únicamente `SearchExpedientesByNumero`. La respuesta 200 es:

```typescript
interface ExpedienteSearchResponse {
  readonly items: readonly ExpedienteSearchItem[];
}
```

No existe respuesta singular, `total` ni paginación. El número no es único.

## SEARCH-EW-008 — Validation

`numero` ausente, vacío o no construible como `ExpedienteNumero` produce
`HTTP_VALIDATION_ERROR`/400 mediante el Problem Details canónico. La frontera no
implementa una normalización alternativa.

## SEARCH-EW-009 — UX 0/1/N

- 0 items: estado vacío «sin coincidencias»;
- 1 item: abrir ese Expediente;
- N > 1: mostrar `DisambiguationList` y exigir selección explícita.

Nunca se auto-selecciona una coincidencia cuando existen varias.

## SEARCH-EW-010 — Dependency graph

Sin renumerar tasks completadas, se incorpora `T-12A` después de T-12 y antes de T-13.
T-12A implementa en este orden: Use Case Application, extensión API y sincronización
OpenAPI. T-13 depende de T-12A y vuelve a incluir `useExpedienteSearch`; T-15 conserva
su dependencia de T-13 con búsqueda activa.
