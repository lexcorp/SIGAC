# TQ-009 — Frontend Testing

Loading/empty/error/conflict, capability-driven actions, keyboard, forms, badges, tables y privacidad.

Para búsqueda de Expediente: 0 items muestra estado vacío, 1 abre directamente y N > 1
muestra desambiguación sin auto-selección. Verificar navegación por teclado, foco visible
y que el hook consume `{ items }` sin asumir unicidad ni inventar paginación.

Verificar que Auditoría queda oculta y no consulta sin `EXPEDIENT_AUDIT_VIEW`; con la
permission consume página sanitizada y reenvía cursor opaco. Dispatch/AcceptCustody
dialogs sólo abren por capability, usan UbicacionOption, preservan rowVersion string no
editable, no envían metadata server-side y refrescan tras 204.

Los dialogs consumen GET `/api/v1/ubicaciones` sin evaluar `LOCATION_VIEW` ni roles en
frontend. Tratan 403 mediante Problem Details, sin mensajes técnicos ni captura manual
de UUID.
