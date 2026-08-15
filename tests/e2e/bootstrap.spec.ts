import { test, expect } from '@playwright/test';

test('SIGAC shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard operativo' })).toBeVisible();
});
