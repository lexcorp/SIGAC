import { useState } from 'react';
import { agendaApi } from './api/agendaApi';
import { useAgendaDay } from './hooks/useAgendaDay';
import { useAgendaImportHistory } from './hooks/useAgendaImportHistory';
import { useAgendaImportIncidents } from './hooks/useAgendaImportIncidents';
import {
  useAgendaPreparationList,
  useAgendaPreparationPrint,
} from './hooks/useAgendaPreparationList';
import { AgendaSummary } from './components/AgendaSummary';
import { ImportAgendaWizard } from './components/ImportAgendaWizard';
import { IncidentList } from './components/IncidentList';
import { ImportHistory } from './components/ImportHistory';
import { PreparationList } from './components/PreparationList';
import type { PreparationOrder } from './types/agenda.types';

type ActiveTab = 'agenda' | 'lista' | 'incidencias' | 'importaciones';

interface Props {
  readonly permissions: ReadonlySet<string>;
}

export function AgendaPreparationWorkspace({ permissions }: Props) {
  const canView = permissions.has('AGENDA_VIEW');
  const canImport = permissions.has('AGENDA_IMPORT');
  const canViewIncidents = permissions.has('AGENDA_INCIDENT_VIEW');

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [showWizard, setShowWizard] = useState(false);
  const [preparationOrder, setPreparationOrder] = useState<PreparationOrder>(
    'APPOINTMENT_TIME_ASC',
  );
  const [printEnabled, setPrintEnabled] = useState(false);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  const dayQuery = useAgendaDay(canView ? date : null);
  const latestImportId = dayQuery.data?.latestImportacionId ?? null;
  const incidentImportId = selectedImportId ?? latestImportId;

  const prepQuery = useAgendaPreparationList(
    activeTab === 'lista' && canView ? date : null,
    preparationOrder,
  );
  const prepItems = prepQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const prepNextCursor = prepQuery.data?.pages.at(-1)?.nextCursor ?? null;

  // print query — only activates when printEnabled is set
  const printQuery = useAgendaPreparationPrint(
    canView ? date : null,
    preparationOrder,
    printEnabled,
  );

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

  function handlePrint() {
    setPrintEnabled(true);
    if (printQuery.data) {
      window.print();
    }
  }

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
              setPrintEnabled(false);
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
        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          aria-current={activeTab === 'agenda' ? 'page' : undefined}
          className={activeTab === 'agenda' ? 'tab active' : 'tab'}
        >
          Agenda
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lista')}
          aria-current={activeTab === 'lista' ? 'page' : undefined}
          className={activeTab === 'lista' ? 'tab active' : 'tab'}
        >
          Lista de preparación
        </button>
        {canViewIncidents && (
          <button
            type="button"
            onClick={() => setActiveTab('incidencias')}
            aria-current={activeTab === 'incidencias' ? 'page' : undefined}
            className={activeTab === 'incidencias' ? 'tab active' : 'tab'}
          >
            Incidencias
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('importaciones')}
          aria-current={activeTab === 'importaciones' ? 'page' : undefined}
          className={activeTab === 'importaciones' ? 'tab active' : 'tab'}
        >
          Importaciones
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
        <PreparationList
          loading={prepQuery.isLoading}
          error={prepQuery.isError ? prepQuery.error : undefined}
          items={prepItems}
          order={preparationOrder}
          onOrderChange={(o) => {
            setPreparationOrder(o);
            // query key includes order — TanStack Query v5 automatically re-fetches
          }}
          nextCursor={prepNextCursor}
          loadingMore={prepQuery.isFetchingNextPage}
          onLoadMore={() => {
            void prepQuery.fetchNextPage();
          }}
          onPrint={handlePrint}
        />
      )}

      {activeTab === 'incidencias' && canViewIncidents && (
        <IncidentList
          loading={incidentsQuery.isLoading}
          error={incidentsQuery.isError ? incidentsQuery.error : undefined}
          items={incidentItems}
          nextCursor={incidentNextCursor}
          loadingMore={incidentsQuery.isFetchingNextPage}
          onLoadMore={() => {
            void incidentsQuery.fetchNextPage();
          }}
        />
      )}

      {activeTab === 'importaciones' && (
        <ImportHistory
          loading={historyQuery.isLoading}
          error={historyQuery.isError ? historyQuery.error : undefined}
          items={historyItems}
          nextCursor={historyNextCursor}
          loadingMore={historyQuery.isFetchingNextPage}
          onLoadMore={() => {
            void historyQuery.fetchNextPage();
          }}
          onSelect={setSelectedImportId}
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
