import { expect, test } from '@playwright/test';
import { addSubtask, createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('saves a todo as template and reuses it', async ({ page }) => {
  await register(page, uniqueUsername('template'));
  await createTodo(page, { title: 'Template source', dueDate: futureSingaporeLocal(180), priority: 'high' });
  await addSubtask(page, 'Template source', 'Carry over subtask');

  await page.locator('article').filter({ hasText: 'Template source' }).first().getByRole('button', { name: 'Save as template' }).click();
  await page.getByTestId('open-templates-modal').click();
  const useButton = page.getByTestId('templates-modal').getByRole('button', { name: 'Use' }).first();
  await useButton.click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.locator('article').filter({ hasText: 'Template source' })).toHaveCount(2);
  await expect(page.getByText('Carry over subtask')).toHaveCount(2);
});
