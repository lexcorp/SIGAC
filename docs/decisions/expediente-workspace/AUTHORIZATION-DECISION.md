# Authorization Decision — Expediente Workspace

**Estado:** APPROVED  
**Fecha:** 2026-08-15  
**Scope:** Expediente Workspace v0.3.3 / T-04

## Separación de conceptos

`Role != Permission != Capability != Command`.

- Role identifica una función RBAC del actor.
- Permission autoriza una clase de acción.
- Capability es un comando operativo que la UI puede ofrecer en el contexto actual.
- Command es una intención de dominio/aplicación y no hereda automáticamente el nombre
  de una permission o capability.

`capabilities[]` contiene exclusivamente comandos operativos. `EXPEDIENT_VIEW` es una
permission de lectura y no es una capability.

## ActorContext y tenant

`ActorContext` conserva `actorId`, `permissions` y `tenantIds`, y se amplía con `roles`.

Roles canónicos del slice:

```text
ARCHIVISTA
ARCHIVO_JEFE
DIRECCION
COORDINACION_MEDICA
RECEPTOR_SERVICIO
AUDITOR_CONSULTA
ADMIN_TECNICO
TRASLADO
```

No se crean roles separados `SUBDIRECTOR`, `ENFERMERIA` ni `MEDICO_RECEPTOR` en este slice.
La validación actor -> tenant ocurre server-side antes de `ExpedienteCapabilityService`.
El servicio recibe `ActorContext` y `TenantContext` ya validados y no resuelve tenant.

## Capability -> Permission

| Capability | Permission |
|---|---|
| `SOLICITAR` | `REQUEST_CREATE` |
| `INICIAR_BUSQUEDA` | `SEARCH_START` |
| `MARCAR_LOCALIZADO` | `SEARCH_MARK_LOCATED` |
| `MARCAR_NO_LOCALIZADO` | `SEARCH_MARK_NOT_LOCATED` |
| `DISPATCH` | `EXPEDIENT_DISPATCH` |
| `ACCEPT_CUSTODY` | `CUSTODY_ACCEPT` |
| `ABRIR_PRESTAMO` | `LOAN_OPEN` |
| `RENOVAR_PRESTAMO` | `LOAN_RENEW` |
| `RECIBIR_DEVOLUCION` | `RETURN_RECEIVE` |
| `CONFIRMAR_REARCHIVO` | `REARCHIVE_CONFIRM` |
| `REPORTAR_INCIDENCIA` | `INCIDENT_OPEN` |

`EXPEDIENT_DISPATCH` y `CUSTODY_ACCEPT` son permissions canónicas.
`INICIAR_BUSQUEDA`, `MARCAR_LOCALIZADO` y `MARCAR_NO_LOCALIZADO` son capabilities canónicas.

## Asignación mínima del Workspace

| Role | Permissions mínimas aprobadas |
|---|---|
| `ARCHIVISTA` | `EXPEDIENT_VIEW`, `REQUEST_CREATE`, `SEARCH_START`, `SEARCH_MARK_LOCATED`, `SEARCH_MARK_NOT_LOCATED`, `EXPEDIENT_DISPATCH`, `LOAN_OPEN`, `LOAN_RENEW`, `RETURN_RECEIVE`, `REARCHIVE_CONFIRM`, `INCIDENT_OPEN` |
| `ARCHIVO_JEFE` | Las mismas permissions operativas de `ARCHIVISTA` |
| `DIRECCION` | `EXPEDIENT_VIEW` |
| `COORDINACION_MEDICA` | `EXPEDIENT_VIEW` |
| `RECEPTOR_SERVICIO` | `EXPEDIENT_VIEW` cuando el contexto lo requiera; `CUSTODY_ACCEPT` |
| `AUDITOR_CONSULTA` | `EXPEDIENT_VIEW`; operational `capabilities: []` |
| `ADMIN_TECNICO` | `ADMIN_CONFIGURE`; sin `EXPEDIENT_VIEW` automático |
| `TRASLADO` | Sin `CUSTODY_ACCEPT`; sin `LOAN_OPEN` |

El permiso exacto del tab Auditoría permanece bajo OQ-EW-003 y no bloquea T-04.

## Contexto operativo canónico para capabilities

Se usan únicamente estados existentes del SDB:

- Solicitud: `Pendiente`, `Asignada`, `EnBusqueda`, `Localizada`, `Preparada`,
  `Entregada`, `Cancelada`, `NoLocalizada`.
- Préstamo: `Activo`, `Vencido`, `Renovado`, `Devuelto`, `Cerrado`.

Reglas del Workspace:

- `SOLICITAR`: Expediente `DISPONIBLE` sin Solicitud activa.
- `INICIAR_BUSQUEDA`: Solicitud activa `Asignada`.
- `MARCAR_LOCALIZADO` y `MARCAR_NO_LOCALIZADO`: Solicitud activa `EnBusqueda`.
- `DISPATCH`: Expediente `APARTADO`.
- `ACCEPT_CUSTODY`: Expediente `EN_TRASLADO`.
- `ABRIR_PRESTAMO`: Expediente `DISPONIBLE`, sin Préstamo activo y con fuente
  habilitante aplicable.
- `RENOVAR_PRESTAMO`: Préstamo `Activo`, sujeto a permission y contexto.
- `RECIBIR_DEVOLUCION`: Préstamo `Activo` o `Vencido`.
- `CONFIRMAR_REARCHIVO`: Préstamo `Devuelto` y devolución/verificación completadas.
- `REPORTAR_INCIDENCIA`: cualquier EstadoOperativo, sujeto a permission.

## SM 1-14 y fuentes habilitantes

- `DIRECCION` o `COORDINACION_MEDICA` emite/autoriza el vale SM 1-14.
- `ARCHIVISTA` o `ARCHIVO_JEFE` ejecuta `ABRIR_PRESTAMO`.
- Emitir el vale no concede `LOAN_OPEN` al emisor.
- El contexto de `OpenLoan` contiene una fuente habilitante previamente validada.
- `CONSULTA_PROGRAMADA` habilita `ABRIR_PRESTAMO` para Archivo/Jefatura conforme a
  permission y contexto.
- `VALE_ARCHIVO_SM_1_14` habilita la ejecución por Archivo/Jefatura sólo cuando la
  fuente llega previamente validada.
- `ORDEN_SUPERIOR` opera fail-closed: no habilita `ABRIR_PRESTAMO` en T-04 hasta que
  exista su spec detallada.

## AUTH-EW-006 — Colección de fuentes disponibles

`ExpedienteCapabilityService` recibe `readonly FuenteHabilitanteSalidaContext[]` desde
`ExitEnablingSourceQueryPort`. Incluye `ABRIR_PRESTAMO` sólo cuando existe al menos un
elemento validado cuyo tipo es `CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14`, además de
las condiciones de permission, rol, estado y ausencia de préstamo activo.

## AUTH-EW-007 — ORDEN_SUPERIOR fail-closed

`ORDEN_SUPERIOR` permanece fail-closed incluso si llega con `validada: true`. El servicio
no selecciona la fuente concreta ni valida evidencia; `OpenLoan` selecciona y registra la
fuente, y el provider/adapter determina `validada`.

## Gaps

Esta decisión cierra `AUTH-GAP-001` a `AUTH-GAP-013` para el scope de T-04.
OQ-EW-003 permanece abierta y no bloqueante.
