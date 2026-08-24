/**
 * Dashboard — pantalla de inicio de SIGAC.
 *
 * Muestra un acceso directo a las secciones implementadas.
 * Pendiente de especificación completa; esta versión es un placeholder
 * operativo que evita mostrar ExpedienteWorkspace en la raíz /.
 */

import { navigate } from './useRoute';

export function Dashboard() {
  return (
    <main className="dashboard">
      <h1>Panel de Archivo Clínico</h1>
      <p className="dashboard-subtitle">
        Selecciona una sección para comenzar.
      </p>
      <nav aria-label="Accesos rápidos" className="dashboard-cards">
        <button
          type="button"
          className="dashboard-card"
          onClick={() => navigate('/expedientes')}
        >
          <span className="dashboard-card__title">Expedientes</span>
          <span className="dashboard-card__desc">
            Consultar y gestionar expedientes físicos
          </span>
        </button>
        <button
          type="button"
          className="dashboard-card"
          onClick={() => navigate('/preparacion')}
        >
          <span className="dashboard-card__title">Preparación de Agenda</span>
          <span className="dashboard-card__desc">
            Importar agenda SIMEF y lista de preparación
          </span>
        </button>
      </nav>
    </main>
  );
}
