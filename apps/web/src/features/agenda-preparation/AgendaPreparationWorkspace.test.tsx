/**
 * AgendaPreparationWorkspace — tests estructurales / semánticos.
 *
 * Verifican la nueva organización de la barra de pestañas (T-UX-01):
 *   - Las 5 pestañas viven dentro de <nav aria-label="Secciones de Agenda">
 *   - El botón "Importar / actualizar" queda FUERA del <nav>
 *   - El comportamiento de click del botón no cambia
 *   - La estructura es accesible: aria-label en nav, aria-current en tab activo
 *
 * No modifican lógica de negocio ni backend.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AgendaPreparationWorkspace } from './AgendaPreparationWorkspace';

// ── Minimal mocks ─────────────────────────────────────────────────────────────
// We mock heavy hooks so the structural tests run without a Postgres connection.
vi.mock('./hooks/useAgendaDay',           () => ({ useAgendaDay:            () => ({ isLoading: false, isError: false, data: null }) }));
vi.mock('./hooks/useAgendaImportHistory', () => ({ useAgendaImportHistory:  () => ({ isLoading: false, isError: false, data: null, isFetchingNextPage: false, fetchNextPage: vi.fn() }) }));
vi.mock('./hooks/useAgendaImportIncidents', () => ({ useAgendaImportIncidents: () => ({ isLoading: false, isError: false, data: null, isFetchingNextPage: false, fetchNextPage: vi.fn() }) }));
vi.mock('./hooks/useAgendaPreparationList', () => ({ useAgendaPreparationList: () => ({ isLoading: false, isError: false, data: null, isFetchingNextPage: false, fetchNextPage: vi.fn() }) }));

function renderWorkspace(permissions: string[] = [
  'AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW', 'AGENDA_PRINT',
]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AgendaPreparationWorkspace permissions={new Set(permissions)} />
    </QueryClientProvider>,
  );
}

// ── T-UX-01: Estructura semántica ─────────────────────────────────────────────

describe('AgendaPreparationWorkspace — estructura semántica (T-UX-01)', () => {

  it('las 5 pestañas están dentro del <nav aria-label="Secciones de Agenda">', () => {
    renderWorkspace();
    const nav = screen.getByRole('navigation', { name: 'Secciones de Agenda' });
    // All 5 tab buttons must be descendants of the nav
    const tabNames = ['Agenda', 'Lista de preparación', 'Incidencias', 'Importaciones', 'Paquetes'];
    for (const name of tabNames) {
      expect(within(nav).getByRole('button', { name })).toBeDefined();
    }
  });

  it('el botón "Importar / actualizar" está presente cuando el actor tiene AGENDA_IMPORT', () => {
    renderWorkspace(['AGENDA_VIEW', 'AGENDA_IMPORT']);
    expect(screen.getByRole('button', { name: 'Importar o actualizar Agenda' })).toBeDefined();
  });

  it('el botón "Importar / actualizar" NO está dentro del <nav>', () => {
    renderWorkspace(['AGENDA_VIEW', 'AGENDA_IMPORT']);
    const nav = screen.getByRole('navigation', { name: 'Secciones de Agenda' });
    // The import button must NOT be a descendant of the nav
    expect(
      within(nav).queryByRole('button', { name: 'Importar o actualizar Agenda' }),
    ).toBeNull();
  });

  it('el botón "Importar / actualizar" NO aparece sin permiso AGENDA_IMPORT', () => {
    renderWorkspace(['AGENDA_VIEW']); // no AGENDA_IMPORT
    expect(
      screen.queryByRole('button', { name: 'Importar o actualizar Agenda' }),
    ).toBeNull();
  });

  it('la tab activa tiene aria-current="page"', () => {
    renderWorkspace();
    // Default active tab is "Agenda"
    const agendaBtn = screen.getByRole('button', { name: 'Agenda' });
    expect(agendaBtn).toHaveAttribute('aria-current', 'page');
  });

  it('hacer clic en una pestaña cambia aria-current sin salir del nav', async () => {
    renderWorkspace(['AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW']);
    const nav = screen.getByRole('navigation', { name: 'Secciones de Agenda' });
    const listaBtn = within(nav).getByRole('button', { name: 'Lista de preparación' });
    await userEvent.click(listaBtn);
    expect(listaBtn).toHaveAttribute('aria-current', 'page');
    // El botón de importar sigue fuera del nav
    expect(within(nav).queryByRole('button', { name: 'Importar o actualizar Agenda' })).toBeNull();
  });

  it('hacer clic en "Importar / actualizar" abre el wizard (comportamiento no cambiado)', async () => {
    renderWorkspace(['AGENDA_VIEW', 'AGENDA_IMPORT']);
    const btn = screen.getByRole('button', { name: 'Importar o actualizar Agenda' });
    await userEvent.click(btn);
    // ImportAgendaWizard should appear after click
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('el encabezado h1 "Preparación de Agenda" sigue presente', () => {
    renderWorkspace();
    expect(screen.getByRole('heading', { name: 'Preparación de Agenda' })).toBeDefined();
  });

  it('el selector de fecha sigue presente con aria-label correcto', () => {
    renderWorkspace();
    expect(screen.getByLabelText('Fecha de la Agenda')).toBeDefined();
  });
});
