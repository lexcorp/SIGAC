import { useCallback, useState, type FormEvent } from 'react';
import type { ExpedienteCapability } from './types/expediente.types';
import { ExpedienteApiError } from './api/expedienteApi';
import { CommandBar } from './components/CommandBar';
import { AcceptCustodyDialog } from './components/AcceptCustodyDialog';
import { DisambiguationList } from './components/DisambiguationList';
import { DispatchExpedienteDialog } from './components/DispatchExpedienteDialog';
import { ExpedienteHeader } from './components/ExpedienteHeader';
import { WorkspaceTabs } from './components/tabs/WorkspaceTabs';
import { useCapabilities } from './hooks/useCapabilities';
import { useExpediente } from './hooks/useExpediente';
import { useExpedienteAudit } from './hooks/useExpedienteAudit';
import { useExpedienteCommands } from './hooks/useExpedienteCommands';
import { useExpedienteSearch } from './hooks/useExpedienteSearch';
import { useExpedienteTimeline } from './hooks/useExpedienteTimeline';
import { useSessionAuthorization } from './hooks/useSessionAuthorization';
import { useUbicaciones } from './hooks/useUbicaciones';

export function ExpedienteWorkspace(props: {
  readonly onCommand?: (capability: ExpedienteCapability) => void;
}) {
  const [numeroInput, setNumeroInput] = useState('');
  const [submittedNumero, setSubmittedNumero] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<'dispatch' | 'accept-custody' | null>(null);
  const selectSingle = useCallback((id: string) => setSelectedId(id), []);
  const search = useExpedienteSearch(submittedNumero, selectSingle);
  const expediente = useExpediente(selectedId);
  const timeline = useExpedienteTimeline(selectedId);
  const session = useSessionAuthorization();
  const auditAuthorized = session.data?.permissions.includes('EXPEDIENT_AUDIT_VIEW') ?? false;
  const audit = useExpedienteAudit(selectedId, auditAuthorized);
  const capabilities = useCapabilities(expediente.data);
  const commands = useExpedienteCommands(selectedId ?? '', expediente.data?.rowVersion ?? '0');
  const locations = useUbicaciones(openDialog !== null);
  const movimientos = timeline.data?.pages.flatMap((page) => page.items) ?? [];
  const nextCursor = timeline.data?.pages.at(-1)?.nextCursor ?? null;
  const auditItems = audit.data?.pages.flatMap((page) => page.items) ?? [];
  const auditNextCursor = audit.data?.pages.at(-1)?.nextCursor ?? null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSelectedId(null);
    setSubmittedNumero(numeroInput);
  }

  function handleCommand(capability: ExpedienteCapability) {
    if (capability === 'DISPATCH') setOpenDialog('dispatch');
    else if (capability === 'ACCEPT_CUSTODY') setOpenDialog('accept-custody');
    else props.onCommand?.(capability);
  }

  return (
    <main className="expediente-workspace">
      <form className="expediente-search" onSubmit={submit}>
        <label htmlFor="expediente-numero">Número de expediente</label>
        <div>
          <input
            id="expediente-numero"
            value={numeroInput}
            onChange={(event) => setNumeroInput(event.target.value)}
            aria-describedby="expediente-search-hint"
            required
          />
          <button type="submit" disabled={search.isFetching}>Buscar</button>
        </div>
        <p id="expediente-search-hint">Puedes usar el formato institucional disponible.</p>
      </form>

      {search.isFetching ? <div className="skeleton" aria-busy="true">Buscando…</div> : null}
      {search.isError ? <ErrorRegion error={search.error} /> : null}
      {submittedNumero && search.isSuccess && search.items.length === 0
        ? <section className="empty-state">No se encontraron coincidencias.</section>
        : null}
      {search.isDisambiguating
        ? <DisambiguationList items={search.items} onSelect={setSelectedId} />
        : null}

      {selectedId && expediente.isLoading ? <ExpedienteHeader loading /> : null}
      {selectedId && expediente.isError ? <ErrorRegion error={expediente.error} /> : null}
      {expediente.data ? (
        <>
          <ExpedienteHeader expediente={expediente.data} />
          <CommandBar capabilities={capabilities} onCommand={handleCommand} />
          <WorkspaceTabs
            expediente={expediente.data}
            movimientos={movimientos}
            timelineLoading={timeline.isLoading}
            timelineError={timeline.isError}
            timelineNextCursor={nextCursor}
            timelineLoadingMore={timeline.isFetchingNextPage}
            onLoadMore={() => { void timeline.fetchNextPage(); }}
            auditAuthorized={auditAuthorized}
            auditItems={auditItems}
            auditLoading={audit.isLoading}
            auditError={audit.isError}
            auditNextCursor={auditNextCursor}
            auditLoadingMore={audit.isFetchingNextPage}
            onAuditLoadMore={() => { void audit.fetchNextPage(); }}
          />
          {openDialog && locations.isLoading ? <div aria-busy="true">Cargando ubicaciones…</div> : null}
          {openDialog && locations.isError ? <ErrorRegion error={locations.error} /> : null}
          {openDialog === 'dispatch' && locations.data ? <DispatchExpedienteDialog
            locations={locations.data.items}
            rowVersion={expediente.data.rowVersion}
            pending={commands.dispatchMutation.isPending}
            onClose={() => setOpenDialog(null)}
            onSubmit={(input) => commands.dispatchMutation.mutateAsync(input)}
          /> : null}
          {openDialog === 'accept-custody' && locations.data ? <AcceptCustodyDialog
            locations={locations.data.items}
            rowVersion={expediente.data.rowVersion}
            pending={commands.acceptCustodyMutation.isPending}
            onClose={() => setOpenDialog(null)}
            onSubmit={(input) => commands.acceptCustodyMutation.mutateAsync(input)}
          /> : null}
        </>
      ) : null}
    </main>
  );
}

function ErrorRegion({ error }: { readonly error: unknown }) {
  return <section className="error-region" role="alert">{safeErrorMessage(error)}</section>;
}

export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof ExpedienteApiError)) return 'No fue posible completar la operación.';
  switch (error.problem?.code) {
    case 'AUTHENTICATION_REQUIRED': return 'Tu sesión no está disponible. Vuelve a iniciar sesión.';
    case 'PERMISSION_DENIED': return 'No tienes permiso para realizar esta operación.';
    case 'INSUFFICIENT_ENABLING_SOURCE': return 'La operación no cuenta con una fuente habilitante válida.';
    case 'EXPEDIENTE_NOT_FOUND': return 'El expediente solicitado no está disponible.';
    case 'OPTIMISTIC_LOCK_CONFLICT': return 'El expediente cambió. Recarga para revisar la información actual.';
    case 'REQUEST_INVALID_TRANSITION': return 'La operación ya no es válida para la situación actual.';
    case 'HTTP_VALIDATION_ERROR': return 'Revisa los datos capturados.';
    default: return 'No fue posible completar la operación.';
  }
}
