import { expect, test } from '@playwright/test';
import { createTag, createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('creates, edits, and filters by tags', async ({ page }) => {
  await register(page, uniqueUsername('tag'));
  await createTag(page, 'Work', '#ef4444');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Work' }).first().click();
  await createTodo(page, { title: 'Tagged todo', dueDate: futureSingaporeLocal(120) });
  await expect(page.getByText('Work ×')).toBeVisible();

  await page.getByTestId('open-tags-modal').click();
  await page.getByTestId('tags-modal').getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('tags-modal').locator('input').first().fill('Office');
  await page.getByTestId('tags-modal').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByText('Office ×')).toBeVisible();
  await page.getByTestId('filter-tag').selectOption({ label: 'Office' });
  await expect(page.getByText('Tagged todo')).toBeVisible();
});
