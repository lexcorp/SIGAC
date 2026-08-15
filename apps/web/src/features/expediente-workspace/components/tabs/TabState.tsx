import type { ReactNode } from 'react';

export function TabState(props: {
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly empty?: boolean;
  readonly emptyMessage: string;
  readonly children: ReactNode;
}) {
  if (props.loading) return <div className="tab-state skeleton" aria-busy="true">Cargando…</div>;
  if (props.error) return <div className="tab-state error-region" role="alert">No fue posible cargar esta sección.</div>;
  if (props.empty) return <div className="tab-state empty-state">{props.emptyMessage}</div>;
  return <>{props.children}</>;
}
