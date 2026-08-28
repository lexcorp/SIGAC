---
spec: agenda-to-vale-archivo
version: "0.2.0"
status: "Approved for Implementation"
date: "2026-08-27"
---

# Design — Agenda Preparation → Vale Archivo

## 1. Context map

`Agenda Preparation` es upstream de información preparada. `Vale Archivo` conserva
ownership de `ValeArchivo`, sus items y lifecycle. Un tercer límite Application de
integración traduce entre contratos publicados sin compartir modelos Domain.

```text
Agenda Preparation -- PreparedAgendaSourcePort --> Integration Application
Integration Application -- ValeRequestCreationPort --> Vale Archivo
                         -- TraceabilityRepository --> tenant database
```

Ningún paquete de los bounded contexts importa al otro. El composition root conecta
adapters. `RequestContext` y contratos platform compartidos permanecen permitidos.

## 2. Alternativas evaluadas

| Alternativa | Evaluación |
|---|---|
| Domain Event directo | Rechazada para el primer slice: importar/reconciliar no expresa por sí mismo autorización para crear Vales y los eventos de Agenda están diferidos. |
| Integration Event + broker | Diferida: requiere ADR, outbox, delivery, retries e idempotencia; hoy no hay broker aprobado. |
| Application Service síncrono | Recomendada: comando explícito, errores inmediatos, tenant-local y composición sencilla. |
| Import directo entre módulos | Prohibido: acopla bounded contexts y filtra modelos internos. |

## 3. Componentes conceptuales

### `GenerateValesFromPreparedAgenda`

Application Service/process manager neutral. Responsabilidades:

1. autorizar con contrato aprobado;
2. consultar candidatos por fecha y tenant;
3. agrupar determinísticamente;
4. validar metadata de creación aprobada;
5. verificar idempotencia/trazabilidad;
6. crear cada Vale mediante port destino;
7. persistir relación de origen;
8. auditar sin PII.

No reimplementa reconciliación, lifecycle de Cita ni lifecycle de Vale.

### Source ACL

Contrato conceptual que T-01 debe concretar:

```ts
interface PreparedAgendaSourcePort {
  findActiveCandidates(
    agendaDate: string,
    tenant: TenantContext,
  ): Promise<readonly PreparedAppointmentCandidate[]>;
}
```

`PreparedAppointmentCandidate` usa primitives/referencias neutralizadas: folio, fecha,
hora, Expediente, paciente, médico y Servicio. No expone `Agenda`, `Cita` ni
`PreparationItem` directamente.

### Target ACL

Contrato conceptual que T-01 debe concretar:

```ts
interface ValeRequestCreationPort {
  createFromPreparedGroup(
    command: PreparedValeCreationCommand,
    context: RequestContext,
  ): Promise<{ readonly valeId: string; readonly numeroVale: string }>;
}
```

El adapter traduce al contrato aprobado de Vale Archivo. No construye el Aggregate fuera
del contexto destino ni accede a su Repository.

### Traceability

Requiere un `AgendaValeTraceabilityRepository` tenant-scoped con consulta por source key
y append de snapshot/vínculo. El módulo neutral de integración posee el contrato; la
infraestructura tenant-local posee su implementación física.

## 4. Agrupación

Clave de grupo aprobada por ADR-0037:

```text
(agendaDate, servicioCodigo, medicoNumeroEmpleado)
```

El orden de procesamiento puede ser Servicio → médico, pero el orden no forma identidad.
`servicioNombre` y `medicoNombre` se conservan como snapshots descriptivos. No se usa
matching por nombre.

## 5. Deduplicación

Se requiere una unique source key tenant-local formada conceptualmente por AgendaFecha,
sourceImportacionId y generationSnapshotHash. Se verifica dentro de la misma unidad de
consistencia que crea el Vale/vínculo.

Una comprobación “find then insert” sin constraint no es suficiente. El replay debe
devolver explícitamente el Vale previamente relacionado.

## 6. Trazabilidad

La relación incluye fecha, importación, instante server-side, Servicio, médico,
Vale/numeroVale, FOLIOs, mapping a items, conflictos resueltos y hash del snapshot. No se
copian nombres de pacientes a la relación técnica.

## 7. Consistencia

Una transacción PostgreSQL tenant-local crea Vale, items, reserva el número, persiste
trazabilidad y escribe audit success de forma atómica. No se usa broker/outbox.

## 8. Seguridad y privacidad

- Tenant sólo desde `RequestContext`.
- No cross-tenant lookup ni public `CROSS_TENANT_*`.
- Requiere `AGENDA_VIEW` y `REQUEST_CREATE`; audit action
  `VALES_DESDE_AGENDA_GENERADOS`.
- Audit sólo registra IDs y conteos aprobados, nunca nombres/Expedientes/FOLIOs.
- El contrato transporta sólo datos aprobados para la finalidad operativa del Vale.

## 9. Impactos previstos, no autorizados todavía

- módulo Application de integración o componente equivalente en composition root;
- adapters ACL de lectura Agenda y creación Vale;
- migration tenant-local para trazabilidad/deduplicación;
- endpoint y OpenAPI;
- UI de confirmación;
- pruebas unitarias, integration, tenant isolation y E2E.

## 10. Decisiones aplicadas

ADR-0035..ADR-0040 de `decisions.md` son autoridad para numeración, operación explícita,
granularidad, repetidos, no resueltos, trazabilidad, reconciliación y atomicidad.

**implementation_ready:** true

## 11. Agenda to Vale Generation Application Design

### 11.1 Módulo neutral

Se adopta como nombre técnico futuro:

```text
packages/modules/agenda-vale-integration
```

Es preferible a:

- `agenda-archive-integration`: “archive” puede confundirse con Archive Operations y
  ampliar accidentalmente el scope;
- `archive-generation`: sugiere ownership unilateral de Archivo y no expresa el origen
  Agenda;
- `agenda-vale-integration`: nombra explícitamente ambos extremos y deja claro que el
  módulo posee sólo la coordinación.

El módulo no es un tercer modelo Domain. Es un módulo Application de integración con
DTOs neutrales, ports y reglas de orquestación aprobadas. Puede depender exclusivamente
de contratos compartidos como `@sigac/tenant` y `@sigac/audit`; no depende de
`@sigac/agenda-preparation`, `@sigac/vale-archivo`, NestJS, Drizzle o PostgreSQL.

Los adapters ACL se construyen fuera de este módulo, en Infrastructure/composition root:

- el adapter source conoce el contrato público de Agenda Preparation e implementa el
  port neutral;
- el adapter target conoce el contrato público de Vale Archivo e implementa el port
  neutral;
- ningún bounded context importa al otro y ningún adapter comparte Aggregates,
  repositories, entities o tablas.

### 11.2 Tipos neutrales

Todos los tipos siguientes son contratos Application conceptuales que T-01 debe
implementar sin importar Value Objects de los bounded contexts:

```ts
interface AgendaGenerationSource {
  readonly agendaDate: string;
  readonly sourceImportacionId: string;
  readonly sourceVersion: string;
  readonly appointments: readonly PreparedAppointment[];
}

interface PreparedAppointment {
  readonly folio: string;
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly tipoDerechohabiente: string;
  readonly pacienteNombre: string;
  readonly expedienteReference: string | null;
  readonly medico: {
    readonly numeroEmpleado: string;
    readonly nombre: string;
  };
  readonly servicio: {
    readonly codigo: string | null;
    readonly nombre: string | null;
  };
}

interface ValeHeaderInput {
  readonly fechaSolicitud: string;
  readonly fechaRecepcion: string;
  readonly unidadSolicitante: string;
  readonly solicitante: {
    readonly nombre: string;
    readonly cargo: string;
  };
  readonly autorizador: {
    readonly nombre: string;
    readonly cargo: string;
  };
}

interface ValeGroupKey {
  readonly agendaDate: string;
  readonly servicioCodigo: string;
  readonly medicoNumeroEmpleado: string;
}
```

`sourceVersion` es un token opaco del snapshot leído. Application sólo lo compara o
reenvía; no interpreta su encoding ni algoritmo. El adapter source es responsable de
proyectar exclusivamente Citas `ACTIVA`. Servicio nullable permite representar de forma
explícita evidencia inválida, que Application clasifica sin inventar un grupo.

### 11.3 Ports

#### `AgendaPreparationReadPort`

```ts
interface AgendaPreparationReadPort {
  findPreparedAgenda(
    agendaDate: string,
    tenant: TenantContext,
  ): Promise<AgendaGenerationSource | null>;

  isCurrentVersion(
    agendaDate: string,
    sourceImportacionId: string,
    sourceVersion: string,
    tenant: TenantContext,
  ): Promise<boolean>;
}
```

Responsabilidades:

- proyectar datos mínimos sin retornar `Agenda`, `Cita`, `PreparationItem` ni VOs;
- resolver el tenant únicamente desde `TenantContext`;
- entregar la importación vigente y versión opaca;
- permitir detección optimista de una reconciliación ocurrida durante la operación.

#### `ValeGenerationPort`

```ts
interface ValeGenerationPort {
  generateBatch(
    command: ValeGenerationBatchCommand,
    context: RequestContext,
  ): Promise<ValeGenerationBatchResult>;
}
```

El command contiene header confirmado, source identity/version, grupos, items físicos
deduplicados, todas sus referencias de FOLIO y resoluciones explícitas de conflicto. El
adapter target es responsable de:

- traducir a contratos de Vale Archivo;
- reservar `VA-YYYYMMDD-NNN`;
- aplicar idempotencia;
- crear Vales/items y snapshot/vínculos;
- escribir audit success;
- confirmar todo en una transacción tenant-local.

El port no expone `ValeArchivo`, `ValeArchivoRepository`, transacciones o tipos de DB.

#### `GenerationSnapshotHasherPort`

```ts
interface GenerationSnapshotHasherPort {
  compute(input: GenerationSnapshotInput): Promise<string>;
}
```

Produce el hash opaco de ADR-0040 a partir de una representación canónica ordenada. El
algoritmo y encoding son detalle técnico del adapter; Application nunca usa el hash como
identidad Domain ni lo muestra al usuario.

### 11.4 Application Service

Nombre aprobado:

```text
GenerateValesFromAgenda
```

Se usa plural porque una Agenda puede producir varios Vales. No se usa
`GenerateValeFromAgendaService`: el sufijo `Service` no aporta semántica y el singular
contradice ADR-0037.

#### Input

```ts
interface GenerateValesFromAgendaInput {
  readonly agendaDate: string;
  readonly header: ValeHeaderInput;
  readonly conflictResolutions?: readonly {
    readonly expedienteReference: string;
    readonly ownerGroup: ValeGroupKey;
  }[];
  readonly context: RequestContext;
}
```

Invariante de resolución cross-group: **`ownerGroup` únicamente es válido si pertenece
a los grupos candidatos detectados**. Un owner ajeno a esos candidatos se trata
fail-closed como conflicto no resuelto; nunca elimina la demanda, elige otro grupo ni
produce trazabilidad de una resolución inexistente.

No recibe `tenant` o `actor` por separado: usa `context.tenant` y `context.actor`. No
acepta NumeroVale, timestamps técnicos, importacionId, sourceVersion o hash del cliente.
No se introducen filtros iniciales: la fuente es la Agenda vigente completa y cualquier
selección de grupos futura requerirá una decisión específica para preservar idempotencia.

#### Output

```ts
interface GenerateValesFromAgendaResult {
  readonly generatedVales: readonly {
    readonly valeId: string;
    readonly numeroVale: string;
    readonly group: ValeGroupKey;
    readonly outcome: 'GENERATED' | 'ALREADY_GENERATED';
  }[];
  readonly conflicts: readonly {
    readonly expedienteReference: string;
    readonly candidateGroups: readonly ValeGroupKey[];
    readonly folios: readonly string[];
  }[];
  readonly unresolvedItems: readonly {
    readonly folio: string;
    readonly reason: 'EXPEDIENT_NOT_RESOLVED' | 'SERVICE_NOT_RESOLVED';
  }[];
}
```

No incluye entidades Domain, snapshots internos, PII adicional ni el hash técnico.

### 11.5 Flujo de ejecución

```text
Actor autenticado
  -> verificar AGENDA_VIEW + REQUEST_CREATE
  -> AgendaPreparationReadPort.findPreparedAgenda
  -> clasificar no resolubles / Servicio ausente
  -> agrupar fecha + servicio + médico
  -> deduplicar demandas físicas por expedienteReference
  -> aplicar conflictResolutions; conflictos sin resolver no generan esa demanda
  -> construir snapshot canónico y hash
  -> AgendaPreparationReadPort.isCurrentVersion
  -> ValeGenerationPort.generateBatch
       -> reservar NumeroVale
       -> crear Vale(s) e items
       -> persistir snapshot/trazabilidad
       -> audit VALES_DESDE_AGENDA_GENERADOS
       -> commit all-or-nothing
  -> devolver generatedVales + conflicts + unresolvedItems
```

Autorización ocurre antes de leer Agenda. Si la Agenda no existe se usa un error
Application específico que T-01 deberá declarar dentro del catálogo cerrado del módulo.
Si `isCurrentVersion` devuelve false, no se llama al target y se devuelve/lanzará un
conflicto de snapshot stale; no se genera desde datos obsoletos.

### 11.6 Casos especiales

| Caso | Tratamiento aprobado |
|---|---|
| Expediente repetido en el mismo grupo | Un item físico; todas las referencias FOLIO quedan en trazabilidad. |
| Expediente repetido entre grupos | Sin resolución explícita se reporta `conflicts` y esa demanda no se genera; no hay ganador implícito. |
| Expediente inexistente/no resuelto | Se excluye, aparece en `unresolvedItems` con `EXPEDIENT_NOT_RESOLVED`; otros grupos válidos continúan. |
| Cita retirada antes de la lectura | El source adapter no la retorna. |
| Agenda reconciliada durante la generación | `isCurrentVersion=false`; cero mutación target. |
| Agenda reconciliada después del commit | ADR-0040: no altera Vales; otra acción explícita genera sólo delta suplementario. |
| Médico sin Servicio | No se forma grupo; `SERVICE_NOT_RESOLVED`. El médico sigue identificado por número de empleado. |
| Grupo vacío | No se envía al target ni se reserva número. |
| Snapshot ya generado | El target devuelve los Vales existentes con `ALREADY_GENERATED`. |
| No hay items elegibles | Resultado con arrays vacíos/incidencias; cero Vale y cero reserva de número. |

### 11.7 Contract tests de T-01

- el package neutral no declara dependencia de Agenda Preparation o Vale Archivo;
- source port no retorna entities/VO/repositories;
- target port no expone Aggregate, Repository, UnitOfWork o DB transaction;
- `RequestContext` es el único carrier de actor/tenant;
- autorización exige ambas permissions antes del source port;
- agrupación usa fecha + código de Servicio + número de empleado;
- deduplicación same-group y conflicto cross-group;
- no resueltos/Servicio ausente son explícitos;
- source version stale impide target call;
- replay `ALREADY_GENERATED` no duplica Vales;
- output no contiene PII adicional ni metadata técnica.

### 11.8 Estado de diseño T-01

No se requiere un ADR adicional: esta sección deriva ADR-0035..ADR-0040 sin cambiar sus
decisiones. Los nombres de ports y tipos quedan aprobados como base de implementación de
T-01.1..T-01.4.

**T-01 ready_for_implementation:** true

## 12. ADR-0041 — Prerequisitos Application para ACL

ADR-0041, en
`docs/architecture/decisions/ADR-0041-agenda-vale-snapshot-and-batch-contract.md`, define
el contrato que desbloquea T-03:

- Agenda Preparation publica `GetPreparedAgendaGenerationSource`, propietario de
  `sourceImportacionId`, `sourceVersion` y Citas vigentes allow-listed;
- `sourceVersion` es SHA-256 lowercase hex sobre RFC 8785/JCS del snapshot canónico de
  Agenda, con items ordenados por FOLIO;
- Vale Archivo publica `GenerateValeBatch`, propietario de creación batch, numeración,
  replay, trazabilidad y coordinación mediante un port UnitOfWork abstracto;
- el adapter source no consulta DB/ports internos directamente;
- el adapter target no encadena llamadas a `RegistrarVale`;
- `AgendaSnapshotHasher` calcula el hash canónico del batch final y no accede a I/O.

`GenerateValeBatch` conserva un contrato propietario de Vale Archivo y no importa tipos
del módulo neutral. `ValeGenerationAdapter` mapeará ambos contratos en T-03.

**T-03 blocked until Application prerequisites pass:** true
