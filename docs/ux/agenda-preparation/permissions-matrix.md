# Permissions Matrix

| Superficie/control | AGENDA_VIEW | AGENDA_IMPORT | AGENDA_INCIDENT_VIEW |
|---|---:|---:|---:|
| Entrada al módulo | requerida | no sustituye VIEW | no sustituye VIEW |
| Agenda del día | visible | — | — |
| Lista de preparación | visible | — | — |
| Importaciones/detalle/resultados | visible | — | — |
| CTA Importar/actualizar | — | visible | — |
| Wizard | — | accesible | — |
| Tab/consulta Incidencias | — | — | visible |
| Enlace a incidencias desde resultado | — | — | visible |

## Variantes

- `AGENDA_VIEW` sin `AGENDA_IMPORT`: consulta completa; CTA y wizard ausentes.
- `AGENDA_VIEW + AGENDA_IMPORT`: consulta y CTA disponibles.
- `AGENDA_VIEW + AGENDA_INCIDENT_VIEW`: consulta e incidencias; import CTA sólo si
  también existe `AGENDA_IMPORT`.
- Sin `AGENDA_VIEW`: módulo y navegación de consulta ocultos; si una URL directa produce
  403, mostrar ProblemBanner seguro. No inferir acceso por poseer otra permission.
- Estado aún no cargado/error del read model de sesión: fail-closed; no parpadear controles.

Permissions no son capabilities. No existe cálculo `role === ...` ni mapping local.
