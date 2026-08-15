---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-018 — Consultar Situación del Expediente

## Objetivo
Permitir a un usuario autorizado conocer la situación operativa actual de un expediente
físico: dónde está, quién lo tiene, desde cuándo y qué ocurrió.

## Read Model
- `expedienteNumero` (formato institucional con separador preferente `/`)
- referencia mínima del paciente (datos C3 — mínimo necesario para identificación operativa)
- `estadoOperativo` (uno de: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA,
  NO_LOCALIZADO, EXTRAVIADO — DEC-EW-STATE-001)
- ubicación actual
- custodia actual (tipo, referencia, `acceptedAt` si aplica)
- préstamo activo (si existe)
- solicitud activa (si existe)
- incidencias abiertas (si existen)
- historial de movimientos operativos relevantes (`MovimientoExpediente`)
- `capabilities[]` — acciones válidas para el actor actual en el estado actual

## Búsqueda por número (OQ-EW-001/007 RESOLVED)
- La búsqueda por `expedienteNumero` puede devolver **0, 1 ó N coincidencias**.
- Si N = 0: estado vacío descriptivo; no revelar información de otros tenants.
- Si N = 1: abrir el workspace directamente.
- Si N > 1: presentar lista de coincidencias con datos mínimos de desambiguación
  (nombre, CURP, número ISSSTE); **nunca** abrir automáticamente una coincidencia
  cuando existan varias (INV-EXP-003, BR-017).
- Se aceptan variantes de separador (`/`, `-`, sin separador) para búsqueda;
  la presentación usa `/` como forma preferente.

## UX principle
Debe responder rápidamente: dónde está, quién lo tiene, desde cuándo y qué puedo hacer.

## Non-goals
- No mostrar diagnósticos, notas clínicas, tratamientos ni estudios.
- No autorizar acceso al contenido clínico del expediente.

## Precondición
Actor autenticado con permiso `EXPEDIENT_VIEW` en el tenant resuelto server-side.

## Input de Application

`GetExpediente` recibe exclusivamente `{ expedienteId: ExpedienteId; context:
RequestContext }`. La frontera server-side construye el contexto inmutable; Application
usa `context.actor` y `context.tenant` y no acepta esos valores desde body/query.

## Composición del read model (READ-EW-001..012)

`GetExpediente` compone server-side un único `ExpedienteReadModel`. Obtiene el Expediente
tenant-scoped y consume proyecciones mínimas mediante:

- `ActiveRequestQueryPort.findActiveByExpedienteId(ExpedienteId, TenantContext)` ->
  `ActiveRequestSummary | null` (`solicitudId`, `tipo`, `origen`, `estado`,
  `asignadoA` nullable).
- `ActiveLoanQueryPort.findActiveByExpedienteId(ExpedienteId, TenantContext)` ->
  `ActiveLoanSummary | null` (`prestamoId`, `finalidad`, `custodioRef`, `destinoTipo`,
  `destinoRef`, `dueAt`, `fuenteHabilitanteSalida`, `estado: Activo|Vencido`).
- `OpenIncidentsQueryPort.findOpenByExpedienteId(ExpedienteId, TenantContext)` ->
  `readonly OpenIncidentSummary[]` (`incidenciaId`, `tipo`, `severidad`, `estado`,
  `resumen`, `asignadoA` nullable, `openedAt`).
- `ExitEnablingSourceQueryPort.findAvailableByExpediente(ExpedienteId, TenantContext)` ->
  `readonly FuenteHabilitanteSalidaContext[]`, cardinalidad `0..N`, ausencia `[]`;
  cada elemento contiene exclusivamente `tipo` y `validada`.

Los puertos pertenecen a Application de Expediente Workspace como consumidor de
proyecciones; los aggregates siguen perteneciendo a sus módulos. El frontend recibe el
read model ya compuesto y no orquesta dominios.

El provider determina `validada`. `GetExpediente` pasa la colección completa a
`ExpedienteCapabilityService`, que sólo comprueba si existe al menos una fuente validada
de tipo `CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14`. No selecciona la fuente de
`OpenLoan`. `ORDEN_SUPERIOR` no habilita la capability aunque llegue validada.

## Audit

El Use Case produce un `AuditEntry` semántico y consume
`AuditWriter.append(entry, context)` desde Application. Registra `EXPEDIENTE_VIEW` /
`EXPEDIENTE` con resultado exacto `success`, `denied` o `not-found` y sin datos C3. El
writer añade actor, tenant, request/correlation IDs, source y `occurredAt`; el controller
no escribe audit.

## Fuente
DDD-013, SPEC-009, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007,
DEC-EW-STATE-001, READ-MODEL-COMPOSITION-DECISION.
