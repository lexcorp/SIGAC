# Agenda y Cita Domain Decision

**Estado:** APPROVED  
**Fecha:** 2026-08-21  
**Scope:** contratos Domain completos de T-03 para `agenda-preparation v0.1.6`

## AGD-AP-001 — Identidad y tenant boundary de Agenda

La identidad lógica de `Agenda` en el sistema es `TenantContext + AgendaFecha`. Domain
representa únicamente `AgendaFecha`; el tenant ya fue resuelto por Application y delimita
Repository/UnitOfWork. El Aggregate no contiene `TenantContext`, tenantId, databaseName,
connection string ni otra referencia de infraestructura. No se introduce `AgendaId`.

```ts
interface CreateAgendaInput {
  readonly fecha: AgendaFecha;
  readonly citasIniciales?: readonly Cita[];
}

Agenda.create(input: CreateAgendaInput): Agenda;
```

Una Agenda puede nacer vacía. `citasIniciales` omitido equivale a `[]`. Si se proporciona,
todas las Citas deben compartir `input.fecha` y tener FOLIO único; la creación valida el
conjunto completo antes de construir el Aggregate. El estado inicial conserva las Citas
recibidas, sin imponer orden Domain. `rehydrate()` se difiere a la tarea de persistencia.

## AGD-AP-002 — Value Objects adicionales de T-03

### HoraCita

`HoraCita.parse(value: string): HoraCita` acepta exclusivamente la forma canónica
`HH:mm`, reloj de 24 horas, entre `00:00` y `23:59`. No aplica trim ni acepta segundos,
timezone, offset o `Date`. Interpretar una representación externa pertenece al parser.
Igualdad por el string canónico exacto. Cualquier violación usa
`DomainError('HORA_CITA_INVALID', message)`.

### MedicoReferencia

```ts
MedicoReferencia.create({
  numeroEmpleado: NumeroEmpleado,
  nombre: string,
}): MedicoReferencia;
```

`nombre` es obligatorio, aplica trim exclusivamente exterior y queda vacío sólo mediante
error `MEDICO_REFERENCIA_INVALID`. Conserva case, acentos y contenido interno. La identidad
y la igualdad de negocio se determinan por `NumeroEmpleado`; el nombre es descriptivo.
Este VO no hace matching por nombre ni contiene Turno, Consultorio o Servicio.

### ExpedienteReferencia

`ExpedienteReferencia.parse(value: string): ExpedienteReferencia` crea una referencia
opaca a Archive Operations. Aplica trim exclusivamente exterior, rechaza vacío y conserva
case, separadores, ceros y contenido interno. No presupone UUID ni unicidad de
ExpedienteNumero. Igualdad por valor canónico exacto. El error es
`EXPEDIENTE_REFERENCIA_INVALID`. Agenda Preparation Domain no importa
`@sigac/archive-operations`.

En una `Cita`, `expedienteReference` es `ExpedienteReferencia | null`: `null` significa
que no existe una referencia segura/resuelta para la Cita.

### Tipo de derechohabiente y tipo de consulta

No existe catálogo autoritativo de tipo de derechohabiente para este slice. Se representa
como `string` semántico obligatorio, con trim exclusivamente exterior, no vacío, sin enum
ni normalización agresiva. Su validación pertenece a `Cita` y usa `CITA_INVALID`.

El tipo de consulta reutiliza el catálogo ya aprobado:

```ts
type AppointmentKind = 'FIRST_TIME' | 'SUBSEQUENT';
```

El parser futuro traduce representaciones SIMEF. No se agrega un tercer valor.

## AGD-AP-003 — Entity Cita

```ts
type CitaLifecycle = 'ACTIVA' | 'RETIRADA_DE_AGENDA';

interface CitaSnapshot {
  readonly folio: FolioCita;
  readonly agendaFecha: AgendaFecha;
  readonly hora: HoraCita;
  readonly expedienteReference: ExpedienteReferencia | null;
  readonly nombrePaciente: string;
  readonly tipoDerechohabiente: string;
  readonly tipoConsulta: AppointmentKind;
  readonly medico: MedicoReferencia;
  readonly servicioEspecialidad: ServicioEspecialidad;
}

Cita.create(snapshot: CitaSnapshot): Cita;
```

`Cita.create` inicia en `ACTIVA`. `nombrePaciente` y `tipoDerechohabiente` son strings
obligatorios, con trim sólo exterior y no vacíos. Una shape inválida usa `CITA_INVALID`.
FOLIO es la identidad estable dentro de la Agenda tenant-scoped.

La Entity contiene exclusivamente los campos de `CitaSnapshot` y `lifecycle`. No contiene
CURP, teléfono, vigencia, sexo, edad, Turno, Consultorio, Destino, datos asistenciales,
raw, posición de origen, fingerprint o metadata técnica.

Las operaciones de actualización, retiro y restauración son internas al límite de
`Agenda`; ningún consumidor muta una Cita directamente.

## AGD-AP-004 — Comparación funcional

Para un FOLIO ya existente, `UPDATE` se determina comparando exactamente:

- `hora`;
- `expedienteReference`;
- `nombrePaciente`;
- `tipoDerechohabiente`;
- `tipoConsulta`;
- `medico.numeroEmpleado` y `medico.nombre`;
- `servicioEspecialidad.codigo` y `servicioEspecialidad.nombre`.

`agendaFecha` debe ser compatible con la Agenda y no es mutable. No participan en la
comparación FOLIO, lifecycle, sourcePosition, raw, fingerprint ni metadata técnica.
`RESTORE` se decide antes de `UPDATE`: una Cita retirada que reaparece se actualiza con el
snapshot recibido y se clasifica sólo como `RESTORED`.

## AGD-AP-005 — Reconciliación atómica por FOLIO

```ts
interface ReconcileAgendaInput {
  readonly incoming: readonly CitaSnapshot[];
}

interface AgendaReconciliationResult {
  readonly added: readonly FolioCita[];
  readonly updated: readonly FolioCita[];
  readonly unchanged: readonly FolioCita[];
  readonly restored: readonly FolioCita[];
  readonly withdrawn: readonly FolioCita[];
}

Agenda.reconcile(input: ReconcileAgendaInput): AgendaReconciliationResult;
```

Antes de mutar, Agenda valida todo `incoming`: shape de cada snapshot, fecha compatible y
FOLIO único. Dos entradas con el mismo FOLIO producen `AGENDA_FOLIO_DUPLICADO`; ninguna
gana y el Aggregate queda sin cambios. Una fecha distinta produce
`AGENDA_FECHA_INCOMPATIBLE`, también sin cambios. Otra invalidez estructural del comando
de reconciliación usa `AGENDA_RECONCILIACION_INVALIDA`.

Después de validar:

- FOLIO nuevo: crea Cita `ACTIVA` y aparece en `added`;
- FOLIO activo con cambio funcional: actualiza la misma Cita y aparece en `updated`;
- FOLIO activo idéntico: no muta y aparece en `unchanged`;
- FOLIO retirado que reaparece: actualiza/reactiva la misma identidad y aparece sólo en
  `restored`;
- Cita activa ausente de `incoming`: pasa a `RETIRADA_DE_AGENDA` y aparece en
  `withdrawn`;
- Cita ya retirada y todavía ausente: permanece retirada y no vuelve a reportarse.

Un snapshot vacío es válido y retira todas las Citas activas. Las cuatro primeras
colecciones conservan el orden de `incoming`; `withdrawn` conserva el orden interno de la
Agenda. Ese orden facilita resultados deterministas, pero no constituye orden de consulta.
`WITHDRAWN` permanece separado de `RecordProcessingResult` porque no corresponde a una
fila recibida.

Domain no fija orden de presentación ni impide que futuros query/read models ordenen por
`hora ASC` o por nombre de paciente A–Z. Sorting e impresión quedan fuera de T-03.

## AGD-AP-006 — Historia preservada

Retirar no elimina la Entity: conserva el mismo FOLIO y el último contenido funcional
conocido, cambia únicamente su lifecycle y la excluye de preparación vigente. Restaurar
reactiva y actualiza esa misma identidad. No se introduce Event Sourcing, tabla histórica
conceptual, versión histórica embebida ni identidad alternativa.

## AGD-AP-007 — Temporalidad y Domain Events

`Cita` no almacena `createdAt`, `updatedAt`, `withdrawnAt` ni `restoredAt` en T-03.
`Agenda.reconcile` no recibe `occurredAt` porque T-03 no emite Domain Events y ninguna
regla Domain aprobada necesita tiempo.

Los candidatos `AgendaReconciled`, `CitaWithdrawnFromAgenda` y `CitaRestored` quedan
**DEFERRED**: T-03 no los implementa ni emite. Una decisión posterior deberá aprobar
payload, necesidad y temporalidad antes de introducirlos. Si se aprueba un evento cuyo
`occurredAt` sea el instante efectivo, Application/UnitOfWork lo proporcionará
explícitamente conforme DOM-EVENT-001; Domain nunca genera tiempo mediante `Date.now()` o
`new Date()`.

## AGD-AP-008 — DomainError codes cerrados de T-03

| Código | Uso exclusivo |
|---|---|
| `AGENDA_INVALID` | creación/estado interno inválido de Agenda no cubierto por un código específico |
| `CITA_INVALID` | shape, strings requeridos o tipo de consulta inválidos |
| `HORA_CITA_INVALID` | valor que incumple la forma canónica de HoraCita |
| `MEDICO_REFERENCIA_INVALID` | nombre requerido inválido en MedicoReferencia |
| `EXPEDIENTE_REFERENCIA_INVALID` | referencia opaca ausente/vacía o inválida |
| `AGENDA_FOLIO_DUPLICADO` | FOLIO repetido en creación o snapshot incoming |
| `AGENDA_FECHA_INCOMPATIBLE` | Cita/snapshot con fecha distinta a la Agenda |
| `AGENDA_RECONCILIACION_INVALIDA` | comando de reconciliación estructuralmente inválido no cubierto arriba |

Todos usan `DomainError(code, message)`. El código es contractual; el message es interno,
no contiene datos personales/raw y no es contrato HTTP. No se reutilizan códigos T-01 o
T-02 con semántica distinta ni se usan errores nativos.

## AGD-AP-009 — Límites de T-03 y readiness

T-03 implementará únicamente `Agenda`, `Cita`, `HoraCita`, `MedicoReferencia`,
`ExpedienteReferencia`, lifecycle y reconciliación descritos aquí. No implementará parser,
matching, persistence, Repository, Application, API, audit, frontend ni Domain Events.

El bloqueo documental de T-03 queda resuelto. No se modifican `INV-AP-001..012`,
`INV-IMP-AP-001..006`, `IMP-AP-001..014`, `ImportOutcome`, `RecordProcessingResult`,
`ImportIncident`, `AuditResult`, permissions o audit actions.
