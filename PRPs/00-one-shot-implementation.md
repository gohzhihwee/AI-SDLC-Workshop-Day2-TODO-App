# One-Shot Implementation Prompt - Todo App

This is the compact specification for the complete Todo app. Use it instead
of separate, feature-sized PRPs. It is intentionally concise: inspect
existing code only when a detail below is ambiguous.

## Execution rules

1. Read `.github/copilot-instructions.md` and `EVALUATION.md` before coding.
2. Preserve the existing architecture and behavior unless the requested
   feature explicitly changes it.
3. Implement across database, authenticated API routes, client UI, and
   Playwright coverage as applicable.
4. Do not start the application or execute tests if the user says not to.
5. Do not paste full files into chat; report changed paths and validation
   status concisely.

## Binding model routing

Use **Sonnet 5** only for correctness-critical work:

| Work | Required model |
| --- | --- |
| Foundational schema and shared types | Sonnet 5 |
| WebAuthn, JWT sessions, and middleware | Sonnet 5 |
| Todo sorting and shared Todo API behavior | Sonnet 5 |
| Recurring due-date calculations | Sonnet 5 |
| Reminder polling and notification deduplication | Sonnet 5 |
| Import transactions, ID remapping, and tag conflict handling | Sonnet 5 |
| Calendar grid generation | Sonnet 5 |

Use **Haiku 4.5** for fully specified, repetitive work:

| Work | Required model |
| --- | --- |
| Priority, recurrence, reminder, and tag UI badges | Haiku 4.5 |
| Tags and subtasks CRUD routes and UI | Haiku 4.5 |
| Template CRUD excluding the `/use` integration | Haiku 4.5 |
| Search/filter functions and UI | Haiku 4.5 |
| CSV formatting and holiday seed data | Haiku 4.5 |
| Playwright test cases | Haiku 4.5 |

Batch related Haiku work for a feature in one task. Do Sonnet-routed work
directly with the accumulated architecture context.

## Stack and boundaries

- Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript.
- `better-sqlite3` is synchronous. Use `lib/db.ts` for database types and
  CRUD objects; do not access it from client components.
- Use `getSingaporeNow()` and related helpers from `lib/timezone.ts` for all
  application date/time logic.
- Auth uses `@simplewebauthn/*`, WebAuthn passkeys, and seven-day JWT sessions
  in HTTP-only cookies.
- Authenticate every API route and scope all user data by `session.userId`.
- Dynamic route parameters are promises in Next.js 16.

## Feature order and requirements

1. **Authentication:** Register/login through WebAuthn options and verification
   endpoints. Store credential IDs with `isoBase64URL`; use
   `authenticator.counter ?? 0`; reject counter regressions except the
   both-zero case. Protect `/` and `/calendar`.
2. **Todo CRUD:** Require a non-empty trimmed title. Default priority is
   `medium`; due dates must be at least one Singapore minute in the future.
   Show overdue, pending, and completed sections. Sort pending and overdue by
   priority, then due date, then newest creation time.
3. **Priority:** Support `high`, `medium`, and `low`; show accessible
   color-coded badges and filters.
4. **Recurring todos:** Require a due date. Completing a recurrence creates a
   next instance and carries priority, tags, reminder, and recurrence settings.
   Daily adds one day, weekly seven; month/year calculations clamp invalid
   target dates.
5. **Reminders:** Support 15m, 30m, 1h, 2h, 1d, 2d, and 1w settings. Disable
   reminders without a due date. Poll every 30 seconds and prevent duplicates.
6. **Subtasks:** Support ordered create/update/delete with cascade deletion.
   Show progress only when subtasks exist; it is green at exactly 100%.
7. **Tags:** Tags are unique per user and attach through a many-to-many join.
   Attach/detach operations are idempotent. Editing a tag updates all uses.
8. **Templates:** Save reusable todo fields and serialized subtasks. Template
   use creates fresh, incomplete subtasks and computes a due date from its
   offset. Existing todos survive template deletion.
9. **Search and filters:** Filter client-side in this AND order: text search,
   priority, tag, completion, date range. Search titles and subtask titles,
   case-insensitively with a 300ms debounce. Store presets in local storage.
10. **Export/import:** Export versioned JSON or CSV. Import must validate
    input, remap IDs, preserve subtask/tag relationships, and use a
    transaction.
11. **Calendar:** Render a Singapore-timezone monthly grid, show todos by due
    date and Singapore holidays, and support navigation.

## API surface

- Auth: register/login options and verification, logout, and current-user
  endpoints under `/api/auth`.
- Todos: `/api/todos`, `/api/todos/[id]`, nested subtasks and tags, plus
  `/export` and `/import`.
- Resources: `/api/subtasks/[id]`, `/api/tags`, `/api/tags/[id]`,
  `/api/templates`, `/api/templates/[id]`, `/api/templates/[id]/use`,
  `/api/notifications/check`, and `/api/holidays`.

## Test expectation

Add or update the feature-specific Playwright spec under `tests/`, using
`tests/helpers.ts`. Cover the successful user flow, validation/error behavior,
and the feature's critical integration point. Do not run the tests unless
requested.
