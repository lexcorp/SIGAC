export function ConflictBanner(props: {
  readonly visible: boolean;
  readonly reloading?: boolean;
  readonly onReload: () => void;
}) {
  if (!props.visible) return null;
  return (
    <aside className="conflict-banner" role="alert" aria-live="assertive">
      <p>El expediente cambió desde la última consulta. Recarga para revisar la información actual.</p>
      <button type="button" disabled={props.reloading} onClick={props.onReload}>
        {props.reloading ? 'Recargando…' : 'Recargar'}
      </button>
    </aside>
  );
}
