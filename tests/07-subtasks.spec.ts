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

test('hides the progress bar when a todo has zero subtasks', async ({ page }) => {
  await register(page, uniqueUsername('subtask-empty'));
  await createTodo(page, { title: 'No subtasks yet', dueDate: futureSingaporeLocal(120) });

  const card = page.locator('article').filter({ hasText: 'No subtasks yet' }).first();
  await expect(card.getByText(/subtasks$/)).toHaveCount(0);
  await expect(card.getByTestId(/^add-subtask-/)).toBeVisible();
});

test('turns the progress bar green when all subtasks are completed', async ({ page }) => {
  await register(page, uniqueUsername('subtask-complete'));
  await createTodo(page, { title: 'Finish everything', dueDate: futureSingaporeLocal(120) });

  await addSubtask(page, 'Finish everything', 'Only subtask');

  const card = page.locator('article').filter({ hasText: 'Finish everything' }).first();
  await card.getByLabel('Only subtask').check();
  await expect(card.getByText('1/1 subtasks')).toBeVisible();
  await expect(card.getByText('100%')).toBeVisible();
  await expect(card.locator('.bg-green-500')).toBeVisible();
});

test('adds a subtask by pressing Enter', async ({ page }) => {
  await register(page, uniqueUsername('subtask-enter'));
  await createTodo(page, { title: 'Enter to add', dueDate: futureSingaporeLocal(120) });

  const card = page.locator('article').filter({ hasText: 'Enter to add' }).first();
  await card.locator('input[placeholder="Add subtask"]').fill('Added via Enter');
  await card.locator('input[placeholder="Add subtask"]').press('Enter');
  await expect(card.getByText('Added via Enter')).toBeVisible();
});

test('rejects empty and whitespace-only subtask titles', async ({ page }) => {
  await register(page, uniqueUsername('subtask-empty-title'));
  await createTodo(page, { title: 'Reject blanks', dueDate: futureSingaporeLocal(120) });

  const card = page.locator('article').filter({ hasText: 'Reject blanks' }).first();

  // Empty title: clicking Add should not create any subtask row.
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByText(/subtasks$/)).toHaveCount(0);

  // Whitespace-only title: same expectation.
  await card.locator('input[placeholder="Add subtask"]').fill('   ');
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByText(/subtasks$/)).toHaveCount(0);
});

test('cascade deletes subtasks when the parent todo is deleted', async ({ page }) => {
  await register(page, uniqueUsername('subtask-cascade'));
  await createTodo(page, { title: 'Todo to delete', dueDate: futureSingaporeLocal(120) });

  await addSubtask(page, 'Todo to delete', 'Should vanish with parent');

  const card = page.locator('article').filter({ hasText: 'Todo to delete' }).first();
  await card.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('Todo to delete')).toHaveCount(0);
  await expect(page.getByText('Should vanish with parent')).toHaveCount(0);
});
