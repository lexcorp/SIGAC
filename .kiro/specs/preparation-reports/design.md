---
spec: preparation-reports
version: "0.1.1"
status: "Approved for Implementation"
date: "2026-08-26"
amended: "2026-08-26 — ADR-0031 Agenda Shift Determination"
requires:
  - "requirements.md v0.1.0"
  - "agenda-preparation design.md v0.1.7"
bounded_context: "Agenda / Appointment Preparation"
open_questions_blocking: []
---

# Preparation Reports — Design

## 1. Principios de diseño

| Principio | Aplicación en este slice |
|---|---|
| Reutilizar antes de crear | `PreparationItem`, `PreparationListQueryPort`, `AgendaFecha`, `TenantSessionExecutor` y `AuditWriter` se reutilizan sin modificación. |
| PDF como infraestructura | PDFKit vive exclusivamente en `packages/platform`; el dominio no conoce ninguna clase de PDF. |
| No nuevo Aggregate | La generación de PDF es un use case de lectura + efecto secundario (audit); no requiere nuevo Aggregate. |
| Separación de capas | Domain → Application (use case) → Infrastructure (adapter PDF) → API (controller HTTP). |
| Tenant isolation obligatorio | `TenantContext` se resuelve server-side; ningún query es cross-tenant. |
| Privacy by default | El adapter PDF solo recibe `PreparationItem[]`; nunca recibe campos adicionales. |
| Fail fast on empty | Si no hay citas activas, el use case falla antes de invocar PDFKit. |
| Stream sobre buffer | El PDF se genera como stream hacia la respuesta HTTP; no se acumula en memoria completa. |

## 2. ADR-0030 — Motor de generación PDF: PDFKit

### Contexto

El endpoint `POST /api/v1/agendas/{date}/preparation-report` necesita generar un PDF
estructurado con tablas, encabezados/pies de página, saltos de página controlados y
numeración de páginas. Se evaluaron tres alternativas:

| Opción | Pros | Contras |
|---|---|---|
| **PDFKit** | Node.js puro, sin dependencias externas, stream nativo, tablas programáticas, saltos de página, MIT | API de bajo nivel (requiere adapter) |
| Puppeteer/Chromium | Fidelidad HTML→PDF alta | ~300 MB, headless browser, inaceptable en API server |
| jsPDF | Bien conocido en frontend | Diseñado para browser; soporte server-side limitado |

### Decisión

**PDFKit** queda seleccionado como motor de generación PDF para `preparation-reports`.

### Justificación

- Sin Chromium ni dependencias de sistema operativo adicionales.
- Genera PDFs con tablas, saltos de página programáticos y numeración de páginas.
- Compatible con Node.js streams (`pipe` directo a `response`).
- Bien mantenida; licencia MIT.
- El adapter encapsula todo el API de PDFKit; el use case recibe solo `PreparationItem[]`.

### Scope de aplicación

PDFKit queda aprobado **exclusivamente para documentos operativos estructurados** — listas
tabulares generadas programáticamente con datos de `PreparationItem`.
No es la elección por defecto para todos los casos de generación documental del sistema.

### Consecuencias

- `PDFKitPreparationReportGenerator` vive en `packages/platform/pdf`.
- PDFKit es una dependencia de `packages/platform/pdf`, no de dominio ni de Application.
- Cambiar el motor en el futuro requiere reimplementar únicamente el adapter.

### Riesgo futuro registrado — RF-ADR-030-01

Si en iteraciones posteriores los formatos institucionales requieren:

- maquetación compleja definida en HTML/CSS (membrete oficial, logotipo embebido,
  columnas de estilo libre, fuentes tipográficas institucionales);
- generación a partir de plantillas HTML versionadas;
- fidelidad pixel-perfect a documentos Word/DOCX existentes;

...entonces PDFKit puede ser insuficiente y se deberá evaluar un renderer HTML→PDF
(Puppeteer headless o equivalente) en un ADR separado.

**Criterio de evaluación futuro:** si el formato del documento no puede expresarse
razonablemente como operaciones programáticas sobre PDFKit en ≤ 300 líneas de adapter,
escalar a nuevo ADR antes de extender el adapter actual.


## 2b. ADR-0031 — Determinación del turno de cita: derivado de appointmentTime

**Versión:** 1.1 — revisada tras evaluación de reutilización (2026-08-26)

### Contexto

El archivo SIMEF no contiene columna "Turno". El proceso operativo de Archivo Clínico
trabaja con dos turnos:

- **Turno Matutino**: aproximadamente 07:00 a 13:59
- **Turno Vespertino**: aproximadamente 14:00 a 20:00
- Intervalo de atención observado: 20 minutos

El turno es necesario en el PDF impreso. Se evaluó también si será requerido por:
vista web, filtros, dashboards, exportaciones.

### Opciones evaluadas

| Opción | Descripción | Veredicto |
|---|---|---|
| A | `deriveShift` privado en el adapter PDF | Descartada — no reutilizable |
| **B** | `deriveShift` como función pura en Application (`@sigac/agenda-preparation`) | **Seleccionada** |
| C | Campo `shift` en `PreparationItem` (modifica contrato) | Aplazada a siguiente iteración |
| D | Campo `shift` derivado en el mapper del controller | Aplazada a siguiente iteración |

### Decisión

1. **El turno no se leerá desde SIMEF** ni se almacenará en la base de datos.
2. **`deriveShift` vive en Application** — como función pura exportada desde
   `packages/modules/agenda-preparation/src/application/` — no en el adapter PDF.
3. **`PreparationItem` no cambia** en esta iteración (sin campo `shift`).
4. **La API JSON no expone `shift`** en esta iteración.
5. El adapter PDF importa `deriveShift` desde `@sigac/agenda-preparation` y la llama
   localmente al construir cada página.

### Justificación del traslado a Application

El turno es una **regla de negocio del módulo Agenda Preparation**, no lógica de
presentación PDF. Si permanece en el adapter PDF:

- Cada futuro consumidor (vista web, filtros, exports) reimplementa la misma regla.
- Un cambio de límite de turno (ej. hospitales con jornada distinta) requiere localizar
  y parchear múltiples implementaciones.
- La regla no tiene lógica de infraestructura — es puramente sobre `appointmentTime`.

Al trasladarla a Application:

- Un único punto de cambio si la regla evoluciona.
- Reutilizable sin persistir el dato.
- Testeable en aislamiento completo, sin dependencia del adapter PDF.
- No modifica `PreparationItem`, `Cita` ni ningún contrato persistido.

### Regla aprobada

```typescript
// packages/modules/agenda-preparation/src/application/deriveShift.ts
export type AgendaShift = 'MATUTINO' | 'VESPERTINO';

/**
 * Derives the shift from an appointment time in HH:mm format.
 * Rule (ADR-0031 v1.1): hour < 14 → MATUTINO, hour >= 14 → VESPERTINO.
 * Pure function — no I/O, no side effects, no persistence.
 */
export function deriveShift(appointmentTime: string): AgendaShift {
  const [hoursStr] = appointmentTime.split(':');
  const hours = parseInt(hoursStr ?? '0', 10);
  return hours < 14 ? 'MATUTINO' : 'VESPERTINO';
}
```

### Dónde vive la lógica

```
packages/modules/agenda-preparation/
  src/
    application/
      deriveShift.ts          ← NUEVO — función pura exportada (T-21 la crea)
      index.ts                ← re-exportar deriveShift y AgendaShift

packages/platform/pdf/
  src/
    PDFKitPreparationReportGenerator.ts
      ← importa deriveShift desde '@sigac/agenda-preparation'
      ← llama al inicio de cada grupo servicio+médico
```

### Uso en el adapter PDF

```typescript
import { deriveShift } from '@sigac/agenda-preparation';

// Al inicio de cada grupo:
const firstItem = groupItems[0]!;
const shift = deriveShift(firstItem.appointmentTime); // 'MATUTINO' | 'VESPERTINO'
// → aparece en el encabezado de la página
```

### Formato del encabezado PDF

```
Fecha de consulta: DD/MM/YYYY         Turno: MATUTINO
Servicio: NOMBRE (CÓDIGO)
Médico: NOMBRE MÉDICO
No. Empleado: NNNNNNNN
```

### Camino abierto para la siguiente iteración

Cuando la vista web o los filtros necesiten el turno, la decisión ya tiene opciones
evaluadas:

- **Opción C (preferida si la UI necesita filtrar por turno):** añadir `shift` como
  campo derivado en `PreparationItem`. Requiere ADR de cambio de contrato y migración
  de tests existentes. Candidato a T-28.
- **Opción D (si solo necesita mostrarse):** el mapper del controller llama
  `deriveShift(item.appointmentTime)` y añade el campo en la respuesta HTTP sin
  modificar `PreparationItem`. Cambio solo en la capa API.

Ninguna de las dos opciones implica persistir el turno ni leerlo de SIMEF.

### Lo que NO hace este ADR

- No introduce campo `turno` en `PreparationItem`, `Cita` ni `citas` (tabla).
- No crea un value object `Turno` en el Domain.
- No persiste el turno en ninguna tabla.
- No expone `shift` en la API JSON en esta iteración.
- No define turnos nocturnos ni configurables (fuera del alcance actual).

### Consecuencias

- `deriveShift.ts` se crea en T-21 junto con los demás archivos de Application.
- Los tests de `deriveShift` van en `deriveShift.test.ts` (unit puro, sin mocks).
- El adapter PDF (`PDFKitPreparationReportGenerator`) importa `deriveShift` y NO lo reimplementa.
- Si en el futuro la regla necesita configuración por hospital, se crea un nuevo ADR.

## 3. Arquitectura por capas

```
packages/modules/agenda-preparation/
  src/
    domain/
      value-objects/           ← AgendaFecha (ya existe, sin cambios)
    application/
      deriveShift.ts           ← NUEVO — función pura AgendaShift + deriveShift() (ADR-0031 v1.1)
      ports/
        ReadQueryPorts.ts       ← PreparationListQueryPort (ya existe, sin cambios)
        PreparationReportGeneratorPort.ts   ← NUEVO
      use-cases/
        GeneratePreparationReport.ts        ← NUEVO
      index.ts                 ← exportar nuevos contratos incl. deriveShift, AgendaShift

packages/platform/
  pdf/
    src/
      PDFKitPreparationReportGenerator.ts  ← NUEVO adapter
                                              (importa deriveShift desde @sigac/agenda-preparation)
  tenant/
    src/
      index.ts                 ← agregar AGENDA_PRINT al catálogo de PERMISSIONS

apps/api/
  src/
    agenda-preparation/
      AgendaPreparationModule.ts  ← registrar nuevas dependencias
      controllers/
        AgendaPreparationController.ts  ← agregar POST /{date}/preparation-report

apps/web/
  src/
    agenda-preparation/
      components/
        PreparationTable.tsx    ← NUEVO (reemplaza PreparationList.tsx actual)
        ReportWizard.tsx        ← NUEVO
      AgendaPreparationWorkspace.tsx ← agregar tab "Paquetes"
```

## 4. Domain — sin cambios

No se introduce ninguna entidad, value object ni aggregate nuevo en Domain. `AgendaFecha`
se reutiliza para validar la fecha del reporte. El Domain no conoce PDFKit, HTTP ni
generación de documentos.

## 5. Application — nuevo port y use case

### 5.1 Port: `PreparationReportGeneratorPort`

```typescript
// packages/modules/agenda-preparation/src/application/ports/PreparationReportGeneratorPort.ts

export interface ReportGenerationRequest {
  readonly agendaDate: string;          // YYYY-MM-DD formateada para encabezado
  readonly items: readonly PreparationItem[];
  readonly order: PreparationOrder;
  /**
   * ID de la importación SIMEF origen de la cual provienen las citas.
   * Permite trazar el documento generado contra el artefacto importado.
   * Se obtiene de AgendaDayReadModel.latestImportacionId al momento de la solicitud.
   */
  readonly sourceImportId: string;
}

export interface ReportGenerationResult {
  readonly stream: NodeJS.ReadableStream;
  readonly filename: string;            // "lista-preparacion-{date}.pdf"
  readonly byteEstimate?: number;       // opcional, para Content-Length si disponible
}

export interface PreparationReportGeneratorPort {
  generate(request: ReportGenerationRequest): Promise<ReportGenerationResult>;
}
```

**Reglas del port:**
- Recibe únicamente `PreparationItem[]`; no recibe campos adicionales.
- La implementación decide el formato exacto del PDF; el port es agnóstico al motor.
- `filename` no contiene datos de paciente.
- El stream es readable; el adapter es responsable de cerrar el stream al terminar.

### 5.2 Use Case: `GeneratePreparationReport`

```typescript
// packages/modules/agenda-preparation/src/application/use-cases/GeneratePreparationReport.ts

export interface GeneratePreparationReportCommand {
  readonly agendaDate: AgendaFecha;
  readonly services?: readonly string[];   // null/undefined = todos los servicios
  readonly order: PreparationOrder;
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
  /**
   * ID de la importación SIMEF origen, resuelto mediante AgendaDayQueryPort
   * antes de llamar al use case. Permite trazar el reporte PDF contra la
   * importación específica que generó las citas.
   */
  readonly sourceImportId: string;
}

export interface GeneratePreparationReportResult {
  readonly stream: NodeJS.ReadableStream;
  readonly filename: string;
}
```

**Flujo del use case:**

```
1. Validar permisos AGENDA_VIEW + AGENDA_PRINT (via RequestContext, antes de llegar aquí)
2. Construir AgendaFecha desde command.agendaDate (falla si inválida → 422)
3. Llamar PreparationListQueryPort.listForPrint(agendaDate, order, tenant)
4. Si services != null, filtrar items por servicioEspecialidad.codigo ∈ services
5. Si items.length === 0 → lanzar NoActiveAppointmentsError (→ HTTP 422)
6. Construir ReportGenerationRequest con items filtrados + sourceImportId del command
7. Llamar PreparationReportGeneratorPort.generate(request) → stream + filename
8. Escribir AuditEntry(action=AGENDA_REPORT_GENERATED, result=SUCCESS,
     metadata.sourceImportId, metadata.agendaDate, metadata.recordCount, ...)
9. Retornar { stream, filename }
```

**Errores del use case:**

| Error de dominio | HTTP | Descripción |
|---|---|---|
| `AgendaFechaInvalidError` | 422 | Fecha con formato inválido |
| `NoActiveAppointmentsError` | 422 | Sin citas activas para los servicios solicitados |
| Error inesperado de generación | 500 | Fallo interno del adapter PDF |

**Dependencias del use case:**

```typescript
constructor(
  private readonly preparationListQuery: PreparationListQueryPort,
  private readonly reportGenerator: PreparationReportGeneratorPort,
  private readonly auditWriter: AuditWriter,
) {}
```

### 5.3 Acción de Audit

| Campo | Valor |
|---|---|
| `action` | `AGENDA_REPORT_GENERATED` |
| `result` | `SUCCESS` / `FAILURE` |
| `tenantId` | del TenantContext |
| `userId` | del actor |
| `metadata.agendaDate` | fecha de la agenda (YYYY-MM-DD) |
| `metadata.sourceImportId` | ID de la importación SIMEF origen |
| `metadata.serviceCount` | número de servicios incluidos |
| `metadata.recordCount` | número de citas incluidas |

El audit entry no incluye nombres de pacientes, folios individuales ni expedientes.
`sourceImportId` permite correlacionar el reporte con la importación SIMEF que originó
las citas; no es PII.

## 6. Infrastructure — PDFKit adapter

### 6.1 `PDFKitPreparationReportGenerator`

```
packages/platform/pdf/src/PDFKitPreparationReportGenerator.ts
```

**Responsabilidades:**

1. Agrupar los `PreparationItem[]` por `servicioEspecialidad.codigo ASC` →
   `medico.numeroEmpleado ASC` → `appointmentTime ASC`.
2b. Derivar el turno del primer item de cada grupo usando `deriveShift(appointmentTime)`
    (ADR-0031); mostrarlo en el encabezado de la página.
3. Para cada grupo servicio+médico: abrir nueva página (excepto la primera), imprimir
   encabezado institucional (incluyendo turno derivado), tabla de citas, total de expedientes y pie.
4. Numeración de páginas en el pie (requiere dos pasadas o buffer; ver nota abajo).
5. No escribir campos no presentes en `PreparationItem` (salvo el turno derivado localmente).
6. Devolver stream readable de PDFKit.

**Estructura de cada página:**

```
┌─────────────────────────────────────────────────────────────────┐
│  SISTEMA DE INFORMACIÓN MÉDICO FINANCIERO                       │
│  ARCHIVO CLÍNICO                                                │
│                                                                 │
│  LISTA DE EXPEDIENTES PARA CONSULTA                             │
│                                                                 │
│  Fecha de consulta: DD/MM/YYYY         Turno: MATUTINO          │
│  Servicio: NOMBRE (CÓDIGO)                                      │
│  Médico: NOMBRE MÉDICO                                          │
│  No. Empleado: NNNNNNNN                                         │
├────────┬─────────────────┬─────────────────────┬───────────────┤
│  Hora  │  Expediente     │  Derechohabiente    │  Folio        │
├────────┼─────────────────┼─────────────────────┼───────────────┤
│  07:00 │  XXXXXXXXXX     │  (nombre operativo) │  FOLIO-001    │
│  07:20 │  XXXXXXXXXX     │  (nombre operativo) │  FOLIO-002    │
├────────┴─────────────────┴─────────────────────┴───────────────┤
│  Total de expedientes: N                                        │
└─────────────────────────────────────────────────────────────────┘
                                          Página P de TOTAL
```

**Nota sobre numeración total de páginas:** PDFKit no conoce el total hasta cerrar el
documento. Se usará un buffer en memoria (PDFDocument con `bufferPages: true`) para
escribir el total de páginas en los pies al finalizar, antes de hacer `pipe` al stream
de respuesta. Dado que los reportes son documentos de tamaño operativo pequeño (≤ ~500
citas por día), el buffer en memoria es aceptable.

**Campos que el adapter SÍ usa de PreparationItem:**

| PreparationItem field | Columna PDF |
|---|---|
| `appointmentTime` | Hora |
| `expediente.original` | Expediente |
| `nombrePaciente` | Derechohabiente |
| `folio` | Folio |
| `servicioEspecialidad.codigo` | Agrupación + encabezado |
| `servicioEspecialidad.nombre` | Encabezado |
| `medico.numeroEmpleado` | Agrupación + encabezado |
| `medico.nombre` | Encabezado |
| `agendaDate` | Encabezado fecha |

**Campos que el adapter NO usa (nunca recibe):** CURP, fecha de nacimiento, teléfono,
email, edad, sexo, diagnósticos.

### 6.2 Registro en `packages/platform/pdf`

```
packages/platform/pdf/
  src/
    PDFKitPreparationReportGenerator.ts
    index.ts                ← export { PDFKitPreparationReportGenerator }
  package.json              ← "name": "@sigac/pdf", dep: pdfkit ^0.15
```

### 6.3 Catálogo de permisos — agregar AGENDA_PRINT

```typescript
// packages/platform/tenant/src/index.ts
// Agregar a la colección PERMISSIONS existente:
export const AGENDA_PRINT = 'AGENDA_PRINT' as const;
```

## 7. API — nuevo endpoint

### 7.1 Contrato HTTP

```
POST /api/v1/agendas/{date}/preparation-report
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "services": ["CL05", "CL06"],   // string[] | null; null = todos los servicios
  "order": "APPOINTMENT_TIME_ASC" // PreparationOrder; default APPOINTMENT_TIME_ASC
}
```

**Respuesta exitosa:**

```
HTTP 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="lista-preparacion-2026-08-26.pdf"
[stream bytes del PDF]
```

**Respuestas de error (RFC 7807):**

| Condición | HTTP | `type` |
|---|---|---|
| Sin citas activas para servicios | 422 | `/errors/no-active-appointments` |
| Fecha inválida | 422 | `/errors/invalid-agenda-date` |
| Sin AGENDA_VIEW | 403 | `/errors/permission-denied` |
| Sin AGENDA_PRINT | 403 | `/errors/permission-denied` |
| Error interno | 500 | `/errors/internal` |

### 7.2 Controller (NestJS)

```typescript
// apps/api/src/agenda-preparation/controllers/AgendaPreparationController.ts
// Método nuevo — solo orquestación, sin lógica de negocio:

@Post(':date/preparation-report')
@UseGuards(JwtAuthGuard)
async generatePreparationReport(
  @Param('date') date: string,
  @Body() body: GeneratePreparationReportDto,
  @Res() res: Response,
  @RequestContextDecorator() ctx: RequestContext,
): Promise<void> {
  // 1. Verificar AGENDA_VIEW + AGENDA_PRINT desde ctx.permissions
  // 2. Construir comando
  // 3. Llamar use case
  // 4. Escribir headers Content-Type / Content-Disposition
  // 5. Pipe stream → res
}
```

**DTO de request:**

```typescript
export class GeneratePreparationReportDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[] | null;

  @IsOptional()
  @IsEnum(['APPOINTMENT_TIME_ASC', 'PATIENT_NAME_ASC'])
  order?: PreparationOrder;
}
```

### 7.3 Módulo NestJS — nuevas dependencias

`AgendaPreparationModule` registra como providers:

- `GeneratePreparationReport` (use case)
- `PDFKitPreparationReportGenerator` (implementa `PreparationReportGeneratorPort`)

`PDFKitPreparationReportGenerator` se inyecta como `PREPARATION_REPORT_GENERATOR_TOKEN`.

## 8. Frontend — cambios en AgendaPreparationWorkspace

### 8.1 Nuevo tab "Paquetes"

`AgendaPreparationWorkspace.tsx` agrega un tercer tab llamado **"Paquetes"** junto a los
tabs existentes. El tab "Paquetes" contiene `ReportWizard` y reemplaza o convive con la
vista actual de preparación según la decisión de UX del implementador.

La vista de lista paginada (`PreparationTable`) puede ser el tab existente con la tabla
renovada (reemplazando acordeones).

### 8.2 `PreparationTable.tsx`

Reemplaza el componente actual basado en acordeones. Características:

- Tabla plana (`<table>` semántica, accesible).
- Columnas: Hora, Expediente, Folio, Derechohabiente, Tipo consulta, Médico, Servicio.
- Paginación offset en el cliente: 50 registros por página; los datos llegan via cursor
  del backend (el componente consume todos los items de la página actual del backend y
  pagina localmente en bloques de 50).
- Filtros: fecha (date input), servicio (select), médico (select). Filtros operan sobre
  los datos de la página cargada.
- Búsqueda: campo de texto libre; filtra `folio` y `expediente.original`
  case-insensitive sobre los datos de la página.
- Ordenamiento: selector con `APPOINTMENT_TIME_ASC` (default) / `PATIENT_NAME_ASC`;
  al cambiar, reinicia la paginación.
- Estado vacío, estado de carga y estado de error con mensajes accesibles.
- El componente nunca decide autorización; el backend ya filtró datos por tenant y permisos.

**Props:**

```typescript
interface PreparationTableProps {
  agendaDate: string;
  onDateChange: (date: string) => void;
}
```

### 8.3 `ReportWizard.tsx`

Componente para la generación del PDF. Flujo:

1. Mostrar lista de servicios disponibles (derivada de los items de la tabla actual).
2. Permitir selección múltiple de servicios (o "todos").
3. Selector de orden (mismo que la tabla).
4. Botón "Generar PDF" — visible solo si el usuario tiene `AGENDA_PRINT` (dato enviado
   por el backend en el token/claims, no calculado en frontend).
5. Al hacer clic: `POST /api/v1/agendas/{date}/preparation-report` con `services` y
   `order`.
6. En éxito: activar descarga del blob recibido con filename del header
   `Content-Disposition`.
7. En error 403: mostrar mensaje de permisos insuficientes.
8. En error 422: mostrar mensaje "No hay citas activas para los servicios seleccionados".

**El componente ReportWizard nunca:**
- Calcula si el usuario tiene permisos (lo obtiene del backend).
- Genera el PDF localmente.
- Accede al DOM para imprimir.

### 8.4 Eliminar `window.print()`

El código existente que llama `window.print()` se elimina en T-24 (implementación del
tab y componentes). El reemplazo es `ReportWizard.tsx` con el endpoint del servidor.

## 9. OpenAPI — actualización

El contrato OpenAPI existente de `agenda-preparation` se extiende con:

```yaml
/api/v1/agendas/{date}/preparation-report:
  post:
    operationId: generatePreparationReport
    summary: Genera y descarga el PDF de la lista de preparación
    tags: [AgendaPreparation]
    security:
      - bearerAuth: []
    parameters:
      - name: date
        in: path
        required: true
        schema:
          type: string
          format: date
          example: "2026-08-26"
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/GeneratePreparationReportRequest'
    responses:
      '200':
        description: PDF generado correctamente
        headers:
          Content-Disposition:
            schema:
              type: string
              example: 'attachment; filename="lista-preparacion-2026-08-26.pdf"'
        content:
          application/pdf:
            schema:
              type: string
              format: binary
      '403':
        $ref: '#/components/responses/Forbidden'
      '422':
        $ref: '#/components/responses/UnprocessableEntity'
      '500':
        $ref: '#/components/responses/InternalError'
```

## 10. Testing strategy

### 10.1 Unit tests

| Suite | Qué testea | Tipo |
|---|---|---|
| `GeneratePreparationReport.spec.ts` | Flujo completo con mocks de `PreparationListQueryPort`, `PreparationReportGeneratorPort` y `AuditWriter` | Unit |
| `GeneratePreparationReport.spec.ts` | Falla con `NoActiveAppointmentsError` cuando items = 0 | Unit |
| `GeneratePreparationReport.spec.ts` | Filtrado correcto por lista de servicios | Unit |
| `GeneratePreparationReport.spec.ts` | Audit escrito con campos correctos y sin PII | Unit |
| `PDFKitPreparationReportGenerator.spec.ts` | PDF generado > 0 bytes con datos sintéticos | Unit |
| `PDFKitPreparationReportGenerator.spec.ts` | Agrupación: cada bloque servicio+médico tiene su propia sección | Unit |
| `PDFKitPreparationReportGenerator.spec.ts` | Privacidad: el PDF (como texto extraído) no contiene patrones CURP | Unit (property) |

### 10.2 Integration tests

| Suite | Qué testea | Tipo |
|---|---|---|
| `AgendaPreparationController.spec.ts` | POST genera PDF real > 0 bytes, Content-Type correcto | Integration |
| `AgendaPreparationController.spec.ts` | POST retorna 403 sin AGENDA_PRINT | Integration |
| `AgendaPreparationController.spec.ts` | POST retorna 422 sin citas activas | Integration |
| `AgendaPreparationController.spec.ts` | POST retorna 403 sin AGENDA_VIEW | Integration |
| `AgendaPreparationController.spec.ts` | Tenant B no obtiene datos del Tenant A | Integration |

### 10.3 E2E (Playwright)

| Escenario | Descripción |
|---|---|
| Usuario autorizado descarga PDF | Actor con AGENDA_VIEW + AGENDA_PRINT recibe descarga válida |
| Usuario sin AGENDA_PRINT ve 403 | Actor con solo AGENDA_VIEW recibe error de permisos |
| Filtros de la tabla | Filtrar por servicio reduce las filas visibles |

### 10.4 Property-based tests (Vitest + fast-check)

- `PDFKitPreparationReportGenerator`: para todo array de `PreparationItem[]` sintético
  (fast-check), el PDF generado es > 0 bytes y no contiene patrones CURP.
- El uso de PBT es apropiado aquí porque el comportamiento varía con el contenido y
  número de items (casos límite: 1 médico, N médicos, 0 citas por médico filtrado,
  páginas múltiples).

### 10.5 Datos de test

- Todos los fixtures usan datos sintéticos desidentificados.
- No se copian nombres reales, expedientes reales ni folios reales a fixtures.
- El tenant DEMO usa exclusivamente datos sintéticos.

## 11. Trazabilidad de requisitos

| Requisito | Componente de diseño |
|---|---|
| REQ-PR-001 (vista tabular) | `PreparationTable.tsx` |
| REQ-PR-002 (PDF on-demand) | `GeneratePreparationReport` + `PDFKitPreparationReportGenerator` + endpoint |
| REQ-PR-003 (estructura PDF) | `PDFKitPreparationReportGenerator` (formato) |
| REQ-PR-004 (privacidad PDF) | Port `PreparationReportGeneratorPort` (solo PreparationItem) + test privacy |
| REQ-PR-005 (AGENDA_PRINT) | `packages/platform/tenant/src/index.ts` + guards del controller |
| REQ-PR-006 (audit + trazabilidad) | `AuditWriter` en `GeneratePreparationReport`; `sourceImportId` en `ReportGenerationRequest` y audit |
| REQ-PR-007 (tenant isolation) | `TenantContext` en use case + query port |
| REQ-PR-008 (reutilizar infra) | `PreparationListQueryPort.listForPrint()` como única fuente |
| REQ-PR-009 (turno derivado) | `deriveShift()` en `PDFKitPreparationReportGenerator` (ADR-0031) |

## 12. Readiness

- `requirements_ready: true`
- `design_ready: true` — incluye ADR-0031 turno derivado + sourceImportId (2026-08-26)
- `tasks_ready: false` — pendiente tasks.md
- `implementation_ready: false` — pendiente T-20..T-27
