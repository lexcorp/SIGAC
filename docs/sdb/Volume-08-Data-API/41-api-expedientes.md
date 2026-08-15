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

No hay endpoint que edite contenido clínico.

## Búsqueda por número — colección (OQ-EW-001/007 RESOLVED)

`GET /api/v1/expedientes?numero={n}` devuelve siempre un array:

```jsonc
// Respuesta — colección
{
  "data": [
    {
      "id": "uuid",
      "expedienteNumero": "PERR810604/10",
      "pacienteRef": { "displayLabel": "..." },
      "estadoOperativo": "DISPONIBLE",
      "ubicacionActual": { ... }
    }
    // ... más resultados si N > 1
  ],
  "total": 2
}
```

- N = 0 → `data: []`, `total: 0`; HTTP 200 (no 404).
- N = 1 → `data: [...]`, `total: 1`; el cliente puede navegar directamente.
- N > 1 → `data: [...]`, `total: N`; el cliente **debe** presentar desambiguación.

El parámetro `numero` se normaliza internamente (sin separador) antes de la búsqueda.

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
  "prestamoActivo": { ... } | null,
  "solicitudActiva": { ... } | null,
  "incidenciasAbiertas": [ ... ],
  "capabilities": ["DISPATCH", "SOLICITAR", "REPORTAR_INCIDENCIA", ...],
  "rowVersion": 42,
  "updatedAt": "ISO8601"
}
```

## Fuente
DECISION-REGISTER OQ-EW-001, OQ-EW-006, OQ-EW-007, DEC-EW-STATE-001, DAT-006, DAT-016.
