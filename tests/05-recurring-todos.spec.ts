import { expect, test } from '@playwright/test';
import { createTodo, register, uniqueUsername } from './helpers';

test('creates the next recurring todo instance on completion', async ({ page }) => {
  await register(page, uniqueUsername('recur'));

  await createTodo(page, {
    title: 'Monthly close',
    dueDate: '2030-01-31T09:30',
    recurring: true,
    recurrencePattern: 'monthly',
  });

  await page.locator('article').filter({ hasText: 'Monthly close' }).first().getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByTestId('completed-section').getByText('Monthly close')).toBeVisible();
  await expect(page.getByTestId('pending-section').getByText('Monthly close')).toBeVisible();
});
