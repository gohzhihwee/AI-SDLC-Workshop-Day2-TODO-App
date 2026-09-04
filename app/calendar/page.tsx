'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, Suspense } from 'react';
import type { Holiday, Todo } from '@/lib/db';
import {
  addSingaporeDays,
  createSingaporeDate,
  formatSingaporeDate,
  formatSingaporeDateTimeLocal,
  getSingaporeNow,
  getSingaporeWeekday,
  isSameSingaporeDay,
  parseSingaporeDate,
} from '@/lib/timezone';

type DayCell = {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
};

async function requestJson<T>(input: RequestInfo): Promise<T> {
  const response = await fetch(input);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed');
  }

  return data;
}

function parseMonth(value: string | null) {
  const fallback = formatSingaporeDate(getSingaporeNow()).slice(0, 7);
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return fallback;
  }

  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12 ? value : fallback;
}

function shiftMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number);
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }).format(
    createSingaporeDate(year, month, 1),
  );
}

function generateCalendarGrid(monthValue: string): DayCell[] {
  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = createSingaporeDate(year, month, 1);
  const firstWeekday = getSingaporeWeekday(firstDay);
  const startDate = addSingaporeDays(firstDay, -firstWeekday);
  const today = getSingaporeNow();

  const cells: DayCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addSingaporeDays(startDate, index);
    const dateString = formatSingaporeDate(date);
    const cellMonth = Number(dateString.slice(5, 7));
    cells.push({
      date: dateString,
      isCurrentMonth: cellMonth === month,
      isToday: isSameSingaporeDay(date, today),
      isPast: parseSingaporeDate(dateString).getTime() < parseSingaporeDate(formatSingaporeDate(today)).getTime(),
      isWeekend: [0, 6].includes(getSingaporeWeekday(date)),
    });
  }

  const lastCurrentMonthIndex = cells.reduce((result, cell, index) => (cell.isCurrentMonth ? index : result), 0);
  return cells.slice(0, lastCurrentMonthIndex < 35 ? 35 : 42);
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = parseMonth(searchParams.get('month'));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [todoData, holidayData] = await Promise.all([
          requestJson<{ todos: Todo[] }>('/api/todos'),
          requestJson<{ holidays: Holiday[] }>(`/api/holidays?month=${month}`),
        ]);
        setTodos(todoData.todos);
        setHolidays(holidayData.holidays);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load calendar');
      }
    };

    void load();
  }, [month]);

  const grid = useMemo(() => generateCalendarGrid(month), [month]);
  const holidayMap = useMemo(() => new Map(holidays.map((holiday) => [holiday.date, holiday.name])), [holidays]);
  const todosByDay = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.due_date) {
        continue;
      }

      const date = formatSingaporeDate(todo.due_date);
      const list = map.get(date) ?? [];
      list.push(todo);
      map.set(date, list);
    }
    return map;
  }, [todos]);

  const selectedTodos = selectedDate ? todosByDay.get(selectedDate) ?? [] : [];

  const updateMonth = (delta: number) => {
    router.push(`/calendar?month=${shiftMonth(month, delta)}`);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Calendar</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">Todos and Singapore public holidays by month.</p>
            </div>
            <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
              Back to Todos
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <button data-testid="calendar-prev" type="button" onClick={() => updateMonth(-1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
              Previous
            </button>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{monthLabel(month)}</h2>
            <button data-testid="calendar-next" type="button" onClick={() => updateMonth(1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
              Next
            </button>
          </div>

          {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        </header>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-200 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="px-2 py-3">
                {label}
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-7 ${grid.length === 35 ? 'grid-rows-5' : 'grid-rows-6'}`}>
            {grid.map((cell) => {
              const items = todosByDay.get(cell.date) ?? [];
              const holiday = holidayMap.get(cell.date);
              return (
                <button
                  key={cell.date}
                  data-testid={`calendar-day-${cell.date}`}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={`min-h-36 border border-slate-200 p-3 text-left align-top dark:border-slate-800 ${
                    cell.isCurrentMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 text-slate-400 dark:bg-slate-950/60'
                  } ${cell.isToday ? 'ring-2 ring-blue-500 ring-inset' : ''} ${cell.isWeekend ? 'bg-slate-50/80 dark:bg-slate-950/70' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${cell.isPast ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {cell.date.slice(8, 10)}
                    </span>
                    {holiday ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Holiday</span> : null}
                  </div>
                  {holiday ? <p className="mt-2 line-clamp-2 text-xs text-rose-600 dark:text-rose-300">{holiday}</p> : null}
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 2).map((todo) => (
                      <div
                        key={todo.id}
                        className={`truncate rounded-lg px-2 py-1 text-xs font-semibold ${
                          todo.priority === 'high'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : todo.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {todo.title}
                      </div>
                    ))}
                    {items.length > 2 ? <div className="text-xs text-slate-500 dark:text-slate-400">+{items.length - 2} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selectedDate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedDate}</h2>
                  {holidayMap.get(selectedDate) ? <p className="text-sm text-rose-600 dark:text-rose-300">{holidayMap.get(selectedDate)}</p> : null}
                </div>
                <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {selectedTodos.length ? (
                  selectedTodos.map((todo) => (
                    <div key={todo.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{todo.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{formatSingaporeDateTimeLocal(todo.due_date as string).replace('T', ' ')}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No todos due on this day.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}
