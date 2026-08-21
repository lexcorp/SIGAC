# Accessibility Specification

## Estructura

- Un `h1` “Preparación de Agenda”; jerarquía de headings sin saltos.
- Landmarks de navegación, main y regiones nombradas para métricas/listas.
- Tabs con roles/relaciones tablist-tab-tabpanel y navegación de flechas conforme patrón.
- Grupos Servicio/Médico usan headings; expand/collapse, si se implementa, comunica
  `aria-expanded` y mantiene contenido accesible.

## Wizard

- Dialog nombrado, focus trap y retorno de foco al CTA.
- Step actual con `aria-current="step"`, número y label. Completado/error incluye texto o
  icono con nombre accesible; nunca sólo color.
- No se permite activar libremente pasos futuros. Volver sólo cuando la operación no ha
  iniciado y el estado lo permite.
- Al entrar a un paso, foco en heading; al fallar, foco en resumen de error.
- Dropzone siempre tiene input de archivo accesible y botón “Elegir archivo”; drag/drop
  no es el único mecanismo.

## Feedback

- Loading indeterminado usa `aria-busy` y un anuncio cortés único.
- Resultado y error se anuncian; no repetir mensajes en cada render.
- Errores de campo se asocian por `aria-describedby`; ProblemBanner recibe foco sólo
  después de submit/fallo.
- No comunicar outcome/incidencia exclusivamente por color.

## Teclado y lectura

- Orden de foco coincide con el orden visual.
- Escape cancela/cierra sólo antes de comenzar o después de terminar; durante POST no
  implica cancelar servidor si ese contrato no existe.
- “Cargar más” preserva foco y lo mueve al primer item nuevo sólo si resulta predecible;
  de otro modo mantiene el botón y anuncia cantidad añadida sin PII.
- Tablas usan captions/headers; layouts apilados conservan labels programáticos.

## Contenido

- Lenguaje humano, no identifiers técnicos como etiqueta primaria.
- Fecha/hora local con valor machine-readable cuando corresponda.
- Contraste, foco visible y tipografía se heredan del sistema SIGAC; validar WCAG 2.2 AA
  en Figma y posteriormente con pruebas automatizadas/manuales.
