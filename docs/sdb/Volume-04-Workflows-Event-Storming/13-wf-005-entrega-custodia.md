---
project: SIGAC
sdb_volume: "04 - Workflows & Event Storming"
version: "0.2.0"
status: "Draft for workflow validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-006 RESOLVED: despacho, transporte y aceptación de custodia separados"
methodology:
  - Event Storming
  - Domain-Driven Design
  - Spec-Driven Development
---
# WF-005 — Entrega y Transferencia de Custodia

## Trigger
Expediente preparado y requerido por servicio/consultorio.

## Secuencia (refinada — OQ-EW-006 RESOLVED)

Los siguientes pasos son **obligatoriamente distintos** y no deben fusionarse:

### Fase 1 — Despacho (`DispatchExpediente`)
1. Verificar que el expediente está preparado (`EstadoOperativo = APARTADO`).
2. Identificar destino autorizado y actor de traslado (archivista/mensajero).
3. Registrar origen, destino previsto, actor de traslado y timestamp.
4. Ejecutar `DispatchExpediente`.
5. Emitir `ExpedienteDispatched` → `EstadoOperativo = EN_TRASLADO`.
6. El mensajero porta la hoja diaria con los expedientes.

### Fase 2 — Transporte
- El expediente está en tránsito con el mensajero.
- `EstadoOperativo` permanece `EN_TRASLADO`.
- No hay evento de dominio adicional hasta la llegada.

### Fase 3 — Aceptación de custodia (`AcceptCustody`)
7. El mensajero llega al área/consultorio de destino.
8. El receptor autorizado (Enfermería o médico/solicitante) confirma la recepción
   mediante una acción autenticada y auditable.
9. Registrar receptor, ubicación de destino y timestamp de aceptación.
10. Ejecutar `AcceptCustody`.
11. Emitir `CustodyAccepted` → `EstadoOperativo = EN_CONSULTA`.
12. `CustodiaActual.acceptedAt` queda establecido.

### Fase 4 — Retorno (inicio del flujo de devolución)
13. El mensajero recoge los expedientes que Enfermería le entrega.
14. Los expedientes no retirados permanecen en custodia del servicio.
15. Ver WF-007 (Devolución) y WF-008 (Rearchivo) para continuación.

## Resultado
Custodia externa formal conocida, con evento `CustodyAccepted` registrado y auditable.

## Notas de diseño
- `ExpedienteDispatched` (despacho) ≠ `CustodyAccepted` (aceptación).
- La confirmación digital inicial no implica firma electrónica criptográfica en este slice.
- Si el receptor habitual es Enfermería, el receptor autenticado es el personal de
  Enfermería presente. Si es médico/solicitante directo, ese actor autentica.
- La hoja diaria AS-IS se reemplaza por el registro digital de los dos eventos.
- En casos de traslado con múltiples paradas pueden existir múltiples pares
  `ExpedienteDispatched` / `CustodyAccepted`.

## Fuente
SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-006.
