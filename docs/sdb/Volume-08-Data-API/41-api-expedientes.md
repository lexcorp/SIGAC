---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001/007: búsqueda devuelve colección; estados corregidos"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# API-011 — Expedientes

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/expedientes/{id}` | Read model completo por `ExpedienteId` (UUID) |
| `GET` | `/api/v1/expedientes?numero={n}` | Búsqueda por número — devuelve **colección** 0..N (ver abajo) |
| `GET` | `/api/v1/expedientes/{id}/timeline` | Historial de movimientos operativos |
| `GET` | `/api/v1/expedientes/{id}/current-custody` | Custodia actual |
| `GET` | `/api/v1/expedientes/{id}/active-loan` | Préstamo activo si existe |
| `POST` | `/api/v1/expedientes/{id}/custody-transfers` | Transferencia de custodia interna |
| `POST` | `/api/v1/expedientes/{id}/dispatch` | `DispatchExpediente` → `EN_TRASLADO` |
| `POST` | `/api/v1/expedientes/{id}/accept-custody` | `AcceptCustody` → `EN_CONSULTA` |
| `POST` | `/api/v1/expedientes/{id}/rearchive` | `ConfirmRearchive` → `DISPONIBLE` |

### Scope base T-11 y extensión SEARCH-EW-006

El catálogo anterior incluye operaciones futuras. T-11 publica exclusivamente las rutas
con Use Case Application canónico existente:

- `GET /api/v1/expedientes/{id}`;
- `GET /api/v1/expedientes/{id}/timeline`;
- `POST /api/v1/expedientes/{id}/dispatch`;
- `POST /api/v1/expedientes/{id}/accept-custody`.

La extensión v0.3.20 activa la búsqueda por número mediante el Use Case canónico
`SearchExpedientesByNumero`. `current-custody`, `active-loan` y `rearchive` permanecen
diferidos. El controller no consume Repository directamente.

## Command success (API-EW-024/025)

- `POST /api/v1/expedientes/{id}/dispatch` → 204 No Content.
- `POST /api/v1/expedientes/{id}/accept-custody` → 204 No Content.

No existe response body y los DomainEvent no son contratos HTTP. No aplica 201 ni 202;
el cliente puede refrescar el GET del Expediente.

No hay endpoint que edite contenido clínico.

El contrato conceptual de `POST /accept-custody` aporta receptor
`{type,reference,service}`, ubicacionDestino, businessReference `{type,id}` y
expectedRowVersion. Actor, tenant y trazabilidad proceden del RequestContext server-side,
no del body. Application audita `CUSTODY_ACCEPTED/EXPEDIENTE/{id}`.

## Timeline

`GET /api/v1/expedientes/{id}/timeline?cursor={opaque}&limit={n}` devuelve:

```jsonc
{
  "items": [/* MovimientoExpedienteSummary DAT-011 */],
  "nextCursor": "opaque | null"
}
```

Orden: `occurredAt DESC, movimientoId DESC`. El cursor representa conceptualmente esa
tupla, pero API/UI no interpretan su encoding. No se devuelve `total`. Ausencia:
`items=[]`, `nextCursor=null`. Requiere `EXPEDIENT_VIEW`, opera sólo en el tenant
server-side y registra audit separado. No decide retención.

Antes de consultar movimientos, Application autoriza y comprueba la existencia del
Expediente en el tenant activo. Falta de permission -> 403 `PERMISSION_DENIED`; ausencia
-> 404 `EXPEDIENTE_NOT_FOUND`. Una página vacía es 200. Audit usa
`EXPEDIENTE_TIMELINE_VIEW` sobre `EXPEDIENTE/{id}` y jamás aparece en `items`.

## Búsqueda por número — colección (OQ-EW-001/007 RESOLVED)

`GET /api/v1/expedientes?numero={n}` devuelve siempre un wrapper de colección:

```jsonc
// Respuesta — colección
{
  "items": [
    {
      "expedienteId": "uuid",
      "expedienteNumero": "PERR810604/10",
      "paciente": {
        "idInstitucional": "...",
        "curp": "...",
        "nombreOperativo": "...",
        "numeroIssste": "..."
      },
      "estadoOperativo": "DISPONIBLE",
      "ubicacion": { "id": "uuid", "codigo": "...", "descripcion": "..." }
    }
  ],
}
```

- N = 0 → `items: []`; HTTP 200 (no 404).
- N = 1 → `items: [...]`; el cliente puede navegar directamente.
- N > 1 → `items: [...]`; el cliente **debe** presentar desambiguación.

No hay respuesta singular, `total` ni paginación. `numero` es obligatorio; ausencia,
vacío o VO inválido produce `HTTP_VALIDATION_ERROR`/400. `ExpedienteNumero` normaliza
las variantes `/`, `-` o sin separador. El Use Case exige `EXPEDIENT_VIEW`, opera en
`RequestContext.tenant` y audita `EXPEDIENTE_SEARCH/EXPEDIENTE/{numeroNormalizado}` con
success para 0..N.

## Read model — response body (`GET /expedientes/{id}`)

```jsonc
{
  "id": "uuid",
  "expedienteNumero": "PERR810604/10",
  "pacienteRef": {
    "id": "uuid",
    "displayLabel": "string"    // campo mínimo C3 — formato pendiente OQ-EW-002
  },
  "estadoOperativo": "DISPONIBLE | APARTADO | EN_TRASLADO | EN_CONSULTA | NO_LOCALIZADO | EXTRAVIADO",
  "ubicacionActual": { "id": "uuid", "codigo": "string", "descripcion": "string" },
  "custodiaActual": {
    "custodioTipo": "string",
    "custodioRef": "string",
    "servicio": "string | null",
    "aceptadaEn": "ISO8601 | null"   // null si EN_TRASLADO sin CustodyAccepted
  },
  "prestamoActivo": {
    "prestamoId": "uuid",
    "finalidad": "string",
    "custodioRef": "string",
    "destinoTipo": "string",
    "destinoRef": "string",
    "dueAt": "ISO8601",
    "fuenteHabilitanteSalida": "CONSULTA_PROGRAMADA | VALE_ARCHIVO_SM_1_14 | ORDEN_SUPERIOR",
    "estado": "Activo | Vencido"
  } | null,
  "solicitudActiva": {
    "solicitudId": "uuid",
    "tipo": "string",
    "origen": "string",
    "estado": "Pendiente | Asignada | EnBusqueda | Localizada | Preparada | Entregada | Cancelada | NoLocalizada",
    "asignadoA": "string | null"
  } | null,
  "incidenciasAbiertas": [{
    "incidenciaId": "uuid",
    "tipo": "string",
    "severidad": "string",
    "estado": "Abierta | EnInvestigacion | Escalada",
    "resumen": "string",
    "asignadoA": "string | null",
    "openedAt": "ISO8601"
  }],
  "capabilities": ["DISPATCH", "SOLICITAR", "REPORTAR_INCIDENCIA", ...],
  "rowVersion": "42"
}
```

`rowVersion` y `expectedRowVersion` son strings decimales en JSON (`^[0-9]+$`) y
`bigint` en Application. La frontera nunca convierte mediante JavaScript `number`.

El backend compone este único read model mediante query ports tenant-scoped propiedad de
Application de Expediente Workspace. Cardinalidades: solicitud `0..1`, préstamo `0..1`,
incidencias `0..N`. Ausencia: `null`, `null`, `[]`, respectivamente. El frontend no
orquesta dominios para construir la respuesta.

`updatedAt` no pertenece a este read model, al aggregate ni a su snapshot. No se crea un
query port para obtenerlo. `rowVersion` es el mecanismo canónico de optimistic
concurrency; metadata temporal futura requiere una decisión de proyección específica.

Para calcular capabilities, `GetExpediente` consume internamente
`ExitEnablingSourceQueryPort.findAvailableByExpediente(ExpedienteId, TenantContext)` ->
`readonly FuenteHabilitanteSalidaContext[]`. Esta colección no forma parte obligatoria
del response body: alimenta `capabilities[]`. El provider determina `validada`; no se
expone evidencia de Agenda o SM 1-14.

## Fuente
DECISION-REGISTER OQ-EW-001, OQ-EW-006, OQ-EW-007, DEC-EW-STATE-001, DAT-006, DAT-016,
EXPEDIENT-SEARCH-DECISION SEARCH-EW-001..010.

## API v0.3.21 — Auditoría subordinada

`GET /api/v1/expedientes/{id}/audit` invoca `GetExpedienteAudit`. Requiere
`EXPEDIENT_AUDIT_VIEW`, verifica primero existencia tenant-scoped y responde
`{items,nextCursor}` sin total. El cursor es opaco. Items exponen sólo auditId, action,
result, actorRef, occurredAt, source, requestId y correlationId. No exponen
changeSummary/securityContext. 401/403/404 conservan la taxonomía no divulgativa.
