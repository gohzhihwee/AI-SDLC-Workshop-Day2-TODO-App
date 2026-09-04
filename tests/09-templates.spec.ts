import { expect, test } from '@playwright/test';
import { addSubtask, createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('saves a todo as template and reuses it', async ({ page }) => {
  await register(page, uniqueUsername('template'));
  await createTodo(page, { title: 'Template source', dueDate: futureSingaporeLocal(180), priority: 'high' });
  await addSubtask(page, 'Template source', 'Carry over subtask');

  await page.locator('article').filter({ hasText: 'Template source' }).first().getByRole('button', { name: 'Save as template' }).click();
  await page.getByTestId('template-name-input').fill('Template source');
  await page.getByTestId('save-template-button').click();
  await page.getByTestId('open-templates-modal').click();
  const useButton = page.getByTestId('templates-modal').getByRole('button', { name: 'Use' }).first();
  await useButton.click();

  await expect(page.locator('article').filter({ hasText: 'Template source' })).toHaveCount(2);
  await expect(page.getByText('Carry over subtask')).toHaveCount(2);
  await expect(page.getByTestId('templates-modal')).toBeHidden();
});

test('template API accepts serialized subtask definitions', async ({ page }) => {
  await register(page, uniqueUsername('template-api'));
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'API checklist',
        title_template: 'Checklist',
        subtasks: [{ title: 'First step', position: 0 }],
      }),
    });
    return { status: result.status, body: await result.json() };
  });

  expect(response.status).toBe(201);
  expect(response.body.template.subtasks_json).toContain('First step');
});

test('saves template metadata and uses it from the quick selector', async ({ page }) => {
  await register(page, uniqueUsername('template-quick'));
  await page.getByTestId('todo-title-input').fill('Weekly review');
  await page.getByRole('button', { name: 'Save draft as template' }).click();
  await page.getByTestId('template-name-input').fill('Weekly review template');
  await page.getByTestId('template-category-input').fill('Work');
  await page.getByTestId('template-description-input').fill('Review the team backlog');
  await page.getByTestId('save-template-button').click();

  const selector = page.getByTestId('use-template-select');
  await expect(selector).toContainText('Weekly review template (Work)');
  await selector.selectOption({ label: 'Weekly review template (Work)' });
  await expect(page.getByText('Weekly review').first()).toBeVisible();
});
