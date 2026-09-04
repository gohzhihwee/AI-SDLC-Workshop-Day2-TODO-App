export const SINGAPORE_TIMEZONE = 'Asia/Singapore';
export const SINGAPORE_OFFSET = '+08:00';
const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DateInput = Date | string | number;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDate(value?: DateInput): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00${SINGAPORE_OFFSET}`);
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return new Date(`${value}:00${SINGAPORE_OFFSET}`);
    }

    return new Date(value);
  }

  return new Date(value ?? Date.now());
}

function getParts(dateInput?: DateInput) {
  const date = toDate(dateInput);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00';

  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    hour: Number(part('hour')),
    minute: Number(part('minute')),
    second: Number(part('second')),
  };
}

export function createSingaporeDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${SINGAPORE_OFFSET}`,
  );
}

export function getSingaporeNow(): Date {
  const parts = getParts();
  return createSingaporeDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
}

export function formatSingaporeDate(value?: DateInput): string {
  const parts = getParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatSingaporeDateTime(value?: DateInput): string {
  const parts = getParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${SINGAPORE_OFFSET}`;
}

export function formatSingaporeDateTimeLocal(value?: DateInput): string {
  const parts = getParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function parseSingaporeDate(value: string): Date {
  return toDate(value);
}

export function parseDateTimeLocal(value: string): string {
  if (!value) {
    return '';
  }

  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}${SINGAPORE_OFFSET}`;
}

export function addSingaporeMinutes(value: DateInput, minutes: number): Date {
  return new Date(toDate(value).getTime() + minutes * 60_000);
}

export function addSingaporeDays(value: DateInput, days: number): Date {
  return addSingaporeMinutes(value, days * 24 * 60);
}

export function differenceInMinutes(from: DateInput, to: DateInput): number {
  return Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 60_000);
}

export function isSameSingaporeDay(a: DateInput, b: DateInput): boolean {
  return formatSingaporeDate(a) === formatSingaporeDate(b);
}

export function startOfSingaporeMonth(year: number, month: number): Date {
  return createSingaporeDate(year, month, 1);
}

export function getSingaporeWeekday(value: DateInput): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SINGAPORE_TIMEZONE,
    weekday: 'short',
  }).format(toDate(value));
  return weekdayMap.indexOf(weekday);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateNextDueDate(current: string, pattern: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const currentDate = parseSingaporeDate(current);
  const parts = getParts(currentDate);

  if (pattern === 'daily') {
    return formatSingaporeDateTime(addSingaporeDays(currentDate, 1));
  }

  if (pattern === 'weekly') {
    return formatSingaporeDateTime(addSingaporeDays(currentDate, 7));
  }

  if (pattern === 'monthly') {
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
    const day = Math.min(parts.day, daysInMonth(nextYear, nextMonth));
    return formatSingaporeDateTime(createSingaporeDate(nextYear, nextMonth, day, parts.hour, parts.minute, parts.second));
  }

  const nextYear = parts.year + 1;
  const day = parts.month === 2 && parts.day === 29 ? Math.min(28, daysInMonth(nextYear, parts.month)) : parts.day;
  return formatSingaporeDateTime(createSingaporeDate(nextYear, parts.month, day, parts.hour, parts.minute, parts.second));
}

export function formatReminderLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  if (minutes < 1_440) {
    return `${minutes / 60}h`;
  }

  if (minutes < 10_080) {
    return `${minutes / 1_440}d`;
  }

  return `${minutes / 10_080}w`;
}
