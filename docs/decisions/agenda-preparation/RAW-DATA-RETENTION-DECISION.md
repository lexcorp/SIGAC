# Raw Data Retention Decision — Agenda Preparation

**Estado:** APPROVED

**Fecha:** 2026-08-20

**Scope:** `agenda-preparation v0.1.0-draft` / cierre de `AP-OQ-002`

## RAW-AP-001 — Categorías separadas

| Categoría | Ownership conceptual | Clasificación | Persistencia del slice |
|---|---|---|---|
| A. Archivo original recibido | Infrastructure ingestion boundary | C3 | Sólo staging transitorio protegido |
| B. Representación raw de fila | Parser/Infrastructure | C3 | Sólo memoria/staging transitorio; no durable tras finalizar |
| C. Valores originales necesarios | `RegistroImportadoAgenda` dentro de `ImportacionAgenda` | C2/C3 según campo; C3 cuando identifica atención/persona | Sí, sólo allow-list mínima |
| D. Valores normalizados/resueltos | Agenda Preparation Domain/Application | C2/C3 | Sí, sólo los necesarios para reglas/read models |
| E. Agenda/Cita mínima e historia | Agenda Preparation Domain | C3 | Sí, como dato operacional tenant-local |

El archivo, su representación raw y el modelo de dominio son artefactos distintos. La
obligación de conservar el valor original no obliga a conservar indefinidamente el
binario ni una copia completa de cada fila.

## RAW-AP-002 — Archivo original

El archivo sólo existe en quarantine/staging mientras se valida, interpreta y concluye
el intento autorizado. No forma parte del Aggregate ni se ofrece como read model.

Al alcanzar un resultado terminal —layout rechazado, importación idéntica, importación
confirmada o reconciliación confirmada— debe eliminarse del almacenamiento activo. No se
conserva una copia durable para descarga o consulta humana en el slice inicial.

Un intento denegado ocurre antes de leer el archivo y, por tanto, SIGAC no persiste su
contenido. Un fallo técnico durante parsing conserva el archivo sólo en staging hasta
cerrar/abortar de forma segura el intento; queda sujeto a la misma disposición técnica.

## RAW-AP-003 — Raw row

La fila raw completa puede existir transitoriamente durante parsing, pero no se persiste
después de finalizar el intento. Un layout rechazado no produce filas raw persistidas.
Errores de parsing o validación conservan únicamente posición/código sanitizado y los
valores allow-listed que sean indispensables para trazabilidad, nunca el payload completo.

## RAW-AP-004 — Allow-list persistente

Sólo pueden persistirse, con original e interpretación/resolución distinguibles cuando
aplique: FOLIO; nombre de paciente/derechohabiente; referencia de Expediente; tipo de
derechohabiente; primera vez/subsecuente; fecha; hora; médico; número de empleado; y
Servicio/Especialidad.

Contacto, vigencia, sexo, edad, CURP y datos asistenciales adicionales pueden existir en
memoria o staging durante parsing, pero se descartan antes de persistir resultados,
incidencias o estado Domain. No se copian a logs, audit, tracing, métricas ni errores.

## RAW-AP-005 — Evidencia mínima duradera

Después de eliminar archivo/raw, `ImportacionAgenda` conserva:

- identidad técnica de la importación persistida y tenant implícito por database;
- fecha/instante, actor y estado/outcome aprobado posteriormente;
- fingerprint técnico del archivo;
- identificación/version del layout reconocido;
- conteos agregados;
- por registro: posición lógica, valores originales allow-listed, interpretación,
  referencias resueltas y resultado/incidencia sanitizada;
- historia de reconciliación necesaria para explicar ADD/UPDATE/UNCHANGED/RETIRADA/RESTORE.

Esta evidencia satisface `original → interpretación → entidad resuelta` sin conservar el
archivo completo. `fingerprint != AgendaId`, `fingerprint != ImportacionAgendaId` y no
es identidad de negocio. El algoritmo concreto requiere estándar técnico posterior; no
se fija en esta decisión.

No se persiste el filename proporcionado por el cliente. Cualquier nombre temporal es
opaco, generado server-side y se elimina con el staging.

## RAW-AP-006 — Retención por categoría

- Archivo y fila raw: retención técnica mínima necesaria para completar/abortar el
  intento, con plazo máximo configurable por política institucional; nunca indefinida.
- Metadata de ImportacionAgenda y RegistroImportadoAgenda minimizado: retención
  operacional configurable para trazabilidad/reconciliación.
- Agenda/Cita e historia de retirada/restauración: retención operacional histórica
  configurable y distinta del staging.
- Logs, audit y backups: conservan sus políticas propias; no heredan la retención del raw.

No existe plazo numérico aprobado. El owner institucional debe configurarlo antes de
producción; la implementación no puede introducir un default silencioso. La ausencia de
un número no autoriza retención indefinida.

## RAW-AP-007 — Protección

- En tránsito: TLS según SEC-035 y el trust boundary institucional.
- Staging/reposo: almacenamiento cifrado mediante controles institucionales de
  disco/plataforma, namespace tenant y least privilege.
- Database tenant-local: cifrado de disco/database y backups conforme SEC-035; field
  encryption sólo si un threat model posterior la exige.
- Keys: SEC-036; separadas cuando sea viable, rotables y nunca en repositorio/logs.
- No se diseña criptografía propia ni se fija algoritmo en esta decisión.

## RAW-AP-008 — Acceso

Sólo el componente técnico de ingestión y el Use Case autorizado pueden leer el staging
durante el procesamiento. Ni `AGENDA_VIEW`, ni `AGENDA_INCIDENT_VIEW`, ni
`AGENDA_IMPORT` conceden por sí solas visualización o descarga posterior del raw.

El slice inicial no implementa visualizar/descargar archivo, visualizar fila raw,
recuperar staging ni eliminar manualmente. Una futura operación humana requerirá una
decisión específica de permission, audit action, finalidad y exposición segura.

## RAW-AP-009 — Tenant isolation

RequestContext.tenant es la única autoridad. Archivo, staging, metadata, registros,
Agenda e historia usan namespace/storage tenant-scoped. No se deriva tenant de filename
o contenido y no existe almacenamiento compartido sin partición/namespace de tenant.

## RAW-AP-010 — Disposición

La eliminación automática del archivo/raw es irreversible desde el almacenamiento
activo: no existe restore/download de aplicación. Las copias ya incluidas en backups
expiran conforme a la política separada de backups; esta decisión no promete borrado
criptográfico retroactivo.

La disposición automática no crea AuditEntry ni nuevos identifiers de audit. Debe dejar
telemetría operacional sanitizada (conteo/éxito/fallo, sin filename, fingerprint o C3).
Un fallo de limpieza es incidente operativo y debe activar el mecanismo/runbook futuro;
no autoriza conservar indefinidamente.

## RAW-AP-011 — Escenarios

| Escenario | Archivo/raw | Evidencia persistente |
|---|---|---|
| Permission denied | Nunca leído ni persistido | Audit de AUTH-AP-001; sin contenido |
| Layout rejected | Staging transitorio y eliminación al cerrar | Fingerprint/layout outcome sanitizado; sin filas raw |
| Parsing error | Staging sólo hasta abortar/cerrar | Posición/código sanitizado y allow-list si fue interpretada con seguridad |
| Incidencia de validación de negocio | Raw transitorio | Registro minimizado + resolución/incidencia sanitizada |
| Importación idéntica | Raw transitorio y eliminación | Metadata/fingerprint/conteos; sin estado de negocio duplicado |
| Importación/reconciliación confirmada | Raw transitorio y eliminación | Importación, registros minimizados, Agenda/Cita e historia |

Los nombres finales de outcomes permanecen bajo AP-OQ-004.

## RAW-AP-012 — Ownership

- `ImportacionAgenda`: Aggregate root de accountability funcional.
- `RegistroImportadoAgenda`: entidad hija con allow-list original, interpretación y
  resolución; no contiene raw irrestricto.
- `ImportArtifactMetadata`: metadata técnica asociada a la importación, propiedad del
  ingestion/Application boundary; no es Aggregate ni identidad de negocio.
- Bytes y raw rows: Infrastructure staging, fuera del Domain.

No se decide schema físico, job de limpieza, API ni mecanismo de upload.

## Estado de OQs

- `AP-OQ-001`: RESOLVED.
- `AP-OQ-002`: RESOLVED.
- `AP-OQ-003`: RESOLVED posteriormente por API-AP-001..014.
- `AP-OQ-004`: OPEN.
- `implementation_ready`: false.

> Estado posterior: `AP-OQ-004` fue resuelto por RESULT-AP-001..014 en
> `IMPORT-RESULT-TAXONOMY-DECISION.md`. Esta sección conserva el estado histórico al
> aprobar RAW-AP; la readiness vigente de la spec es `true`.
