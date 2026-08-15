# TQ-009 — Frontend Testing

Loading/empty/error/conflict, capability-driven actions, keyboard, forms, badges, tables y privacidad.

Para búsqueda de Expediente: 0 items muestra estado vacío, 1 abre directamente y N > 1
muestra desambiguación sin auto-selección. Verificar navegación por teclado, foco visible
y que el hook consume `{ items }` sin asumir unicidad ni inventar paginación.
