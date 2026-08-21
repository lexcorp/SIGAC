---
spec: agenda-preparation
version: "0.1.0-draft"
status: "Draft — requirements ready; implementation decisions pending"
date: "2026-08-20"
source_of_truth:
  - "knowledge/README.md — precedence and traceability"
  - "knowledge/01-normativa/guias/Guia de organización y manejo del expediente clinico.pdf"
  - "knowledge/02-procedimientos/citas-programadas/PROCESOS_ARCHIVO_CLINICO_CITAS_PROGRAMADAS.docx"
  - "knowledge/03-formatos-oficiales/SM10-1/FORMATO_SM10-1_HOJA DE LABORES DEL MEDICO.xls"
  - "knowledge/04-simef-evidencia-operativa/agenda-archivo-clinico/AGENDA DE ARCHIVO CLINICO.xls"
  - "docs/domain-discovery/expediente-flow/"
decisions_applied:
  - "DD-EW-001..006 RESOLVED for the initial slice"
  - "FOLIO is the stable appointment identity"
  - "physician employee number is the tenant-scoped physician identity"
  - "Servicio == Especialidad only inside Agenda Preparation"
  - "RETIRADA_DE_AGENDA is not clinical cancellation"
---

# Agenda Preparation — Requirements

## 1. Propósito

Importar y reconciliar la **Agenda de Archivo Clínico** exportada por SIMEF para una fecha concreta y un tenant, garantizando que cada registro recibido tenga un resultado explícito y produciendo una lista inicial, validada y minimizada para la preparación de Expedientes.

La spec pertenece al bounded context candidato **Agenda / Appointment Preparation**. No reemplaza SIMEF ni redefine Archive Operations.

## 2. Alcance

### 2.1 Incluido

1. Recibir un archivo diario SIMEF.
2. Validar layout, contenido y reglas de negocio por etapas separadas.
3. Registrar una ejecución de importación tenant-scoped.
4. Interpretar el layout HTML ISO-8859 observado bajo extensión `.xls`.
5. Conservar el valor original de los datos utilizados junto con su interpretación y resolución.
6. Identificar la Agenda lógica por tenant + fecha.
7. Identificar cada Cita por FOLIO.
8. Identificar médico por número de empleado tenant-scoped.
9. Resolver Servicio/Especialidad como un solo concepto operacional dentro del contexto.
10. Reconciliar un nuevo snapshot contra la Agenda lógica vigente.
11. Producir un resultado explícito por cada registro recibido.
12. Producir resumen, resultados, incidencias y lista inicial de preparación.

### 2.2 Fuera de alcance

- Solicitud extraordinaria y SM1-14.
- Préstamo, devolución y rearchivo.
- Paquetes físicos, traslado, despacho o custodia.
- Generación completa o impresión de SM10-1.
- `ATENCION_FUERA_DE_AGENDA` y cita abierta.
- Turno; no se derivará de la hora y no se crearán enums MATUTINO/VESPERTINO/FIN DE SEMANA.
- Consultorio o Destino; no se inferirán desde médico o Servicio.
- Automatización de Excel, macros VBA o descarga desde SIMEF.
- Contenido clínico y campos asistenciales.
- Cambios funcionales a `expediente-workspace v0.3.23`.

## 3. Actores

| Actor | Responsabilidad en el slice | Estado de autorización |
|---|---|---|
| Personal de Archivo Clínico | Entrega/importa el snapshot y consulta resultados/lista | Permission exacta pendiente de aprobación (`AP-OQ-001`) |
| Jefatura de Archivo | Supervisa importación e incidencias | Permission exacta pendiente de aprobación (`AP-OQ-001`) |
| SIMEF | Sistema externo que produce el archivo diario | Fuente, no actor autenticado de SIGAC en este slice |
| Administrador técnico | Soporte de layout/configuración futura | No obtiene acceso funcional por implicación |

La autorización será server-side mediante `RequestContext` y `TenantContext` canónicos. La UI no derivará acceso desde roles.

## 4. Requisitos funcionales

### REQ-AP-001 — Registrar importación tenant-scoped

El sistema debe registrar una ejecución de importación distinta del archivo físico y de la Agenda lógica. Debe asociarla exclusivamente al tenant server-side y a la fecha de Agenda interpretada.

**Aceptación:** dos tenants pueden importar la misma fecha sin compartir Agenda, importaciones, catálogos ni resultados.

### REQ-AP-002 — Validar el layout fail-closed

Antes de interpretar filas, el sistema debe verificar que el archivo corresponde al layout aprobado: contenido HTML bajo `.xls`, encabezados requeridos y bloques explícitos `Médico:`/`Servicio:`. Un layout desconocido o incompatible debe producir error estructural y cero interpretación silenciosa.

**Aceptación:** cambiar, omitir o desplazar un encabezado requerido no puede mapear datos hacia otro campo.

### REQ-AP-003 — Separar validaciones

La importación debe distinguir:

1. validación estructural del artefacto;
2. validación de contenido por registro;
3. validación/resolución de negocio.

Un fallo debe indicar su etapa sin exponer datos personales innecesarios.

### REQ-AP-004 — Identificar Agenda lógica

La Agenda lógica inicial se identifica conceptualmente por `TenantContext + fechaAgenda`. Un archivo diario puede contener múltiples bloques médico/Servicio, pero éstos pertenecen a la misma Agenda lógica del tenant y fecha.

### REQ-AP-005 — Identificar Cita por FOLIO

FOLIO es la identidad estable de Cita para importación y reconciliación. Número de cita, nombre, Expediente, médico, hora o combinaciones de esos campos no sustituyen FOLIO.

### REQ-AP-006 — Resolver médico

El número de empleado es la identidad primaria y tenant-scoped del médico. El nombre se conserva como dato original/descriptivo. La normalización de nombre sólo podrá utilizarse como fallback controlado:

- cero candidatos: resultado explícito pendiente de resolución;
- más de un candidato: resultado explícito ambiguo;
- nunca fuzzy matching o asociación ambigua silenciosa.

### REQ-AP-007 — Resolver Servicio/Especialidad

Dentro de Agenda Preparation, Servicio y Especialidad representan un solo concepto operacional con código y nombre originales. Esta equivalencia no se exporta como regla universal a otros bounded contexts.

### REQ-AP-008 — Conservar origen e interpretación

Para cada campo dentro del alcance debe poder trazarse:

`valor original → valor interpretado/normalizado → entidad o referencia resuelta`.

La normalización no puede sobrescribir ni destruir el valor original. La retención del archivo binario completo permanece en `AP-OQ-002`.

### REQ-AP-009 — Reconciliar por FOLIO

Al comparar snapshots de la misma Agenda lógica:

| Condición | Acción conceptual |
|---|---|
| FOLIO nuevo | ADD: incorporar la Cita vigente |
| FOLIO existente con cambios permitidos | UPDATE: actualizar y conservar trazabilidad |
| FOLIO existente idéntico | UNCHANGED: no modificar estado de negocio |
| FOLIO antes presente y ahora ausente | `RETIRADA_DE_AGENDA`: excluir de preparación vigente, conservar historia, no borrar |
| FOLIO retirado que reaparece | RESTORE: reconciliar la misma identidad, no crear otra Cita |

`RETIRADA_DE_AGENDA` no equivale a `CANCELADA` ni confirma una cancelación clínica.

### REQ-AP-010 — Reimportación idempotente

Si una nueva importación no contiene diferencias, el sistema debe reconocer que la Agenda ya fue importada y no crear estado de negocio duplicado. Si contiene diferencias, debe ejecutar reconciliación por FOLIO.

### REQ-AP-011 — Resultado explícito por registro

Ningún registro recibido puede desaparecer silenciosamente. La taxonomía funcional mínima es:

| Resultado | Semántica |
|---|---|
| `PROCESADO` | Registro nuevo o restaurado incorporado correctamente |
| `SIN_CAMBIOS` | FOLIO ya vigente e idéntico |
| `ACTUALIZADO` | FOLIO existente reconciliado con cambios permitidos |
| `RETIRADO_DE_AGENDA` | Efecto de reconciliación sobre una Cita previa ausente del snapshot actual |
| `PENDIENTE_RESOLUCION` | No puede resolverse inequívocamente médico, Expediente u otra referencia requerida |
| `DUPLICADO` | FOLIO repetido de forma incompatible dentro del input |
| `ERROR_ESTRUCTURAL` | Artefacto/registro no puede interpretarse con el layout aprobado |

Los nombres son lenguaje contractual de esta draft y deberán validarse antes de implementar (`AP-OQ-004`).

### REQ-AP-012 — Producir lista inicial de preparación

La lista debe contener únicamente:

- FOLIO;
- nombre del paciente/derechohabiente;
- Expediente tal como fue proporcionado y su referencia resuelta si existe;
- tipo de derechohabiente;
- primera vez/subsecuente;
- fecha;
- hora;
- médico: número de empleado y nombre;
- Servicio/Especialidad: código y nombre.

Sólo Citas vigentes y resolubles participan. Una `RETIRADA_DE_AGENDA` deja de producir necesidad de preparación.

### REQ-AP-013 — Producir read models de importación

Application debe poder producir:

1. resumen de importación;
2. lista de registros con resultado;
3. lista inicial de preparación;
4. incidencias pendientes.

No se incluyen Turno, Consultorio, Destino, paquetes ni datos clínicos.

### REQ-AP-014 — Métricas consistentes

Cada importación debe informar: registros recibidos, procesados, sin cambios, actualizados, retirados, incidencias y errores.

Los resultados de filas del snapshot deben cumplir:

`recibidos = procesados + sinCambios + actualizados + pendientesResolucion + duplicados + erroresEstructurales`.

`retirados` es un efecto sobre Citas del snapshot anterior, no una fila recibida, y se informa separadamente para evitar doble conteo.

### REQ-AP-015 — Minimizar datos

No deben formar parte del modelo persistido ni de los read models del slice: contacto, vigencia, sexo, edad, CURP ni datos asistenciales del SM10-1. La mera presencia en el archivo no constituye finalidad.

### REQ-AP-016 — Integrar sin redefinir Archive Operations

Agenda Preparation sólo puede relacionarse con Archive Operations mediante contratos y referencias conceptuales. No modifica `Expediente`, `Custodia`, `Ubicacion`, `MovimientoExpediente` ni `EstadoOperativo`. `ExpedienteNumero` no se tratará como único.

### REQ-AP-017 — Aislamiento multi-tenant

Agenda, ImportacionAgenda, Cita, registros, incidencias, resolución de médicos y cualquier referencia son tenant-scoped. No existen queries ni reconciliaciones cross-tenant. Tenant DEMO usa exclusivamente datos sintéticos.

### REQ-AP-018 — Fixtures y regresión seguros

Tests usarán fixtures desidentificados y versionados. Los archivos reales podrán servir como baseline externo controlado por hashes y métricas agregadas, pero nunca se copiarán datos personales reales a fixtures, logs o snapshots de test.

## 5. Invariantes

| ID | Invariante |
|---|---|
| INV-AP-001 | Una Agenda lógica pertenece exactamente a un tenant y una fecha. |
| INV-AP-002 | Dentro de una Agenda tenant-scoped, FOLIO determina la identidad de Cita. |
| INV-AP-003 | Todo registro recibido termina con exactamente un resultado de fila. |
| INV-AP-004 | `RETIRADA_DE_AGENDA` conserva historia y no implica cancelación clínica. |
| INV-AP-005 | Una reaparición usa el mismo FOLIO/identidad. |
| INV-AP-006 | Médico se identifica primariamente por número de empleado dentro del tenant. |
| INV-AP-007 | Matching ambiguo nunca produce asociación automática. |
| INV-AP-008 | Valor original no se destruye al interpretar o normalizar. |
| INV-AP-009 | Layout incompatible falla cerrado antes de reconciliar. |
| INV-AP-010 | Datos excluidos por minimización no aparecen en persistencia/read models del slice. |
| INV-AP-011 | Reconciliación nunca cruza tenants. |
| INV-AP-012 | Turno, Consultorio y Destino no se derivan ni se incorporan en esta spec. |

## 6. Autorización conceptual

- RequestContext y TenantContext se resuelven server-side antes de Application.
- Importar, consultar resultados y resolver incidencias requieren autorización explícita.
- No se reutiliza silenciosamente una permission existente ni se deriva autorización desde rol.
- Los identifiers de permission y la matriz actor→permission se aprobarán antes de T-01 (`AP-OQ-001`).
- No se aceptan tenant, actor ni tracing desde contenido del archivo o body arbitrario.

## 7. Privacidad y trazabilidad

- Los valores personales mínimos sólo se exponen a personal autorizado del tenant.
- Logs, métricas y errores no incluyen nombre, Expediente, FOLIO ni contenido raw.
- La evidencia raw y el modelo normalizado son responsabilidades distintas.
- La política de retención/cifrado/acceso del archivo binario completo requiere decisión (`AP-OQ-002`).
- Cada resultado debe ser trazable a importación y posición lógica/fila de origen sin exponerla públicamente.

## 8. Acceptance criteria globales

| ID | Criterio |
|---|---|
| AC-AP-001 | Fixture válido produce una Agenda tenant+fecha y un resultado por fila. |
| AC-AP-002 | Reimportación idéntica no duplica Citas ni estado de negocio. |
| AC-AP-003 | ADD/UPDATE/UNCHANGED se determinan por FOLIO. |
| AC-AP-004 | Ausencia posterior produce `RETIRADA_DE_AGENDA`, conserva historia y excluye preparación. |
| AC-AP-005 | Reaparición restaura la misma identidad. |
| AC-AP-006 | Layout inválido falla antes de reconciliar. |
| AC-AP-007 | Cero/múltiples candidatos de médico producen resultado explícito sin asociación. |
| AC-AP-008 | Espacios/representación del nombre no alteran identidad por número de empleado. |
| AC-AP-009 | Conteos satisfacen INV-AP-003 y la ecuación de REQ-AP-014. |
| AC-AP-010 | Lista contiene exactamente los campos permitidos y excluye los minimizados. |
| AC-AP-011 | Tenant A no observa ni modifica Agenda/importaciones de Tenant B. |
| AC-AP-012 | No aparecen Turno, Consultorio, Destino, SM1-14 ni cita abierta. |

## 9. Open questions y readiness

### Bloqueantes antes de implementación

- `AP-OQ-001`: permissions canónicas y matriz mínima para importar/consultar/resolver incidencias.
- `AP-OQ-002`: retención, cifrado, acceso y eliminación de archivo binario/raw completo.
- `AP-OQ-003`: contrato de entrada/exposición API, límites de archivo y semántica síncrona/asíncrona.
- `AP-OQ-004`: aprobación final de la taxonomía técnica de resultados de REQ-AP-011.

### No bloqueantes para requirements

- `AP-OQ-005`: una entrada de Agenda origina en el futuro Solicitud, proyección o RequerimientoExpediente.
- `AP-OQ-006`: ciclo de vida detallado de ImportacionAgenda después de procesarse.

## 10. SDB propagation required

Antes de implementación deben propagarse las decisiones aprobadas a:

- Volume 02 — proceso, actores, reglas y minimización.
- Volume 03 — bounded context, aggregates, entities y lenguaje.
- Volume 04 — workflow de importación/reconciliación.
- Volume 05 — Use Cases y SDD de Agenda Preparation.
- Volume 06 — ingestion boundary, ownership y composición.
- Volume 07 — authorization, tenant isolation y raw privacy.
- Volume 08 — contratos de datos/API una vez aprobados.
- Volume 09 — read models/UI cuando se defina alcance de frontend.
- Volume 10 — fixtures, property/contract/integration tests.
- Volume 11 — operación, retención, reproceso y observabilidad.
- Volume 12 — readiness, OQs y trazabilidad OpenSpec.

## 11. Readiness

- `requirements_ready: true`
- `design_ready: true`
- `tasks_ready: true`
- `implementation_ready: false`
