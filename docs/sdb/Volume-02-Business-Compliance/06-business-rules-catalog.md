---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-001, OQ-EW-005, OQ-EW-006, DEC-EW-STATE-001"
---
# BIZ-006 — Business Rules
BR-001 Expediente es objeto central.
BR-002 Toda salida relevante tiene finalidad.
BR-003 Ubicación y custodia deben poder determinarse.
BR-004 No localizado != perdido.
BR-005 Devuelto != archivado.
BR-006 Préstamo tiene responsable/plazo cuando aplique.
BR-007 Renovación explícita.
BR-008 Devolución requiere recepción/control.
BR-009 Integridad/buen estado.
BR-010 Solo acceso autorizado.
BR-011 Acciones críticas auditables.
BR-012 Agenda cambiante se reconciliará.
BR-013 Baja documental no es borrado ordinario.
BR-014 MVP no contiene información clínica.
BR-015 Configuración por hospital no puede vulnerar obligaciones.

## Reglas añadidas — DEC-EW-001/005/006 (2026-08-14)

BR-016 El número de expediente institucional sigue el patrón `<RFC_BASE_10><SEP><COD_DERECHOHABIENTE_2>`
(ej. `PERR810604/10`). El separador puede ser `/`, `-` o ausente; la representación preferente
de presentación es con `/`. Este identificador proviene de SIMEF y del operativo hospitalario.
Fuente: SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-001.

BR-017 `expedienteNumero` no se asume globalmente único. La búsqueda por número puede devolver
0..N coincidencias. Si N > 1, el sistema debe exigir desambiguación por datos del derechohabiente
(nombre, CURP o número ISSSTE) antes de abrir el expediente. Nunca seleccionar automáticamente
una coincidencia cuando existan varias. Fuente: DECISION-REGISTER OQ-EW-007.

BR-018 La autorización para la salida/préstamo de un expediente depende de su fuente habilitante
(`FuenteHabilitanteSalida`). Las fuentes reconocidas son al menos:
- `CONSULTA_PROGRAMADA`: la programación de citas habilita preparación y salida; Archivo Clínico
  realiza la saca y entrega sin autorización individual adicional por expediente.
- `VALE_ARCHIVO_SM_1_14`: solicitud extraordinaria; actores facultados: Director de la unidad,
  Subdirector, Coordinación Médica; plazo máximo 24 horas; si se requiere más tiempo se genera
  un nuevo formato/préstamo.
- `ORDEN_SUPERIOR`: fuente habilitante válida reconocida; detalles adicionales fuera de este slice.
No se aplica la regla universal "cualquier médico puede solicitar".
Fuente: DECISION-REGISTER OQ-EW-005.

BR-019 Despacho (salida física de Archivo Clínico) y Aceptación de Custodia (confirmación del
receptor autorizado en destino) son momentos y eventos distintos. El expediente puede estar
EN_TRASLADO sin que la custodia externa haya sido aceptada formalmente.
Fuente: DECISION-REGISTER OQ-EW-006.
