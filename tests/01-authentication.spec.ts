import { expect, test } from '@playwright/test';
import { login, logout, register, uniqueUsername } from './helpers';

test('registers, protects routes, and logs in with a passkey', async ({ page }) => {
  const username = uniqueUsername('auth');

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await register(page, username);
  await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();

  await logout(page);
  await login(page, username);
  await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();
});
