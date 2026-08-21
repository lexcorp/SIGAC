# Information Architecture

## App Shell

El módulo usa el shell existente de SIGAC: tipografía, tokens, banners seguros, foco
visible y patrón de carga incremental. Navegación activa mínima:

```text
Inicio
Expedientes
Preparación de Agenda
```

No se activan módulos futuros para completar el menú.

## Jerarquía

```text
Preparación de Agenda (página/módulo)
├── Agenda del día (vista inicial)
├── Lista de preparación (tab/vista)
├── Incidencias (tab condicional por permission)
└── Importaciones (tab/vista)
    └── Detalle de importación (página subordinada)

Importar / actualizar Agenda (dialog de cuatro pasos)
```

Las vistas principales comparten selector de fecha y contexto de módulo. Un tab conserva
su URL/estado navegable, pero no implica nuevos módulos. El wizard es dialog porque es
una tarea acotada que regresa a la Agenda; en pantallas estrechas puede ocupar la vista
completa manteniendo semántica de dialog.

## Navegación y permisos

| Área | Permission | Ausencia |
|---|---|---|
| Agenda, lista, importaciones y resultados | `AGENDA_VIEW` | No se muestra enlace/contenido |
| Importar/actualizar | `AGENDA_IMPORT` | Acción oculta |
| Incidencias | `AGENDA_INCIDENT_VIEW` | Tab oculto fail-closed |

Las permissions proceden del read model de sesión existente. No se inspeccionan roles.
Una permission no se transforma en capability.

## Modelo mental

La fecha es el eje de la Agenda lógica. Importaciones son evidencia histórica de cómo
se obtuvo/reconcilió esa Agenda. La lista es el producto operativo vigente. Incidencias
son elementos de consulta que explican por qué algunas filas no participan.

La colección usa `ListAgendaImports`; desde cualquier item o resultado inmediato se
navega al detalle por importacionId.
