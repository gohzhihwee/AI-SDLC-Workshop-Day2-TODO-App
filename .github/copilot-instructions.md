# Todo App - AI Agent Instructions

## Required preflight

Before implementing a feature, read this file, `EVALUATION.md`, and
`PRPs/00-one-shot-implementation.md` completely. The model-routing table in
the one-shot PRP is binding. Do not replace it with independent model-choice
judgment.

Do not start the application unless the user explicitly asks. Add Playwright
coverage for changed behavior, but do not run it when the user prohibits test
execution.

## Architecture

- Next.js 16 App Router, React 19, Tailwind CSS 4.
- SQLite through synchronous `better-sqlite3`; all persistence lives in
  `lib/db.ts`.
- WebAuthn passkeys with JWT sessions in HTTP-only cookies.
- Playwright E2E tests in `tests/`.
- Date and time behavior uses Singapore time (`Asia/Singapore`) via
  `lib/timezone.ts`; do not use `new Date()` directly for app behavior.

## Conventions

- Main UI stays in the client components at `app/page.tsx` and
  `app/calendar/page.tsx`. Do not import `lib/db.ts` in client components.
- API routes authenticate first using `getSession()`. Use `session.userId` for
  every user-scoped query and return a 401 JSON response when no session exists.
- In Next.js 16 dynamic API route parameters are asynchronous:
  `const { id } = await params`.
- Use prepared statements. Enable and preserve foreign-key cascade behavior.
- Define shared database types in `lib/db.ts`.
- WebAuthn credential IDs use `isoBase64URL`. Preserve authenticator counters
  with `counter: authenticator.counter ?? 0`.
- Reuse `tests/helpers.ts` before adding duplicate test helpers.

## Key behavior

- Protected routes: `/` and `/calendar`; unauthenticated users go to `/login`.
- Todo dates, recurrence, reminders, and holidays all use Singapore timezone
  helpers.
- Completing recurring todos creates the next instance while preserving
  recurrence metadata, tags, priority, and reminder settings.
- Browser reminders are polled through `lib/hooks/useNotifications.ts` and
  must deduplicate notifications.
