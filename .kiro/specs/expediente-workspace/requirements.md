---
spec: expediente-workspace
version: "0.3.3"
status: "Draft — pending stakeholder validation"
date: "2026-08-15"
sdb_sources:
  - "Volume-02 / BIZ-006 (BR-016–019), BIZ-007, BIZ-008, BIZ-010, BIZ-016"
  - "Volume-03 / DDD-007, DDD-009–013, DDD-018–020"
  - "Volume-05 / UC-018, SPEC-009, SPEC-006, SDD-005, SDD-006, PERM-MATRIX"
  - "Volume-07 / SEC-003, SEC-017, SEC-018, SEC-032, SEC-038"
  - "Volume-08 / DAT-006, DAT-011, DAT-012, DAT-019, API-001, API-011, DAT-016"
  - "Volume-09 / APP-003, IA-005, DS-014, INT-001–INT-009"
  - "Volume-10 / TQ-002, TQ-007, TQ-009, TQ-010"
  - "Volume-12 / OS-004–OS-018"
decisions_applied:
  - "OQ-EW-001 RESOLVED — DECISION-REGISTER"
  - "OQ-EW-005 RESOLVED — DECISION-REGISTER"
  - "OQ-EW-006 RESOLVED — DECISION-REGISTER"
  - "OQ-EW-007 RESOLVED — DECISION-REGISTER"
  - "DEC-EW-STATE-001 ACCEPTED — DECISION-REGISTER"
  - "AUTHORIZATION-DECISION APPROVED"
  - "READ-MODEL-COMPOSITION-DECISION APPROVED"
  - "OQ-EW-DESIGN-004 RESOLVED"
  - "READ-EW-008..012 APPROVED"
  - "AUTH-EW-006/007 APPROVED"
---

# Expediente Workspace — Requirements

> **Principio rector (SDB APP-003):** La pantalla responde exactamente tres preguntas:
> _¿Dónde está el expediente? ¿Quién lo tiene? ¿Qué puedo hacer con él ahora mismo?_

---

## 1. Contexto y alcance

El **Expediente Workspace** es la pantalla central de operación de SIGAC.
Consolida la situación operativa actual y las acciones disponibles según el estado
del aggregate, el rol del usuario y el contexto del negocio.

**Fuente de dominio:** Aggregate Expediente (DDD-013).
**Spec de consulta:** SPEC-009 / UC-018.
**Pantalla UI:** APP-003 (Volume 09).

### 1.1 Alcance incluido

| # | Capacidad |
|---|-----------|
| A | Recuperar y mostrar la situación operativa actual del Expediente |
| B | Mostrar ubicación actual (DDD-019) |
| C | Mostrar custodia actual — distinguir EN_TRASLADO (sin aceptar) de EN_CONSULTA (custodia aceptada) |
| D | Mostrar préstamo activo si existe (DDD-015) |
| E | Mostrar solicitud activa si existe (DDD-014) |
| F | Mostrar incidencias abiertas si existen (DDD-017) |
| G | Mostrar historial de movimientos operativos (DDD-020) |
| H | Exponer barra de comandos según estado/rol/contexto/FuenteHabilitanteSalida (DS-014) |
| I | Mostrar tab de Auditoría a roles autorizados (SEC-038, INT-008) |
| J | Manejar concurrencia optimista y conflictos de estado (DAT-019) |
| K | Buscar expediente por número con resultado 0..N y desambiguación si N > 1 |
| L | Registrar despacho (DispatchExpediente) y aceptación de custodia (AcceptCustody) |

### 1.2 Non-goals explícitos

- No muestra ni almacena diagnósticos, notas clínicas, tratamientos ni estudios.
- No autoriza ni deniega acceso clínico al contenido del expediente.
- No reemplaza la agenda; la importa como dependencia (SPEC-008).
- No implementa TOMO como unidad administrable independiente (OQ-DOM-005 abierta).

---

## 2. Actores

| Actor | Descripción | Fuente |
|-------|-------------|--------|
| **Archivista** | Operador de Archivo Clínico; búsqueda, despacho, custodia, préstamo, devolución, rearchivo | PERM-MATRIX, INT-002 |
| **Jefatura de Archivo** | Supervisor; mismas acciones que Archivista + autorizaciones adicionales | PERM-MATRIX |
| **Receptor de Servicio** | Personal de servicio/consultorio; ejecuta AcceptCustody en destino | PERM-MATRIX, BIZ-008 |
| **Director / Subdirector / Coordinación Médica** | Actores facultados para emitir VALE_ARCHIVO_SM_1_14 | BIZ-010, BIZ-016 |
| **Auditor** | Acceso de lectura; puede ver tab Auditoría | INT-002, SEC-038 |
| **Administrador TI** | Sin acceso funcional; configuración de sistema | PERM-MATRIX |

> **Nota (SEC-017):** La autorización final es la tupla
> `sujeto + permiso + tenant + recurso + contexto de negocio + fuente habilitante`.
> La matriz UI (INT-002) es orientativa; RBAC/ABAC del Volume 07 es autoridad.

---

## 3. Requisitos funcionales

### REQ-EW-001 — Recuperar Expediente por identificador interno
- **Actor:** Cualquier usuario con permiso EXPEDIENT_VIEW en el tenant activo.
- **Precondición:** Usuario autenticado; TenantContext resuelto server-side (API-005).
- **Acción:** El sistema recibe ExpedienteId (UUID) y devuelve el read model.
- **Resultado:** EstadoOperativo, ubicación, custodia, préstamo activo, solicitud activa,
  incidencias abiertas, capabilities[].
- **Fuente SDB:** UC-018, SPEC-009 FR-VIEW-001..006, API-011.
- **Invariantes:** INV-EXP-001, INV-EXP-002, INV-EXP-004.
- **Composición (READ-EW-001..012):** `GetExpediente` compone server-side un único
  `ExpedienteReadModel`. El frontend no orquesta Préstamo, Solicitud e Incidencia.
- **Cardinalidades:** `prestamoActivo` 0..1 (`null` si no existe), `solicitudActiva`
  0..1 (`null` si no existe), `incidenciasAbiertas` 0..N (`[]` si no existen).
- **Tenant:** cada query port recibe obligatoriamente `ExpedienteId` y `TenantContext`.
- **Fuente habilitante disponible:** `GetExpediente` consulta internamente
  `ExitEnablingSourceQueryPort.findAvailableByExpediente(id, tenant)` ->
  `readonly FuenteHabilitanteSalidaContext[]` (`0..N`; ausencia `[]`). Su input público
  permanece `expedienteId + actor + tenant`.

### REQ-EW-001A — Contratos de proyección del Workspace
- **Ownership:** Application de Expediente Workspace es propietario consumidor de
  `ActiveLoanQueryPort`, `ActiveRequestQueryPort` y `OpenIncidentsQueryPort`.
- **Boundary:** los módulos de Préstamo, Solicitud e Incidencia conservan sus aggregates
  y reglas; los puertos retornan summaries, nunca aggregates completos.
- **Contrato Solicitud activa:** `solicitudId`, `tipo`, `origen`, `estado`,
  `asignadoA` nullable; estados canónicos existentes únicamente.
- **Contrato Préstamo activo:** `prestamoId`, `finalidad`, `custodioRef`, `destinoTipo`,
  `destinoRef`, `dueAt`, `fuenteHabilitanteSalida`, `estado` (`Activo|Vencido`).
- **Contrato Incidencias abiertas:** `incidenciaId`, `tipo`, `severidad`, `estado`,
  `resumen`, `asignadoA` nullable, `openedAt`; estado exclusivamente
  `Abierta|EnInvestigacion|Escalada` (`Resuelta` no es abierta).
- **Regla:** `NO_LOCALIZADO` no crea automáticamente una Incidencia; OQ-EW-004 sigue abierta.
- **Contrato de fuente:** `FuenteHabilitanteSalidaContext` contiene exclusivamente
  `tipo: FuenteHabilitanteSalida` y `validada: boolean`. El provider determina
  `validada`; CapabilityService no inspecciona evidencia.

### REQ-EW-002 — Búsqueda por número de expediente (0..N resultados)
- **Actor:** Archivista, Jefatura.
- **Precondición:** Usuario con EXPEDIENT_VIEW.
- **Formato del número (OQ-EW-001 RESOLVED):** patron RFC_BASE_10 + SEP + COD_2.
  Ejemplo: PERR810604/10. Separadores aceptados: /, - o sin separador.
  Representación preferente con /.
- **Acción:** GET /api/v1/expedientes?numero={n} — el sistema normaliza antes de buscar.
- **Resultado:**
  - N = 0: estado vacío descriptivo; HTTP 200 colección vacía; sin revelar otros tenants.
  - N = 1: apertura directa del workspace.
  - N > 1: lista con nombre, CURP, número ISSSTE para desambiguación manual.
    NUNCA se selecciona automáticamente.
- **Regla (BR-017, INV-EXP-003):** expedienteNumero no es único globalmente.
  La identidad técnica es ExpedienteId UUID.
- **Fuente SDB:** SPEC-009 FR-VIEW-001, API-011, DAT-016, BIZ-016/017,
  DECISION-REGISTER OQ-EW-001, OQ-EW-007.

### REQ-EW-003 — Mostrar ubicación actual
- **Resultado:** Ubicación actual visible (anaquel, zona temporal, consultorio, servicio).
- **Fuente SDB:** SPEC-009 FR-VIEW-003, DDD-019, DAT-006.
- **OQ no-bloqueante:** OQ-EW-008 — codificación exacta de ubicaciones temporales.

### REQ-EW-004 — Mostrar custodia con distinción traslado/aceptada
- **Resultado:**
  - EstadoOperativo = EN_TRASLADO: custodio de traslado visible; acceptedAt = null.
  - EstadoOperativo = EN_CONSULTA: receptor que aceptó visible; acceptedAt con timestamp.
- **Regla (DDD-018, OQ-EW-006 RESOLVED):** Transporte != custodia aceptada.
  ExpedienteDispatched y CustodyAccepted son eventos distintos.
- **Fuente SDB:** SPEC-009 FR-VIEW-004, DDD-018, BIZ-008, DECISION-REGISTER OQ-EW-006.

### REQ-EW-005 — Mostrar préstamo activo
- **Precondición:** Expediente con préstamo Activo o Vencido.
- **Resultado:** Finalidad, custodio, destino, fecha límite, FuenteHabilitanteSalida, estado.
- **Fuente SDB:** SPEC-009 FR-VIEW-005, DDD-015, API-011.

### REQ-EW-006 — Mostrar solicitud activa
- **Resultado:** Tipo, origen, estado actual, asignado de la solicitud activa.
- **Fuente SDB:** UC-018 read model, DDD-014, V05-41.

### REQ-EW-007 — Mostrar incidencias abiertas
- **Resultado:** Indicador en header + listado en tab Incidencias.
- **Regla (INV-INC-002, BR-004):** NO_LOCALIZADO != EXTRAVIADO.
  La transición a EXTRAVIADO requiere proceso formal con autorización.
- **Fuente SDB:** SPEC-009 FR-VIEW-006, DDD-017, BIZ-006 BR-004.
- **OQ no-bloqueante:** OQ-EW-004 — cuándo MarkNotLocated abre Incidencia automáticamente.

### REQ-EW-008 — Mostrar historial de movimientos
- **Actor:** Archivista, Jefatura (acceso pleno); Auditor (lectura).
- **Resultado:** Tab Movimientos con trayectoria física/operativa cronológica.
  Incluye ExpedienteDispatched y CustodyAccepted.
- **Regla:** MovimientoExpediente != audit_log. No mezclar con eventos técnicos.
- **Fuente SDB:** SPEC-009 FR-VIEW-007, DDD-020, DAT-011, API-011.

### REQ-EW-009 — Barra de comandos contextual
- **Resultado:** Solo comandos válidos para EstadoOperativo, rol y FuenteHabilitanteSalida.
- **Regla:** Comandos derivados de capabilities[] del API; no calculados en frontend.

`Role != Permission != Capability != Command`. `capabilities[]` contiene comandos
operativos; `EXPEDIENT_VIEW` no es una capability.

| Capability | Permission |
|---|---|
| SOLICITAR | REQUEST_CREATE |
| INICIAR_BUSQUEDA | SEARCH_START |
| MARCAR_LOCALIZADO | SEARCH_MARK_LOCATED |
| MARCAR_NO_LOCALIZADO | SEARCH_MARK_NOT_LOCATED |
| DISPATCH | EXPEDIENT_DISPATCH |
| ACCEPT_CUSTODY | CUSTODY_ACCEPT |
| ABRIR_PRESTAMO | LOAN_OPEN |
| RENOVAR_PRESTAMO | LOAN_RENEW |
| RECIBIR_DEVOLUCION | RETURN_RECEIVE |
| CONFIRMAR_REARCHIVO | REARCHIVE_CONFIRM |
| REPORTAR_INCIDENCIA | INCIDENT_OPEN |

| EstadoOperativo | Comandos candidatos |
|-----------------|---------------------|
| DISPONIBLE sin solicitud activa | Solicitar |
| Solicitud Asignada | Iniciar búsqueda |
| Solicitud EnBusqueda | Marcar localizado, Marcar no localizado |
| APARTADO | Despachar (DISPATCH) |
| EN_TRASLADO | — (esperando AcceptCustody por receptor) |
| DISPONIBLE sin préstamo activo | Abrir préstamo (si FuenteHabilitanteSalida válida) |
| Préstamo Activo | Renovar préstamo, Recibir devolución |
| Devolución recibida | Confirmar rearchivo |
| Cualquier estado | Reportar incidencia |

- **Fuente SDB:** DS-014, DDD-010, DDD-012, BIZ-016, DECISION-REGISTER OQ-EW-005.

### REQ-EW-010 — Abrir préstamo según FuenteHabilitanteSalida
- **Precondición:** Expediente en estado compatible; actor con permiso; fuente válida.
- **Regla (BIZ-010, OQ-EW-005 RESOLVED):**
  - CONSULTA_PROGRAMADA: Archivista/Jefatura; sin autorización individual adicional.
  - VALE_ARCHIVO_SM_1_14: DIRECCION o COORDINACION_MEDICA emite/autoriza;
    ARCHIVISTA o ARCHIVO_JEFE ejecuta con fuente previamente validada; emitir no
    concede LOAN_OPEN; plazo máx. 24 h; si se necesita más tiempo se genera nuevo préstamo.
  - ORDEN_SUPERIOR: fuente reconocida, pero no habilita ABRIR_PRESTAMO en este slice.
- **Resultado:** Préstamo abierto con FuenteHabilitanteSalida registrada.
- **Capability (AUTH-EW-006/007):** además de permission, rol, estado y ausencia de
  préstamo activo, `ABRIR_PRESTAMO` requiere que la colección disponible contenga al
  menos una fuente con `validada=true` y tipo `CONSULTA_PROGRAMADA` o
  `VALE_ARCHIVO_SM_1_14`. `ORDEN_SUPERIOR` nunca habilita en esta spec, incluso validada.
- **Separación:** CapabilityService no elige fuente. `OpenLoan` selecciona y registra la
  fuente concreta.
- **Fuente SDB:** UC-010, SPEC-006 FR-LOAN-001/007, BIZ-010, DECISION-REGISTER OQ-EW-005.

### REQ-EW-011 — Despacho de expediente
- **Actor:** Archivista, Jefatura.
- **Precondición:** Expediente APARTADO; destino autorizado.
- **Resultado:** ExpedienteDispatched emitido; EstadoOperativo → EN_TRASLADO.
  Custodia sigue siendo de Archivo hasta CustodyAccepted.
- **Fuente SDB:** WF-005 Fase 1, DDD-010, DDD-011, BIZ-008, DECISION-REGISTER OQ-EW-006.

### REQ-EW-012 — Aceptación de custodia en destino
- **Actor:** Receptor de Servicio autenticado (Enfermería o médico/solicitante).
- **Precondición:** Expediente EN_TRASLADO.
- **Resultado:** CustodyAccepted emitido; EstadoOperativo → EN_CONSULTA;
  custodiaActual.acceptedAt establecido. Acción auditable; sin firma criptográfica.
- **Fuente SDB:** WF-005 Fase 3, DDD-018, BIZ-008, DECISION-REGISTER OQ-EW-006.

### REQ-EW-013 — Tab Auditoría (acceso restringido)
- **Precondición:** permiso de auditoría pendiente de definición bajo OQ-EW-003;
  se evalúa fuera de capabilities[] operativas.
- **Resultado:** Registros de audit_log separados del tab Movimientos.
- **Fuente SDB:** SEC-038, INT-008.
- **OQ no-bloqueante:** OQ-EW-003 — roles exactos con acceso.

### REQ-EW-014 — Privacidad en presentación
- **Resultado:** Solo referencia mínima de paciente para la tarea. Sin datos clínicos.
- **Regla:** Datos C3 no en URL, título de ventana, toasts ni exports.
- **Fuente SDB:** SEC-003, INT-009.
- **OQ no-bloqueante:** OQ-EW-002 — campo exacto de pacienteRef.displayLabel.

### REQ-EW-015 — Manejo de concurrencia y conflictos
- **Resultado:** Al recibir HTTP 409, preservar contexto, informar conflicto,
  ofrecer recarga. Sin sobreescritura silenciosa.
- **Acciones críticas:** DispatchExpediente, AcceptCustody, TransferCustody,
  OpenLoan, CloseLoan, ResolveIncident, transiciones de Solicitud.
- **Fuente SDB:** DAT-019, INT-006, API-006.

### REQ-EW-016 — Aislamiento multi-tenant
- **Resultado:** Solo opera sobre expedientes del tenant resuelto server-side.
  Ningún valor de tenant proviene del body.
- **Fuente SDB:** SEC-032, API-005, AGENTS.md (non-negotiable).

### REQ-EW-017 — Accesibilidad y navegación por teclado
- **Resultado:** Todos los comandos y tabs alcanzables con teclado; foco visible; ARIA.
- **Fuente SDB:** DEL-005, Volume-09 §07.

---

## 4. Requisitos no funcionales

| ID | Atributo | Requisito | Fuente SDB |
|----|----------|-----------|------------|
| NFR-EW-001 | Rendimiento | Read model completo responde en <= 1 s bajo carga operativa normal | UC-018 |
| NFR-EW-002 | Seguridad | Backend re-verifica autorización completa (incl. FuenteHabilitanteSalida) en cada petición | SEC-017, AGENTS.md |
| NFR-EW-003 | Audit | Toda acción registra actor, tenant, recurso, resultado y timestamp (append-only) | SEC-038, DAT-012 |
| NFR-EW-004 | Aislamiento | Ningún query puede cruzar tenant | SEC-032, TQ-007 |
| NFR-EW-005 | Privacidad | Datos C3 no aparecen en logs ni telemetría | SEC-003, INT-009 |
| NFR-EW-006 | Concurrencia | Transiciones críticas usan row_version; conflicto → HTTP 409 | DAT-019 |

### NFR-EW-007 — Audit append-only desde Application

Los Use Cases del Workspace consumen `AuditWriter`; el controller no escribe audit. El
puerto recibe `AuditRecord` y `TenantContext`, sólo permite append y conserva los campos
DAT-012/SEC-038. Para `GetExpediente`, acción `EXPEDIENTE_VIEW`, recurso `EXPEDIENTE` y
resultado `success|denied|not-found`. No se registran datos C3.

---

## 5. Criterios de aceptación

**AC-EW-001 — Apertura básica**
```gherkin
Given un archivista autenticado en el tenant correcto
When navega al Expediente Workspace de un expediente existente
Then el header muestra numero, referencia mínima de paciente,
     EstadoOperativo (uno de los 6 valores aceptados), ubicación y custodio
And el contenido está visible above the fold
And no se muestra ningún dato clínico
```

**AC-EW-002 — Búsqueda: variantes de separador**
```gherkin
Given un archivista con EXPEDIENT_VIEW
When busca por "PERR810604/10"
Then el workspace se abre directamente (N=1)

When busca por "PERR810604-10"
Then el sistema normaliza y retorna el mismo expediente

When busca por "PERR81060410"
Then el sistema normaliza y retorna el mismo expediente
```

**AC-EW-003 — Búsqueda: múltiples coincidencias**
```gherkin
Given un número con dos derechohabientes del mismo tipo
When el archivista busca
Then aparece lista de desambiguación con nombre, CURP y número ISSSTE
And ningún expediente se abre automáticamente
```

**AC-EW-004 — Búsqueda: sin resultado**
```gherkin
Given un número inexistente en el tenant
When el archivista busca
Then estado vacío descriptivo visible
And respuesta HTTP 200 con colección vacía
And no se revela información de otros tenants
```

**AC-EW-005 — EN_TRASLADO vs EN_CONSULTA**
```gherkin
Given un expediente despachado (DispatchExpediente ejecutado)
When el archivista abre el Workspace
Then EstadoOperativo = EN_TRASLADO
And custodiaActual.acceptedAt es null

Given el mismo expediente tras AcceptCustody
When el archivista abre el Workspace
Then EstadoOperativo = EN_CONSULTA
And custodiaActual.acceptedAt tiene timestamp válido
```

**AC-EW-006 — EN_BUSQUEDA no aparece en el Expediente**
```gherkin
Given expediente con solicitud en estado EnBusqueda
When el archivista abre el Workspace del expediente
Then EstadoOperativo del expediente NO es EN_BUSQUEDA
And la solicitud activa muestra su propio estado EnBusqueda
```

**AC-EW-007 — NO_LOCALIZADO no implica EXTRAVIADO**
```gherkin
Given un expediente en estado NO_LOCALIZADO
When el archivista abre el Workspace
Then EstadoOperativo = NO_LOCALIZADO
And no existe indicador automático de EXTRAVIADO
And la transición a EXTRAVIADO solo aparece si capabilities la incluye
```

**AC-EW-008 — Préstamo CONSULTA_PROGRAMADA**
```gherkin
Given archivista con permiso y FuenteHabilitanteSalida = CONSULTA_PROGRAMADA
When ejecuta Abrir préstamo
Then el préstamo se abre exitosamente
And no se requiere autorización de Director/Coordinación
```

**AC-EW-009 — Préstamo SM 1-14: actor incorrecto**
```gherkin
Given un archivista con LOAN_OPEN
And FuenteHabilitanteSalida = VALE_ARCHIVO_SM_1_14 no validada
When intenta abrir el préstamo
Then el sistema rechaza con error de autorización
And la UI muestra mensaje claro sin datos clínicos
```

**AC-EW-010 — Préstamo SM 1-14: actor correcto**
```gherkin
Given un vale SM 1-14 emitido/autorizado por DIRECCION o COORDINACION_MEDICA
And un ARCHIVISTA o ARCHIVO_JEFE con LOAN_OPEN
And FuenteHabilitanteSalida = VALE_ARCHIVO_SM_1_14 previamente validada
When abre el préstamo
Then préstamo creado con plazo máximo 24 horas
And referencia del formato SM 1-14 registrada
```

**AC-EW-011 — Capabilities según estado**
```gherkin
Given expediente DISPONIBLE sin solicitud activa
When archivista abre el Workspace
Then capability SOLICITAR disponible
And DISPATCH no disponible

Given expediente APARTADO
When archivista abre el Workspace
Then capability DISPATCH disponible
```

**AC-EW-012 — Conflicto de concurrencia**
```gherkin
Given archivista A y B abren el mismo Expediente
When A despacha exitosamente
And B intenta despachar con versión anterior
Then sistema responde HTTP 409 con versión actual
And UI de B preserva contexto, informa conflicto
And ofrece opción de recargar
```

**AC-EW-013 — Tenant isolation**
```gherkin
Given usuario del tenant Hospital-A
When intenta acceder a expediente de Hospital-B
Then sistema responde 404
And no revela existencia del expediente en otro tenant
```

**AC-EW-014 — Tab Auditoría restringida**
```gherkin
Given archivista sin permiso de auditoría
When abre el Workspace
Then tab Auditoría no visible

Given auditor autorizado
When abre tab Auditoría
Then ve registros de audit_log distintos de Movimientos
```

**AC-EW-015 — Movimientos != Audit**
```gherkin
Given expediente con historial de movimientos
When archivista abre tab Movimientos
Then ve solo trayectoria física/operativa
And NO ve eventos técnicos de login/configuración/permisos
```

**AC-EW-016 — Privacidad**
```gherkin
Given cualquier usuario en el Workspace
When se muestra notificación o título del navegador
Then no contienen datos C3
```

**AC-EW-017 — Navegación por teclado**
```gherkin
Given usuario con teclado únicamente
When accede al Workspace
Then navega tabs con Tab/flechas
And activa comandos con Enter/Space
And foco siempre visible
```

---

## 6. Open Questions

### Bloqueantes para implementación

Ninguna. OQ-EW-001, OQ-EW-005, OQ-EW-006 y OQ-EW-007 están RESUELTAS.

### No bloqueantes (decisión provisional disponible)

| ID | Pregunta | Fuente SDB | Impacto | Decisión provisional |
|----|----------|------------|---------|----------------------|
| OQ-EW-002 | Campo mínimo de pacienteRef.displayLabel en header | OQ-SPEC-012, SEC-003 | REQ-EW-014 | Nombre corto operativo hasta resolución |
| OQ-EW-003 | Permiso exacto del tab Auditoría | OQ-UX-008, SEC-038 | REQ-EW-013 | Fuera de capabilities[] operativas; no bloquea T-04 |
| OQ-EW-004 | MarkNotLocated abre Incidencia en qué condiciones | OQ-DOM-006, INV-INC-002 | REQ-EW-007 | No automático; acción explícita hasta resolución |
| OQ-EW-008 | Codificación exacta de ubicaciones temporales | OQ-DOM-009 | REQ-EW-003 | Categoría genérica hasta confirmación de Archivo |
| OQ-EW-009 | Barcode scanner en MVP | OQ-UX-003 | REQ-EW-002 | Búsqueda manual; scanner en iteración posterior |
| OQ-EW-010 | Política de retención de MovimientoExpediente | OQ-DAT-005, OQ-API-006 | REQ-EW-008 | Sin límite; paginación con limit hasta resolución |

---

## 7. Implementation Readiness

```yaml
spec_version: "0.3.3"
blocking_open_questions: []
non_blocking_open_questions:
  - OQ-EW-002
  - OQ-EW-003
  - OQ-EW-004
  - OQ-EW-008
  - OQ-EW-009
  - OQ-EW-010
contradictions_found: []
implementation_ready: true
```
