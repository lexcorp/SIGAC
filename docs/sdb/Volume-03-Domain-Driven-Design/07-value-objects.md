---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-001, OQ-EW-005, DEC-EW-STATE-001"
---
# DDD-007 — Value Objects

## Catálogo

| VO | Notas |
|----|-------|
| `ExpedienteNumero` | Ver detalle abajo (OQ-EW-001 RESOLVED) |
| `ExpedienteId` | UUID interno, identidad técnica primaria |
| `PatientReference` | Referencia mínima: id, CURP, nombre operativo, número ISSSTE |
| `HospitalId` | Identificador del hospital/tenant |
| `TenantId` | Identificador del tenant de plataforma |
| `LocationCode` | Código de ubicación física configurable por Archivo |
| `Ubicacion` | id, código, descripción, tipo |
| `Custodia` | custodianType, custodianReference, service, location, acceptedAt |
| `FuenteHabilitanteSalida` | Ver detalle abajo (OQ-EW-005 RESOLVED) |
| `EstadoOperativoExpediente` | Enum de 6 valores; ver DDD-012 (DEC-EW-STATE-001) |
| `FechaHora` | Timestamp UTC |
| `PeriodoPrestamo` | opened_at, due_at, política aplicable |
| `MotivoSolicitud` | Texto con propósito de la solicitud |
| `TipoSolicitud` | Tipo de solicitud (programada / extraordinaria / etc.) |
| `Prioridad` | Nivel de prioridad operativa |
| `EstadoSolicitud` | Pendiente, Asignada, EnBusqueda, Localizada, Preparada, Entregada, Cancelada, NoLocalizada |
| `EstadoPrestamo` | Activo, Vencido, Renovado, Devuelto, Cerrado |
| `EstadoIncidencia` | Abierta, EnInvestigacion, Escalada, Resuelta |
| `AgendaFingerprint` | Hash de importación para idempotencia |

---

## ExpedienteNumero — detalle (OQ-EW-001 RESOLVED)

**Patrón:** `<RFC_BASE_10><SEPARADOR><CODIGO_DERECHOHABIENTE_2>`

**Ejemplo anonimizado:** `PERR810604/10`

**Componentes:**
- `rfcBase`: 10 caracteres del RFC sin homoclave.
- `separador`: `/` (preferente), `-`, o ausente.
- `codigoDerechohabiente`: código de 2 dígitos del catálogo operativo.

**Catálogo operativo (SRC-INT-002):**

| Código | Tipo |
|--------|------|
| 10 | Trabajador |
| 20 | Trabajadora |
| 30 | Esposa |
| 40 | Concubina |
| 50 | Padre o Abuelo |
| 60 | Madre o Abuela |
| 70 | Hijo |
| 80 | Hija |
| 90 | Pensionado |

**Reglas de negocio:**
- `ExpedienteNumero` se conserva tal como viene de la institución; SIGAC no lo sustituye.
- La representación preferente de presentación usa `/` como separador.
- Para búsqueda y normalización interna se aceptan las tres variantes de separador.
- `expedienteNumero` **no** es identidad técnica primaria; `ExpedienteId` (UUID) lo es.
- No declarar `UNIQUE(expediente_numero)` sin perfilar los datos reales de SIMEF
  (OQ-EW-007 RESOLVED — pueden existir múltiples expedientes con el mismo número).

**Fuente:** SRC-INT-002, DECISION-REGISTER OQ-EW-001.

---

## FuenteHabilitanteSalida — detalle (OQ-EW-005 RESOLVED)

Valor semántico que acompaña a `OpenLoan` / salida de un expediente.
Determina la política de autorización aplicable.

| Valor | Descripción |
|-------|-------------|
| `CONSULTA_PROGRAMADA` | Flujo normal; habilitada por agenda; sin autorización individual adicional |
| `VALE_ARCHIVO_SM_1_14` | Solicitud extraordinaria; formato SM 1-14; Director/Subdirector/Coord. Médica; 24 h máx. |
| `ORDEN_SUPERIOR` | Fuente válida reconocida; detalles fuera de este slice |

**Fuente:** SRC-INT-003, DECISION-REGISTER OQ-EW-005.
