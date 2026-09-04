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

test('search is case-insensitive and matches subtask titles', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Team meeting' });

  await page.getByTestId('search-input').fill('MEETING');
  await page.waitForTimeout(400);
  await expect(page.getByText('Team meeting')).toBeVisible();

  const card = page.locator('article').filter({ hasText: 'Team meeting' }).first();
  await card.locator('input[placeholder="Add subtask"]').fill('Prepare slides');
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByText('Prepare slides')).toBeVisible();

  await page.getByTestId('search-input').fill('slides');
  await page.waitForTimeout(400);
  await expect(page.getByText('Team meeting')).toBeVisible();
});

test('clearing search via the ✕ button restores the full list immediately', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Buy milk' });
  await createTodo(page, { title: 'Write memo' });

  await page.getByTestId('search-input').fill('buy');
  await page.waitForTimeout(400);
  await expect(page.getByText('Write memo')).toHaveCount(0);

  await page.getByTestId('clear-search').click();
  await expect(page.getByText('Buy milk')).toBeVisible();
  await expect(page.getByText('Write memo')).toBeVisible();
});

test('expanding Advanced reveals completion status and date range controls', async ({ page }) => {
  await register(page, uniqueUsername('filter'));

  await expect(page.getByTestId('filter-completion')).toHaveCount(0);
  await page.getByTestId('advanced-toggle').click();
  await expect(page.getByTestId('filter-completion')).toBeVisible();
  await expect(page.getByTestId('filter-date-from')).toBeVisible();
  await expect(page.getByTestId('filter-date-to')).toBeVisible();
});

test('completion status filter isolates completed vs incomplete todos', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Done task' });
  await createTodo(page, { title: 'Pending task' });

  const doneCard = page.locator('article').filter({ hasText: 'Done task' }).first();
  await doneCard.getByRole('button', { name: 'Complete' }).click();

  await page.getByTestId('advanced-toggle').click();
  await page.getByTestId('filter-completion').selectOption('completed');
  await expect(page.getByText('Done task')).toBeVisible();
  await expect(page.getByText('Pending task')).toHaveCount(0);

  await page.getByTestId('filter-completion').selectOption('incomplete');
  await expect(page.getByText('Pending task')).toBeVisible();
  await expect(page.getByText('Done task')).toHaveCount(0);
});

test('due date range filter shows only todos due within range', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Soon task', dueDate: futureSingaporeLocal(60) });
  await createTodo(page, { title: 'Far task', dueDate: futureSingaporeLocal(60 * 24 * 30) });

  await page.getByTestId('advanced-toggle').click();
  const soon = new Date(Date.now() + 60 * 60_000);
  const from = soon.toISOString().slice(0, 10);
  const to = soon.toISOString().slice(0, 10);
  await page.getByTestId('filter-date-from').fill(from);
  await page.getByTestId('filter-date-to').fill(to);

  await expect(page.getByText('Far task')).toHaveCount(0);
});

test('Clear All only appears with an active filter and resets the view', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Buy milk' });

  await expect(page.getByTestId('clear-all-filters')).toHaveCount(0);
  await page.getByTestId('filter-priority').selectOption('high');
  await expect(page.getByTestId('clear-all-filters')).toBeVisible();

  await page.getByTestId('clear-all-filters').click();
  await expect(page.getByTestId('clear-all-filters')).toHaveCount(0);
});

test('saves a filter preset, reloads, and reapplies it', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Buy milk', priority: 'high' });
  await createTodo(page, { title: 'Write memo', priority: 'low' });

  await page.getByTestId('filter-priority').selectOption('high');
  await page.getByTestId('open-save-filter').click();
  await expect(page.getByTestId('save-filter-preview')).toContainText('Priority: high');
  await page.getByTestId('preset-name-input').fill('High priority');
  await page.getByTestId('confirm-save-preset').click();

  await page.getByTestId('clear-all-filters').click();
  await expect(page.getByText('Write memo')).toBeVisible();

  await page.reload();
  await page.getByText('High priority').click();
  await expect(page.getByText('Buy milk')).toBeVisible();
  await expect(page.getByText('Write memo')).toHaveCount(0);
});

test('deleting a saved preset removes it permanently', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await createTodo(page, { title: 'Buy milk', priority: 'high' });

  await page.getByTestId('filter-priority').selectOption('high');
  await page.getByTestId('open-save-filter').click();
  await page.getByTestId('preset-name-input').fill('Temp preset');
  await page.getByTestId('confirm-save-preset').click();
  await expect(page.getByText('Temp preset')).toBeVisible();

  await page.getByRole('button', { name: 'Delete preset Temp preset' }).click();
  await expect(page.getByText('Temp preset')).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Temp preset')).toHaveCount(0);
});

test('shows a distinct empty state when filters match nothing versus zero todos', async ({ page }) => {
  await register(page, uniqueUsername('filter'));
  await expect(page.getByTestId('empty-no-todos')).toBeVisible();

  await createTodo(page, { title: 'Buy milk' });
  await page.getByTestId('search-input').fill('nonexistent-search-term');
  await page.waitForTimeout(400);
  await expect(page.getByTestId('empty-no-matches')).toBeVisible();
});
