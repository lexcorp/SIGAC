---
spec: expediente-workspace
version: "0.2.0"
status: "Draft — pending stakeholder validation"
date: "2026-08-14"
sdb_sources:
  - "Volume-03 / DDD-013, DDD-014, DDD-015, DDD-017, DDD-018, DDD-019, DDD-020, DDD-009, DDD-010, DDD-012"
  - "Volume-05 / UC-018, SPEC-009, SDD-005, SDD-006, PERM-MATRIX"
  - "Volume-07 / SEC-003, SEC-017, SEC-018, SEC-032, SEC-038"
  - "Volume-08 / DAT-006, DAT-011, DAT-012, DAT-019, API-001, API-011"
  - "Volume-09 / APP-003, IA-005, DS-014, INT-001–INT-009"
  - "Volume-10 / TQ-002, TQ-007, TQ-009, TQ-010"
  - "Volume-12 / OS-004–OS-018"
---

# Expediente Workspace — Requirements

> **Principio rector (SDB APP-003):** La pantalla responde exactamente tres preguntas en cualquier momento:
> _¿Dónde está el expediente? ¿Quién lo tiene? ¿Qué puedo hacer con él ahora mismo?_

---

## 1. Contexto y alcance

El **Expediente Workspace** es la pantalla central de operación de SIGAC.
Consolida, para un expediente físico dado, su situación operativa actual y el conjunto de
acciones disponibles según el estado del aggregate, el rol del usuario y el contexto del negocio.

**Fuente de dominio:** Aggregate `Expediente` (DDD-013).
**Spec de consulta:** SPEC-009 / UC-018.
**Pantalla UI:** APP-003 (Volume 09).

### 1.1 Alcance incluido

| # | Capacidad |
|---|-----------|
| A | Recuperar y mostrar la situación operativa actual del Expediente |
| B | Mostrar ubicación actual (DDD-019) |
| C | Mostrar custodia actual (DDD-018) |
| D | Mostrar préstamo activo si existe (DDD-015) |
| E | Mostrar solicitud activa si existe (DDD-014) |
| F | Mostrar incidencias abiertas si existen (DDD-017) |
| G | Mostrar historial de movimientos operativos (DDD-020) |
| H | Exponer barra de comandos con las acciones válidas según estado/rol/contexto (DS-014) |
| I | Mostrar tab de Auditoría a roles autorizados (SEC-038, INT-008) |
| J | Manejar concurrencia optimista y conflictos de estado (DAT-019) |

### 1.2 Non-goals explícitos

- No muestra ni almacena diagnósticos, notas clínicas, tratamientos ni estudios
  (DDD-013, V05-43 regla 10, AGENTS.md).
- No autoriza ni deniega acceso clínico al contenido del expediente.
- No reemplaza la agenda; la importa como dependencia (SPEC-008).
- No implementa contenido de tabs distintos a Expediente Workspace en esta spec.
- No implementa TOMO como unidad administrable independiente hasta resolver OQ-DOM-005 / OQ-SPEC-006.

---

## 2. Actores

| Actor | Descripción | Fuente |
|-------|-------------|--------|
| **Archivista** | Operador de Archivo Clínico; acciones de búsqueda, custodia, préstamo, devolución y rearchivo | PERM-MATRIX, INT-002 |
| **Jefatura de Archivo** | Supervisor; puede realizar las mismas acciones que Archivista y adicionales de autorización | PERM-MATRIX |
| **Receptor de Servicio** | Personal de servicio/consultorio; recibe expediente, confirma custodia en destino | PERM-MATRIX |
| **Coordinación Médica / Dirección** | Autoriza tipos especiales de préstamo | PERM-MATRIX |
| **Auditor** | Acceso de lectura; puede ver tab Auditoría | INT-002, SEC-038 |
| **Administrador TI** | Sin acceso funcional; configuración de sistema | PERM-MATRIX |

> **Nota de diseño (SEC-017):** La autorización final es una tupla
> `sujeto + permiso + tenant + recurso + contexto de negocio`.
> La matriz de la UI (INT-002) es orientativa; RBAC/ABAC del Volume 07 es autoridad.

---

## 3. Requisitos funcionales

### REQ-EW-001 — Recuperar Expediente por identificador
- **Actor:** Cualquier usuario con permiso `EXPEDIENT_VIEW` en el tenant activo.
- **Precondición:** Usuario autenticado; TenantContext resuelto server-side (API-005).
- **Acción:** El sistema recibe `ExpedienteId` o `ExpedienteNumero` y devuelve el read model.
- **Resultado:** Se presenta la situación operativa actual (estado, ubicación, custodia, préstamo activo, solicitud activa, incidencias abiertas).
- **Fuente SDB:** UC-018, SPEC-009 FR-VIEW-001/002/003/004/005/006, API-011 `GET /expedientes/{id}`.
- **Invariantes:** INV-EXP-001, INV-EXP-002.

### REQ-EW-002 — Búsqueda por número de expediente
- **Actor:** Archivista, Jefatura.
- **Precondición:** Usuario con `EXPEDIENT_VIEW`; número de expediente disponible.
- **Acción:** `GET /expedientes?numero=...`
- **Resultado:** Lista de coincidencias o apertura directa si hay resultado único.
- **Fuente SDB:** SPEC-009 FR-VIEW-001, API-011, DAT-030.

### REQ-EW-003 — Mostrar ubicación actual
- **Precondición:** Expediente recuperado.
- **Resultado:** Ubicación actual visible (anaquel, zona temporal, consultorio, servicio, etc.).
- **Fuente SDB:** SPEC-009 FR-VIEW-003, DDD-019, DAT-006 `ubicacion_actual_id`.
- **OQ pendiente:** OQ-DOM-009 — codificación exacta de ubicaciones temporales.

### REQ-EW-004 — Mostrar custodia actual
- **Precondición:** Expediente recuperado.
- **Resultado:** Custodio actual visible (tipo, referencia, servicio, fecha de aceptación).
- **Fuente SDB:** SPEC-009 FR-VIEW-004, DDD-018, DAT-006 `custodio_tipo / custodio_ref`.
- **OQ pendiente:** OQ-DOM-003 — ¿cuándo inicia custodia externa?, OQ-SPEC-004.

### REQ-EW-005 — Mostrar préstamo activo
- **Precondición:** Expediente con préstamo en estado `Activo` o `Vencido`.
- **Resultado:** Sección préstamo visible con finalidad, custodio, destino, fecha límite, estado.
- **Fuente SDB:** SPEC-009 FR-VIEW-005, DDD-015, API-011 `GET /expedientes/{id}/active-loan`.

### REQ-EW-006 — Mostrar solicitud activa
- **Precondición:** Expediente con solicitud en estado no terminal.
- **Resultado:** Sección solicitud visible con tipo, origen, estado actual, asignado.
- **Fuente SDB:** UC-018 read model, DDD-014, V05-41.

### REQ-EW-007 — Mostrar incidencias abiertas
- **Precondición:** Expediente con incidencia(s) no resueltas.
- **Resultado:** Indicador en header + listado en tab Incidencias.
- **Fuente SDB:** SPEC-009 FR-VIEW-006, DDD-017, API-011.
- **Regla:** `NoLocalizado ≠ Extraviado` de forma automática (DDD-029 OQ-DOM-006, V05-43 regla 5).

### REQ-EW-008 — Mostrar historial de movimientos
- **Actor:** Archivista, Jefatura (acceso pleno); Auditor (lectura).
- **Resultado:** Tab Movimientos con trayectoria física/operativa ordenada cronológicamente.
- **Fuente SDB:** SPEC-009 FR-VIEW-007, DDD-020, DAT-011, API-011 `GET /expedientes/{id}/timeline`.
- **Regla:** Movimiento ≠ Audit Log (DDD-024, DAT-012). No mezclar eventos técnicos con trayectoria operativa.

### REQ-EW-009 — Barra de comandos contextual
- **Precondición:** Workspace abierto; estado y capabilities calculados server-side.
- **Resultado:** Sólo los comandos válidos para el estado actual del Expediente/Solicitud/Préstamo y el rol del usuario son presentados y habilitados.
- **Fuente SDB:** DS-014, INT-003, DDD-010 (lista de comandos del dominio).
- **Regla:** Los comandos son derivados de `capabilities` devueltas por el API, no calculados en el frontend (DEL-002).
- **Comandos candidatos visibles según estado:**

| Estado dominante | Comandos candidatos |
|------------------|---------------------|
| Sin solicitud activa | Solicitar |
| Solicitud Asignada | Iniciar búsqueda |
| En búsqueda | Marcar localizado, Marcar no localizado |
| Localizada / Preparada | (continúa en flujo de preparación — SPEC-002) |
| Sin préstamo activo | Abrir préstamo* |
| Préstamo Activo | Renovar préstamo*, Recibir devolución* |
| Cualquier estado | Reportar incidencia |
| Devuelto | Confirmar rearchivo |

  `*` sujeto a permisos de rol; ver OQ pendientes de autorización.

### REQ-EW-010 — Tab Auditoría (acceso restringido)
- **Actor:** Auditor, Jefatura (según OQ-UX-008).
- **Precondición:** Usuario con permiso de auditoría.
- **Resultado:** Registros de audit log (DAT-012) del expediente, separados de Movimientos.
- **Fuente SDB:** SEC-038, INT-008 (no mezclar audit técnico con timeline operativo), PERM-MATRIX.
- **OQ pendiente:** OQ-UX-008 — lista exacta de roles con acceso al tab Auditoría.

### REQ-EW-011 — Privacidad en presentación
- **Resultado:** Solo se muestra la referencia mínima de paciente necesaria para la tarea.
  Diagnósticos, notas y cualquier dato clínico quedan excluidos.
- **Fuente SDB:** SEC-003 (C3 Restricted), INT-009, DDD-013, V05-43 regla 10.
- **Regla:** Datos de paciente no aparecen en URL, título de ventana, toast, ni nombres de archivo exportado.

### REQ-EW-012 — Manejo de concurrencia y conflictos
- **Precondición:** Usuario intenta ejecutar un comando sobre un recurso que otro actor modificó concurrentemente.
- **Resultado:** El sistema preserva el contexto del usuario, explica que el registro cambió y ofrece opción de refrescar/revisar. No sobreescribe silenciosamente.
- **Fuente SDB:** DAT-019 (row_version, HTTP 409), INT-006, API-006.
- **Acciones críticas:** TransferCustody, OpenLoan, CloseLoan, ResolveIncident, transiciones de Solicitud.

### REQ-EW-013 — Aislamiento multi-tenant
- **Resultado:** El workspace solo opera sobre expedientes del tenant resuelto server-side para la sesión. Ningún valor de tenant proviene del cuerpo de la petición.
- **Fuente SDB:** SEC-032, API-005, AGENTS.md (non-negotiable).

### REQ-EW-014 — Accesibilidad y navegación por teclado
- **Resultado:** Todos los comandos y navegación de tabs son alcanzables con teclado; foco visible; etiquetas ARIA apropiadas.
- **Fuente SDB:** DEL-005 (UX acceptance criteria), Volume-09 §07.

---

## 4. Requisitos no funcionales

| ID | Atributo | Requisito | Fuente SDB |
|----|----------|-----------|------------|
| NFR-EW-001 | Rendimiento | El read model del expediente (estado + ubicación + custodia + préstamo activo + solicitud activa) responde en ≤ 1 s bajo carga operativa normal | UC-018 UX principle |
| NFR-EW-002 | Seguridad | Backend re-verifica autorización en cada petición; no delega a frontend | SEC-017, AGENTS.md |
| NFR-EW-003 | Audit | Toda acción de comando registra actor, tenant, recurso y resultado en audit log (append-only) | SEC-038, DAT-012 |
| NFR-EW-004 | Aislamiento | Ningún query puede cruzar tenant | SEC-032, TQ-007 |
| NFR-EW-005 | Trazabilidad | Datos C3 no aparecen en logs de aplicación ni telemetría | SEC-003, INT-009 |
| NFR-EW-006 | Concurrencia | Transiciones críticas usan optimistic locking (row_version); conflicto → HTTP 409 | DAT-019 |

---

## 5. Criterios de aceptación

> Formato: Given/When/Then (SDD-004).

**AC-EW-001 — Apertura básica del workspace**
```gherkin
Given un archivista autenticado en el tenant correcto
When navega al Expediente Workspace de un expediente existente
Then el header muestra: número de expediente, referencia mínima de paciente,
     estado operativo, ubicación actual y custodio actual
And el contenido está visible sin scroll vertical adicional (above the fold)
And no se muestra ningún dato clínico (diagnósticos, notas, tratamientos)
```

**AC-EW-002 — Expediente inexistente**
```gherkin
Given un archivista autenticado
When solicita un expediente que no existe en su tenant
Then el sistema responde con error 404
And la UI muestra un estado vacío descriptivo
And no se revela información de otros tenants
```

**AC-EW-003 — Comandos disponibles según estado**
```gherkin
Given un expediente con Solicitud en estado EnBusqueda
And el usuario es Archivista
When abre el Workspace
Then la barra de comandos muestra "Marcar localizado" y "Marcar no localizado"
And NO muestra "Abrir préstamo" (transición no válida en ese estado)
```

**AC-EW-004 — Conflicto de concurrencia**
```gherkin
Given un archivista A y un archivista B abren el mismo Expediente
When A transfiere custodia exitosamente
And B intenta transferir custodia con la versión anterior
Then el sistema responde HTTP 409 con la versión actual
And la UI de B preserva su contexto, informa que el registro cambió
And ofrece la opción de recargar antes de reintentar
And no sobreescribe silenciosamente
```

**AC-EW-005 — Aislamiento de tenant**
```gherkin
Given un usuario del tenant Hospital-A
When intenta acceder a un expediente que pertenece a Hospital-B
Then el sistema responde 404 (o 403 según política de exposición)
And no se revela la existencia del expediente en el otro tenant
```

**AC-EW-006 — Tab Auditoría restringida**
```gherkin
Given un archivista sin permiso de auditoría
When abre el Workspace
Then el tab "Auditoría" no es visible o está deshabilitado
Given un auditor autorizado
When abre el tab Auditoría del mismo expediente
Then ve los registros de audit log del expediente
And estos registros son distintos del historial operativo de Movimientos
```

**AC-EW-007 — Movimientos ≠ Audit**
```gherkin
Given un expediente con historial de movimientos y registros de audit
When el archivista abre el tab Movimientos
Then solo ve la trayectoria física/operativa (Archivo→Preparación, Preparación→Consultorio, etc.)
And NO ve eventos técnicos de login, configuración o cambios de permisos
```

**AC-EW-008 — Privacidad en URL y toasts**
```gherkin
Given cualquier usuario en el Workspace
When se muestra una notificación de éxito o error
Then la notificación no contiene datos C3 (nombre completo, número de expediente en texto plano)
And el título del navegador no revela datos del paciente
```

**AC-EW-009 — Navegación por teclado**
```gherkin
Given un usuario navegando con teclado únicamente
When accede al Expediente Workspace
Then puede navegar entre tabs con Tab/flechas
And puede activar comandos de la barra con Enter/Space
And el foco es siempre visible
```

---

## 6. Preguntas abiertas (Open Questions)

Las siguientes preguntas provienen del SDB y no pueden resolverse unilateralmente.
Deben ser validadas por el equipo antes de avanzar a implementación.

| ID | Pregunta | Fuente SDB | Impacto en spec |
|----|----------|------------|-----------------|
| OQ-EW-001 | ¿Cuál es el formato exacto y regex del identificador de expediente? | OQ-DAT-001, OQ-SPEC-009, OQ-DOM-010 | REQ-EW-001/002 — validación de búsqueda |
| OQ-EW-002 | ¿Cuál es el campo mínimo de referencia de paciente permitido en el Workspace? | OQ-SPEC-012, SEC-003, INT-009 | REQ-EW-001/011 — qué mostrar en header |
| OQ-EW-003 | ¿Cuáles roles exactos tienen acceso al tab Auditoría? | OQ-UX-008, SEC-038 | REQ-EW-010, AC-EW-006 |
| OQ-EW-004 | ¿Cuándo exactamente una NoLocalización abre automáticamente una Incidencia? | OQ-DOM-006, DDD-029 | REQ-EW-007; lógica del command MarkNotLocated |
| OQ-EW-005 | ¿Qué permisos adicionales requiere abrir un préstamo según tipo de solicitud? | OQ-SPEC-001, OQ-SPEC-003, PERM-MATRIX `*` | REQ-EW-009 — comandos habilitados |
| OQ-EW-006 | ¿La aceptación de custodia requiere confirmación digital del receptor? | OQ-SPEC-011 | REQ-EW-009 — flujo TransferCustody |
| OQ-EW-007 | ¿TOMO es unidad independiente administrada en el mismo Workspace? | OQ-DOM-005, OQ-SPEC-006 | Alcance del workspace; posible extensión |
| OQ-EW-008 | ¿Qué ubicaciones temporales son oficiales (carrito, recepción, zona de preparación)? | OQ-DOM-009, DDD-019 | REQ-EW-003 — codificación de ubicación |
| OQ-EW-009 | ¿El workspace soporta lectora de código de barras en MVP? | OQ-UX-003 | REQ-EW-002 — mecanismo de búsqueda |
| OQ-EW-010 | ¿Cuál es la política exacta de retención de MovimientoExpediente para el timeline? | OQ-DAT-005, OQ-API-006 | REQ-EW-008 — ventana de historial |
