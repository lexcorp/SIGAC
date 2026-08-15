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
INV-INC-001 Resolución conserva actor, fecha y causa.
INV-INC-002 NO_LOCALIZADO no implica automáticamente EXTRAVIADO; la declaración de
  EXTRAVIADO requiere proceso formal con política/autorización.
