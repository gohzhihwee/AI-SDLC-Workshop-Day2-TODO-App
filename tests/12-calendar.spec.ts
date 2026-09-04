import { expect, test } from '@playwright/test';
import { createTodo, register, uniqueUsername } from './helpers';

test('shows holidays and todos on the calendar view', async ({ page }) => {
  await register(page, uniqueUsername('calendar'));
  await createTodo(page, { title: 'Calendar todo', dueDate: '2027-01-05T10:00', priority: 'high' });

  await page.goto('/calendar?month=2027-01');
  await expect(page.getByText("New Year's Day")).toBeVisible();
  await expect(page.getByTestId('calendar-day-2027-01-05').getByText('Calendar todo')).toBeVisible();

  await page.getByTestId('calendar-day-2027-01-05').click();
  await expect(page.getByRole('heading', { name: 'Calendar todo' })).toBeVisible();
});
