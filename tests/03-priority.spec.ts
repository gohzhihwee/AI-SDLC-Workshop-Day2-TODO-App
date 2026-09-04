import { expect, test } from '@playwright/test';
import { createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('sorts pending todos by priority', async ({ page }) => {
  await register(page, uniqueUsername('priority'));

  await createTodo(page, { title: 'Low priority', dueDate: futureSingaporeLocal(240), priority: 'low' });
  await createTodo(page, { title: 'Medium priority', dueDate: futureSingaporeLocal(180), priority: 'medium' });
  await createTodo(page, { title: 'High priority', dueDate: futureSingaporeLocal(120), priority: 'high' });

  const titles = await page.getByTestId('pending-section').locator('article h3').allTextContents();
  expect(titles.slice(0, 3)).toEqual(['High priority', 'Medium priority', 'Low priority']);
});
