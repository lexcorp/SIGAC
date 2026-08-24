import { test, expect } from '@playwright/test';

test('SIGAC shell renders — Dashboard at root', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  // Root route shows Dashboard (BUG-4 fix): expediente search is NOT here
  await expect(page.getByRole('heading', { name: 'Panel de Archivo Clínico' })).toBeVisible();
});

test('SIGAC shell renders — ExpedienteWorkspace at /expedientes', async ({ page }) => {
  await page.goto('/expedientes');
  await expect(page.getByRole('main')).toBeVisible();
  // ExpedienteWorkspace has the expediente number search
  await expect(page.getByLabel('Número de expediente')).toBeVisible();
});
