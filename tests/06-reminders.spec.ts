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

  const second = await page.evaluate(async () => {
    const response = await fetch('/api/notifications/check');
    return response.json();
  });
  expect(second.notifications).toHaveLength(0);
});
