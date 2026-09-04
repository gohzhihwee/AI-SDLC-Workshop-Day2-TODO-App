import { expect, test } from '@playwright/test';
import { createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('returns reminder notifications once per reminder window', async ({ page }) => {
  await register(page, uniqueUsername('reminder'));
  await createTodo(page, {
    title: 'Reminder window todo',
    dueDate: futureSingaporeLocal(10),
    reminderMinutes: '15',
  });

  const first = await page.evaluate(async () => {
    const response = await fetch('/api/notifications/check');
    return response.json();
  });
  expect(first.notifications).toHaveLength(1);

  const todoId = first.notifications[0].id;
  const markSent = await page.evaluate(async (id) => {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_notification_sent: new Date().toISOString() }),
    });
    return response.json();
  }, todoId);
  expect(markSent.todo.last_notification_sent).toBeTruthy();

  const second = await page.evaluate(async () => {
    const response = await fetch('/api/notifications/check');
    return response.json();
  });
  expect(second.notifications).toHaveLength(0);
});

test('shows reminder controls only when a due date is set', async ({ page }) => {
  await register(page, uniqueUsername('reminder-controls'));

  const reminder = page.getByTestId('todo-reminder-select');
  await expect(reminder).toBeDisabled();
  await page.getByTestId('todo-due-date-input').fill(futureSingaporeLocal(60));
  await expect(reminder).toBeEnabled();
  await expect(reminder.locator('option')).toHaveCount(8);
});
