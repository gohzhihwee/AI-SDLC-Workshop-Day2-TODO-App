import { expect, test, type Page } from '@playwright/test';
import { createTodo, register, uniqueUsername } from './helpers';

function todoCard(page: Page, title: string) {
  return page.locator('article').filter({ hasText: title });
}

function pendingCard(page: Page, title: string) {
  return page.getByTestId('pending-section').locator('article').filter({ hasText: title });
}

test('creates the next recurring todo instance on completion', async ({ page }) => {
  await register(page, uniqueUsername('recur'));

  await createTodo(page, {
    title: 'Monthly close',
    dueDate: '2030-01-31T09:30',
    recurring: true,
    recurrencePattern: 'monthly',
  });

  await todoCard(page, 'Monthly close').first().getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByTestId('completed-section').getByText('Monthly close')).toBeVisible();
  await expect(page.getByTestId('pending-section').getByText('Monthly close')).toBeVisible();
});

test('shows the recurrence badge on a recurring todo', async ({ page }) => {
  await register(page, uniqueUsername('recur-badge'));

  await createTodo(page, {
    title: 'Daily stretch',
    dueDate: '2030-05-10T08:00',
    recurring: true,
    recurrencePattern: 'daily',
  });

  await expect(todoCard(page, 'Daily stretch').first().getByText('🔄 daily')).toBeVisible();
});

test('clamps month-end and leap-day due dates on the next instance', async ({ page }) => {
  await register(page, uniqueUsername('recur-clamp'));

  // Monthly: Jan 31 -> Feb 28 in a non-leap year.
  await createTodo(page, {
    title: 'Pay rent',
    dueDate: '2030-01-31T09:00',
    recurring: true,
    recurrencePattern: 'monthly',
  });
  await todoCard(page, 'Pay rent').first().getByRole('button', { name: 'Complete' }).click();
  await expect(pendingCard(page, 'Pay rent').getByText('2030-02-28 09:00')).toBeVisible();

  // Yearly: Feb 29 (leap year) -> Feb 28 the following year.
  await createTodo(page, {
    title: 'Renew licence',
    dueDate: '2032-02-29T10:15',
    recurring: true,
    recurrencePattern: 'yearly',
  });
  await todoCard(page, 'Renew licence').first().getByRole('button', { name: 'Complete' }).click();
  await expect(pendingCard(page, 'Renew licence').getByText('2033-02-28 10:15')).toBeVisible();
});

test('carries priority, pattern, and reminder onto the next instance', async ({ page }) => {
  await register(page, uniqueUsername('recur-inherit'));

  await createTodo(page, {
    title: 'Weekly report',
    dueDate: '2030-03-01T17:00',
    priority: 'high',
    recurring: true,
    recurrencePattern: 'weekly',
    reminderMinutes: '60',
  });

  await todoCard(page, 'Weekly report').first().getByRole('button', { name: 'Complete' }).click();

  const next = pendingCard(page, 'Weekly report');
  await expect(next.getByText('2030-03-08 17:00')).toBeVisible();
  await expect(next.getByText('high')).toBeVisible();
  await expect(next.getByText('🔄 weekly')).toBeVisible();
  await expect(next.getByText('🔔 1h')).toBeVisible();
});

test('rejects a recurring todo that has no due date', async ({ page }) => {
  await register(page, uniqueUsername('recur-nodate'));

  const response = await page.request.post('/api/todos', {
    data: { title: 'No anchor date', is_recurring: true, recurrence_pattern: 'daily' },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'Recurring todos require a due date' });
});

test('rejects a recurring todo that has no recurrence pattern', async ({ page }) => {
  await register(page, uniqueUsername('recur-nopattern'));

  const response = await page.request.post('/api/todos', {
    data: { title: 'No pattern', due_date: '2030-01-31T09:00', is_recurring: true },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'Invalid recurrence pattern' });
});

test('does not spawn a duplicate instance when completion is submitted twice', async ({ page }) => {
  await register(page, uniqueUsername('recur-double'));

  const created = await page.request.post('/api/todos', {
    data: { title: 'Idempotent habit', due_date: '2030-04-10T07:00', is_recurring: true, recurrence_pattern: 'daily' },
  });
  const { todo } = await created.json();

  const first = await page.request.put(`/api/todos/${todo.id}`, { data: { completed: true } });
  const second = await page.request.put(`/api/todos/${todo.id}`, { data: { completed: true } });

  expect((await first.json()).recurringTodo).not.toBeNull();
  expect((await second.json()).recurringTodo).toBeNull();

  const { todos } = await (await page.request.get('/api/todos')).json();
  expect(todos.filter((item: { title: string }) => item.title === 'Idempotent habit')).toHaveLength(2);
});

test('turning off repeat stops future recurrence', async ({ page }) => {
  await register(page, uniqueUsername('recur-off'));

  const created = await page.request.post('/api/todos', {
    data: { title: 'Was recurring', due_date: '2030-06-01T09:00', is_recurring: true, recurrence_pattern: 'weekly' },
  });
  const { todo } = await created.json();

  await page.request.put(`/api/todos/${todo.id}`, { data: { is_recurring: false, recurrence_pattern: null } });
  const completed = await page.request.put(`/api/todos/${todo.id}`, { data: { completed: true } });

  expect((await completed.json()).recurringTodo).toBeNull();

  const { todos } = await (await page.request.get('/api/todos')).json();
  expect(todos.filter((item: { title: string }) => item.title === 'Was recurring')).toHaveLength(1);
});
