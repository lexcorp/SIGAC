---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-006 RESOLVED: transporte vs custodia"
---
# DDD-018 — Custodia

Custodia expresa quién responde operativamente por el expediente.

**Candidate VO:** `custodianType`, `custodianReference`, `service`, `location`, `acceptedAt`.

`Custodia ≠ permiso de acceso ≠ propiedad`.

## Distinción transporte / custodia (OQ-EW-006 RESOLVED)

El **transporte** (mensajero en tránsito) y la **custodia formal** son conceptos distintos
que se registran en momentos diferentes:

| Momento | Evento | EstadoOperativo resultante |
|---------|--------|---------------------------|
| Expediente sale de Archivo Clínico | `ExpedienteDispatched` | `EN_TRASLADO` |

Durante EN_TRASLADO se reutiliza `Custodia` con `acceptedAt=null` y
`custodianReference: string` obligatorio y no vacío; transportista no es automáticamente
custodio externo formal. Dispatch recibe esa referencia explícitamente y nunca la deriva
de destination.
Para Dispatch, la factory recibe type/reference del custodio previsto y produce
exactamente custodianType/type, custodianReference/reference, service=null,
location=null y acceptedAt=null. Los datos describen al receptor previsto; no confirman
aceptación. No se usan valores sintéticos ni se deriva ningún campo de destination.
| Receptor autorizado confirma recepción | `CustodyAccepted` | `EN_CONSULTA` |

Durante `EN_TRASLADO`:
- El expediente está bajo responsabilidad del archivista/mensajero.
- La custodia formal de Archivo Clínico **no** ha terminado hasta que el receptor confirme.
- El campo `CustodiaActual` del aggregate refleja esta responsabilidad intermedia.

Al emitirse `CustodyAccepted`:
- `acceptedAt` se establece con el timestamp del momento de confirmación.
- `custodianReference` apunta al receptor autenticado.
- La confirmación es una acción digital autenticada y auditable; no requiere firma
  criptográfica en este slice.

**Fuente:** SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-006.
