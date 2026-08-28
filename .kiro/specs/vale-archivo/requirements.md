---
spec: vale-archivo
version: "0.1.0"
status: "Approved for Implementation"
date: "2026-08-26"
bounded_context: "Vale Archivo / Solicitudes Extraordinarias"
parent_spec: null
depends_on:
  - "expediente-workspace (Expediente, Ubicacion, EstadoOperativo ya implementados)"
  - "packages/platform/tenant — catálogo de permisos ya contiene REQUEST_CREATE, REQUEST_ASSIGN, SEARCH_START, SEARCH_MARK_LOCATED, SEARCH_MARK_NOT_LOCATED, CUSTODY_TRANSFER; se agregan ARCHIVE_REQUEST_VIEW, ARCHIVE_REQUEST_PROCESS, ARCHIVE_REQUEST_DELIVER (T-30)"
open_questions_blocking: []
---

# Requirements Document

## Introduction

### 1. Propósito

Vale Archivo digitaliza el proceso de **solicitudes extraordinarias de expedientes físicos**
mediante el formato institucional SM 1-14. Es un bounded context independiente de Agenda
Preparation: gestiona peticiones puntuales de expedientes (urgencias, auditorías,
jefaturas) que no provienen de la agenda diaria SIMEF.

El objetivo de la versión 0.1 es sustituir el flujo actual basado en documentos Word y
hojas de cálculo Excel por un registro digital trazable con control de estados, sin
eliminar el documento institucional físico en esta iteración.

No altera `Expediente`, `Custodia`, `MovimientoExpediente` ni Archive Operations.

## Glossary

### 2. Glosario

- **ValeArchivo**: documento de solicitud digital que agrupa uno o más expedientes
  solicitados bajo un número de vale SM 1-14.
- **ValeArchivoItem**: línea individual del vale; representa un expediente solicitado.
- **NumeroVale**: identificador textual asignado institucionalmente al formato SM 1-14
  (p. ej. `VA-2026-00142`). Puede no ser correlativo.
- **Solicitante**: autoridad institucional que firma la solicitud (Director, Subdirector,
  Coordinador o personal designado). No necesariamente opera SIGAC.
- **Autorizador**: quien aprueba la solicitud antes de iniciar la búsqueda. Puede
  coincidir con el Solicitante.
- **Capturista**: personal de Archivo Clínico que registra el vale en SIGAC. Puede no
  ser el solicitante institucional.
- **Archivista de búsqueda**: personal que localiza físicamente los expedientes.
- **Archivista de entrega**: personal que entrega los expedientes al receptor final.
- **SM 1-14**: formato institucional oficial para solicitudes extraordinarias de
  expedientes en unidades de salud del ISSSTE.
- **EstadoVale**: estado del ciclo de vida del vale completo.
- **EstadoBusqueda**: estado de localización individual por cada `ValeArchivoItem`.
- **SolicitanteReferencia**: registro nominal del solicitante o autorizador (nombre +
  cargo + unidad); no es un `ActorContext` de SIGAC.

## 3. Actores y permisos

| Actor | Rol operativo | Permiso SIGAC requerido |
|---|---|---|
| Capturista | Registra el vale en SIGAC | `REQUEST_CREATE` |
| Archivista (consulta) | Consulta vales activos, su estado y el PDF | `ARCHIVE_REQUEST_VIEW` |
| Archivista de búsqueda | Inicia búsqueda y registra localización | `ARCHIVE_REQUEST_PROCESS` |
| Archivista de entrega | Registra la entrega al receptor | `ARCHIVE_REQUEST_DELIVER` |
| Solicitante | Firma el documento físico; puede no operar SIGAC | — |
| Autorizador | Aprueba la solicitud antes de búsqueda; puede no operar SIGAC | — |

**Permisos del catálogo existente que se reutilizan** (sin modificar):
`REQUEST_CREATE` — capacidad general de iniciación de solicitudes.
`REQUEST_ASSIGN` — asignación futura; no se modifica.

**Permisos nuevos específicos del bounded context Vale Archivo** (T-30, ADR-0033):
- `ARCHIVE_REQUEST_VIEW` — consultar la lista de vales, obtener el PDF y ver el detalle
  de un vale. No permite crear ni modificar. Se agrega porque `EXPEDIENT_VIEW` está
  scoped a expedientes individuales, no a vales SM 1-14.
- `ARCHIVE_REQUEST_PROCESS` — iniciar la búsqueda y registrar localización por ítem
  (LOCALIZADO / NO_LOCALIZADO). Expresa la capacidad de procesamiento dentro del
  bounded context sin reutilizar permisos de búsqueda de otros flujos.
- `ARCHIVE_REQUEST_DELIVER` — registrar la entrega de expedientes al receptor y
  transicionar el vale a ENTREGADA/CERRADA. Separado de `CUSTODY_TRANSFER` para
  no acoplar el bounded context a los permisos de custodia de archive-operations.

Ningún permiso se deriva automáticamente de ningún rol.

La autorización es **exclusivamente server-side** mediante `RequestContext` y
`TenantContext` canónicos. El frontend nunca decide autorización.

## 4. Alcance v0.1

### 4.1 Incluido

1. Registro digital del formato SM 1-14 (número de vale, fechas, unidad, solicitante, autorizador).
2. Múltiples expedientes por vale; especialidad en el ítem, no en el encabezado.
3. Máquina de estados completa: RECIBIDA → EN_BUSQUEDA → COMPLETA/PARCIAL/NO_LOCALIZADA → ENTREGADA → CERRADA.
4. Localización por ítem con registro de ubicación física y observaciones.
5. Registro de entrega con nombre del receptor y fecha.
6. Generación de representación digital PDF del formato SM 1-14.
7. Consulta paginada de vales con filtros por estado, fecha y unidad solicitante.
8. Audit log por cada transición de estado.
9. Tenant isolation obligatorio.
10. Permisos `ARCHIVE_REQUEST_VIEW`, `ARCHIVE_REQUEST_PROCESS` y `ARCHIVE_REQUEST_DELIVER` para operaciones específicas del bounded context.

### 4.2 Fuera de alcance (non-goals)

- Integración con expediente electrónico (Expediente aggregate en archive-operations).
- OCR de formularios físicos SM 1-14.
- Firma digital del PDF.
- Almacenamiento o historial de PDFs generados.
- Ubicación automática de expedientes (sin integración con Ubicacion domain).
- Integración con Agenda Preparation.
- Integración con SIMEF.
- Permisos individuales por unidad solicitante o especialidad.
- Datos clínicos: diagnósticos, notas, signos vitales, antecedentes.
- PII adicional más allá de nombre operativo de paciente: sin CURP, teléfono,
  fecha de nacimiento, correo electrónico, edad, sexo.
- Reimpresión desde historial de PDFs.
- Automatización de macros ni descarga de datos externos.

## Requirements

## 5. Requisitos funcionales

---

### REQ-VA-001 — Registrar Vale SM 1-14

**User Story:** Como Capturista, quiero registrar digitalmente una solicitud SM 1-14,
para sustituir el llenado manual en Word y el registro en la hoja de control Excel.

#### Criterios de aceptación

1. WHEN el Capturista con `REQUEST_CREATE` envía una solicitud de creación con número de
   vale, fecha solicitud, fecha recepción, unidad solicitante, solicitante, autorizador y
   al menos un expediente, THE Sistema SHALL crear un `ValeArchivo` con estado `RECIBIDA`
   y generar un identificador único.
2. THE Sistema SHALL registrar la `SolicitanteReferencia` del solicitante (nombre + cargo)
   y del autorizador (nombre + cargo) como campos independientes del usuario SIGAC que
   captura el vale.
3. IF el cuerpo de la solicitud no contiene al menos un `ValeArchivoItem`, THEN THE API
   SHALL responder HTTP 422 con un error descriptivo.
4. THE Sistema SHALL asociar cada `ValeArchivoItem` con su `especialidad` en el ítem;
   el encabezado del `ValeArchivo` no tiene campo de especialidad.
5. IF el Capturista no tiene `REQUEST_CREATE`, THEN THE API SHALL responder HTTP 403
   sin revelar detalles del tenant.
6. THE Sistema SHALL registrar el `actorId` del Capturista como `creadoPor` en el
   `ValeArchivo`.
7. WHEN el `ValeArchivo` es creado exitosamente, THE AuditWriter SHALL registrar una
   entrada con acción `VALE_CREADO`, sin datos de paciente individuales.

---

### REQ-VA-002 — Generar representación digital PDF SM 1-14

**User Story:** Como Capturista, quiero descargar el PDF del formato SM 1-14 a partir
del registro digital, para adjuntarlo o archivarlo junto al documento físico firmado.

#### Criterios de aceptación

1. WHEN el usuario con `REQUEST_CREATE` o `ARCHIVE_REQUEST_VIEW` solicita
   `GET /api/v1/vale-archivo/:id/pdf`, THE Sistema SHALL generar y devolver un PDF con
   `Content-Type: application/pdf` que representa el formato SM 1-14.
2. THE PDF SHALL incluir: número de vale, fecha solicitud, fecha recepción, unidad
   solicitante, nombre y cargo del solicitante, nombre y cargo del autorizador, y la
   tabla de expedientes (número, nombre paciente, especialidad, estado búsqueda).
3. THE PDF SHALL omitir CURP, teléfono, fecha de nacimiento, correo electrónico, edad,
   sexo y cualquier campo no presente en `ValeArchivo` / `ValeArchivoItem`.
4. THE filename en `Content-Disposition` SHALL seguir el patrón
   `sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf` y no contener datos de paciente.
5. THE Sistema SHALL generar el PDF en memoria sin escribir en filesystem ni storage.
6. IF el `ValeArchivo` no existe para el tenant actual, THEN THE API SHALL responder
   HTTP 404.

---

### REQ-VA-003 — Consultar solicitudes pendientes

**User Story:** Como Archivista, quiero ver la lista de vales activos con su estado y
detalle, para saber qué solicitudes están en espera de atención.

#### Criterios de aceptación

1. WHEN el usuario con `ARCHIVE_REQUEST_VIEW` solicita
   `GET /api/v1/vale-archivo`, THE Sistema SHALL devolver una lista paginada de vales
   con: número de vale, fecha solicitud, unidad solicitante, nombre del solicitante,
   estado del vale y cantidad de ítems.
2. THE Sistema SHALL implementar paginación cursor-based; la respuesta incluye un
   `nextCursor` opaco si existen más resultados.
3. WHERE el parámetro `estado` se proporciona, THE Sistema SHALL filtrar los vales
   cuyo `EstadoVale` coincida con el valor indicado.
4. WHERE el parámetro `fecha` se proporciona, THE Sistema SHALL filtrar los vales cuya
   `fechaSolicitud` coincida con la fecha (formato `YYYY-MM-DD`).
5. WHERE el parámetro `unidad` se proporciona, THE Sistema SHALL filtrar los vales cuya
   `unidadSolicitante` contenga el texto indicado (comparación case-insensitive).
6. IF el usuario no tiene `ARCHIVE_REQUEST_VIEW`, THEN THE API SHALL responder HTTP 403.
7. THE Sistema SHALL no incluir en la respuesta campos de PII más allá del nombre del
   solicitante y del autorizador (no CURP, no teléfono, no datos de paciente en el
   listado general).

---

### REQ-VA-004 — Iniciar búsqueda

**User Story:** Como Archivista de búsqueda, quiero marcar el inicio de la búsqueda de
expedientes, para dejar constancia del momento en que se activa la solicitud.

#### Criterios de aceptación

1. WHEN el Archivista con `ARCHIVE_REQUEST_PROCESS` envía
   `POST /api/v1/vale-archivo/:id/iniciar-busqueda`, THE Sistema SHALL transicionar
   el `ValeArchivo` de estado `RECIBIDA` a `EN_BUSQUEDA`.
2. THE Sistema SHALL registrar el `actorId` del Archivista y el timestamp de inicio
   en el `ValeArchivo`.
3. IF el `ValeArchivo` no está en estado `RECIBIDA`, THEN THE Sistema SHALL responder
   HTTP 422 con un error descriptivo de transición inválida.
4. IF el usuario no tiene `ARCHIVE_REQUEST_PROCESS`, THEN THE API SHALL responder HTTP 403.
5. WHEN la transición es exitosa, THE AuditWriter SHALL registrar una entrada con
   acción `VALE_BUSQUEDA_INICIADA` incluyendo `valeId`, `actorId` y timestamp.

---

### REQ-VA-005 — Registrar localización por expediente

**User Story:** Como Archivista de búsqueda, quiero registrar para cada expediente si
fue encontrado o no, para tener una trazabilidad completa de cada ítem del vale.

#### Criterios de aceptación

1. WHEN el Archivista con `ARCHIVE_REQUEST_PROCESS` envía
   `PATCH /api/v1/vale-archivo/:id/items/:itemId` con
   `estadoBusqueda: 'LOCALIZADO'` y una `ubicacionEncontrada`, THE Sistema SHALL
   actualizar el `ValeArchivoItem` correspondiente.
2. WHEN el Archivista con `ARCHIVE_REQUEST_PROCESS` envía
   `PATCH /api/v1/vale-archivo/:id/items/:itemId` con
   `estadoBusqueda: 'NO_LOCALIZADO'`, THE Sistema SHALL actualizar el
   `ValeArchivoItem` correspondiente.
3. THE Sistema SHALL aceptar un campo `observaciones` opcional en la actualización del
   ítem, sin restricciones de contenido (texto libre ≤ 500 caracteres).
4. WHEN todos los `ValeArchivoItem` tienen `estadoBusqueda` distinto de `PENDIENTE`
   y todos son `LOCALIZADO`, THE Sistema SHALL transicionar el `ValeArchivo` a
   `COMPLETA`.
5. WHEN todos los `ValeArchivoItem` tienen `estadoBusqueda` distinto de `PENDIENTE`
   y al menos uno es `LOCALIZADO` y al menos uno es `NO_LOCALIZADO`, THE Sistema
   SHALL transicionar el `ValeArchivo` a `PARCIAL`.
6. WHEN todos los `ValeArchivoItem` tienen `estadoBusqueda` `NO_LOCALIZADO`, THE
   Sistema SHALL transicionar el `ValeArchivo` a `NO_LOCALIZADA`.
7. IF el `ValeArchivo` no está en estado `EN_BUSQUEDA`, THEN THE Sistema SHALL responder
   HTTP 422 indicando que la operación no es válida en el estado actual.
8. WHEN la transición de estado del vale ocurre (criterios 4, 5 o 6), THE AuditWriter
   SHALL registrar una entrada con acción `VALE_ESTADO_ACTUALIZADO`, `valeId`,
   nuevo estado y `actorId`.

---

### REQ-VA-006 — Registrar entrega

**User Story:** Como Archivista de entrega, quiero registrar la entrega de los
expedientes localizados al receptor final, para cerrar el ciclo operativo del vale.

#### Criterios de aceptación

1. WHEN el Archivista con `ARCHIVE_REQUEST_DELIVER` envía
   `POST /api/v1/vale-archivo/:id/entrega` con fecha entrega, nombre del receptor y
   lista de ítems a entregar, THE Sistema SHALL transicionar el `ValeArchivo` de
   `COMPLETA` o `PARCIAL` a `ENTREGADA`.
2. THE Sistema SHALL registrar: fecha de entrega, `actorId` del Archivista, nombre
   del receptor (texto libre) y la lista de `ValeArchivoItem` entregados.
3. IF el `ValeArchivo` no está en estado `COMPLETA` ni `PARCIAL`, THEN THE Sistema
   SHALL responder HTTP 422 con un error de transición inválida.
4. THE Sistema SHALL permitir la transición de `ENTREGADA` a `CERRADA` mediante el
   mismo endpoint o una acción posterior explícita; ambas opciones son válidas en v0.1.
5. IF el usuario no tiene `ARCHIVE_REQUEST_DELIVER`, THEN THE API SHALL responder HTTP 403.
6. WHEN la entrega es registrada exitosamente, THE AuditWriter SHALL registrar una
   entrada con acción `VALE_ENTREGADO`, `valeId`, `actorId`, fecha de entrega y
   cantidad de ítems entregados; sin nombres de pacientes individuales.

---

### REQ-VA-007 — Cierre administrativo de vale no localizado

**User Story:** Como Archivista, quiero poder cerrar un vale en estado `NO_LOCALIZADA`,
para que no permanezca indefinidamente activo en el sistema.

#### Criterios de aceptación

1. WHEN el usuario con `REQUEST_CREATE` o `REQUEST_ASSIGN` envía una acción de cierre
   sobre un `ValeArchivo` en estado `NO_LOCALIZADA`, THE Sistema SHALL transicionar
   el vale a `CERRADA`.
2. THE Sistema SHALL registrar el `actorId`, el motivo de cierre (texto libre, opcional)
   y el timestamp.
3. IF el `ValeArchivo` no está en estado `NO_LOCALIZADA`, THEN THE Sistema SHALL
   responder HTTP 422.
4. WHEN el cierre es registrado, THE AuditWriter SHALL registrar una entrada con
   acción `VALE_CERRADO_ADMINISTRATIVO`.

## 6. Máquina de estados

```
RECIBIDA ──────────────────────────────► EN_BUSQUEDA (REQ-VA-004)
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                          COMPLETA        PARCIAL       NO_LOCALIZADA
                         (todos          (algunos        (ninguno
                       localizados)    localizados)    localizado)
                              │               │               │
                              └───────┬───────┘               │
                                      ▼                       ▼
                                  ENTREGADA            CERRADA (adm.)
                                      │
                                      ▼
                                   CERRADA
```

**Transiciones válidas:**

| Desde | Hacia | Disparador | Requisito |
|---|---|---|---|
| `RECIBIDA` | `EN_BUSQUEDA` | `IniciarBusqueda` | `ARCHIVE_REQUEST_PROCESS` |
| `EN_BUSQUEDA` | `COMPLETA` | Último ítem → `LOCALIZADO` | `ARCHIVE_REQUEST_PROCESS` |
| `EN_BUSQUEDA` | `PARCIAL` | Último ítem resuelto, mezcla | `ARCHIVE_REQUEST_PROCESS` |
| `EN_BUSQUEDA` | `NO_LOCALIZADA` | Último ítem → `NO_LOCALIZADO` | `ARCHIVE_REQUEST_PROCESS` |
| `COMPLETA` | `ENTREGADA` | `RegistrarEntrega` | `ARCHIVE_REQUEST_DELIVER` |
| `PARCIAL` | `ENTREGADA` | `RegistrarEntrega` | `ARCHIVE_REQUEST_DELIVER` |
| `ENTREGADA` | `CERRADA` | `CerrarVale` (inmediato o diferido) | `ARCHIVE_REQUEST_DELIVER` / `REQUEST_ASSIGN` |
| `NO_LOCALIZADA` | `CERRADA` | `CerrarValeAdministrativo` | `REQUEST_CREATE` / `REQUEST_ASSIGN` |

**Estados terminales:** `CERRADA`.

## 7. Invariantes

| ID | Invariante |
|---|---|
| INV-VA-001 | Un `ValeArchivo` tiene al menos un `ValeArchivoItem`. |
| INV-VA-002 | `SolicitanteReferencia` y el `actorId` del Capturista se registran por separado; pueden representar a la misma persona física, pero son campos distintos. |
| INV-VA-003 | La `especialidad` pertenece al `ValeArchivoItem`; el encabezado de `ValeArchivo` no tiene campo de especialidad. |
| INV-VA-004 | El PDF SM 1-14 no contiene CURP, teléfono, fecha de nacimiento ni correo electrónico. |
| INV-VA-005 | `TenantContext` siempre es server-resolved; ningún vale es cross-tenant. |
| INV-VA-006 | Cada transición de estado escribe una entrada en `audit_log`; no hay transiciones silenciosas. |
| INV-VA-007 | No se almacenan datos clínicos: diagnósticos, signos vitales, notas médicas, antecedentes. |
| INV-VA-008 | El PDF se genera en memoria on-demand; no se persiste en filesystem ni storage. |
| INV-VA-009 | El filename del PDF no contiene nombre de paciente, expediente ni CURP. |
| INV-VA-010 | Las transiciones de estado son unidireccionales; no existe retroceso de estado. |
| INV-VA-011 | El concepto de Turno (MATUTINO/VESPERTINO) no pertenece a Vale Archivo; es exclusivo de Agenda Preparation y no aparece en ningún campo, filtro, PDF ni respuesta de este bounded context. |
| INV-VA-012 | Las operaciones de procesamiento de búsqueda y de entrega usan permisos específicos del bounded context (`ARCHIVE_REQUEST_PROCESS`, `ARCHIVE_REQUEST_DELIVER`); no reutilizan `SEARCH_MARK_LOCATED`, `SEARCH_MARK_NOT_LOCATED` ni `CUSTODY_TRANSFER` de archive-operations. |

## 8. Privacidad y seguridad

- `pacienteNombre` en `ValeArchivoItem` corresponde al nombre operativo ya presente en los
  documentos físicos SM 1-14; su inclusión mantiene la finalidad operativa existente.
- El PDF no agrega ningún campo que no exista en `ValeArchivo` / `ValeArchivoItem`.
- Logs, errores y métricas no incluyen CURP, teléfono, correo ni datos clínicos.
- El `audit_log` por transición no contiene nombres de pacientes individuales; solo
  `valeId`, `actorId`, estado nuevo y contadores agregados.
- Tenant isolation: ninguna query o transacción puede cruzar tenants.

## 9. Criterios de aceptación globales

| ID | Criterio |
|---|---|
| AC-VA-001 | `POST /api/v1/vale-archivo` crea un vale con estado `RECIBIDA` y devuelve el `id`. |
| AC-VA-002 | Un vale con cero ítems en el body devuelve HTTP 422. |
| AC-VA-003 | `GET /api/v1/vale-archivo` devuelve lista paginada con cursor; filtra por `estado`, `fecha`, `unidad`. |
| AC-VA-004 | La transición `RECIBIDA` → `EN_BUSQUEDA` queda registrada en `audit_log`. |
| AC-VA-005 | `PATCH /api/v1/vale-archivo/:id/items/:itemId` actualiza `estadoBusqueda` del ítem. |
| AC-VA-006 | Cuando todos los ítems están en `LOCALIZADO`, el vale pasa a `COMPLETA`. |
| AC-VA-007 | Cuando todos los ítems están en `NO_LOCALIZADO`, el vale pasa a `NO_LOCALIZADA`. |
| AC-VA-008 | `POST /api/v1/vale-archivo/:id/entrega` registra receptor y fecha de entrega. |
| AC-VA-009 | `GET /api/v1/vale-archivo/:id/pdf` devuelve PDF sin patrones CURP ni teléfono. |
| AC-VA-010 | Actor sin `REQUEST_CREATE` recibe HTTP 403 al intentar crear un vale. |
| AC-VA-011 | Tenant B no puede acceder a vales de Tenant A (HTTP 403 o 404, sin revelar datos). |
| AC-VA-012 | Cada transición de estado genera una entrada en `audit_log` con `valeId` y `actorId`. |
| AC-VA-013 | Actor sin `ARCHIVE_REQUEST_VIEW` recibe HTTP 403 al listar vales. |
| AC-VA-016 | Actor sin `ARCHIVE_REQUEST_PROCESS` recibe HTTP 403 al intentar iniciar búsqueda o registrar localización. |
| AC-VA-017 | Actor sin `ARCHIVE_REQUEST_DELIVER` recibe HTTP 403 al intentar registrar la entrega. |
| AC-VA-014 | Transición inválida (p. ej. `COMPLETA` → `EN_BUSQUEDA`) devuelve HTTP 422. |
| AC-VA-015 | El filename del PDF sigue el patrón `sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf`. |

## 10. Open questions

No existen preguntas bloqueantes para esta spec v0.1.0. Las siguientes son no bloqueantes:

- `VA-OQ-001` (no bloqueante): ¿El número de vale debe ser único por tenant o puede
  repetirse entre periodos? Actualmente se trata como texto libre único por tenant.
- `VA-OQ-002` (no bloqueante): ¿El Autorizador necesitará firmado digital del PDF en
  una versión futura? Fuera del alcance v0.1; PDFKit lo soporta sin cambio de motor.
- `VA-OQ-003` (no bloqueante): ¿Se requerirá historial de PDFs generados? El `audit_log`
  provee trazabilidad básica; almacenamiento de PDFs es out of scope v0.1.
- `VA-OQ-004` (no bloqueante): ¿La transición `ENTREGADA` → `CERRADA` debe ser inmediata
  (misma acción de entrega) o diferida (acción separada)? La spec permite ambas; el
  implementador elige en T-33.

## 11. Implementation Readiness

| Prerequisito | Estado |
|---|---|
| `Expediente`, `Ubicacion`, `EstadoOperativo` | PASS (expediente-workspace) |
| `TenantSessionExecutor` | PASS |
| `AuditWriter` port (`@sigac/audit`) | PASS |
| `@sigac/pdf` package (PDFKit adapter infra) | PASS (T-22 preparation-reports) |
| Permisos base del catálogo | PASS |
| Permisos `ARCHIVE_REQUEST_VIEW`, `ARCHIVE_REQUEST_PROCESS`, `ARCHIVE_REQUEST_DELIVER` | PENDIENTE (T-30) |

- `requirements_ready: true`
- `design_ready: true`
- `tasks_ready: true`
- `implementation_ready: true` — Approved for Implementation (2026-08-26)
