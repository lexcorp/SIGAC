# UX Blueprint — Preparación de Agenda

**Spec:** `agenda-preparation v0.1.1` — Approved for Implementation

**Estado:** UX specification
**Alcance:** arquitectura de información y comportamiento funcional; no es diseño visual final.

## Propósito

Presentar el trabajo como **Preparación de Agenda**. La importación de un `.xls` de
SIMEF es el mecanismo actual de entrada, no la identidad del módulo.

## Autoridad y límites

Precedencia: Domain/Business contracts → SDB → spec → este blueprint. Se aplican
AUTH-AP, RAW-AP, API-AP y RESULT-AP. La UX no calcula reglas, no introduce
`capabilities[]` y sólo consume `AGENDA_IMPORT`, `AGENDA_VIEW` y
`AGENDA_INCIDENT_VIEW` resueltas server-side.

Quedan fuera Turno, Consultorio/Destino, paquetes, traslado, SM10-1 completo, SM1-14,
préstamo, devolución, rearchivo, cita abierta, atención fuera de agenda y resolución de
incidencias.

## Documentos

- `information-architecture.md`: navegación y jerarquía.
- `navigation-model.md`: comparación y modelo de navegación recomendado.
- `user-flows.md`: flujos principales y alternos.
- `screen-inventory.md`: pantallas y responsabilidades.
- `states-matrix.md`: estados, errores y vacíos por frame.
- `permissions-matrix.md`: variantes fail-closed.
- `wireframes.md`: especificación funcional AP-01…AP-08.
- `component-inventory.md`: componentes candidatos.
- `responsive-behavior.md`: desktop, tablet y pantallas pequeñas.
- `accessibility.md`: requisitos WCAG y comportamiento de interacción.
- `requirement-screen-traceability.md`: cadena requirement → UX → contrato.
- `figma-handoff.md`: frames y variantes para diseño visual posterior.
- `ux-open-questions.md`: gaps sin alterar la spec.

## Decisiones de estructura

`AP-SCR-002 Resultado de importación` es el paso final del wizard, no una página
adicional. El detalle durable se consulta después en `AP-SCR-005`.

El wizard usa `UPCOMING | CURRENT | COMPLETED | ERROR` sólo como estados efímeros UI.
No son estados Domain, contratos API, tablas ni eventos.

## Recomendación principal

La lista de preparación usa un patrón híbrido: grupos expandibles
Servicio/Especialidad → Médico y, dentro de cada médico, una tabla operativa compacta.
Preserva jerarquía y escaneabilidad sin convertir cada Cita en una card voluminosa.
