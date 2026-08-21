# Navigation Model

## Alternativas evaluadas

| Patrón | Ventaja | Riesgo | Decisión |
|---|---|---|---|
| Tabs | Cambio rápido, patrón ya presente en SIGAC | Saturación en ancho reducido | Recomendado |
| Subnavigation lateral | Escala a muchas áreas | Duplica el App Shell para sólo cuatro vistas | Descartado |
| Links contextuales | Simple para flujos lineales | Oculta áreas hermanas y dificulta orientación | Complementario |

## Modelo recomendado

Ruta conceptual del módulo: `/agenda-preparation`. Debajo del encabezado y selector de
fecha se usa un tablist accesible:

```text
[Agenda] [Lista de preparación] [Incidencias]* [Importaciones]
```

`*` Sólo con `AGENDA_INCIDENT_VIEW`. Agenda, Lista e Importaciones requieren
`AGENDA_VIEW`. La ausencia de permission oculta fail-closed el destino; no se muestra
disabled. La navegación no inspecciona roles.

El wizard se abre desde CTA en Agenda y permanece fuera del tablist. El detalle de una
importación es una página subordinada con “Volver a Importaciones”; también puede abrirse
desde el resultado inmediato.

## Preservación de contexto

- Fecha seleccionada acompaña Agenda y Lista.
- Incidencias se contextualizan por importación; no se inventa una colección global.
- Importaciones puede filtrarse por `agendaDate` y conserva cursor opaco sólo durante la
  sesión de esa colección.
- Cambiar fecha reinicia cursores y solicita de nuevo; no filtra datos ya cargados.
- Back/forward debe preservar tab y fecha mediante el mecanismo de routing futuro, sin
  prescribir implementación.
