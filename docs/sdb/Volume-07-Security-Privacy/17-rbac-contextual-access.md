---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.3.0"
status: "Draft for security/privacy validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-005 RESOLVED: enabling source añadida a la tupla"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-017 — RBAC + Contextual Access

## Decisión
- RBAC para permiso grueso (rol del actor).
- Policy/context checks para tipo de solicitud, hospital, estado del recurso,
  finalidad y fuente habilitante de salida.

## Tupla de autorización (actualizada — OQ-EW-005 RESOLVED)

`subject + permission + tenant + resource + business context + enabling source`

| Componente | Descripción |
|------------|-------------|
| `subject` | Actor autenticado (usuario + roles) |
| `permission` | Acción solicitada (ej. `LOAN_OPEN`, `EXPEDIENT_VIEW`) |
| `tenant` | Hospital/tenant resuelto server-side; nunca del body |
| `resource` | Recurso específico (expediente, solicitud, préstamo…) |
| `business context` | Estado del recurso, tipo de solicitud, servicio, etc. |
| `enabling source` | `FuenteHabilitanteSalida` para operaciones de salida/préstamo |

## Principio
El backend **siempre** re-verifica autorización completa en cada petición.
No se delega la verificación al frontend.

`Role != Permission != Capability != Command`. `ActorContext` contiene `actorId`,
`roles`, `permissions` y `tenantIds`. La membresía actor -> tenant se valida server-side
antes del CapabilityService; éste recibe ActorContext y TenantContext ya validados.

La infraestructura autenticada construye `ActorContext` con actorId, roles, permissions
y tenantIds sin fijar todavía claims OIDC concretos. El tenant resuelto debe pertenecer
a `actor.tenantIds`; la ambigüedad multi-tenant se resuelve antes de Application.
Request no autenticada produce `AUTHENTICATION_REQUIRED`/401; actor autenticado sin
permission produce `PERMISSION_DENIED`/403.

La falta de una permission requerida produce `PERMISSION_DENIED`; no se confunde con
`INSUFFICIENT_ENABLING_SOURCE`. Ambas se traducen a 403, pero expresan causas distintas.
Un Expediente fuera del tenant activo se trata como `EXPEDIENTE_NOT_FOUND`/404. No se
publica un código `CROSS_TENANT_*` ni se revela la existencia en otro tenant; cualquier
señal interna del intento pertenece a security/audit.

La búsqueda por número requiere la permission existente `EXPEDIENT_VIEW`; no se crea
`EXPEDIENT_SEARCH`. `SearchExpedientesByNumero` recibe `RequestContext` server-side y
consulta sólo `context.tenant`. Falta de permission produce `PERMISSION_DENIED`/403.

## Aplicación a préstamos/salidas (OQ-EW-005)
- `CONSULTA_PROGRAMADA`: el rol Archivo/Jefatura es suficiente; no se requiere
  verificación de actor emisor adicional.
- `VALE_ARCHIVO_SM_1_14`: `DIRECCION` o `COORDINACION_MEDICA` emite/autoriza;
  `ARCHIVISTA` o `ARCHIVO_JEFE` ejecuta con fuente previamente validada. Emitir no
  concede `LOAN_OPEN`.
- `ORDEN_SUPERIOR`: fail-closed para T-04; no habilita `ABRIR_PRESTAMO`.

## Fuentes disponibles para capabilities

`ExpedienteCapabilityService` recibe una colección tenant-scoped de contextos
`{ tipo, validada }`. Requiere al menos una fuente validada de tipo
`CONSULTA_PROGRAMADA` o `VALE_ARCHIVO_SM_1_14` para ofrecer `ABRIR_PRESTAMO`, además de
las demás condiciones de autorización. El provider determina `validada`; el servicio no
inspecciona evidencia. `ORDEN_SUPERIOR` no habilita la acción aunque llegue validada.
La selección de la fuente concreta se re-verifica y registra en `OpenLoan`.

## Fuente
BIZ-016, DDD-010, DECISION-REGISTER OQ-EW-005, NIST SP 800-207.
