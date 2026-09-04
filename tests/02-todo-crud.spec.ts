import { expect, test } from '@playwright/test';
import { createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('creates, edits, completes, and deletes a todo', async ({ page }) => {
  await register(page, uniqueUsername('crud'));

  await createTodo(page, { title: 'Ship release checklist', dueDate: futureSingaporeLocal(120), priority: 'medium' });
  await expect(page.getByTestId('pending-section').getByText('Ship release checklist')).toBeVisible();

  const card = page.locator('article').filter({ hasText: 'Ship release checklist' }).first();
  await card.getByRole('button', { name: 'Edit' }).click();
  await card.getByTestId(/edit-todo-title-/).fill('Ship release checklist v2');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Ship release checklist v2')).toBeVisible();

  await card.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByTestId('completed-section').getByText('Ship release checklist v2')).toBeVisible();

  await page.getByTestId('completed-section').locator('article').filter({ hasText: 'Ship release checklist v2' }).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Ship release checklist v2')).toHaveCount(0);
});
