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
      <main className="workspace">
        <header className="topbar">
          <input aria-label="Buscar expediente o paciente" placeholder="Buscar expediente, paciente..." />
          <span className="tenant-badge">DEMO</span>
        </header>
        <section>
          <h1>Dashboard operativo</h1>
          <p className="muted">Bootstrap UI — implementar desde Volume 09.</p>
          <div className="cards">
            <article><strong>Preparación</strong><span>—</span></article>
            <article><strong>Préstamos vencidos</strong><span>—</span></article>
            <article><strong>Incidencias</strong><span>—</span></article>
          </div>
        </section>
      </main>
    </div>
  );
}
