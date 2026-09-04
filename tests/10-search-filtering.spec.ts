import { expect, test } from '@playwright/test';
import { createTag, createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('searches and filters todos in the documented order', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTag(page, 'Home');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await createTodo(page, { title: 'Buy milk', dueDate: futureSingaporeLocal(120), priority: 'high' });
  await createTodo(page, { title: 'Write memo', dueDate: futureSingaporeLocal(180), priority: 'low' });

  await page.getByTestId('search-input').fill('buy');
  await page.waitForTimeout(400);
  await expect(page.getByText('Buy milk')).toBeVisible();
  await expect(page.getByText('Write memo')).toHaveCount(0);

  await page.getByTestId('filter-priority').selectOption('high');
  await page.getByTestId('filter-tag').selectOption({ label: 'Home' });
  await expect(page.getByText('Buy milk')).toBeVisible();
});
