import { ExpedienteWorkspace } from '../features/expediente-workspace';

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SIGAC</div>
        <nav aria-label="Principal">
          <a className="active" href="/">Dashboard</a>
          <a href="/expedientes">Expedientes</a>
          <a href="/solicitudes">Solicitudes</a>
          <a href="/preparacion">Preparación</a>
          <a href="/prestamos">Préstamos</a>
          <a href="/devoluciones">Devoluciones</a>
          <a href="/incidencias">Incidencias</a>
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <input aria-label="Buscar expediente o paciente" placeholder="Buscar expediente, paciente..." />
          <span className="tenant-badge">DEMO</span>
        </header>
        <ExpedienteWorkspace />
      </div>
    </div>
  );
}
