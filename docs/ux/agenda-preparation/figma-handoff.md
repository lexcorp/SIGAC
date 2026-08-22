# Figma Wireframe Handoff

No se crean frames ni assets en esta tarea. Esta lista es el contrato de handoff.

| Frame | Nombre recomendado | Variantes mínimas |
|---|---|---|
| AP-01 | Agenda | loading, empty/404, loaded, error, import allowed/hidden |
| AP-02 | Import Wizard / Select | empty, selected, invalid, keyboard focus |
| AP-03 | Import Wizard / Validate | indeterminate, error |
| AP-04 | Import Wizard / Processing | indeterminate, timeout/failure |
| AP-05 | Import Wizard / Result | imported, already imported, reconciled |
| AP-06 | Preparation List | loading, empty, grouped, loading more, error |
| AP-07 | Incidents | permission hidden, empty, loaded, loading more |
| AP-08 | Import Detail | loading, not-found, loaded, incidents hidden/visible |

## Component sets

- WizardStepper: upcoming/current/completed/error; horizontal/vertical.
- FileDropzone: idle/drag/selected/invalid/disabled.
- MetricTile: default/zero/emphasis, sin significado sólo por color.
- EmptyState y ProblemBanner con textos de `states-matrix.md`.
- LoadMoreButton: idle/loading/disabled.
- Permission variants: AGENDA_VIEW, AGENDA_IMPORT, AGENDA_INCIDENT_VIEW, fail-closed.

## Layout

- Desktop hospitalario como frame base; ancho reducido convierte stepper a vertical y
  listas a filas apiladas.
- Usar tokens y shell observados en `apps/web`; no crear identidad visual paralela.
- Anotar focus order, landmarks, labels, `aria-current`, live regions y mensajes de
  error en cada frame.
- No representar Turno, Consultorio, Destino, raw, filename posterior, capabilities ni
  acciones de resolución.

## Page and frame hierarchy

```text
Page: 02 Agenda Preparation / Wireframes
├── Section: AP-01 Agenda
├── Section: AP-02–05 Import Wizard
├── Section: AP-06 Preparation
├── Section: AP-07 Incidents
├── Section: AP-08 Imports
└── Section: Components / annotations
```

Nombrar variantes `{Frame}/{Viewport}/{State}/{Permission}`, por ejemplo
`AP-01/Desktop/Loaded/CanImport` y `AP-07/Desktop/Empty/Authorized`.

## Frame geometry

| Viewport | Frame | Grid | Margin / gutter |
|---|---:|---|---|
| Desktop | 1440×1024 mínimo | 12 columns | 32 / 24 |
| Tablet | 834×1112 | 8 columns | 24 / 16 |
| Small | 390×844 | 4 columns | 16 / 16 |

El shell desktop reserva 240 px conforme frontend existente. El contenido usa spacing
base de 8 px (8/16/24/32), cards con radios existentes 10/16 px y jerarquía tipográfica
del shell (`Poppins` headings, `Open Sans` body). Estos valores reutilizan la referencia
actual; no constituyen una nueva identidad visual.

## Per-frame construction notes

- **AP-01:** header + date/action row; tablist; summary header; 4 metric tiles; two
  contextual links. Crear loaded, empty, loading, error y CTA-hidden.
- **AP-02:** dialog header; four-step horizontal stepper; instruction; dropzone; temporary
  filename row; footer actions. Variants idle/drag/selected/invalid/too-large.
- **AP-03:** mismo dialog; Select completed, Validate current; centered indeterminate
  loader. Error variants 400/413/415/422 reuse ProblemBanner.
- **AP-04:** Process current; one message and indeterminate loader. Variants timeout,
  failed and uncertain network; no percentage/cancel server/retry automático.
- **AP-05:** all prior steps completed; outcome heading; 12 contractual metrics in
  responsive grid; permission-sensitive next links.
- **AP-06:** date/context row; order selector and print action; nested Service and
  Physician headers; compact table on desktop, semantic stacked rows small; LoadMore
  state. Annotate cursor reset on order change and identical screen/print sequence.
- **AP-07:** heading/import context; incident rows with human category; empty/multiple;
  no resolution actions.
- **AP-08:** create collection and subordinate detail variants within the same section;
  optional date filter, history rows, opaque pagination, summary/metrics and independently
  paged result/incident regions.

Detailed anatomy and ASCII references are authoritative in `wireframes.md`.

## Synthetic content kit

Use only invented data:

- Date: `21/08/2026`.
- Physician: `Dra. Laura Rivera`, employee `00421`.
- Service: `Cardiología`.
- Patient labels: `Persona Ejemplo`, `Usuario Sintético`.
- Expedientes: `ABCD00000110`, `EFGH00000220`.
- FOLIO: `F-1001`, `F-1002`.
- Import id: `IMP-SYN-002`.

Never paste rows or names from supplied SIMEF artifacts.

## Contract annotations

Every frame carries a nonvisual annotation layer with:

1. permission and fail-closed behavior;
2. Use Case/endpoint;
3. requirement IDs;
4. fields consumed;
5. prohibited fields;
6. cursor behavior where applicable;
7. focus entry/exit and live-region behavior;
8. unresolved non-blocking UX-GAP, if relevant.

## Styling boundary

Wireframes remain grayscale/low fidelity except semantic annotations. Color tokens shown
in reference may be applied in a later visual-design pass only after contrast validation.
Do not infer new branding, icons, illustrations or status colors from this handoff.
