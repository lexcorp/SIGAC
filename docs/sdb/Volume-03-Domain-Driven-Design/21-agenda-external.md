---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-021 — Agenda Externa / Anti-Corruption Layer
SIMEF pertenece a un contexto externo.
SIGAC importará solo la representación necesaria.
Candidate ACL: AgendaImportAdapter.
Candidate objects: AgendaVersion, AgendaItem, AgendaFingerprint, AgendaReconciliationResult.
Una importación no se asume definitiva.

RESULT-AP-001..014 reemplaza nombres exploratorios para el slice: ImportacionAgenda,
Agenda, Cita, RecordProcessingResult e ImportIncident. Fingerprint es metadata, no
identidad. Cada fila termina en uno de los siete resultados aprobados.

## Value Objects T-01 — VO-AP-001..010

- AgendaFecha es fecha civil gregoriana `YYYY-MM-DD`, sin tiempo/zona/UTC.
- FolioCita y NumeroEmpleado son strings requeridos con trim sólo exterior e igualdad
  exacta; no se convierten a número ni reciben regex inferida. NumeroEmpleado conserva
  ceros iniciales.
- ServicioEspecialidad exige código/nombre; identidad por código y nombre descriptivo.
- PosicionRegistroOrigen es ordinal lógico entero positivo base 1, no fila física.
- Los VOs contienen valor canónico; originalValues/interpretedValues pertenecen al futuro
  RegistroImportadoAgenda. El Adapter, no Domain, interpreta representaciones SIMEF.
- Rechazo usa DomainError con exactamente: `AGENDA_FECHA_INVALID`,
  `FOLIO_CITA_INVALID`, `NUMERO_EMPLEADO_INVALID`,
  `SERVICIO_ESPECIALIDAD_INVALID` y `POSICION_REGISTRO_ORIGEN_INVALID`.

## Agenda y Cita T-03 — AGD-AP-001..009

- Agenda no tiene AgendaId/tenant embebido; su identidad sistémica es tenant boundary +
  AgendaFecha y puede crearse vacía.
- Cita usa FOLIO, fecha, HoraCita `HH:mm`, ExpedienteReferencia opaca nullable, nombre,
  tipo de derechohabiente string, `FIRST_TIME|SUBSEQUENT`, médico y servicio.
- MedicoReferencia se identifica por NumeroEmpleado; nombre es requerido/descriptivo.
- Reconciliación valida todo antes de mutar y devuelve FOLIOs separados en added,
  updated, unchanged, restored y withdrawn. Snapshot vacío retira activas.
- Duplicado/fecha incompatible rechazan la reconciliación completa.
- T-03 no guarda timestamps de Cita ni emite Domain Events.
- Domain no fija sorting de presentación; orden por hora/nombre pertenece a queries.
