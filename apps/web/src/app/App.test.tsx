/**
 * Integration tests for App shell routing and permission wiring.
 *
 * Strategy:
 * - Mock useRoute to control which route is active.
 * - Mock useQuery (session) to control permissions.
 * - Shallow-render only the shell; the feature workspaces are mocked at module
 *   level so we don't pull in all their hooks and API clients.
 *
 * Covered:
 *   1.  /expedientes → ExpedienteWorkspace rendered
 *   2.  /preparacion → AgendaPreparationWorkspace rendered
 *   3.  click "Preparación" nav link → navigate called
 *   4a. active link matches current route
 *   4b. "Preparación" not active on /expedientes
 *   4c. "Expedientes" active on /expedientes
 *   5.  direct /preparacion works
 *   6.  AgendaPreparationWorkspace receives server-derived permissions
 *   7.  DEMO session with AGENDA_VIEW → canView:true
 *   8.  AGENDA_IMPORT in session → canImport:true
 *   9.  AGENDA_INCIDENT_VIEW in session → canViewIncidents:true
 *   10. session without AGENDA_VIEW → canView:false (fail-closed)
 *   11. no hardcoded permissions — empty while loading
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./useRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useRoute')>();
  return {
    ...actual,
    useRoute: vi.fn(() => 'expedientes'),
    navigate: vi.fn(),
  };
});

vi.mock('./Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard">Dashboard</div>,
}));

vi.mock('../features/expediente-workspace', () => ({
  ExpedienteWorkspace: () => <div data-testid="expediente-workspace">ExpedienteWorkspace</div>,
  expedienteApi: {
    getSession: vi.fn().mockResolvedValue({
      actorId: 'u1',
      // DEMO full actor — now includes all 3 agenda permissions after the fix
      permissions: ['AGENDA_VIEW', 'AGENDA_IMPORT', 'AGENDA_INCIDENT_VIEW'],
    }),
  },
}));

vi.mock('../features/agenda-preparation', () => ({
  AgendaPreparationWorkspace: ({ permissions }: { permissions: ReadonlySet<string> }) => (
    <div data-testid="agenda-preparation-workspace">
      AgendaPreparationWorkspace
      {' '}canView:{String(permissions.has('AGENDA_VIEW'))}
      {' '}canImport:{String(permissions.has('AGENDA_IMPORT'))}
      {' '}canViewIncidents:{String(permissions.has('AGENDA_INCIDENT_VIEW'))}
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useRoute, navigate } from './useRoute';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

function setRoute(route: import('./useRoute').Route) {
  vi.mocked(useRoute).mockReturnValue(route);
}

// ── Routing tests ─────────────────────────────────────────────────────────────

describe('App shell routing', () => {
  beforeEach(() => { vi.mocked(navigate).mockReset(); });

  it('1. /expedientes renders ExpedienteWorkspace', () => {
    setRoute('expedientes');
    renderApp();
    expect(screen.getByTestId('expediente-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('agenda-preparation-workspace')).not.toBeInTheDocument();
  });

  it('1b. /dashboard (root) renders Dashboard, not ExpedienteWorkspace', () => {
    setRoute('dashboard');
    renderApp();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('expediente-workspace')).not.toBeInTheDocument();
  });

  it('2. /preparacion renders AgendaPreparationWorkspace', () => {
    setRoute('preparacion');
    renderApp();
    expect(screen.getByTestId('agenda-preparation-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('expediente-workspace')).not.toBeInTheDocument();
  });

  it('3. click "Preparación" nav link calls navigate("/preparacion")', async () => {
    setRoute('expedientes');
    renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Preparación' }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith('/preparacion');
  });

  it('4a. active class on "Preparación" link when route is preparacion', () => {
    setRoute('preparacion');
    renderApp();
    const link = screen.getByRole('link', { name: 'Preparación' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('active');
  });

  it('4b. "Preparación" link is NOT active when route is expedientes', () => {
    setRoute('expedientes');
    renderApp();
    expect(screen.getByRole('link', { name: 'Preparación' })).not.toHaveAttribute('aria-current');
  });

  it('4c. "Expedientes" link is active when route is expedientes', () => {
    setRoute('expedientes');
    renderApp();
    expect(screen.getByRole('link', { name: 'Expedientes' })).toHaveAttribute('aria-current', 'page');
  });

  it('5. direct /preparacion (initial mount) works', () => {
    setRoute('preparacion');
    renderApp();
    expect(screen.getByTestId('agenda-preparation-workspace')).toBeInTheDocument();
  });

  it('6. AgendaPreparationWorkspace receives server-derived permissions', async () => {
    setRoute('preparacion');
    renderApp();
    expect(await screen.findByText(/canView:true/)).toBeInTheDocument();
  });
});

// ── Agenda permission wiring tests ────────────────────────────────────────────

describe('App shell — Agenda Preparation permission wiring', () => {
  beforeEach(() => { vi.mocked(navigate).mockReset(); });

  it('7. DEMO session with AGENDA_VIEW → canView:true (workspace accessible, not denied)', async () => {
    setRoute('preparacion');
    renderApp();
    expect(await screen.findByText(/canView:true/)).toBeInTheDocument();
  });

  it('8. AGENDA_IMPORT in session → canImport:true', async () => {
    setRoute('preparacion');
    renderApp();
    expect(await screen.findByText(/canImport:true/)).toBeInTheDocument();
  });

  it('9. AGENDA_INCIDENT_VIEW in session → canViewIncidents:true', async () => {
    setRoute('preparacion');
    renderApp();
    expect(await screen.findByText(/canViewIncidents:true/)).toBeInTheDocument();
  });

  it('10. session without AGENDA_VIEW → canView:false (fail-closed)', async () => {
    const mod = await import('../features/expediente-workspace');
    const getSession = mod.expedienteApi.getSession as ReturnType<typeof vi.fn>;
    getSession.mockResolvedValueOnce({
      actorId: 'restricted',
      permissions: ['EXPEDIENT_VIEW', 'LOCATION_VIEW'],
    });
    setRoute('preparacion');
    renderApp();
    expect(await screen.findByText(/canView:false/)).toBeInTheDocument();
  });

  it('11. no hardcoded permissions — permissions Set is empty while session is loading', async () => {
    const mod = await import('../features/expediente-workspace');
    const getSession = mod.expedienteApi.getSession as ReturnType<typeof vi.fn>;
    // Never-resolving promise simulates an in-flight session request
    getSession.mockReturnValueOnce(new Promise(() => undefined));
    setRoute('preparacion');
    renderApp();
    // Component mounts immediately with empty permissions — no hardcoded grants
    expect(screen.getByTestId('agenda-preparation-workspace')).toBeInTheDocument();
    expect(screen.getByText(/canView:false/)).toBeInTheDocument();
  });
});

// ─── Dashboard regression tests ──────────────────────────────────────────────

describe('App shell — Dashboard at root route (BUG-4 regression)', () => {
  beforeEach(() => { vi.mocked(navigate).mockReset(); });

  it('BUG-4: / renders Dashboard, not ExpedienteWorkspace', () => {
    setRoute('dashboard');
    renderApp();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('expediente-workspace')).not.toBeInTheDocument();
  });

  it('BUG-4: /expedientes renders ExpedienteWorkspace, not Dashboard', () => {
    setRoute('expedientes');
    renderApp();
    expect(screen.getByTestId('expediente-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('BUG-5: search bar (buscar expediente) is NOT in topbar for dashboard route', () => {
    setRoute('dashboard');
    renderApp();
    // The global topbar must not contain the expediente search input
    // (it lives inside ExpedienteWorkspace only)
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      expect(topbar.querySelector('input[aria-label*="Buscar expediente"]')).toBeNull();
    }
    // The expediente-workspace is not mounted, so the search is not accessible
    expect(screen.queryByRole('textbox', { name: /Buscar expediente/i })).not.toBeInTheDocument();
  });

  it('BUG-5: search bar is NOT in topbar for preparacion route', () => {
    setRoute('preparacion');
    renderApp();
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      expect(topbar.querySelector('input[aria-label*="Buscar expediente"]')).toBeNull();
    }
  });
});
