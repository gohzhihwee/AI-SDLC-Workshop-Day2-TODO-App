import { expect, test } from '@playwright/test';
import { createTodo, futureSingaporeLocal, register, uniqueUsername } from './helpers';

test('exports todos as JSON and imports them back', async ({ page }) => {
  await register(page, uniqueUsername('export'));
  await createTodo(page, { title: 'Export me', dueDate: futureSingaporeLocal(120) });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ]);
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream ?? []) {
    contents += chunk.toString();
  }
  const parsed = JSON.parse(contents) as { todos: Array<{ title: string }> };
  expect(parsed.todos[0]?.title).toBe('Export me');

  await page.getByTestId('import-json').setInputFiles({
    name: 'todos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
  await expect(page.getByText('Export me')).toHaveCount(2);
});
