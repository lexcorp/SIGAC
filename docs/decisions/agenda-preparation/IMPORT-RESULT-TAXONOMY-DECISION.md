# Import Result Taxonomy Decision — Agenda Preparation

**Estado:** APPROVED

**Fecha:** 2026-08-20

**Scope:** cierre de `AP-OQ-004` para Agenda Preparation

**Spec resultante:** `agenda-preparation v0.1.0`, Approved for Implementation

## RESULT-AP-001 — Cuatro niveles separados

La taxonomía distingue estrictamente:

1. `ImportOutcome`: resultado global de una importación confirmada.
2. `RecordProcessingResult`: resultado terminal de cada fila recibida.
3. `ImportIncident`: problema operacional asociado a una fila.
4. `ApplicationError`: fallo de Use Case/boundary expresado como error, nunca como fila.

Ninguno es `AuditResult`. Outcome, métrica, estado de Cita, Domain Event y HTTP status
tampoco se sustituyen entre sí.

## RESULT-AP-002 — ImportOutcome

Taxonomía cerrada:

```text
IMPORTED
ALREADY_IMPORTED
RECONCILED
```

- `IMPORTED`: primera ImportacionAgenda confirmada para tenant+fecha. Puede contener
  filas con incidencia; las filas válidas conforman la Agenda inicial.
- `ALREADY_IMPORTED`: existe Agenda previa y el nuevo artefacto no produce diferencias
  efectivas en Citas ni en resultados/incidencias reconciliados. Se conserva la nueva
  ImportacionAgenda como ejecución trazable sin mutar Agenda/Cita.
- `RECONCILED`: existe Agenda previa y hay al menos un ADD, UPDATE, RESTORE,
  RETIRADA_DE_AGENDA o cambio efectivo de resultados/incidencias.

No existen `FAILED`, `INVALID` o `PARTIAL`. Layout rechazado y fallos técnicos no crean
ImportacionAgenda confirmada. Una importación con incidencias de fila sigue siendo
`IMPORTED` o `RECONCILED` y responde 201 si la UoW se confirma.

## RESULT-AP-003 — RecordProcessingResult

Taxonomía cerrada y mutuamente exclusiva para cada fila recibida:

```text
ADDED
UPDATED
UNCHANGED
RESTORED
PENDING_REVIEW
REJECTED
DUPLICATE_FOLIO
```

| Resultado | Semántica |
|---|---|
| `ADDED` | FOLIO nuevo, fila válida/resuelta y Cita incorporada. |
| `UPDATED` | FOLIO vigente con cambios permitidos aplicados. |
| `UNCHANGED` | FOLIO vigente semánticamente idéntico. |
| `RESTORED` | FOLIO retirado reaparece; se reactiva la misma Cita. |
| `PENDING_REVIEW` | Fila interpretable pero una referencia requerida no se resuelve inequívocamente. |
| `REJECTED` | Fila no puede formar una Cita segura por dato obligatorio ausente/inválido o inconsistencia intrínseca. |
| `DUPLICATE_FOLIO` | El FOLIO aparece más de una vez en el mismo snapshot. |

Cada fila termina exactamente en uno. Resultados con incidencia no lanzan exceptions y
no mutan/crean Cita ni entran a la lista vigente de preparación.

## RESULT-AP-004 — Duplicate FOLIO

Si un FOLIO aparece varias veces en el artefacto, todas sus filas reciben
`DUPLICATE_FOLIO` y una incidencia `DUPLICATE_FOLIO_IN_SNAPSHOT`. No se selecciona una
fila ganadora, incluso si las representaciones parecen iguales. No se reconcilia ese
FOLIO hasta una decisión/operación futura fuera del slice inicial.

Esto es distinto de replay por Idempotency-Key y de una reimportación funcional idéntica.

## RESULT-AP-005 — ImportIncident

Taxonomía cerrada inicial:

```text
PHYSICIAN_NOT_RESOLVED
PHYSICIAN_AMBIGUOUS
SERVICE_NOT_RESOLVED
EXPEDIENT_NOT_RESOLVED
REQUIRED_DATA_MISSING
ROW_INCONSISTENT
DUPLICATE_FOLIO_IN_SNAPSHOT
```

Mapping mínimo:

- `PHYSICIAN_NOT_RESOLVED`, `PHYSICIAN_AMBIGUOUS`, `SERVICE_NOT_RESOLVED` y
  `EXPEDIENT_NOT_RESOLVED` → `PENDING_REVIEW`.
- `REQUIRED_DATA_MISSING`, `ROW_INCONSISTENT` → `REJECTED`.
- `DUPLICATE_FOLIO_IN_SNAPSHOT` → `DUPLICATE_FOLIO`.

Una fila puede tener una o varias incidencias compatibles, pero un solo
RecordProcessingResult. No hay severidades. Todas bloquean sólo la fila; el resto puede
confirmarse atómicamente. `MEDICO_SIN_TURNO` no existe en esta taxonomía porque Turno
está fuera del slice.

## RESULT-AP-006 — Resolución de médico/Servicio/Expediente

- Número de empleado tenant-scoped es identidad primaria de médico.
- Si está presente y resuelve exactamente uno, se usa esa referencia y el nombre queda
  descriptivo/original.
- Si falta/no resuelve, sólo se permite fallback controlado por nombre normalizado.
- Cero candidatos produce `PHYSICIAN_NOT_RESOLVED`; N>1 produce
  `PHYSICIAN_AMBIGUOUS`. Nunca fuzzy matching o elección silenciosa.
- Servicio/Especialidad sin resolución produce `SERVICE_NOT_RESOLVED`.
- Expediente sin resolución inequívoca produce `EXPEDIENT_NOT_RESOLVED`; no crea ni
  modifica Expediente y conserva la referencia original allow-listed.

## RESULT-AP-007 — Primera vez/subsecuente

El concepto cerrado es binario:

```text
FIRST_TIME
SUBSEQUENT
```

La Agenda observada contiene columnas separadas. El parser sólo asigna el valor cuando
una de ellas está marcada inequívocamente. La representación exacta del marcador se
valida contra el layout real; esta decisión no presupone que sea `X`/blank. Ambas o
ninguna, cuando el campo sea requerido, produce `ROW_INCONSISTENT` o
`REQUIRED_DATA_MISSING`; no se inventa un tercer estado.

## RESULT-AP-008 — Reconciliation mapping

| Comparación por FOLIO | RecordProcessingResult | Cambio lifecycle | Métrica |
|---|---|---|---|
| Nuevo | `ADDED` | crear Cita vigente | added |
| Vigente con cambios | `UPDATED` | actualizar campos permitidos | updated |
| Vigente idéntico | `UNCHANGED` | ninguno | unchanged |
| Retirado reaparece | `RESTORED` | reactivar misma Cita | restored |
| Anterior ya no aparece | ninguno | `RETIRADA_DE_AGENDA` | withdrawnFromAgenda |

`RETIRADA_DE_AGENDA` es estado/cambio de lifecycle de Cita, reconciliation effect y
proyección métrica. No es RecordProcessingResult porque no existe fila fuente nueva. No
es `CANCELLED`. `RESTORED` sí es resultado de la fila que reaparece y conserva FOLIO.

## RESULT-AP-009 — Métricas e invariantes

Métricas funcionales exactas:

```text
receivedRecords
processed
added
updated
unchanged
restored
pendingReview
rejected
duplicateFolio
withdrawnFromAgenda
incidents
errors
```

Invariantes:

```text
receivedRecords =
  processed + pendingReview + rejected + duplicateFolio

processed = added + updated + unchanged + restored

withdrawnFromAgenda ∉ receivedRecords
incidents = número total de ImportIncident, no número de filas incidentadas
errors = rejected + duplicateFolio
```

`pendingReview` cuenta filas pendientes; `errors` cuenta filas terminalmente rechazadas
por datos/duplicado, no fallos técnicos HTTP. Una fila con varias incidencias se cuenta
una vez en `pendingReview|rejected|duplicateFolio`, pero cada incidencia en `incidents`.

## RESULT-AP-010 — Structural rejection

Un artefacto/layout incompatible se rechaza globalmente antes de producir
RecordProcessingResult. Usa `AGENDA_LAYOUT_REJECTED`/422, no crea ImportacionAgenda,
resultado de fila, Cita ni AuditResult. Una fila inválida dentro de layout reconocido es
local: produce REJECTED/PENDING_REVIEW/DUPLICATE_FOLIO y no aborta otras filas.

## RESULT-AP-011 — Domain Events mínimos

Se aprueban como candidatos contractuales Domain, sin metadata técnica:

- `AgendaImported`: primera Agenda confirmada; resumen/conteos, sin datos personales.
- `AgendaReconciled`: reconciliación confirmada; conteos agregados.
- `CitaWithdrawnFromAgenda`: FOLIO deja preparación vigente conservando historia.
- `CitaRestored`: el mismo FOLIO vuelve a vigencia.

No se crea evento por cada métrica, fila, ADD, UPDATE o incidencia. Domain Events no son
AuditEntry ni response HTTP.

**Refinamiento posterior:** AGD-AP-007 conserva estos nombres como candidatos, pero
difiere explícitamente `AgendaReconciled`, `CitaWithdrawnFromAgenda` y `CitaRestored` en
T-03. No se implementan ni emiten hasta aprobar payload y temporalidad. RESULT-AP-011 no
constituye por sí solo autorización de implementación.

## RESULT-AP-012 — ApplicationError

Códigos propios necesarios:

```text
AGENDA_IMPORT_NOT_FOUND
AGENDA_NOT_FOUND
IDEMPOTENCY_KEY_REUSED
```

Los dos not-found mantienen semántica tenant-scoped no divulgativa. La key reutilizada
con otro artefacto usa 409 conforme API-AP-009. `PERMISSION_DENIED` y los errores de
boundary/import de API-AP-010 se reutilizan donde corresponda. No existe error por cada
RecordProcessingResult ni command manual de resolución/reproceso en el slice inicial.

## RESULT-AP-013 — Read models mínimos

### ImportResultSummary

- importacionId, agendaDate, importedAt, actorRef;
- ImportOutcome y layoutVersion;
- todas las métricas de RESULT-AP-009;
- sin fingerprint, filename, raw o datos de filas.

### RecordResultSummary

- recordId;
- sourcePosition;
- folio nullable cuando no pudo interpretarse;
- RecordProcessingResult;
- `incidentCodes: readonly ImportIncident[]`;
- sin raw completo ni datos excluidos por RAW-AP-004.

### ImportIncidentSummary

- incidentId, recordId, sourcePosition;
- folio nullable;
- ImportIncident;
- sin candidates, raw, mensajes internos ni datos personales adicionales.

### PreparationItem

- FOLIO;
- patientName;
- expediente original y referencia resuelta cuando exista;
- beneficiaryType;
- `FIRST_TIME|SUBSEQUENT`;
- date, time;
- physician employeeNumber + original name;
- Servicio/Especialidad code + original name.

Sólo Citas vigentes con resultado `ADDED|UPDATED|UNCHANGED|RESTORED` y referencias
requeridas resueltas aparecen. No incluye Turno, Consultorio, raw, contacto, vigencia,
sexo, edad, CURP, préstamo o contenido asistencial.

## RESULT-AP-014 — Audit

Incidencias y resultados por fila son estado operacional y no generan AuditEntry por
defecto. Se conserva el audit de importación/lecturas aprobado por AUTH-AP-001..003. No
se añaden AuditResult, permissions ni actions.

## Estado

- `AP-OQ-001`: RESOLVED.
- `AP-OQ-002`: RESOLVED.
- `AP-OQ-003`: RESOLVED.
- `AP-OQ-004`: RESOLVED.
- `AP-OQ-005`: OPEN no bloqueante; integración posterior.
- `AP-OQ-006`: OPEN no bloqueante; no se expone reapertura/reproceso.
- `implementation_ready`: true.
