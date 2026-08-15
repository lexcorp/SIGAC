import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ExpedienteReadModel, MovimientoExpedienteSummary } from '../../types/expediente.types';
import { AuditoriaTab } from './AuditoriaTab';
import { IncidenciasTab } from './IncidenciasTab';
import { MovimientosTab } from './MovimientosTab';
import { PrestamosTab } from './PrestamosTab';
import { ResumenTab } from './ResumenTab';
import { SolicitudesTab } from './SolicitudesTab';

type TabId = 'resumen' | 'movimientos' | 'solicitudes' | 'prestamos' | 'incidencias' | 'auditoria';

export function WorkspaceTabs(props: {
  readonly expediente: ExpedienteReadModel;
  readonly movimientos: readonly MovimientoExpedienteSummary[];
  readonly timelineLoading?: boolean;
  readonly timelineError?: boolean;
  readonly timelineNextCursor: string | null;
  readonly timelineLoadingMore?: boolean;
  readonly onLoadMore: () => void;
  readonly auditAuthorized?: boolean;
}) {
  const tabs: readonly { id: TabId; label: string; content: ReactNode }[] = [
    { id: 'resumen', label: 'Resumen', content: <ResumenTab expediente={props.expediente} /> },
    { id: 'movimientos', label: 'Movimientos', content: <MovimientosTab items={props.movimientos} loading={props.timelineLoading} error={props.timelineError} nextCursor={props.timelineNextCursor} loadingMore={props.timelineLoadingMore} onLoadMore={props.onLoadMore} /> },
    { id: 'solicitudes', label: 'Solicitudes', content: <SolicitudesTab solicitud={props.expediente.solicitudActiva} /> },
    { id: 'prestamos', label: 'Préstamos', content: <PrestamosTab prestamo={props.expediente.prestamoActivo} /> },
    { id: 'incidencias', label: 'Incidencias', content: <IncidenciasTab incidencias={props.expediente.incidenciasAbiertas} /> },
    ...(props.auditAuthorized ? [{ id: 'auditoria' as const, label: 'Auditoría', content: <AuditoriaTab /> }] : []),
  ];
  const [active, setActive] = useState<TabId>('resumen');
  const prefix = useId();
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0]!;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === selected.id);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + delta + tabs.length) % tabs.length]!;
    setActive(next.id);
    document.getElementById(`${prefix}-tab-${next.id}`)?.focus();
  }

  return (
    <section className="workspace-tabs">
      <div role="tablist" aria-label="Secciones del expediente" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            id={`${prefix}-tab-${tab.id}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === selected.id}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={tab.id === selected.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >{tab.label}</button>
        ))}
      </div>
      <div id={`${prefix}-panel-${selected.id}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${selected.id}`}>
        {selected.content}
      </div>
    </section>
  );
}
