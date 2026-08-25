---
spec: preparation-reports
version: "0.1.1"
status: "Approved for Implementation"
date: "2026-08-26"
amended: "2026-08-26 — ADR-0031 Agenda Shift Determination"
parent_spec: "agenda-preparation v0.1.7"
bounded_context: "Agenda / Appointment Preparation"
depends_on:
  - "agenda-preparation tasks T-00..T-19"
  - "PreparationListQueryPort (listForPrint / findPage) — implementados"
  - "PreparationItem — contrato de lectura canónico"
  - "AgendaFecha value object"
  - "TenantDatabaseRouter / TenantSessionExecutor"
open_questions_blocking: []
---

# Preparation Reports — Requirements

## 1. Propósito

Separar la **vista operativa** de la lista de preparación (consulta web paginada) del
**documento operativo** (PDF para Archivo Clínico). La generación del PDF ocurre en el
servidor y produce un documento estructurado, imprimible y trazable, sin depender del
estado del DOM del navegador.

Esta spec extiende `agenda-preparation` sin modificar sus invariantes. No altera
`Expediente`, `Custodia`, `MovimientoExpediente` ni Archive Operations.

## 2. Alcance

### 2.1 Incluido

1. Vista tabular paginada en reemplazo de la vista de acordeones actual (`PreparationList.tsx`).
2. Filtros de consulta: fecha, servicio (select), médico (select).
3. Búsqueda por folio o número de expediente.
4. Ordenamiento: hora de cita ASC / nombre paciente ASC.
5. Nuevo endpoint `POST /api/v1/agendas/{date}/preparation-report` que genera PDF on-demand.
6. Agrupación del PDF por servicio_codigo ASC → medico_numero_empleado ASC → hora ASC.
7. Una página por combinación servicio + médico.
8. Descarga directa del PDF (sin persistencia en filesystem ni storage).
9. Registro de audit log por cada generación de PDF.
10. Nuevo permiso `AGENDA_PRINT` para generar el PDF.
11. ADR-0030: selección de PDFKit como motor de generación.

### 2.2 Fuera de alcance (non-goals explícitos)

- Firma digital del PDF.
- Almacenamiento o historial de reportes generados.
- Reimpresión desde historial.
- Entrega física, devolución, préstamo o rearchivo.
- Permisos individuales por servicio o médico.
- Datos clínicos: diagnósticos, notas, antecedentes, signos vitales.
- PII adicional más allá de lo ya contenido en `PreparationItem`: sin CURP, fecha de
  nacimiento, teléfono, email, edad, sexo.
- Generación de SM10-1 completo.
- Consultorio, Destino (campos excluidos de SIMEF y del dominio actual).
- Turno como columna de datos explícita en el PDF (el turno es derivado de `appointmentTime` según ADR-0031; no es dato separado).
- Automatización de macros o descarga SIMEF.
- Cambios en el flujo de importación (T-00..T-19).

## 3. Actores

| Actor | Responsabilidad en este slice | Permiso requerido |
|---|---|---|
| Archivista | Consulta la lista paginada y descarga el PDF para preparar Expedientes | `AGENDA_VIEW` (consulta) + `AGENDA_PRINT` (PDF) |
| Jefatura de Archivo | Supervisa la lista y descarga el PDF para validación operativa | `AGENDA_VIEW` + `AGENDA_PRINT` |

La autorización es exclusivamente server-side mediante `RequestContext` y `TenantContext`
canónicos. El frontend nunca decide autorización.

## 4. Requisitos funcionales

### REQ-PR-001 — Vista tabular paginada

**User Story:** Como Archivista, quiero consultar la lista de preparación como tabla plana
con filtros, para localizar citas específicas sin expandir acordeones.

#### Criterios de aceptación

1. WHEN el Archivista navega a la lista de preparación con `AGENDA_VIEW`, THE Sistema
   SHALL mostrar una tabla plana con las columnas: Hora, Expediente, Folio,
   Derechohabiente, Tipo consulta, Médico y Servicio.
2. WHILE el filtro de fecha está activo, THE Sistema SHALL mostrar únicamente las citas
   cuya `agendaDate` coincida con la fecha seleccionada.
3. WHEN el usuario selecciona un servicio del filtro, THE Sistema SHALL mostrar únicamente
   las citas cuyo `servicioEspecialidad.codigo` coincida con el seleccionado.
4. WHEN el usuario selecciona un médico del filtro, THE Sistema SHALL mostrar únicamente
   las citas cuyo `medico.numeroEmpleado` coincida con el seleccionado.
5. WHEN el usuario introduce texto en el campo de búsqueda, THE Sistema SHALL filtrar las
   filas cuyo `folio` o `expediente.original` contenga el texto introducido
   (comparación case-insensitive en el cliente sobre la página cargada).
6. THE Sistema SHALL paginar la tabla en bloques de 50 registros mediante offset en el
   cliente, usando los datos ya paginados por cursor que devuelve el backend.
7. WHEN el usuario cambia el orden (hora ASC / nombre paciente ASC), THE Sistema SHALL
   reiniciar la paginación al primer bloque.
8. IF el usuario no tiene `AGENDA_VIEW`, THEN THE API SHALL responder HTTP 403 antes de
   entregar cualquier dato.

### REQ-PR-002 — Generación de PDF on-demand

**User Story:** Como Archivista, quiero descargar un PDF estructurado de la lista de
preparación, para imprimir un documento operativo limpio sin elementos de interfaz.

#### Criterios de aceptación

1. WHEN el usuario con `AGENDA_VIEW` y `AGENDA_PRINT` envía `POST
   /api/v1/agendas/{date}/preparation-report`, THE Sistema SHALL generar y devolver un
   PDF con `Content-Type: application/pdf`.
2. THE Sistema SHALL incluir en la respuesta el header
   `Content-Disposition: attachment; filename="lista-preparacion-{date}.pdf"` donde
   `{date}` es la fecha en formato `YYYY-MM-DD`.
3. THE PDF SHALL agrupar las citas primero por `servicio_codigo ASC`, luego por
   `medico_numero_empleado ASC`, luego por `hora ASC`.
4. THE PDF SHALL dedicar al menos una página completa a cada combinación única
   servicio + médico.
5. WHERE el parámetro `services` se proporciona en el body, THE Sistema SHALL incluir
   únicamente citas cuyos `servicio_codigo` estén en la lista; si el parámetro es `null`
   o se omite, THE Sistema SHALL incluir todas las citas activas de la fecha.
6. IF no existen citas activas para los servicios solicitados en la fecha, THEN THE
   Sistema SHALL responder HTTP 422 con un error descriptivo conforme RFC 7807.
7. IF el usuario no tiene `AGENDA_PRINT`, THEN THE API SHALL responder HTTP 403.
8. IF el usuario no tiene `AGENDA_VIEW`, THEN THE API SHALL responder HTTP 403.
9. THE Sistema SHALL registrar un audit log entry por cada generación exitosa de PDF,
   incluyendo: actor, tenant, fecha de la agenda, timestamp y resultado.
10. THE Sistema SHALL generar el PDF en memoria sin escribir en filesystem ni storage.

### REQ-PR-003 — Estructura del PDF

**User Story:** Como Jefatura de Archivo, quiero que el PDF tenga un formato institucional
estandarizado, para que sirva como documento operativo reconocible.

#### Criterios de aceptación

1. THE PDF SHALL incluir en cada página el encabezado:
   `SISTEMA DE INFORMACIÓN MÉDICO FINANCIERO / ARCHIVO CLÍNICO / LISTA DE EXPEDIENTES
   PARA CONSULTA`.
2. THE PDF SHALL mostrar en la sección de identificación de cada bloque: fecha de consulta
   (`DD/MM/YYYY`), nombre del servicio con código, nombre del médico y número de empleado.
3. THE PDF SHALL incluir una tabla con columnas: Hora, Expediente, Derechohabiente, Folio.
4. THE PDF SHALL mostrar al final de cada bloque el total de expedientes del bloque.
5. THE PDF SHALL mostrar en el pie de cada página la numeración `Página P de TOTAL`.
6. THE PDF SHALL incluir únicamente los campos aprobados por minimización: hora, número
   de expediente (`expediente.original`), nombre del derechohabiente (`nombrePaciente`) y
   folio.
7. THE PDF SHALL omitir CURP, fecha de nacimiento, teléfono, email, edad, sexo,
   diagnósticos y cualquier campo no incluido en `PreparationItem`.
8. THE filename en `Content-Disposition` NO SHALL contener datos de paciente.

### REQ-PR-004 — Privacidad y minimización del PDF

**User Story:** Como Responsable de Privacidad, quiero que el PDF contenga solo los datos
mínimos operativos, para cumplir el principio de minimización.

#### Criterios de aceptación

1. THE PDF SHALL contener únicamente: hora de cita, `expediente.original`, `nombrePaciente`
   y `folio`, tal como los define `PreparationItem`.
2. IF el PDF es analizado con búsqueda de texto, THEN THE Sistema SHALL garantizar que
   no contienen patrones CURP (18 caracteres alfanuméricos con estructura definida),
   números de teléfono ni fechas de nacimiento.
3. THE Sistema SHALL no agregar al PDF ningún campo que no exista ya en `PreparationItem`.
4. THE filename del PDF NO SHALL incorporar nombre de paciente, expediente ni folio.

### REQ-PR-005 — Nuevo permiso AGENDA_PRINT

**User Story:** Como Administrador del sistema, quiero que la generación del PDF requiera
un permiso explícito, para controlar quién puede producir documentos con datos operativos.

#### Criterios de aceptación

1. THE Sistema SHALL definir `AGENDA_PRINT` como una permission distinta en el catálogo
   de `packages/platform/tenant/src/index.ts`.
2. IF un usuario autenticado no tiene `AGENDA_PRINT`, THEN THE API SHALL responder HTTP
   403 sin revelar detalles del tenant.
3. THE Sistema SHALL requerir `AGENDA_VIEW` además de `AGENDA_PRINT` para acceder al
   endpoint de generación de PDF.
4. THE Sistema SHALL no derivar `AGENDA_PRINT` automáticamente de ningún rol.

### REQ-PR-006 — Trazabilidad de generación (audit)

**User Story:** Como Jefatura de Archivo, quiero saber cuándo y quién generó un reporte
PDF, para auditoría operativa.

#### Criterios de aceptación

1. WHEN se genera un PDF exitosamente, THE AuditWriter SHALL registrar una entrada con:
   acción `AGENDA_REPORT_GENERATED`, actor (tenant + userId), agendaDate, timestamp y
   resultado `SUCCESS`.
2. IF la generación falla (sin citas activas u otro error de negocio), THEN THE
   AuditWriter SHALL registrar resultado `FAILURE` con razón descriptiva sin datos de
   paciente.
3. THE audit log entry SHALL no contener nombre de paciente, folio individual ni CURP.
4. THE Sistema SHALL escribir el audit log en la misma operación que produce el PDF, sin
   crear un nuevo aggregate de dominio.

### REQ-PR-007 — Tenant isolation

**User Story:** Como Administrador de seguridad, quiero garantizar que los reportes solo
contienen datos del tenant del contexto actual.

#### Criterios de aceptación

1. THE Sistema SHALL resolver `TenantContext` server-side antes de cualquier consulta.
2. THE PDF SHALL contener únicamente citas cuyo `agenda_date` pertenece al tenant del
   contexto de la petición.
3. IF se detecta un intento de acceso cross-tenant, THEN THE API SHALL responder HTTP 403
   sin revelar información de otros tenants.
4. THE Sistema SHALL no aceptar tenant desde el body de la petición ni desde parámetros
   de query.

### REQ-PR-008 — Compatibilidad con infraestructura existente

**User Story:** Como Desarrollador, quiero que los reportes reutilicen la infraestructura
ya implementada, para no duplicar lógica de acceso a datos.

#### Criterios de aceptación

1. THE Sistema SHALL reutilizar `PreparationListQueryPort.listForPrint()` para obtener
   los datos del PDF sin duplicar queries.
2. THE Sistema SHALL reutilizar `TenantSessionExecutor` y `TenantDatabaseRouter` para
   acceso a la base de datos del tenant.
3. THE Sistema SHALL reutilizar `AgendaFecha` como value object para validar la fecha
   del reporte.
4. THE Sistema SHALL no crear un nuevo Aggregate de dominio para la generación del PDF.


### REQ-PR-009 — Clasificación de turno derivada de hora de cita

**User Story:** Como Archivista, quiero que el PDF indique el turno (Matutino/Vespertino)
de cada bloque médico, para poder organizar y entregar los paquetes por turno de consulta.

#### Criterios de aceptación

1. THE Sistema SHALL derivar el turno de cada cita desde `appointmentTime` según la
   regla aprobada en ADR-0031:
   - hora inicio `< 14:00` → **MATUTINO**
   - hora inicio `>= 14:00` → **VESPERTINO**
2. THE PDF SHALL incluir el turno en el encabezado de cada bloque servicio+médico,
   a continuación de la fecha de consulta.
3. THE Sistema SHALL no leer el turno desde SIMEF ni desde ningún campo de base de datos.
4. THE Sistema SHALL calcular el turno dentro del adapter PDF (`PDFKitPreparationReportGenerator`),
   como función pura sobre `appointmentTime` del primer item del grupo.
5. THE turno SHALL aparecer únicamente en el PDF; no se expone en la API JSON ni en la
   tabla web como columna adicional.
6. THE `PreparationItem` NO SHALL ser modificado para incluir `turno`; el atributo es
   derivado localmente en el adapter.

## 5. Invariantes

| ID | Invariante |
|---|---|
| INV-PR-001 | El PDF solo se genera para fechas que tienen al menos una cita ACTIVA en el tenant. |
| INV-PR-002 | La generación requiere simultáneamente `AGENDA_VIEW` y `AGENDA_PRINT`. |
| INV-PR-003 | El PDF agrupa siempre: servicio_codigo ASC → medico_numero_empleado ASC → hora ASC. |
| INV-PR-004 | Cada bloque servicio+médico ocupa al menos una página completa. |
| INV-PR-005 | Tenant isolation: el PDF solo contiene citas del tenant del contexto. |
| INV-PR-006 | El PDF no persiste en ningún storage; es generado on-demand en memoria. |
| INV-PR-007 | El filename no contiene datos de paciente. |
| INV-PR-008 | El audit log se escribe por cada generación, exitosa o fallida. |
| INV-PR-009 | El turno es siempre derivado de `appointmentTime`; no se lee de SIMEF ni de la DB. |

## 6. Autorización

- `AGENDA_VIEW`: requerido para consultar la lista paginada y para generar el PDF.
- `AGENDA_PRINT`: requerido adicionalmente para generar el PDF.
- `AGENDA_VIEW` + `AGENDA_PRINT` son condición AND, no alternativa.
- El backend re-verifica ambas permissions en el handler antes de ejecutar el use case.
- No existe derivación automática desde roles.
- Permission ausente → HTTP 403 sin detalles de tenant.

## 7. Privacidad

- `nombrePaciente`, `expediente.original` y `folio` son campos ya contenidos en
  `PreparationItem`; su inclusión en el PDF mantiene la misma finalidad operativa.
- El PDF no agrega ningún campo que no exista en `PreparationItem`.
- Logs, errores y métricas no incluyen nombre, expediente, folio ni cualquier PII.
- El PDF se genera en memoria; no hay escritura en filesystem ni log del contenido.
- El filename usa la fecha de agenda (no PII).

## 8. Criterios de aceptación globales

| ID | Criterio |
|---|---|
| AC-PR-001 | POST genera PDF > 0 bytes con Content-Type: application/pdf para fecha con citas. |
| AC-PR-002 | POST responde 422 cuando no hay citas activas para los servicios solicitados. |
| AC-PR-003 | POST responde 403 cuando falta AGENDA_PRINT. |
| AC-PR-004 | POST responde 403 cuando falta AGENDA_VIEW. |
| AC-PR-005 | El PDF contiene al menos un bloque por cada combinación servicio+médico con citas activas. |
| AC-PR-006 | El audit log registra acción AGENDA_REPORT_GENERATED por cada generación. |
| AC-PR-007 | El PDF no contiene patrones CURP, teléfonos ni fechas de nacimiento. |
| AC-PR-008 | El filename no contiene datos de paciente. |
| AC-PR-009 | El tenant B no puede obtener datos del tenant A mediante el endpoint. |
| AC-PR-010 | listForPrint() es la única fuente de datos para el PDF (no query duplicada). |
| AC-PR-011 | La vista tabular muestra la tabla plana sin acordeones. |
| AC-PR-012 | Los filtros de servicio y médico operan correctamente sobre los datos de la página. |
| AC-PR-013 | AGENDA_PRINT existe en el catálogo de permissions. |
| AC-PR-014 | El encabezado de cada bloque PDF indica correctamente MATUTINO (07:00) o VESPERTINO (14:30). |
| AC-PR-015 | `PreparationItem` no contiene campo `turno`; la derivación ocurre en el adapter. |

## 9. Open questions

No existen preguntas bloqueantes para esta spec. Las siguientes son no bloqueantes:

- `PR-OQ-001` (no bloqueante): ¿El PDF necesitará encabezado con logo institucional en
  una versión futura? Fuera del alcance actual; PDFKit lo soporta sin cambio de motor.
- `PR-OQ-002` (no bloqueante): ¿Se requerirá historial de reportes generados en una
  versión futura? Fuera del alcance actual; el audit log provee trazabilidad básica.

## 10. Implementation Readiness

| Prerequisito | Estado |
|---|---|
| agenda-preparation T-00..T-08 | PASS |
| PreparationListQueryPort implementado | PASS (PostgresAgendaPreparationQueryPort) |
| PreparationItem contrato estable | PASS |
| TenantSessionExecutor disponible | PASS |
| AuditWriter port disponible (@sigac/audit) | PASS (T-04A) |
| AgendaFecha value object | PASS |
| Permiso AGENDA_PRINT | PENDIENTE (T-20) |
| PDFKit seleccionado | APROBADO (ADR-0030, esta spec) |
| ADR-0031 Turno derivado | APROBADO (esta spec v0.1.1) |

- `requirements_ready: true`
- `design_ready: false` — pendiente design.md
- `tasks_ready: false` — pendiente tasks.md
- `implementation_ready: false` — pendiente T-20..T-27
