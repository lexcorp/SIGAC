import { useQuery } from '@tanstack/react-query';
import { AgendaPreparationWorkspace } from '../features/agenda-preparation';
import { ExpedienteWorkspace, expedienteApi } from '../features/expediente-workspace';
import { Dashboard } from './Dashboard';
import { navigate, useRoute } from './useRoute';

/** NavLink renders an anchor that uses the SPA navigator instead of full reload. */
function NavLink({
  href,
  active,
  children,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
}) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigate(href);
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={active ? 'active' : undefined}
    >
      {children}
    </a>
  );
}

export function App() {
  const route = useRoute();

  // Session permissions — server-derived, never hardcoded.
  // The same endpoint used by ExpedienteWorkspace's useSessionAuthorization hook.
  // By calling it here we share the cached result (same query key) across all features.
  const sessionQuery = useQuery({
    queryKey: ['session-authorization'],
    queryFn: () => expedienteApi.getSession(),
  });

  // Build a ReadonlySet<string> from the server response, or an empty set while
  // loading/errored so child components render their own permission-denied state.
  const permissions: ReadonlySet<string> = new Set(
    sessionQuery.data?.permissions ?? [],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SIGAC</div>
        <nav aria-label="Principal">
          <NavLink href="/" active={route === 'dashboard'}>Dashboard</NavLink>
          <NavLink href="/expedientes" active={route === 'expedientes'}>Expedientes</NavLink>
          <a href="/solicitudes">Solicitudes</a>
          <NavLink href="/preparacion" active={route === 'preparacion'}>Preparación</NavLink>
          <a href="/prestamos">Préstamos</a>
          <a href="/devoluciones">Devoluciones</a>
          <a href="/incidencias">Incidencias</a>
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          {/* search bar lives inside ExpedienteWorkspace only */}
          <span className="tenant-badge">DEMO</span>
        </header>

        {route === 'dashboard' && (
          <Dashboard />
        )}

        {route === 'expedientes' && (
          <ExpedienteWorkspace />
        )}

        {route === 'preparacion' && (
          <AgendaPreparationWorkspace permissions={permissions} />
        )}

        {route === 'not-found' && (
          <main>
            <p>Página no encontrada.</p>
          </main>
        )}
      </div>
    </div>
  );
}
