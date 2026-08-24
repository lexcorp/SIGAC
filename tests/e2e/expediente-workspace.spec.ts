import { expect, test, type Page } from '@playwright/test';
import { E2E } from './harness/fixtures.js';

async function search(page: Page, numero: string): Promise<void> {
  await page.goto('/expedientes');
  await page.getByLabel('Número de expediente').fill(numero);
  const response = page.waitForResponse((candidate) => candidate.url().includes('/api/v1/expedientes?numero='));
  await page.getByRole('button', { name: 'Buscar' }).click();
  expect((await response).status()).toBe(200);
}

async function fillDispatch(page: Page): Promise<void> {
  await page.getByLabel('Destino').selectOption(E2E.locationConsult);
  await page.getByLabel('Tipo de custodio previsto').fill('SERVICIO');
  await page.getByLabel('Referencia de custodio previsto').fill('receptor-previsto');
  await page.getByLabel('Tipo de referencia de negocio').fill('VALE');
  await page.getByLabel('ID de referencia de negocio').fill('vale-e2e');
}

test.describe.serial('Expediente Workspace real E2E', () => {
  test('búsqueda 0/1/N, normalización y selección accesible', async ({ page }) => {
    await search(page, 'NONE810604/90');
    await expect(page.getByText('No se encontraron coincidencias.')).toBeVisible();

    await search(page, 'PERR810604-10');
    await expect(page.getByRole('heading', { name: 'PERR810604/10' })).toBeVisible();
    await expect(page.getByText('Paciente operativo uno')).toBeVisible();
    await expect(page.getByText('APARTADO').first()).toBeVisible();
    await expect(page.getByText('Archivo central')).toBeVisible();

    await search(page, 'DUPL810604/20');
    await expect(page.getByRole('heading', { name: 'Selecciona el expediente correcto' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DUPL810604/20' })).toHaveCount(0);
    const first = page.getByRole('button', { name: /Duplicado uno/ });
    await first.focus(); await page.keyboard.press('Enter');
    await expect(page.getByText('Duplicado uno')).toBeVisible();
    await expect(page.getByText('DISPONIBLE').first()).toBeVisible();
    await expect(page.getByText('EN_BUSQUEDA')).toHaveCount(0);
  });

  test('timeline real pagina por cursor y nunca mezcla Audit', async ({ page }) => {
    await search(page, 'PERR810604/10');
    await page.getByRole('tab', { name: 'Movimientos' }).click();
    await expect(page.getByText('DISPATCHED').first()).toBeVisible();
    await expect(page.getByText(/E2E_AUDIT_/)).toHaveCount(0);
    const loadMore = page.getByRole('button', { name: 'Cargar más movimientos' });
    await expect(loadMore).toBeVisible(); await loadMore.click();
    await expect(page.getByText('DISPATCHED')).toHaveCount(26);
  });

  test('Auditoría queda fail-closed sin permission', async ({ context, page }) => {
    await context.addCookies([{ name: 'sigac_e2e_actor', value: 'noAudit', domain: 'localhost', path: '/' }]);
    let auditRequests = 0; page.on('request', (request) => { if (request.url().includes('/audit')) auditRequests++; });
    await search(page, 'PERR810604/10');
    await expect(page.getByRole('tab', { name: 'Auditoría' })).toHaveCount(0);
    expect(auditRequests).toBe(0);
  });

  test('Auditoría autorizada muestra summary sanitizado y cursor opaco', async ({ page }) => {
    await search(page, 'PERR810604/10');
    await page.getByRole('tab', { name: 'Auditoría' }).click();
    await expect(page.getByText(/E2E_AUDIT_/).first()).toBeVisible();
    await expect(page.getByText(/securityContext|changeSummary|private/)).toHaveCount(0);
    const loadMore = page.getByRole('button', { name: 'Cargar más auditoría' });
    await expect(loadMore).toBeVisible(); await loadMore.click();
    await expect(page.getByText(/E2E_AUDIT_/)).toHaveCount(26);
  });

  test('capabilities ofrecen fuentes válidas y cierran fail-closed la no validada', async ({ page }) => {
    await search(page, 'LOAN810604/30');
    await expect(page.getByRole('button', { name: 'Abrir préstamo' })).toBeVisible();
    await search(page, 'NOVL810604/40');
    await expect(page.getByRole('button', { name: 'Abrir préstamo' })).toHaveCount(0);
  });

  test('Dispatch y AcceptCustody completan el flujo real con refresh tras 204', async ({ page }) => {
    await search(page, 'PERR810604/10');
    await page.getByRole('button', { name: 'Despachar' }).click();
    await fillDispatch(page);
    await page.getByRole('button', { name: 'Confirmar despacho' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('EN_TRASLADO').first()).toBeVisible();
    await expect(page.getByText('Consultorio uno')).toBeVisible();
    await expect(page.getByText('receptor-previsto').first()).toBeVisible();

    await page.getByRole('button', { name: 'Aceptar custodia' }).click();
    await page.getByLabel('Receptor tipo').fill('MEDICO');
    await page.getByLabel('Receptor referencia').fill('receptor-efectivo');
    await page.getByLabel('Servicio').fill('CONSULTA');
    await page.getByLabel('Ubicación destino').selectOption(E2E.locationConsult);
    await page.getByLabel('Tipo de referencia de negocio').fill('VALE');
    await page.getByLabel('ID de referencia de negocio').fill('vale-e2e');
    await page.getByRole('button', { name: 'Confirmar recepción' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('EN_CONSULTA').first()).toBeVisible();
    await expect(page.getByText('receptor-efectivo').first()).toBeVisible();
    await expect(page.getByText('Aceptada:')).toBeVisible();
  });

  test('conflicto optimistic real conserva datos y exige recarga explícita', async ({ browser }) => {
    const context = await browser.newContext(); const stale = await context.newPage(); const concurrent = await context.newPage();
    await search(stale, 'CONF810604/50'); await stale.getByRole('button', { name: 'Despachar' }).click(); await fillDispatch(stale);
    await search(concurrent, 'CONF810604/50'); await concurrent.getByRole('button', { name: 'Despachar' }).click(); await fillDispatch(concurrent); await concurrent.getByRole('button', { name: 'Confirmar despacho' }).click();
    await expect(concurrent.getByText('EN_TRASLADO').first()).toBeVisible();
    const conflictResponse = stale.waitForResponse((response) => response.url().endsWith(`/api/v1/expedientes/${E2E.conflict}/dispatch`) && response.request().method() === 'POST');
    await stale.getByRole('button', { name: 'Confirmar despacho' }).click();
    const conflictProblem = await conflictResponse;
    const conflictBody = await conflictProblem.json();
    expect({ status: conflictProblem.status(), body: conflictBody }).toMatchObject({ status: 409, body: { code: 'OPTIMISTIC_LOCK_CONFLICT' } });
    await expect(stale.getByText('No fue posible completar la operación.')).toBeVisible();
    await expect(stale.getByText(/El expediente cambió desde la última consulta/)).toBeVisible();
    await stale.getByRole('button', { name: 'Cancelar' }).click();
    await expect(stale.getByRole('alert')).toContainText('El expediente cambió');
    await expect(stale.getByText('APARTADO').first()).toBeVisible();
    await stale.getByRole('button', { name: 'Recargar' }).click();
    await expect(stale.getByText('EN_TRASLADO').first()).toBeVisible(); await context.close();
  });

  test('tenant isolation no divulga expediente ajeno', async ({ page }) => {
    await search(page, 'ONLY810604/60');
    await expect(page.getByText('No se encontraron coincidencias.')).toBeVisible();
    const response = await page.request.get(`/api/v1/expedientes/${E2E.tenantBOnly}`);
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'EXPEDIENTE_NOT_FOUND' });
  });
});
