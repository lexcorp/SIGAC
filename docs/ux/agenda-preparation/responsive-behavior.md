# Responsive Behavior

## Desktop — base de diseño (≥ 1200 px)

- App Shell lateral existente (240 px) y workspace con padding observado 24/32 px.
- Contenido máximo recomendado 1440 px; grid conceptual de 12 columnas, gutter 24 px.
- AgendaSummary: cuatro métricas por fila cuando haya espacio.
- PreparationList: grupos anchos y tabla compacta; encabezado sticky es candidato visual,
  no comportamiento contractual.
- Wizard dialog: 880–960 px, stepper horizontal.

## Tablet (768–1199 px)

- Grid de 8 columnas, gutter 16 px; métricas 2×2.
- Tabs permiten scroll horizontal con foco visible, sin truncar el tab activo.
- Wizard conserva stepper horizontal si caben labels; si no, vertical.
- Tabla de Citas conserva columnas prioritarias Hora, Expediente, Paciente y Tipo; Médico
  y Servicio permanecen en encabezados de grupo, FOLIO/derechohabiente en segunda línea.

## Pantalla pequeña (< 768 px)

- Grid de 4 columnas, margen 16 px; shell usa su adaptación existente.
- Stepper vertical con número, label y estado textual.
- Dialog puede ocupar viewport, manteniendo título, cierre y focus trap.
- Cada fila de preparación se apila como definición label/value; no se elimina ningún
  campo contractual.
- Métricas en una columna o dos si el ancho lo permite.
- “Cargar más” ocupa ancho disponible; cursor nunca visible.

## Reglas comunes

- No horizontal scroll de página; una tabla excepcional puede usar contenedor con label.
- Targets mínimos 44×44 CSS px cuando sea posible.
- No cambiar orden semántico al reflow.
- Desktop-first responde al entorno hospitalario, pero teclado/touch siguen operables.
