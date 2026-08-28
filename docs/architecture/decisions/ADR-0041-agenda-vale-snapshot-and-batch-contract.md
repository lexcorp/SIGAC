# ADR-0041 — Agenda Snapshot Versioning and Vale Batch Application Contract

**Status:** Approved  
**Date:** 2026-08-28  
**Scope:** `004-agenda-to-vale-archivo` / prerequisitos de T-03

## Context

El ACL neutral necesita detectar si la Agenda cambió entre lectura y creación, producir
una identidad idempotente del batch y delegar la creación a Vale Archivo sin acceder a
su Aggregate o Repository.

Actualmente Agenda Preparation no publica conjuntamente Citas vigentes,
`sourceImportacionId` y una versión del snapshot. Vale Archivo sólo publica
`RegistrarVale`, que crea un Vale individual, recibe `numeroVale` desde el caller y no
coordina numeración, idempotencia ni trazabilidad batch.

Implementar adapters sobre esos contratos incompletos rompería ADR-0035 y ADR-0040.

## Decision 1 — Origen oficial de `sourceVersion`

Agenda Preparation será propietaria de una proyección Application de generación. El
Use Case/query conceptual se denomina:

```text
GetPreparedAgendaGenerationSource
```

Su resultado contiene exclusivamente:

- `agendaDate`;
- `sourceImportacionId`: última importación confirmada que representa el estado vigente;
- `sourceVersion`: versión opaca calculada por Agenda Preparation;
- Citas `ACTIVA` con los campos allow-listed del contrato neutral.

`sourceVersion` no procede de HTTP, filename, `updatedAt`, clock, row count ni
`ImportacionAgendaId` aislado. Se calcula como:

```text
lowercase-hex(SHA-256(JCS(canonicalAgendaSource)))
```

`JCS` significa JSON Canonicalization Scheme, RFC 8785, codificado en UTF-8. Antes de
canonicalizar, las Citas se ordenan por `folio` mediante comparación ordinal exacta de
Unicode code points. El objeto usa estas keys, sin aliases ni campos adicionales:

```text
agendaDate
sourceImportacionId
items[]:
  folio
  agendaDate
  appointmentTime
  tipoConsulta
  tipoDerechohabiente
  pacienteNombre
  expedienteReference
  medico.numeroEmpleado
  medico.nombre
  servicio.codigo
  servicio.nombre
```

Los valores son los valores semánticos ya producidos por Agenda Preparation; el hasher
no normaliza, recorta, cambia case ni interpreta datos.

El mismo Use Case/query debe permitir verificar si `(agendaDate,
sourceImportacionId, sourceVersion)` continúa vigente. El adapter ACL no consulta tablas
directamente y no reconstruye la versión.

`sourceVersion` es metadata sensible derivada: no se expone en UI/API, audit o logs.

## Decision 2 — `generationSnapshotHash`

El módulo neutral calcula el hash del batch final después de clasificación,
deduplicación y resoluciones explícitas:

```text
lowercase-hex(SHA-256(JCS(canonicalGenerationSnapshot)))
```

Orden canónico:

1. grupos por `agendaDate`, `servicioCodigo`, `medicoNumeroEmpleado`;
2. demandas por `expedienteReference`;
3. referencias por `folio`, `servicioCodigo`, `medicoNumeroEmpleado`.

El snapshot contiene source identity/version, keys de grupo, nombres descriptivos,
demandas físicas y referencias. Excluye header confirmado, `RequestContext`,
`NumeroVale`, timestamps, resultado, audit e IDs generados. Cambiar metadata del header
no permite crear duplicados del mismo snapshot operacional.

`AgendaSnapshotHasher` implementará `GenerationSnapshotHasherPort` dentro de
`packages/modules/agenda-vale-integration/src/infrastructure/`. Es infraestructura pura
determinista, sin acceso a DB, red, clock o bounded contexts.

## Decision 3 — Application Use Case `GenerateValeBatch`

Vale Archivo debe publicar un Use Case Application específico; el ACL target no llamará
`RegistrarVale` repetidamente.

Nombre:

```text
GenerateValeBatch
```

Contrato conceptual propietario de Vale Archivo:

```ts
interface GenerateValeBatchCommand {
  readonly source: {
    readonly kind: 'AGENDA_PREPARATION';
    readonly agendaDate: string;
    readonly sourceImportacionId: string;
    readonly sourceVersion: string;
    readonly generationSnapshotHash: string;
  };
  readonly header: {
    readonly fechaSolicitud: string;
    readonly fechaRecepcion: string;
    readonly unidadSolicitante: string;
    readonly solicitanteNombre: string;
    readonly solicitanteCargo: string;
    readonly autorizadorNombre: string;
    readonly autorizadorCargo: string;
  };
  readonly groups: readonly {
    readonly agendaDate: string;
    readonly servicioCodigo: string;
    readonly servicioNombre: string;
    readonly medicoNumeroEmpleado: string;
    readonly medicoNombre: string;
    readonly items: readonly {
      readonly expedienteNumero: string;
      readonly pacienteNombre: string;
      readonly appointmentReferences: readonly {
        readonly folio: string;
        readonly servicioCodigo: string;
        readonly medicoNumeroEmpleado: string;
      }[];
    }[];
  }[];
  readonly context: RequestContext;
}

interface GenerateValeBatchResult {
  readonly generatedVales: readonly {
    readonly valeId: string;
    readonly numeroVale: string;
    readonly agendaDate: string;
    readonly servicioCodigo: string;
    readonly medicoNumeroEmpleado: string;
    readonly outcome: 'GENERATED' | 'ALREADY_GENERATED';
  }[];
}
```

El Use Case:

1. exige `REQUEST_CREATE` (la verificación adicional `AGENDA_VIEW` pertenece al
   orquestador neutral);
2. valida el contrato con reglas de Vale Archivo;
3. delega la reserva `VA-YYYYMMDD-NNN` a un port transaccional;
4. detecta replay por source identity + generation snapshot hash;
5. crea un Vale por grupo usando `ValeArchivo.create`;
6. persiste Vales, items y trazabilidad inmutable;
7. escribe `VALES_DESDE_AGENDA_GENERADOS / success`;
8. confirma todo mediante una única UnitOfWork tenant-local;
9. devuelve `ALREADY_GENERATED` sin crear estado duplicado.

El contrato no importa tipos de `@sigac/agenda-vale-integration` ni
`@sigac/agenda-preparation`. `ValeGenerationAdapter` realizará mapping estructural hacia
este comando público.

`RegistrarVale` permanece intacto para creación manual individual.

## Decision 4 — Prerequisitos y orden

Antes de T-03 deben existir y pasar tests:

1. `GetPreparedAgendaGenerationSource` en Application de Agenda Preparation;
2. `GenerateValeBatch` y sus ports Application en Vale Archivo.

La persistence/UnitOfWork concreta se implementará en T-04/T-05. Para permitir tests
Application, `GenerateValeBatch` dependerá de un port transaccional abstracto; no se
simulará atomicidad en el adapter API.

T-03 implementará después:

- `AgendaPreparationReadAdapter`, delegando únicamente al Use Case/query publicado;
- `ValeGenerationAdapter`, delegando únicamente a `GenerateValeBatch`;
- `AgendaSnapshotHasher`, conforme a la canonicalización anterior.

## Consequences

- ningún bounded context importa al otro;
- el módulo neutral conserva sólo ports/contratos/orquestación e infraestructura pura;
- adapters no conocen repositories, Aggregates ni tablas;
- no se puede iniciar T-03 hasta completar los prerequisitos Application;
- endpoints, migrations, DB adapters y UI permanecen fuera de esta decisión.
