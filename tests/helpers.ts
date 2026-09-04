import { expect, Page } from '@playwright/test';

export async function setupVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

export function uniqueUsername(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function futureSingaporeLocal(minutesFromNow = 60) {
  const target = new Date(Date.now() + minutesFromNow * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(target);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}T${lookup('hour')}:${lookup('minute')}`;
}

export async function register(page: Page, username: string) {
  await setupVirtualAuthenticator(page);
  await page.goto('/login');
  await page.getByTestId('register-tab').click();
  await page.getByTestId('username-input').fill(username);
  await page.getByTestId('register-button').click();
  await expect(page).toHaveURL(/\/$/);
}

export async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.getByTestId('login-tab').click();
  await page.getByTestId('username-input').fill(username);
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/\/$/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function createTodo(
  page: Page,
  todo: {
    title: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    recurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminderMinutes?: string;
  },
) {
  await page.getByTestId('todo-title-input').fill(todo.title);
  if (todo.dueDate) {
    await page.getByTestId('todo-due-date-input').fill(todo.dueDate);
  }
  if (todo.priority) {
    await page.getByTestId('todo-priority-select').selectOption(todo.priority);
  }
  if (todo.recurring) {
    await page.getByTestId('todo-recurring-checkbox').check();
    await page.getByTestId('todo-recurrence-select').selectOption(todo.recurrencePattern ?? 'daily');
  }
  if (todo.reminderMinutes) {
    await page.getByTestId('todo-reminder-select').selectOption(todo.reminderMinutes);
  }
  await page.getByTestId('create-todo-button').click();
  await expect(page.getByText(todo.title).first()).toBeVisible();
}

export async function addSubtask(page: Page, todoTitle: string, subtaskTitle: string) {
  const card = page.locator('article').filter({ hasText: todoTitle }).first();
  await card.locator('input[placeholder="Add subtask"]').fill(subtaskTitle);
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByText(subtaskTitle)).toBeVisible();
}

export async function createTag(page: Page, name: string, color = '#3B82F6') {
  await page.getByTestId('open-tags-modal').click();
  await page.getByTestId('tags-modal').locator('input[placeholder="Tag name"]').fill(name);
  await page.getByTestId('tags-modal').locator('input[type="color"]').first().fill(color);
  await page.getByTestId('create-tag-button').click();
  await expect(page.getByTestId('tags-modal').getByText(name)).toBeVisible();
}

export async function createTemplate(page: Page, name: string, title: string) {
  await page.getByTestId('todo-title-input').fill(title);
  await page.locator('input[placeholder="Template name"]').fill(name);
  await page.getByRole('button', { name: 'Save draft as template' }).click();
  await page.getByTestId('open-templates-modal').click();
  await expect(page.getByTestId('templates-modal').getByText(name)).toBeVisible();
}
