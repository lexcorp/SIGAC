---
spec: vale-archivo
version: "0.1.0"
status: "Approved for Implementation"
date: "2026-08-26"
bounded_context: "Vale Archivo / Solicitudes Extraordinarias"
requires:
  - "requirements.md v0.1.0"
open_questions_blocking: []
---

# Vale Archivo — Design

## Overview

### 1. Principios de diseño

| Principio | Aplicación en este bounded context |
|---|---|
| Bounded context propio | Vale Archivo vive en `packages/modules/vale-archivo`; no importa nada de `@sigac/agenda-preparation`. El concepto de Turno no existe en este bounded context (INV-VA-011). |
| Reutilizar infraestructura | `@sigac/audit`, `@sigac/database`, `@sigac/tenant`, `@sigac/pdf` se reutilizan sin modificación. |
| PDF como infraestructura | `PDFKitValeArchivoGenerator` vive en `packages/platform/pdf`; el dominio no conoce PDFKit. |
| No nuevo Aggregate para PDF | Generar el PDF es un use case de lectura + efecto secundario (audit); sin nuevo Aggregate. |
| Tenant isolation obligatorio | `TenantContext` server-resolved; todas las queries filtran por tenant. |
| Privacy by default | El PDF recibe únicamente los campos aprobados de `ValeArchivo`/`ValeArchivoItem`; nunca CURP ni datos clínicos. |
| Fail fast en invariantes | El Aggregate valida precondiciones antes de cada transición; lanza error de dominio si falla. |
| Stream sobre buffer en PDF | El PDF se genera como stream on-demand; no se persiste ni acumula en memoria innecesariamente. |

## 2. ADR-0032 — Bounded Context: Vale Archivo independiente de Agenda Preparation

### Contexto

Vale Archivo gestiona solicitudes extraordinarias SM 1-14 (peticiones puntuales de
expedientes por urgencias, auditorías, jefaturas). Agenda Preparation gestiona la lista
diaria preventiva de citas SIMEF. Son flujos distintos con:

- Actores distintos (Capturista vs. Archivista de preparación).
- Documentos distintos (SM 1-14 vs. lista de preparación diaria).
- Estados distintos (RECIBIDA/EN_BUSQUEDA/... vs. ACTIVA/PREPARADA/...).
- Sin dependencia funcional entre ambos.

### Decisión

Vale Archivo es un **bounded context separado** en `packages/modules/vale-archivo/`.
No importa nada de `@sigac/agenda-preparation`. Comparte únicamente:

- `@sigac/database` — `TenantSessionExecutor`, `TenantDatabaseRouter`.
- `@sigac/tenant` — `TenantContext`, `RequestContext`, `Permission`.
- `@sigac/audit` — `AuditWriter`.
- `@sigac/pdf` — adapter PDFKit (ya existe por preparation-reports).
- `@sigac/domain-kernel` — `DomainError`, `DomainEvent`.

### Consecuencias

- Tablas con prefijo `vale_` en la base de datos por tenant.
- Módulo NestJS independiente: `ValeArchivoModule`.
- Bounded contexts separados, sin compartir repositorios ni queries.

---

## 3. ADR-0033 — Permisos: separación entre capacidades generales y específicas del bounded context

### Contexto

El catálogo existente en `packages/platform/tenant` ya contiene permisos generales de
operación (`REQUEST_CREATE`, `REQUEST_ASSIGN`, `SEARCH_START`, `SEARCH_MARK_LOCATED`,
`SEARCH_MARK_NOT_LOCATED`, `CUSTODY_TRANSFER`) que modelan capacidades transversales del
flujo de Archivo Clínico. Sin embargo, las operaciones específicas del bounded context
Vale Archivo —consultar vales, procesar la búsqueda, registrar la entrega— requieren
permisos propios que expresen exactamente esa capacidad dentro del contexto.

### Decisión

1. Mantener `REQUEST_CREATE` para la creación del vale: es una capacidad general de
   iniciación de solicitudes que ya existe en el catálogo y aplica sin ambigüedad.
2. Agregar tres permisos específicos del bounded context Vale Archivo al catálogo (T-30):
   - `ARCHIVE_REQUEST_VIEW` — consultar la lista de vales y su estado; generar PDF.
   - `ARCHIVE_REQUEST_PROCESS` — procesar la búsqueda: iniciar, marcar localizado/no
     localizado. Reemplaza el uso aislado de `SEARCH_START` + `SEARCH_MARK_LOCATED` /
     `SEARCH_MARK_NOT_LOCATED` para operaciones sobre vales específicamente.
   - `ARCHIVE_REQUEST_DELIVER` — registrar la entrega y cerrar el vale. Reemplaza el uso
     de `CUSTODY_TRANSFER` para operaciones de entrega de vales específicamente.
3. Los permisos generales (`SEARCH_START`, `SEARCH_MARK_LOCATED`, `SEARCH_MARK_NOT_LOCATED`,
   `CUSTODY_TRANSFER`) **se conservan sin modificar** para los flujos de Archivo Clínico
   ya implementados (archive-operations). No se eliminan ni se reutilizan en Vale Archivo
   para evitar acoplamiento entre bounded contexts.
4. No se crea `ARCHIVE_REQUEST_CREATE` ni ningún otro permiso no listado arriba.

### Mapeo definitivo

| Operación | Permiso |
|---|---|
| Crear vale | `REQUEST_CREATE` (capacidad general, ya existente) |
| Consultar lista de vales | `ARCHIVE_REQUEST_VIEW` (nuevo, T-30) |
| Generar PDF SM 1-14 | `ARCHIVE_REQUEST_VIEW` o `REQUEST_CREATE` |
| Iniciar búsqueda | `ARCHIVE_REQUEST_PROCESS` (nuevo, T-30) |
| Marcar ítem localizado | `ARCHIVE_REQUEST_PROCESS` (nuevo, T-30) |
| Marcar ítem no localizado | `ARCHIVE_REQUEST_PROCESS` (nuevo, T-30) |
| Registrar entrega | `ARCHIVE_REQUEST_DELIVER` (nuevo, T-30) |
| Cierre administrativo | `REQUEST_CREATE` o `REQUEST_ASSIGN` |

### Justificación

Separar capacidades generales de capacidades específicas del bounded context permite:
- Otorgar permisos precisos sin escalar privilegios generales de búsqueda o custodia.
- Mantener la semántica original de `SEARCH_START`, `CUSTODY_TRANSFER`, etc. para los
  flujos existentes sin riesgo de colisión.
- Expresar en el catálogo exactamente qué puede hacer un actor dentro de Vale Archivo.

### Consecuencias

- T-30 agrega `ARCHIVE_REQUEST_VIEW`, `ARCHIVE_REQUEST_PROCESS`, `ARCHIVE_REQUEST_DELIVER`
  al array `PERMISSIONS` en `packages/platform/tenant/src/index.ts`.
- Los permisos generales del catálogo no se modifican ni eliminan.
- Los roles de Archivista que necesiten procesar vales recibirán `ARCHIVE_REQUEST_PROCESS`;
  los que entreguen expedientes recibirán `ARCHIVE_REQUEST_DELIVER`.

---

## 4. ADR-0034 — Tenant isolation: database-per-tenant sin columna tenant_id en tablas vale_*

### Contexto

SIGAC utiliza el patrón database-per-tenant: cada tenant tiene su propia base de datos
PostgreSQL. El `TenantDatabaseRouter` enruta cada conexión a la base de datos correcta
en función del `TenantContext` resuelto server-side. Todas las operaciones de Vale
Archivo se ejecutan dentro de la sesión de la base de datos del tenant activo.

### Decisión

Las tablas `vale_archivo` y `vale_archivo_items` **no incluyen una columna `tenant_id`**.
El aislamiento de datos entre tenants es garantizado enteramente por el router de conexión:
ningún registro puede cruzar hacia otro tenant porque la conexión ya está limitada a la
base de datos de ese tenant.

### Justificación

1. Una columna `tenant_id` en un modelo database-per-tenant es redundante y potencialmente
   peligrosa: crea una falsa sensación de seguridad y no añade protección real cuando la
   conexión ya está aislada.
2. Agregar `tenant_id` obligaría a incluirla en todos los queries como filtro adicional,
   aumentando la superficie de error (olvidar el filtro = cross-tenant leak).
3. El patrón es consistente con las tablas existentes de `archive-operations`,
   `agenda-preparation` y todas las demás tablas de tenant en SIGAC.

### Mecanismo de enforcement

```
HTTP Request
  → RequestContextResolver (extrae TenantContext del token JWT)
  → TenantDatabaseRouter.withTransaction(tenant, ...)
  → PostgreSQL connection scoped al databaseName del tenant
  → Queries sobre vale_archivo sin filtro tenant_id
```

Ningún path de código puede obtener una conexión sin pasar por `TenantContext`.
Cualquier intento de cross-tenant se previene en el router, no en las tablas.

### Consecuencias

- Las tablas `vale_archivo` y `vale_archivo_items` no tienen columna `tenant_id`.
- Los tests de tenant isolation verifican que Tenant B no ve los datos de Tenant A
  ejecutando la misma query sobre bases de datos distintas (T-34, T-38).
- Los adapters PostgreSQL de Vale Archivo no deben incluir filtros `WHERE tenant_id = $1`.

---

## Architecture

### 5. Arquitectura por capas

```
packages/modules/vale-archivo/
  src/
    domain/
      aggregates/
        ValeArchivo.ts            ← Aggregate root + lógica de transiciones
      entities/
        ValeArchivoItem.ts        ← Entity dentro del Aggregate
      value-objects/
        ValeArchivoId.ts          ← branded string UUID
        NumeroVale.ts             ← branded string texto libre
        EstadoVale.ts             ← union type + guards
        EstadoBusqueda.ts         ← union type + guards
        SolicitanteReferencia.ts  ← { nombre: string, cargo: string }
      errors/
        ValeArchivoErrors.ts
      index.ts
    application/
      ports/
        ValeArchivoRepository.ts  ← write side (save, findById)
        ValeArchivoQueryPort.ts   ← read side (findPage, findById para queries)
      use-cases/
        RegistrarVale.ts
        IniciarBusqueda.ts
        RegistrarLocalizacion.ts
        RegistrarEntrega.ts
        CerrarValeAdministrativo.ts
        ConsultarVales.ts         ← delegado a ValeArchivoQueryPort
        GenerarPdfVale.ts
      index.ts
    index.ts

packages/platform/pdf/
  src/
    PDFKitValeArchivoGenerator.ts  ← adapter SM 1-14 (reutiliza @sigac/pdf)
    index.ts                       ← re-export

apps/api/
  src/
    vale-archivo/
      ValeArchivoModule.ts
      controllers/
        ValeArchivoController.ts
      dtos/
        CreateValeArchivoDto.ts
        UpdateValeArchivoItemDto.ts
        RegistrarEntregaDto.ts

apps/web/
  src/
    features/
      vale-archivo/
        ← Frontend (fase posterior a v0.1)
```

---

## Components and Interfaces

### 6. Domain — Aggregate ValeArchivo

### 10.1 Value objects

```typescript
// EstadoVale
export type EstadoVale =
  | 'RECIBIDA'
  | 'EN_BUSQUEDA'
  | 'COMPLETA'
  | 'PARCIAL'
  | 'NO_LOCALIZADA'
  | 'ENTREGADA'
  | 'CERRADA';

// EstadoBusqueda
export type EstadoBusqueda = 'PENDIENTE' | 'LOCALIZADO' | 'NO_LOCALIZADO';

// SolicitanteReferencia — no es ActorContext; es una referencia nominal
export interface SolicitanteReferencia {
  readonly nombre: string;   // nombre completo del firmante institucional
  readonly cargo: string;    // cargo formal (Director, Subdirector, etc.)
}
```

### 10.2 ValeArchivoItem (Entity)

```typescript
export interface ValeArchivoItemSnapshot {
  readonly id: string;                    // UUID
  readonly valeId: string;                // FK al ValeArchivo
  readonly expedienteNumero: string;      // número de expediente físico
  readonly pacienteNombre: string;        // nombre operativo del paciente
  readonly especialidad: string;          // especialidad médica del ítem
  readonly estadoBusqueda: EstadoBusqueda;
  readonly ubicacionEncontrada: string | null;
  readonly observaciones: string | null;  // ≤ 500 caracteres
}
```

### 7.3 ValeArchivo (Aggregate root)

```typescript
export interface ValeArchivoSnapshot {
  readonly id: string;                          // UUID — ValeArchivoId
  readonly numeroVale: string;                  // NumeroVale — texto libre único por tenant
  readonly fechaSolicitud: Date;
  readonly fechaRecepcion: Date;
  readonly unidadSolicitante: string;
  readonly solicitante: SolicitanteReferencia;
  readonly autorizador: SolicitanteReferencia;
  readonly estado: EstadoVale;
  readonly items: readonly ValeArchivoItemSnapshot[];
  readonly creadoPor: string;                   // actorId del Capturista
  readonly busquedaIniciadaPor: string | null;  // actorId del Archivista
  readonly busquedaIniciadaAt: Date | null;
  readonly entregadoPor: string | null;
  readonly entregadoAt: Date | null;
  readonly receptorEntrega: string | null;      // nombre libre del receptor
  readonly tenantId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### 6.4 Transiciones de estado — implementación del Aggregate

```typescript
// ValeArchivo — métodos de transición
class ValeArchivo {
  /** VA-004: RECIBIDA → EN_BUSQUEDA */
  iniciarBusqueda(actorId: string, occurredAt: Date): ValeArchivoEvent

  /** VA-005: actualiza ítem y evalúa transición automática del vale */
  registrarLocalizacion(
    itemId: string,
    estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO',
    ubicacionEncontrada: string | null,
    observaciones: string | null,
    occurredAt: Date,
  ): ValeArchivoEvent[]  // puede incluir evento de actualización del vale

  /** VA-006: COMPLETA|PARCIAL → ENTREGADA */
  registrarEntrega(
    actorId: string,
    receptorEntrega: string,
    itemsEntregados: string[],   // ids de ValeArchivoItem
    entregadoAt: Date,
  ): ValeArchivoEvent

  /** VA-007: NO_LOCALIZADA → CERRADA */
  cerrarAdministrativamente(actorId: string, motivo: string | null, occurredAt: Date): ValeArchivoEvent
}
```

**Lógica de transición automática tras `registrarLocalizacion`:**

```
todosResueltos = items.every(i => i.estadoBusqueda !== 'PENDIENTE')
si todosResueltos:
  todoLocalizado = items.every(i => i.estadoBusqueda === 'LOCALIZADO')
  ninguno        = items.every(i => i.estadoBusqueda === 'NO_LOCALIZADO')
  si todoLocalizado  → estado = 'COMPLETA'
  si ninguno         → estado = 'NO_LOCALIZADA'
  si mezcla          → estado = 'PARCIAL'
```

### 6.5 Errores de dominio

```typescript
// packages/modules/vale-archivo/src/domain/errors/ValeArchivoErrors.ts

export class ValeRequiereItemsError extends DomainError     // INV-VA-001
export class InvalidStateTransitionError extends DomainError // INV-VA-010
export class ValeArchivoItemNotFoundError extends DomainError
export class ValeArchivoNotFoundError extends DomainError
```

---

## 7. Application — ports y use cases

### 6.1 Ports

```typescript
// ValeArchivoRepository.ts — write side
export interface ValeArchivoRepository {
  save(vale: ValeArchivo, tenant: TenantContext): Promise<void>;
  findById(id: string, tenant: TenantContext): Promise<ValeArchivo | null>;
}

// ValeArchivoQueryPort.ts — read side
export interface ValeArchivoPageFilter {
  estado?: EstadoVale;
  fecha?: string;       // YYYY-MM-DD, aplica sobre fechaSolicitud
  unidad?: string;      // substring case-insensitive sobre unidadSolicitante
  cursor?: string;      // cursor opaco para paginación
  limit?: number;       // default 20, máx 100
}

export interface ValeArchivoSummary {
  readonly id: string;
  readonly numeroVale: string;
  readonly fechaSolicitud: Date;
  readonly unidadSolicitante: string;
  readonly solicitanteNombre: string;
  readonly estado: EstadoVale;
  readonly itemCount: number;
}

export interface ValeArchivoPage {
  readonly items: readonly ValeArchivoSummary[];
  readonly nextCursor: string | null;
}

export interface ValeArchivoQueryPort {
  findPage(filter: ValeArchivoPageFilter, tenant: TenantContext): Promise<ValeArchivoPage>;
  findByIdForPdf(id: string, tenant: TenantContext): Promise<ValeArchivoSnapshot | null>;
}
```

### 6.2 Use cases

#### RegistrarVale

```typescript
export interface RegistrarValeCommand {
  readonly numeroVale: string;
  readonly fechaSolicitud: string;       // YYYY-MM-DD
  readonly fechaRecepcion: string;       // YYYY-MM-DD
  readonly unidadSolicitante: string;
  readonly solicitante: SolicitanteReferencia;
  readonly autorizador: SolicitanteReferencia;
  readonly items: readonly {
    readonly expedienteNumero: string;
    readonly pacienteNombre: string;
    readonly especialidad: string;
  }[];
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}

export interface RegistrarValeResult {
  readonly id: string;
  readonly numeroVale: string;
  readonly estado: EstadoVale;
}
```

**Flujo:**
1. Validar que `items.length >= 1` → `ValeRequiereItemsError` si no.
2. Crear `ValeArchivo` con estado `RECIBIDA`.
3. `repository.save(vale, tenant)`.
4. `auditWriter.write({ action: 'VALE_CREADO', ... })` — sin PII de pacientes.
5. Retornar `{ id, numeroVale, estado }`.

#### IniciarBusqueda

```typescript
export interface IniciarBusquedaCommand {
  readonly valeId: string;
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}
```

**Flujo:**
1. `repository.findById(valeId, tenant)` — `ValeArchivoNotFoundError` si no existe.
2. `vale.iniciarBusqueda(actor.userId, now)` — `InvalidStateTransitionError` si no está en `RECIBIDA`.
3. `repository.save(vale, tenant)`.
4. `auditWriter.write({ action: 'VALE_BUSQUEDA_INICIADA', ... })`.

#### RegistrarLocalizacion

```typescript
export interface RegistrarLocalizacionCommand {
  readonly valeId: string;
  readonly itemId: string;
  readonly estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO';
  readonly ubicacionEncontrada?: string;
  readonly observaciones?: string;
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}
```

**Flujo:**
1. `repository.findById(valeId, tenant)`.
2. `vale.registrarLocalizacion(itemId, estadoBusqueda, ...)`.
3. Transición automática de estado del vale si todos los ítems están resueltos.
4. `repository.save(vale, tenant)`.
5. `auditWriter.write({ action: 'VALE_ESTADO_ACTUALIZADO', ... })` si el estado del vale cambió.

#### RegistrarEntrega

```typescript
export interface RegistrarEntregaCommand {
  readonly valeId: string;
  readonly receptorEntrega: string;
  readonly entregadoAt: string;          // ISO 8601
  readonly itemsEntregados: string[];    // ids de ValeArchivoItem
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}
```

**Flujo:**
1. `repository.findById(valeId, tenant)`.
2. `vale.registrarEntrega(actor.userId, receptorEntrega, itemsEntregados, entregadoAt)` — falla si no está en `COMPLETA` ni `PARCIAL`.
3. `repository.save(vale, tenant)`.
4. `auditWriter.write({ action: 'VALE_ENTREGADO', itemCount: itemsEntregados.length, ... })`.

#### CerrarValeAdministrativo

```typescript
export interface CerrarValeAdministrativoCommand {
  readonly valeId: string;
  readonly motivo?: string;
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}
```

**Flujo:**
1. `repository.findById(valeId, tenant)`.
2. `vale.cerrarAdministrativamente(actor.userId, motivo, now)` — falla si no está en `NO_LOCALIZADA`.
3. `repository.save(vale, tenant)`.
4. `auditWriter.write({ action: 'VALE_CERRADO_ADMINISTRATIVO', ... })`.

#### GenerarPdfVale

```typescript
export interface GenerarPdfValeCommand {
  readonly valeId: string;
  readonly actor: { readonly userId: string };
  readonly tenant: TenantContext;
}

export interface GenerarPdfValeResult {
  readonly stream: NodeJS.ReadableStream;
  readonly filename: string;   // sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf
}
```

**Flujo:**
1. `queryPort.findByIdForPdf(valeId, tenant)` — 404 si no existe.
2. `pdfGenerator.generate(snapshot)` → `{ stream, filename }`.
3. `auditWriter.write({ action: 'VALE_PDF_GENERADO', ... })`.
4. Retornar `{ stream, filename }`.

### 6.3 Audit entries por use case

| Acción | Campos incluidos | Campos excluidos |
|---|---|---|
| `VALE_CREADO` | `valeId`, `actorId`, `tenantId`, `itemCount`, `unidadSolicitante` | nombres de pacientes, expedientes individuales |
| `VALE_BUSQUEDA_INICIADA` | `valeId`, `actorId`, `tenantId`, timestamp | — |
| `VALE_ESTADO_ACTUALIZADO` | `valeId`, `actorId`, `tenantId`, `estadoNuevo` | — |
| `VALE_ENTREGADO` | `valeId`, `actorId`, `tenantId`, `itemCount`, `entregadoAt` | nombre del receptor, expedientes individuales |
| `VALE_CERRADO_ADMINISTRATIVO` | `valeId`, `actorId`, `tenantId`, `motivo` (texto libre, sin PII) | — |
| `VALE_PDF_GENERADO` | `valeId`, `actorId`, `tenantId` | — |

---

## 8. Infrastructure — PDFKit adapter SM 1-14

### 7.1 `PDFKitValeArchivoGenerator`

```
packages/platform/pdf/src/PDFKitValeArchivoGenerator.ts
```

Implementa un port `ValeArchivoReportGeneratorPort` (definido en Application):

```typescript
export interface ValeArchivoReportGeneratorPort {
  generate(snapshot: ValeArchivoSnapshot): Promise<{
    stream: NodeJS.ReadableStream;
    filename: string;
  }>;
}
```

**Estructura del PDF SM 1-14:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ISSSTE — [NOMBRE DEL HOSPITAL]                                 │
│  ARCHIVO CLÍNICO                                                │
│                                                                 │
│  SOLICITUD DE PRÉSTAMO DE EXPEDIENTE CLÍNICO (SM 1-14)         │
│                                                                 │
│  No. de Vale: VA-2026-00142                                     │
│  Fecha de Solicitud: DD/MM/YYYY                                 │
│  Fecha de Recepción: DD/MM/YYYY                                 │
│  Unidad Solicitante: NOMBRE UNIDAD                              │
│  Solicitante: NOMBRE Y CARGO                                    │
│  Autoriza: NOMBRE Y CARGO                                       │
├────┬──────────────────┬─────────────────────┬──────────────────┤
│ #  │ Expediente       │ Derechohabiente     │ Especialidad     │
├────┼──────────────────┼─────────────────────┼──────────────────┤
│  1 │ XXXXXXXXXX       │ NOMBRE OPERATIVO    │ ESPECIALIDAD     │
│  2 │ XXXXXXXXXX       │ NOMBRE OPERATIVO    │ ESPECIALIDAD     │
└────┴──────────────────┴─────────────────────┴──────────────────┘
│  Total de expedientes solicitados: N                            │
│                                                                 │
│  Recibió: _____________________  Fecha entrega: ______________ │
└─────────────────────────────────────────────────────────────────┘
                                          Página P de TOTAL
```

**Campos que el adapter SÍ usa:**

| Campo snapshot | Posición en PDF |
|---|---|
| `numeroVale` | Encabezado |
| `fechaSolicitud` | Encabezado (`DD/MM/YYYY`) |
| `fechaRecepcion` | Encabezado (`DD/MM/YYYY`) |
| `unidadSolicitante` | Encabezado |
| `solicitante.nombre` + `solicitante.cargo` | Encabezado |
| `autorizador.nombre` + `autorizador.cargo` | Encabezado |
| `items[].expedienteNumero` | Tabla |
| `items[].pacienteNombre` | Tabla |
| `items[].especialidad` | Tabla |
| `receptorEntrega` | Sección de entrega (si aplica) |
| `entregadoAt` | Sección de entrega (si aplica) |

**Campos que el adapter NO usa:** CURP, teléfono, fecha de nacimiento, correo
electrónico, edad, sexo, `estadoBusqueda` individual de cada ítem (no es parte
del documento SM 1-14), `actorId`, `tenantId`.

**Notas técnicas:**
- `bufferPages: true` para numeración `Página P de TOTAL`.
- Documentos operativos pequeños (≤ ~200 ítems por vale); buffer en memoria aceptable.
- `filename = "sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf"` donde la fecha es `fechaSolicitud`.

### 7.2 Port en Application

```typescript
// packages/modules/vale-archivo/src/application/ports/ValeArchivoReportGeneratorPort.ts
export interface ValeArchivoReportGeneratorPort {
  generate(snapshot: ValeArchivoSnapshot): Promise<{
    stream: NodeJS.ReadableStream;
    filename: string;
  }>;
}
```

El use case `GenerarPdfVale` depende de este port; no conoce PDFKit.

---

## Data Models

### 9. Infrastructure — base de datos

### 8.1 Schema SQL (prefijo `vale_`)

```sql
-- Migration: create_vale_archivo_tables

CREATE TABLE vale_archivo (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_vale         TEXT        NOT NULL,
  fecha_solicitud     DATE        NOT NULL,
  fecha_recepcion     DATE        NOT NULL,
  unidad_solicitante  TEXT        NOT NULL,
  solicitante_nombre  TEXT        NOT NULL,
  solicitante_cargo   TEXT        NOT NULL,
  autorizador_nombre  TEXT        NOT NULL,
  autorizador_cargo   TEXT        NOT NULL,
  estado              TEXT        NOT NULL
    CHECK (estado IN (
      'RECIBIDA','EN_BUSQUEDA','COMPLETA','PARCIAL',
      'NO_LOCALIZADA','ENTREGADA','CERRADA'
    )),
  creado_por                TEXT        NOT NULL,
  busqueda_iniciada_por     TEXT,
  busqueda_iniciada_at      TIMESTAMPTZ,
  entregado_por             TEXT,
  entregado_at              TIMESTAMPTZ,
  receptor_entrega          TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vale_archivo_estado       ON vale_archivo(estado);
CREATE INDEX idx_vale_archivo_fecha_sol    ON vale_archivo(fecha_solicitud);
CREATE INDEX idx_vale_archivo_unidad       ON vale_archivo(unidad_solicitante);

CREATE TABLE vale_archivo_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vale_id               UUID        NOT NULL REFERENCES vale_archivo(id) ON DELETE CASCADE,
  expediente_numero     TEXT        NOT NULL,
  paciente_nombre       TEXT        NOT NULL,
  especialidad          TEXT        NOT NULL,
  estado_busqueda       TEXT        NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado_busqueda IN ('PENDIENTE','LOCALIZADO','NO_LOCALIZADO')),
  ubicacion_encontrada  TEXT,
  observaciones         TEXT        CHECK (char_length(observaciones) <= 500)
);

CREATE INDEX idx_vale_archivo_items_vale_id ON vale_archivo_items(vale_id);
```

**Nota de tenant isolation:** todas las tablas viven en la base de datos del tenant
(database-per-tenant). `TenantDatabaseRouter` enruta cada query al schema correcto;
no existe columna `tenant_id` en las tablas.

### 8.2 `PostgresValeArchivoRepository`

```
packages/modules/vale-archivo/src/infrastructure/
  PostgresValeArchivoRepository.ts   ← implementa ValeArchivoRepository
  PostgresValeArchivoQueryAdapter.ts ← implementa ValeArchivoQueryPort
  ValeArchivoMapper.ts               ← rows ↔ ValeArchivoSnapshot
```

---

## Error Handling

### 10. API HTTP

### 9.1 Endpoints

```
POST   /api/v1/vale-archivo                           VA-001: crear vale
GET    /api/v1/vale-archivo                           VA-003: listar (cursor)
GET    /api/v1/vale-archivo/:id                       detalle completo
POST   /api/v1/vale-archivo/:id/iniciar-busqueda      VA-004
PATCH  /api/v1/vale-archivo/:id/items/:itemId         VA-005: localización
POST   /api/v1/vale-archivo/:id/entrega               VA-006
POST   /api/v1/vale-archivo/:id/cerrar                VA-007: cierre administrativo
GET    /api/v1/vale-archivo/:id/pdf                   VA-002: PDF SM 1-14
```

### 9.2 Contratos HTTP

**POST /api/v1/vale-archivo**

Request body:
```json
{
  "numeroVale": "VA-2026-00142",
  "fechaSolicitud": "2026-08-26",
  "fechaRecepcion": "2026-08-26",
  "unidadSolicitante": "DIRECCIÓN MÉDICA",
  "solicitante": { "nombre": "...", "cargo": "Director Médico" },
  "autorizador": { "nombre": "...", "cargo": "Subdirector" },
  "items": [
    { "expedienteNumero": "ISSSTE-000001", "pacienteNombre": "...", "especialidad": "MEDICINA INTERNA" }
  ]
}
```

Response 201:
```json
{ "id": "<uuid>", "numeroVale": "VA-2026-00142", "estado": "RECIBIDA" }
```

**GET /api/v1/vale-archivo**

Query params: `estado`, `fecha` (YYYY-MM-DD), `unidad`, `cursor`, `limit`.

Response 200:
```json
{
  "items": [ { "id": "...", "numeroVale": "...", "estado": "RECIBIDA", "itemCount": 3, ... } ],
  "nextCursor": "<opaque>" | null
}
```

**PATCH /api/v1/vale-archivo/:id/items/:itemId**

Request body:
```json
{
  "estadoBusqueda": "LOCALIZADO",
  "ubicacionEncontrada": "Estantería A-3, Gaveta 12",
  "observaciones": "Expediente con carpeta deteriorada"
}
```

**POST /api/v1/vale-archivo/:id/entrega**

Request body:
```json
{
  "receptorEntrega": "Lic. Juan Pérez Soto",
  "entregadoAt": "2026-08-26T15:30:00Z",
  "itemsEntregados": ["<itemId1>", "<itemId2>"]
}
```

**Respuestas de error (RFC 7807):**

| Condición | HTTP | `type` |
|---|---|---|
| Vale requiere al menos 1 ítem | 422 | `/errors/vale-requiere-items` |
| Transición de estado inválida | 422 | `/errors/invalid-state-transition` |
| Vale no encontrado | 404 | `/errors/vale-not-found` |
| Ítem no encontrado | 404 | `/errors/item-not-found` |
| Sin permiso requerido | 403 | `/errors/permission-denied` |
| Error interno | 500 | `/errors/internal` |

### 10.3 Controller NestJS

```typescript
// apps/api/src/vale-archivo/controllers/ValeArchivoController.ts

@Controller('api/v1/vale-archivo')
@UseGuards(JwtAuthGuard)
export class ValeArchivoController {
  // POST /api/v1/vale-archivo — requiere REQUEST_CREATE
  @Post()
  async crearVale(...)

  // GET /api/v1/vale-archivo — requiere ARCHIVE_REQUEST_VIEW
  @Get()
  async listarVales(...)

  // GET /api/v1/vale-archivo/:id
  @Get(':id')
  async obtenerVale(...)

  // POST /api/v1/vale-archivo/:id/iniciar-busqueda — requiere ARCHIVE_REQUEST_PROCESS
  @Post(':id/iniciar-busqueda')
  async iniciarBusqueda(...)

  // PATCH /api/v1/vale-archivo/:id/items/:itemId — requiere ARCHIVE_REQUEST_PROCESS
  @Patch(':id/items/:itemId')
  async registrarLocalizacion(...)

  // POST /api/v1/vale-archivo/:id/entrega — requiere ARCHIVE_REQUEST_DELIVER
  @Post(':id/entrega')
  async registrarEntrega(...)

  // POST /api/v1/vale-archivo/:id/cerrar — requiere REQUEST_CREATE|REQUEST_ASSIGN
  @Post(':id/cerrar')
  async cerrarVale(...)

  // GET /api/v1/vale-archivo/:id/pdf — requiere ARCHIVE_REQUEST_VIEW o REQUEST_CREATE
  @Get(':id/pdf')
  async generarPdf(...)
}
```

El controller **no** tiene lógica de negocio: verifica permisos desde `RequestContext`,
construye el comando y delega al use case.

### 10.4 Módulo NestJS

`ValeArchivoModule` registra como providers:
- `RegistrarVale`, `IniciarBusqueda`, `RegistrarLocalizacion`,
  `RegistrarEntrega`, `CerrarValeAdministrativo`, `GenerarPdfVale` (use cases)
- `PostgresValeArchivoRepository` como `VALE_ARCHIVO_REPOSITORY_TOKEN`
- `PostgresValeArchivoQueryAdapter` como `VALE_ARCHIVO_QUERY_PORT_TOKEN`
- `PDFKitValeArchivoGenerator` como `VALE_ARCHIVO_PDF_GENERATOR_TOKEN`

---

## 11. OpenAPI — fragmento del contrato

```yaml
/api/v1/vale-archivo:
  post:
    operationId: crearValeArchivo
    summary: Registra un nuevo vale SM 1-14
    tags: [ValeArchivo]
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateValeArchivoRequest'
    responses:
      '201':
        description: Vale creado
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ValeArchivoCreatedResponse'
      '403':
        $ref: '#/components/responses/Forbidden'
      '422':
        $ref: '#/components/responses/UnprocessableEntity'

  get:
    operationId: listarValesArchivo
    summary: Lista vales con paginación cursor
    tags: [ValeArchivo]
    security:
      - bearerAuth: []
    parameters:
      - name: estado
        in: query
        schema:
          type: string
          enum: [RECIBIDA, EN_BUSQUEDA, COMPLETA, PARCIAL, NO_LOCALIZADA, ENTREGADA, CERRADA]
      - name: fecha
        in: query
        schema:
          type: string
          format: date
      - name: unidad
        in: query
        schema:
          type: string
      - name: cursor
        in: query
        schema:
          type: string
      - name: limit
        in: query
        schema:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
    responses:
      '200':
        description: Lista paginada de vales
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ValeArchivoPage'
      '403':
        $ref: '#/components/responses/Forbidden'

/api/v1/vale-archivo/{id}/pdf:
  get:
    operationId: generarPdfValeArchivo
    summary: Genera y descarga el PDF SM 1-14
    tags: [ValeArchivo]
    security:
      - bearerAuth: []
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: PDF generado
        headers:
          Content-Disposition:
            schema:
              type: string
              example: 'attachment; filename="sm1-14-VA-2026-00142-2026-08-26.pdf"'
        content:
          application/pdf:
            schema:
              type: string
              format: binary
      '403':
        $ref: '#/components/responses/Forbidden'
      '404':
        $ref: '#/components/responses/NotFound'
```

---

## Correctness Properties

### 12. Correctness Properties

*Una propiedad es una característica del comportamiento que debe cumplirse en todas las
ejecuciones válidas del sistema — un enunciado formal sobre qué debe hacer el sistema.
Las propiedades conectan la especificación legible con garantías de corrección verificables
automáticamente.*

### Property 1: Transición de estado es función de los ítems resueltos

*Para cualquier* `ValeArchivo` en estado `EN_BUSQUEDA` y cualquier combinación de
actualizaciones de `estadoBusqueda` sobre sus ítems, cuando el último ítem pasa de
`PENDIENTE`, el estado resultante del vale debe ser exactamente:
`COMPLETA` si todos son `LOCALIZADO`, `NO_LOCALIZADA` si todos son `NO_LOCALIZADO`,
o `PARCIAL` si hay mezcla. No existe ninguna otra combinación posible.

**Validates: Requirements REQ-VA-005.4, REQ-VA-005.5, REQ-VA-005.6, INV-VA-010**

### Property 2: Máquina de estados no permite retroceso

*Para cualquier* `ValeArchivo` y cualquier secuencia de comandos aplicados, el estado
resultante en el historial de transiciones es siempre estrictamente hacia adelante;
ninguna transición lleva a un estado anterior en la jerarquía del ciclo de vida.

**Validates: Requirements REQ-VA-004.3, REQ-VA-005.7, REQ-VA-006.3, INV-VA-010**

### Property 3: Privacidad en PDF — sin patrones CURP

*Para cualquier* array de `ValeArchivoSnapshot` generado con datos sintéticos por
fast-check, el contenido textual extraído del PDF generado no contiene patrones CURP
(`/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/`), números de teléfono ni fechas de nacimiento.

**Validates: Requirements REQ-VA-002.3, INV-VA-004, AC-VA-009**

### Property 4: Invariante mínimo de ítems

*Para cualquier* comando `RegistrarValeCommand` con `items.length === 0`, el use case
`RegistrarVale` lanza `ValeRequiereItemsError` y no persiste ningún registro en la base
de datos.

**Validates: Requirements REQ-VA-001.3, INV-VA-001, AC-VA-002**

### Property 5: Filename del PDF no contiene PII de paciente

*Para cualquier* `ValeArchivoSnapshot` con cualquier `numeroVale` y `fechaSolicitud`,
el filename resultante del PDF sigue el patrón
`sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf` y no contiene `pacienteNombre`,
`expedienteNumero` ni CURP.

**Validates: Requirements REQ-VA-002.4, INV-VA-009**

---

## Testing Strategy

### 13. Testing strategy

### 13.1 Unit tests

| Suite | Qué testea |
|---|---|
| `ValeArchivo.spec.ts` | Máquina de estados completa: todas las transiciones válidas e inválidas |
| `ValeArchivo.spec.ts` | Invariante de mínimo 1 ítem |
| `ValeArchivo.spec.ts` | Transición automática al completar ítems (COMPLETA / PARCIAL / NO_LOCALIZADA) |
| `RegistrarVale.spec.ts` | Flujo con mocks de Repository y AuditWriter |
| `IniciarBusqueda.spec.ts` | Transición válida e inválida; audit entry sin PII |
| `RegistrarLocalizacion.spec.ts` | Actualización de ítem + transición automática del vale |
| `RegistrarEntrega.spec.ts` | Entrega con ítems parciales y completos |
| `PDFKitValeArchivoGenerator.spec.ts` | PDF > 0 bytes con datos sintéticos |
| `PDFKitValeArchivoGenerator.spec.ts` | Columnas del PDF presentes (Expediente, Derechohabiente, Especialidad) |

### 13.2 Property-based tests (Vitest + fast-check)

| Property | Test |
|---|---|
| Property 3 | Para todo array sintético → PDF sin patrones CURP |
| Property 4 | Para todo comando con `items = []` → `ValeRequiereItemsError` |
| Property 1 | Para toda combinación de estados de ítems → estado del vale correcto |
| Property 5 | Para todo `snapshot` → filename sin PII |

Mínimo 100 iteraciones por test property.
Tag: `Feature: vale-archivo, Property {n}: {texto}`

### 13.3 Integration tests (PostgreSQL real)

| Suite | Qué testea |
|---|---|
| `ValeArchivoController.spec.ts` | POST crea vale; GET lista con filtros; paginación cursor |
| `ValeArchivoController.spec.ts` | Transiciones de estado end-to-end con DB real |
| `ValeArchivoController.spec.ts` | 403 sin permiso; 422 en transición inválida; 404 vale inexistente |
| `ValeArchivoController.spec.ts` | Tenant B no accede a vales de Tenant A |
| `ValeArchivoController.spec.ts` | Audit log escrito por cada transición |
| `ValeArchivoController.spec.ts` | PDF generado > 0 bytes, Content-Type correcto |

### 13.4 E2E (Playwright)

| Escenario | Descripción |
|---|---|
| Flujo completo VA-001 → VA-006 | Crear, iniciar búsqueda, localizar, entregar, cerrar |
| Acceso sin permiso | Actor sin REQUEST_CREATE → no puede crear |
| PDF accesible | Actor con ARCHIVE_REQUEST_VIEW descarga el PDF |
| Filtros de lista | Estado, fecha, unidad funcionan correctamente |

### 13.5 Datos de test

- Todos los fixtures usan datos sintéticos desidentificados.
- No se copian nombres reales, expedientes reales ni números de vale reales.
- El tenant de test usa exclusivamente datos sintéticos.

---

## 14. Trazabilidad de requisitos

| Requisito | Componente de diseño |
|---|---|
| REQ-VA-001 (registrar vale) | `RegistrarVale` + `ValeArchivo.create()` + POST endpoint |
| REQ-VA-002 (PDF SM 1-14) | `GenerarPdfVale` + `PDFKitValeArchivoGenerator` + GET /:id/pdf |
| REQ-VA-003 (consulta paginada) | `ConsultarVales` + `ValeArchivoQueryPort` + GET endpoint |
| REQ-VA-004 (iniciar búsqueda) | `IniciarBusqueda` + `ValeArchivo.iniciarBusqueda()` |
| REQ-VA-005 (localización por ítem) | `RegistrarLocalizacion` + lógica automática en Aggregate |
| REQ-VA-006 (entrega) | `RegistrarEntrega` + `ValeArchivo.registrarEntrega()` |
| REQ-VA-007 (cierre administrativo) | `CerrarValeAdministrativo` + `ValeArchivo.cerrarAdministrativamente()` |
| INV-VA-001..INV-VA-012 | Domain layer + Audit entries (incl. INV-VA-011 turno, INV-VA-012 permisos BC) |

---

## 15. Readiness

- `requirements_ready: true`
- `design_ready: true`
- `tasks_ready: true`
- `implementation_ready: true` — Approved for Implementation (2026-08-26)
