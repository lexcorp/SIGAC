import { test, expect } from '@playwright/test';

test('SIGAC shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('Número de expediente')).toBeVisible();
});
