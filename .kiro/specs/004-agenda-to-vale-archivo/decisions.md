---
spec: agenda-to-vale-archivo
version: "0.2.0"
status: "APPROVED"
date: "2026-08-27"
scope: "T-00"
---

# Architecture Decision Records — Agenda Preparation → Vale Archivo

## ADR-0035 — Estrategia de numeración del Vale Archivo

**Estado:** APPROVED  
**Decisión:** opción B, fecha + consecutivo tenant-local.

Formato visible:

```text
VA-YYYYMMDD-NNN
```

Ejemplo: `VA-20260829-001`.

El consecutivo se asigna server-side dentro de la misma transacción que crea el Vale,
particionado por tenant y fecha de solicitud. Se preservan ceros a la izquierda; al
superar 999 se amplía la parte consecutiva sin reutilizar números. El UUID técnico de
`ValeArchivoId` permanece como identidad interna y el número visible continúa siendo
único dentro de la database del tenant.

### Alternativas

- A, consecutivo global por tenant: simple, pero pierde contexto operativo diario y
  crea un contador de mayor contención.
- B, fecha + consecutivo: facilita archivo, conciliación verbal y auditoría diaria sin
  convertir el folio en identidad técnica.
- C, UUID + folio visible: mantiene buena identidad técnica, que ya existe, pero no
  resuelve por sí mismo el folio operativo.

### Consecuencias

- el cliente nunca propone el consecutivo;
- la concurrencia se resuelve con constraint/locking tenant-local, no con “máximo + 1”
  sin protección;
- el número no codifica tenant, paciente, Servicio ni médico;
- no existe contador cross-tenant.

## ADR-0036 — Generación explícita de Vale desde Agenda

**Estado:** APPROVED

Importar, reconciliar o preparar una Agenda no crea Vales automáticamente. La generación
requiere una acción humana explícita:

```text
Agenda preparada
  -> actor autorizado revisa grupos/incidencias
  -> confirma metadata del Vale
  -> Generar solicitudes de expedientes
  -> creación transaccional de Vale(s)
```

La decisión evita solicitudes prematuras frente a cambios de Agenda, retiros, conflictos
de Expediente y decisiones operativas del Archivo. El actor queda identificado mediante
el `RequestContext` canónico.

### Autorización

La operación requiere simultáneamente:

- `AGENDA_VIEW`, para leer la Agenda preparada;
- `REQUEST_CREATE`, para crear Vales.

No se introduce una permission nueva. La falta de cualquiera produce
`PERMISSION_DENIED` antes de consultar o mutar datos. La UI no deriva autorización desde
roles ni crea capabilities nuevas.

Audit aprobado:

- `action = VALES_DESDE_AGENDA_GENERADOS`;
- `resourceType = AGENDA`;
- `resourceId = AgendaFecha` canónica;
- sólo IDs técnicos y conteos agregados allow-listed, sin nombres, Folios ni números de
  Expediente.

### Metadata de encabezado

El actor autorizado debe proporcionar y confirmar, como input explícito de la operación,
`unidadSolicitante`, solicitante, autorizador, `fechaSolicitud` y `fechaRecepcion`. Se
validan con los contratos de Vale Archivo. No se derivan de médico, Servicio, Agenda,
tenant ni actor autenticado. `NumeroVale` es generado por ADR-0035.

La operación es un Application Service síncrono neutral conectado por ACLs. No se usa
broker ni se emite un Integration Event en este slice.

## ADR-0037 — Granularidad del Vale Archivo generado

**Estado:** APPROVED  
**Decisión:** opción C, un Vale por fecha + Servicio + médico.

La clave de grupo es:

```text
(agendaDate, servicioCodigo, medicoNumeroEmpleado)
```

Código de Servicio y número de empleado son identidades; los nombres son snapshots
descriptivos. Un Vale nunca mezcla tenants, fechas, Servicios o médicos.

### Justificación

- búsqueda física: entrega lotes operativos manejables y responsables identificables;
- entrega: conserva un destino operativo homogéneo;
- devolución: permite seguir el lote asociado a una atención concreta;
- trazabilidad: el grupo se explica sin inferir desde nombres mutables;
- carga: genera más Vales que una fecha completa, pero evita un documento masivo y
  facilita paralelizar preparación/búsqueda.

La agrupación es responsabilidad del Application Service de integración, no de los
Aggregates `Agenda` o `ValeArchivo`.

## ADR-0038 — Expedientes repetidos entre consultas

**Estado:** APPROVED  
**Decisión:** opción B, una demanda física con múltiples referencias de consulta, con
resolución explícita cuando cruza grupos.

Dentro de una ejecución, el número/referencia canónica de Expediente identifica una sola
demanda física. Se conservan todas las referencias de Cita (`folio`, Servicio y médico)
en el snapshot de trazabilidad.

- si las referencias pertenecen al mismo grupo, se crea un solo `ValeArchivoItem`;
- si pertenecen a grupos distintos, el sistema presenta un conflicto operacional antes
  de crear Vales y exige que el actor seleccione un único Vale propietario/destino;
- los demás grupos conservan la referencia cruzada en trazabilidad, pero no duplican el
  item físico;
- nunca se elige un ganador por orden, nombre o primera aparición.

La confirmación queda registrada sin introducir información clínica. Esto evita que dos
equipos busquen o entreguen simultáneamente el mismo Expediente físico.

## ADR-0039 — Expedientes sin resolución

**Estado:** APPROVED

Una Cita `ACTIVA` sin referencia de Expediente resoluble:

1. se excluye de los items generados automáticamente;
2. produce una incidencia explícita `EXPEDIENT_NOT_RESOLVED` vinculada al preview/lote;
3. permanece visible para revisión y no desaparece de métricas;
4. no bloquea los grupos sin incidencias;
5. puede atenderse después mediante el flujo manual existente de Vale Archivo, una vez
   que el número de Expediente sea confirmado.

El flujo automático no crea items `PENDIENTE` sin número de Expediente, no inventa una
referencia y no modifica la Cita. La creación manual posterior no se presenta como
generación automática desde Agenda salvo que se vincule explícitamente a su origen.

## ADR-0040 — Trazabilidad inmutable Agenda → Vale

**Estado:** APPROVED

Cada generación conserva un snapshot tenant-local e inmutable con:

- `agendaDate`;
- `sourceImportacionId` correspondiente al estado vigente usado para generar;
- instante server-side de generación;
- código/nombre de Servicio;
- número de empleado/nombre del médico;
- `ValeArchivoId` y `NumeroVale` resultantes;
- FOLIOs incluidos y su referencia al `ValeArchivoItem`;
- referencias múltiples/conflictos resueltos de ADR-0038;
- identidad/version hash opaca del snapshot de generación;
- actorId de quien confirmó, vía audit y sin duplicar datos personales en el vínculo.

Los nombres se conservan sólo como snapshots descriptivos; la identidad usa fecha,
importación, código, número de empleado, FOLIO y IDs técnicos según corresponda. La
trazabilidad no depende de joins contra valores actuales mutables.

### Reconciliación posterior

Una reconciliación de Agenda nunca modifica silenciosamente un Vale ya generado. Una
nueva acción explícita compara el snapshot vigente con el último snapshot generado:

- snapshot idéntico: devuelve `ALREADY_GENERATED` y los Vales existentes;
- nuevas/restauradas/modificadas: genera únicamente solicitudes suplementarias para el
  delta confirmado, con nuevos números y vínculo al snapshot/predecesor;
- retiradas: genera una incidencia de divergencia; no cancela ni elimina items/Vales ya
  emitidos automáticamente.

### Atomicidad e idempotencia

Vale(s), items, snapshot/vínculos, reserva de número y audit success se confirman en una
única transacción PostgreSQL tenant-local. Si cualquier escritura falla, todo hace
rollback. No hay transacciones cross-tenant, broker ni outbox en este slice.

La identidad idempotente es:

```text
tenant database + agendaDate + sourceImportacionId + generationSnapshotHash
```

Un constraint físico futuro deberá protegerla frente a concurrencia. El hash es metadata
técnica y no sustituye las identidades Domain.

## Resultado de T-00

| Open question | Resolución |
|---|---|
| OQ-AV-001 | ADR-0035 |
| OQ-AV-002, OQ-AV-003, OQ-AV-007 | ADR-0036 |
| OQ-AV-005 | ADR-0038 |
| OQ-AV-006 | ADR-0039 |
| OQ-AV-004, OQ-AV-008, OQ-AV-009 | ADR-0040 |

No quedan open questions bloqueantes conocidas para iniciar T-01. Las firmas técnicas,
schema y API se derivarán en sus tareas correspondientes sin reabrir estas decisiones.
