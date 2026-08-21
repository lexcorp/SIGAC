# Component Inventory

## Reutilizables SIGAC

| Componente | Responsabilidad |
|---|---|
| AppShell/NavItem | Integración de navegación existente |
| PermissionBoundary | Ocultar fail-closed según permission server-derived |
| Tabs/TabPanel | Navegación accesible de vistas |
| Dialog | Focus trap, cierre y retorno de foco |
| EmptyState | Vacíos sin inferencias |
| ProblemBanner | RFC7807 sanitizado, sin mensajes raw |
| LoadMoreButton | Cursor opaco, loading/disabled |
| LoadingState | Loader/skeleton con anuncio accesible |
| DateSelector | Fecha con label y validación |

## Específicos de Agenda Preparation

| Componente | Variantes/estado |
|---|---|
| AgendaSummary | loaded/empty/loading/error |
| AgendaMetrics | métricas aprobadas exclusivamente |
| AgendaStatus | outcome humano, no lifecycle inventado |
| ImportAgendaWizard | select/submitting/result/error |
| WizardStepper | UPCOMING/CURRENT/COMPLETED/ERROR |
| FileDropzone | empty/selected/invalid/disabled |
| ImportResultSummary | imported/already/reconciled |
| PreparationList | empty/loaded/loading-more/error |
| PreparationGroup | servicio → médico |
| IncidentList | empty/loaded/loading-more/error |
| IncidentRow | siete categorías humanas |
| ImportHistory | empty/loaded/error |
| ImportDetail | summary/results/incidents autorizadas |

Total: 20 candidatos (9 reutilizables, 11 específicos).

Los componentes reciben datos/permissions; no calculan matching, reconciliación,
outcomes ni autorización. No se propone nueva librería de UI o fetching.
