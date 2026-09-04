import { expect, test } from '@playwright/test';
import { addSubtask, createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('adds, completes, and removes subtasks with progress updates', async ({ page }) => {
  await register(page, uniqueUsername('subtask'));
  await createTodo(page, { title: 'Parent todo', dueDate: futureSingaporeLocal(120) });

  await addSubtask(page, 'Parent todo', 'First subtask');
  await addSubtask(page, 'Parent todo', 'Second subtask');

  const card = page.locator('article').filter({ hasText: 'Parent todo' }).first();
  await expect(card.getByText('0/2 subtasks')).toBeVisible();
  await card.getByLabel('First subtask').check();
  await expect(card.getByText('1/2 subtasks')).toBeVisible();
  await card.getByRole('button', { name: 'Delete' }).nth(1).click();
  await expect(card.getByText('Second subtask')).toHaveCount(0);
});
