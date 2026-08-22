# Requirement → Screen Traceability

| Requirement | Screen | Component | State | User action | API/Application contract |
|---|---|---|---|---|---|
| REQ-AP-001..004 | AP-01/AP-02..05 | AgendaSummary, ImportAgendaWizard | no-agenda/importing/result | elegir fecha/importar | GET Agenda; ImportAgenda |
| REQ-AP-002/003 | AP-02..04 | FileDropzone, WizardStepper | invalid/loading/error | seleccionar `.xls` | POST único; 400/413/415/422 |
| REQ-AP-005..011 | AP-05/AP-08 | ImportResultSummary, ImportDetail | imported/already/reconciled | revisar resultados | ImportOutcome, RecordProcessingResult |
| REQ-AP-012/022 | AP-06 | PreparationList/Group/OrderSelector/PrintAction | empty/loaded/more/print | ordenar/consultar/cargar/imprimir | screen cursor opaco ligado al order; print completo |
| REQ-AP-013 | AP-01/AP-05/AP-07/AP-08 | Summary, IncidentList, ImportDetail | empty/loaded | navegar/revisar | cinco query contracts API-AP-011 |
| REQ-AP-014 | AP-01/AP-05/AP-08 | AgendaMetrics | loaded | leer conteos | métricas RESULT-AP-009 |
| REQ-AP-015 | todas | ProblemBanner/read models | error/loaded | consultar | allow-list RAW-AP/RESULT-AP |
| REQ-AP-016 | AP-06 | PreparationList | loaded | consultar referencia | contrato conceptual, sin mutar Expediente |
| REQ-AP-017 | todas | PermissionBoundary | allowed/hidden | abrir acción/vista | RequestContext + permissions |
| REQ-AP-018 | no UI propia | — | — | — | fixtures/tests, no datos reales |

## Elementos condicionados por gaps

| Necesidad | Estado | Razón contractual |
|---|---|---|
| Preview de fecha/conteos antes de importar | UX-GAP-001 | No existe validate/inspect endpoint |
| Buscar/filtrar lista por expediente/paciente/servicio/médico/resultado | UX-GAP-002 | Query sólo define cursor/limit; filtrar una página sería engañoso |
| Retry técnico preservando Idempotency-Key | UX-GAP-003 | Contrato define semántica, no ownership/lifecycle UI de la key |
| Historial/listado de importaciones | RESOLVED | REQ-AP-019 / ListAgendaImports |
| Dashboard de Agenda del día | RESOLVED | REQ-AP-020 / AgendaDayReadModel |

Agrupar los ítems ya recibidos por Servicio/Médico es SUPPORTED como presentación del
read model. No equivale a filtro server-side ni altera el orden/cursor.
