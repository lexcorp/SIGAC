---
spec: agenda-to-vale-archivo
version: "0.2.0"
status: "Approved for Implementation"
date: "2026-08-27"
bounded_context: "Agenda-to-Vale Integration"
depends_on:
  - "agenda-preparation v0.3.0 release baseline"
  - "vale-archivo v0.1.0"
---

# Requirements — Agenda Preparation → Vale Archivo

## 1. Propósito

Convertir de manera explícita, tenant-scoped, trazable e idempotente las Citas vigentes
de una Agenda preparada en solicitudes operativas `ValeArchivo`, sin compartir
Aggregates ni crear dependencias entre los bounded contexts propietarios.

## 2. Alcance

Incluye selección de una Agenda preparada, agrupación por fecha/Servicio/médico,
creación coordinada de Vales, prevención de duplicados y consulta de trazabilidad.

No incluye importación SIMEF, reconciliación de Agenda, búsqueda/localización, entrega,
préstamo, custodia, cambios al PDF de preparación, broker, datos clínicos ni unificación
de los dos bounded contexts.

## 3. Requisitos funcionales

### REQ-VA-013 — Generar solicitudes desde Agenda preparada

El sistema deberá ofrecer una operación explícita que obtenga exclusivamente Citas
vigentes y elegibles de una Agenda tenant-scoped y solicite la creación de Vales mediante
un contrato Application del contexto destino. Agenda Preparation no importará
`vale-archivo`, y Vale Archivo no importará `agenda-preparation`.

Cada item candidato conservará sólo los datos mínimos necesarios: FOLIO como referencia
de origen, número/referencia de Expediente, nombre operativo del paciente y
Servicio/Especialidad. La operación no introducirá datos clínicos.

La operación requiere simultáneamente `AGENDA_VIEW` y `REQUEST_CREATE`. El actor confirma
unidad solicitante, solicitante, autorizador y fechas de solicitud/recepción; esos datos
no se derivan de Agenda. `NumeroVale` se genera server-side como
`VA-YYYYMMDD-NNN`, consecutivo tenant-local por fecha.

### REQ-VA-014 — Agrupar por Servicio, médico y fecha

La generación deberá producir grupos deterministas por:

1. `AgendaFecha`;
2. `ServicioEspecialidad.codigo`;
3. `NumeroEmpleado` del médico.

Los nombres de Servicio y médico son descriptivos y no sustituyen sus identidades. Una
Agenda diaria puede producir cero, uno o varios Vales y cada grupo produce un Vale. No se
mezclan fechas, Servicios, médicos ni tenants.

### REQ-VA-015 — Evitar duplicados

Repetir una solicitud de generación con la misma identidad de origen no deberá crear un
segundo Vale para el mismo grupo. La operación deberá devolver resultados explícitos por
grupo, incluyendo creación o existencia previa.

La identidad idempotente es tenant database + AgendaFecha + sourceImportacionId + hash
opaco del snapshot de generación, respaldada por constraint transaccional. Un replay
idéntico devuelve `ALREADY_GENERATED`. Un snapshot cambiado sólo puede producir un delta
suplementario mediante otra acción explícita; nunca modifica silenciosamente un Vale.

### REQ-VA-016 — Trazabilidad Agenda → Vale

Para cada Vale generado deberá poder conocerse la Agenda y grupo que lo originaron, y
desde la Agenda deberá poder conocerse el Vale resultante. La trazabilidad no dependerá
de logs, filename, texto descriptivo ni inferencia por fecha.

La relación tenant-local conserva fecha, importación origen, instante de generación,
Servicio, médico, Vale/numeroVale, FOLIOs incluidos, mapping a items, conflictos resueltos
y hash de snapshot. No contiene datos clínicos ni depende de valores actuales mutables.

### REQ-VA-017 — Resolver expedientes repetidos

Una referencia de Expediente produce una sola demanda física por ejecución. En el mismo
grupo genera un solo item con múltiples FOLIOs trazados. Si cruza grupos, la generación
se detiene para esa demanda hasta que el actor elija explícitamente un único Vale
propietario; nunca se duplica o selecciona silenciosamente.

### REQ-VA-018 — Tratar citas sin Expediente resoluble

Una Cita sin Expediente resoluble se excluye de la generación automática, produce
`EXPEDIENT_NOT_RESOLVED`, permanece en métricas/revisión y puede atenderse después por el
flujo manual existente. No bloquea grupos independientes sin incidencias.

### REQ-VA-019 — Confirmar de forma atómica

La creación de Vales/items, reserva de números, snapshot/vínculos y audit success se
confirma en una única transacción PostgreSQL tenant-local. Cualquier fallo revierte todo.
No se usa broker, outbox ni transacción cross-tenant en este slice.

## 4. Requisitos arquitectónicos

- Clean Architecture y modular monolith.
- Orquestación fuera de los Domains de Agenda Preparation y Vale Archivo.
- Ports neutrales y adapters ACL; no compartir Aggregates.
- `RequestContext`/`TenantContext` server-resolved; cero queries cross-tenant.
- Controllers no acceden directamente a repositories.
- No broker ni Event Sourcing sin ADR.
- Toda modificación de schema requerirá migration; toda API requerirá OpenAPI.
- Audit de generación: `VALES_DESDE_AGENDA_GENERADOS`, resource `AGENDA` y resourceId
  igual a la fecha canónica, sin PII/FOLIO/Expediente en metadata.

## 5. Invariantes candidatas

| ID | Invariante |
|---|---|
| INV-AV-001 | Un grupo no mezcla tenant, fecha, Servicio ni médico. |
| INV-AV-002 | Agenda Preparation y Vale Archivo no se importan entre sí. |
| INV-AV-003 | Un snapshot idéntico no genera Vales duplicados. |
| INV-AV-004 | Toda creación conserva una relación persistente Agenda/grupo → Vale. |
| INV-AV-005 | Sólo Citas `ACTIVA` y elegibles participan. |
| INV-AV-006 | Nombres descriptivos no sustituyen código de Servicio ni número de empleado. |
| INV-AV-007 | No se agregan datos clínicos ni se rompe minimización. |
| INV-AV-008 | Una demanda física de Expediente aparece como máximo una vez por ejecución. |
| INV-AV-009 | Agenda reconciliation nunca modifica silenciosamente un Vale generado. |
| INV-AV-010 | Creación y trazabilidad se confirman o revierten juntas. |

## 6. Criterios de aceptación de la spec

ADR-0035..ADR-0040 cierran las decisiones de negocio y arquitectura necesarias para que
T-01 derive los contratos técnicos. API/OpenAPI y schema se definirán exclusivamente en
sus tareas posteriores.

## 7. Decisiones cerradas

OQ-AV-001..009 están `RESOLVED` por ADR-0035..ADR-0040 en `decisions.md`.

**implementation_ready:** true
