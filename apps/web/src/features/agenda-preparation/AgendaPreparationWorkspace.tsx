/**
 * AgendaPreparationWorkspace — T-24 updated
 *
 * Changes from previous version:
 * - Tab "lista": accordion PreparationList → flat PreparationTable (REQ-PR-001)
 * - Tab "paquetes": new tab with ReportWizard for PDF generation (REQ-PR-002)
 * - window.print() removed; PDF generation is now server-side via ReportWizard
 * - useAgendaPreparationPrint removed (no longer needed)
 * - printEnabled / handlePrint removed
 */
import { useState } from 'react';
import { agendaApi } from './api/agendaApi';
import { useAgendaDay } from './hooks/useAgendaDay';
import { useAgendaImportHistory } from './hooks/useAgendaImportHistory';
import { useAgendaImportIncidents } from './hooks/useAgendaImportIncidents';
import { useAgendaPreparationList } from './hooks/useAgendaPreparationList';
import { AgendaSummary } from './components/AgendaSummary';
import { ImportAgendaWizard } from './components/ImportAgendaWizard';
import { IncidentList } from './components/IncidentList';
import { ImportHistory } from './components/ImportHistory';
import { PreparationTable } from './components/PreparationTable';
import { ReportWizard } from './components/ReportWizard';
import type { PreparationOrder } from './types/agenda.types';

type ActiveTab = 'agenda' | 'lista' | 'incidencias' | 'importaciones' | 'paquetes';

interface Props {
  readonly permissions: ReadonlySet<string>;
}

export function AgendaPreparationWorkspace({ permissions }: Props) {
  const canView         = permissions.has('AGENDA_VIEW');
  const canImport       = permissions.has('AGENDA_IMPORT');
  const canViewIncidents= permissions.has('AGENDA_INCIDENT_VIEW');
  const canPrint        = permissions.has('AGENDA_PRINT');

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [showWizard, setShowWizard] = useState(false);
  const [preparationOrder, setPreparationOrder] = useState<PreparationOrder>(
    'APPOINTMENT_TIME_ASC',
  );
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  const dayQuery = useAgendaDay(canView ? date : null);
  const latestImportId = dayQuery.data?.latestImportacionId ?? null;
  const incidentImportId = selectedImportId ?? latestImportId;

  // Preparation list — loaded when on lista OR paquetes tab (paquetes needs the items for wizard)
  const prepQuery = useAgendaPreparationList(
    (activeTab === 'lista' || activeTab === 'paquetes') && canView ? date : null,
    preparationOrder,
  );
  const prepItems = prepQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const prepNextCursor = prepQuery.data?.pages.at(-1)?.nextCursor ?? null;

  const historyQuery = useAgendaImportHistory(
    activeTab === 'importaciones' ? date : undefined,
  );
  const historyItems = historyQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const historyNextCursor = historyQuery.data?.pages.at(-1)?.nextCursor ?? null;

  const incidentsQuery = useAgendaImportIncidents(
    activeTab === 'incidencias' ? incidentImportId : null,
    canViewIncidents,
  );
  const incidentItems = incidentsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const incidentNextCursor = incidentsQuery.data?.pages.at(-1)?.nextCursor ?? null;

  if (!canView) {
    return (
      <main className="agenda-preparation-workspace">
        <p role="alert" className="problem-banner">
          No tienes permiso para consultar la Agenda de preparación.
        </p>
      </main>
    );
  }

  return (
    <main className="agenda-preparation-workspace">
      <div className="agenda-toolbar">
        <h1>Preparación de Agenda</h1>
        <div className="date-selector">
          <label htmlFor="agenda-date">Fecha</label>
          <input
            id="agenda-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedImportId(null);
            }}
            aria-label="Fecha de la Agenda"
          />
        </div>
        {canImport && (
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            aria-label="Importar o actualizar Agenda"
          >
            Importar / actualizar
          </button>
        )}
      </div>

      <nav aria-label="Secciones de Agenda">
        <button type="button" onClick={() => setActiveTab('agenda')}
          aria-current={activeTab === 'agenda' ? 'page' : undefined}
          className={activeTab === 'agenda' ? 'tab active' : 'tab'}>
          Agenda
        </button>
        <button type="button" onClick={() => setActiveTab('lista')}
          aria-current={activeTab === 'lista' ? 'page' : undefined}
          className={activeTab === 'lista' ? 'tab active' : 'tab'}>
          Lista de preparación
        </button>
        {canViewIncidents && (
          <button type="button" onClick={() => setActiveTab('incidencias')}
            aria-current={activeTab === 'incidencias' ? 'page' : undefined}
            className={activeTab === 'incidencias' ? 'tab active' : 'tab'}>
            Incidencias
          </button>
        )}
        <button type="button" onClick={() => setActiveTab('importaciones')}
          aria-current={activeTab === 'importaciones' ? 'page' : undefined}
          className={activeTab === 'importaciones' ? 'tab active' : 'tab'}>
          Importaciones
        </button>
        {/* Tab "Paquetes" visible to all with AGENDA_VIEW; button disabled if no AGENDA_PRINT */}
        <button type="button" onClick={() => setActiveTab('paquetes')}
          aria-current={activeTab === 'paquetes' ? 'page' : undefined}
          className={activeTab === 'paquetes' ? 'tab active' : 'tab'}>
          Paquetes
        </button>
      </nav>

      {activeTab === 'agenda' && (
        <AgendaSummary
          loading={dayQuery.isLoading}
          data={dayQuery.data}
          error={dayQuery.isError ? dayQuery.error : undefined}
        />
      )}

      {activeTab === 'lista' && (
        <PreparationTable
          loading={prepQuery.isLoading}
          error={prepQuery.isError ? prepQuery.error : undefined}
          items={prepItems}
          order={preparationOrder}
          onOrderChange={(o) => setPreparationOrder(o)}
          nextCursor={prepNextCursor}
          loadingMore={prepQuery.isFetchingNextPage}
          onLoadMore={() => { void prepQuery.fetchNextPage(); }}
        />
      )}

      {activeTab === 'paquetes' && (
        <ReportWizard
          date={date}
          items={prepItems}
          order={preparationOrder}
          canPrint={canPrint}
        />
      )}

      {activeTab === 'incidencias' && canViewIncidents && (
        <IncidentList
          loading={incidentsQuery.isLoading}
          error={incidentsQuery.isError ? incidentsQuery.error : undefined}
          items={incidentItems}
          nextCursor={incidentNextCursor}
          loadingMore={incidentsQuery.isFetchingNextPage}
          onLoadMore={() => { void incidentsQuery.fetchNextPage(); }}
        />
      )}

      {activeTab === 'importaciones' && (
        <ImportHistory
          loading={historyQuery.isLoading}
          error={historyQuery.isError ? historyQuery.error : undefined}
          items={historyItems}
          nextCursor={historyNextCursor}
          loadingMore={historyQuery.isFetchingNextPage}
          onLoadMore={() => { void historyQuery.fetchNextPage(); }}
          onSelect={(id) => {
            setSelectedImportId(id);
            setActiveTab('incidencias');
          }}
        />
      )}

      {showWizard && (
        <ImportAgendaWizard
          onImport={(file, key) => agendaApi.importAgenda(file, key)}
          onClose={() => {
            setShowWizard(false);
            void dayQuery.refetch();
          }}
          onViewResults={(id) => {
            setSelectedImportId(id);
            setShowWizard(false);
            setActiveTab('importaciones');
          }}
        />
      )}
    </main>
  );
}
