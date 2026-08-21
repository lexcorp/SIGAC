---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-001, OQ-EW-006, OQ-EW-007, DEC-EW-STATE-001"
---
# DDD-009 — Invariants Candidates

INV-EXP-001 Expediente tiene identificador institucional (`ExpedienteNumero`) y un
  `ExpedienteId` UUID interno como identidad técnica primaria.
INV-EXP-002 Mantiene situación operativa coherente entre `EstadoOperativo`, ubicación
  y custodia.
INV-EXP-003 `expedienteNumero` no se asume único globalmente. Si una búsqueda devuelve
  múltiples coincidencias, el sistema debe exigir desambiguación antes de operar.
  Nunca abrir automáticamente una coincidencia cuando existan varias.
  (OQ-EW-007 RESOLVED, BR-017)
INV-EXP-004 `EstadoOperativo` del Expediente solo puede tomar los valores:
  DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO.
  `EN_BUSQUEDA` y `PRESTADO` no son valores válidos de `EstadoOperativo`.
  (DEC-EW-STATE-001)
INV-EXP-005 `ExpedienteDispatched` (despacho) y `CustodyAccepted` (aceptación) son
  transiciones de estado distintas. Un expediente puede estar `EN_TRASLADO` sin que
  la custodia haya sido aceptada formalmente en destino. (OQ-EW-006 RESOLVED)
INV-LOAN-001 Préstamo tiene expediente, responsable/custodio, finalidad,
  `FuenteHabilitanteSalida` e inicio.
INV-LOAN-002 Préstamo cerrado no vuelve a activo.
INV-LOAN-003 Salida con `VALE_ARCHIVO_SM_1_14` tiene plazo máximo de 24 horas;
  si se requiere más tiempo se genera un nuevo préstamo.
INV-REQ-001 Solicitud tiene origen/finalidad.
INV-REQ-002 No pasa a Preparada sin localización o excepción formal.
INV-PREP-001 Reimportación equivalente no duplica ítems.
INV-AP-001 Una Agenda lógica pertenece exactamente a un tenant y una fecha.
INV-AP-002 Dentro de una Agenda tenant-scoped, FOLIO determina la identidad de Cita.
INV-AP-003 Todo registro recibido termina con exactamente un resultado de fila.
INV-AP-004 RETIRADA_DE_AGENDA conserva historia y no implica cancelación clínica.
INV-AP-005 Una reaparición usa el mismo FOLIO/identidad.
INV-AP-006 Médico se identifica primariamente por número de empleado dentro del tenant.
INV-AP-007 Matching ambiguo nunca produce asociación automática.
INV-AP-008 Valor original no se destruye al interpretar o normalizar.
INV-AP-009 Layout incompatible falla cerrado antes de reconciliar.
INV-AP-010 Datos excluidos por minimización no aparecen en persistencia/read models del slice.
INV-AP-011 Reconciliación nunca cruza tenants.
INV-AP-012 Turno, Consultorio y Destino no se derivan ni se incorporan en esta spec.

AGD-AP-001..009 concreta estas invariantes sin cambiar su namespace: Agenda representa
AgendaFecha y vive en un tenant boundary externo a Domain; creación/reconciliación
validan atómicamente FOLIO único y fecha compatible; retirada conserva la Entity y
reaparición reactiva la misma identidad.

INV-IMP-AP-001 ImportacionAgenda recibe IDs e importedAt desde Application/UoW; Domain no genera identidad ni tiempo.
INV-IMP-AP-002 RegistroImportadoAgenda recibe exactamente un RecordProcessingResult; una segunda asignación se rechaza.
INV-IMP-AP-003 IDs de registro/incidencia no se agregan dos veces y toda incidencia referencia un registro existente con la misma posición lógica.
INV-IMP-AP-004 ImportacionAgenda finalizada no admite nuevas mutaciones ni otra finalización.
INV-IMP-AP-005 Métricas se derivan; cumplen RESULT-AP-009 y withdrawnFromAgenda no cuenta como registro recibido.
INV-IMP-AP-006 ImportArtifactMetadata, fingerprint, filename y raw quedan fuera de Domain.
INV-INC-001 Resolución conserva actor, fecha y causa.
INV-INC-002 NO_LOCALIZADO no implica automáticamente EXTRAVIADO; la declaración de
  EXTRAVIADO requiere proceso formal con política/autorización.
