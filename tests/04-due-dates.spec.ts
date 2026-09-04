import { expect, test } from '@playwright/test';
import { createTodo, register, uniqueUsername } from './helpers';

test('requires due dates for recurring todos', async ({ page }) => {
  await register(page, uniqueUsername('due'));

  await page.getByTestId('todo-title-input').fill('Recurring without due date');
  await page.getByTestId('todo-recurring-checkbox').check();
  await page.getByTestId('create-todo-button').click();

  await expect(page.getByText('Recurring todos require a due date')).toBeVisible();

  await createTodo(page, { title: 'Recurring with due date', dueDate: '2030-01-10T09:30', recurring: true });
  await expect(page.getByText('🔄 daily')).toBeVisible();
});
