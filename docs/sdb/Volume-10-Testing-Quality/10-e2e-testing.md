# TQ-010 — E2E

Escenarios base:
- Expediente workspace.
- Solicitud → búsqueda → preparación.
- Préstamo → devolución → rearchivo.
- No localizado → incidencia.
- Agenda → reconcile.
- Tenant isolation.
- DEMO.

## Escenarios añadidos (2026-08-14)

### Búsqueda y desambiguación (OQ-EW-001/007 RESOLVED)
- Buscar `RFC/COD` → workspace abre directamente (N=1).
- Buscar `RFC-COD` → normaliza y abre el mismo expediente.
- Buscar número con N > 1 coincidencias → lista de desambiguación aparece;
  no se abre ningún expediente automáticamente.
- Buscar número inexistente → estado vacío descriptivo; no 404.

### Despacho y aceptación de custodia (OQ-EW-006 RESOLVED)
- Archivista ejecuta `DispatchExpediente` → estado cambia a `EN_TRASLADO`.
- Workspace muestra `EN_TRASLADO` con `acceptedAt = null`.
- Receptor autorizado ejecuta `AcceptCustody` → estado cambia a `EN_CONSULTA`.
- Workspace muestra `EN_CONSULTA` con `acceptedAt` establecido.
- Dispatch sin AcceptCustody no produce `EN_CONSULTA`.

### Estados del Expediente (DEC-EW-STATE-001)
- Badge `EN_BUSQUEDA` nunca aparece en el Expediente Workspace (es de Solicitud).
- Badge `PRESTADO` nunca aparece en el Expediente Workspace (es de Préstamo).
- Los 6 estados válidos se muestran con badge semántico diferenciado.

### Autorización por fuente habilitante (OQ-EW-005 RESOLVED)
- Archivista abre préstamo en flujo `CONSULTA_PROGRAMADA` → permitido.
- Archivista intenta abrir préstamo con `VALE_ARCHIVO_SM_1_14` no validada → rechazado.
- Dirección/Coordinación emite SM 1-14; Archivo/Jefatura con `LOAN_OPEN` ejecuta y
  el préstamo se abre con plazo 24 h.
- El emisor no obtiene `LOAN_OPEN` por emitir el vale.
- `ORDEN_SUPERIOR` no ofrece `ABRIR_PRESTAMO` en este slice.

### Extensión v0.3.21 — comandos y Auditoría

- búsqueda → selección/apertura → Dispatch dialog → 204 → refresh → EN_TRASLADO;
- AcceptCustody dialog → 204 → refresh → EN_CONSULTA;
- payloads proceden de formularios/opciones, nunca hardcoded;
- `EXPEDIENT_AUDIT_VIEW` muestra tab y registros sanitizados mediante GET `/audit`;
- sin esa permission el tab no aparece ni dispara request;
- el resolver E2E proporciona `LOCATION_VIEW`; los diálogos cargan ubicaciones desde el
  endpoint real y un 403 usa Problem Details sin derivar autorización desde roles.
- GET `/session` entrega permissions server-derived; Auditoría queda oculta/visible
  según `EXPEDIENT_AUDIT_VIEW`, nunca según roles.
