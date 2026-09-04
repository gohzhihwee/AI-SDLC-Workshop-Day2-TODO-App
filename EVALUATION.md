# Todo App Delivery Evaluation

Use this checklist before declaring a feature complete. Mark an item as
verified only after the requested validation has actually run.

## Global requirements

- [ ] Routes require a valid WebAuthn/JWT session where applicable.
- [ ] User data queries are scoped to the active user.
- [ ] Database changes preserve foreign keys and migration compatibility.
- [ ] Singapore timezone helpers are used for date/time behavior.
- [ ] Client components do not import the database layer.
- [ ] API input is validated and failures return an appropriate error response.
- [ ] Relevant Playwright coverage exists and reuses shared helpers.

## Feature acceptance

| Feature | Acceptance criteria |
| --- | --- |
| Authentication | Passkey registration/login works; protected routes redirect; session logout works. |
| Todo CRUD | A title-only todo can be created, edited, completed, and deleted; invalid titles and past dates are rejected; sections and sorting are correct. |
| Priority | High/medium/low priorities persist, display accessibly, sort correctly, and filter correctly. |
| Recurrence | All four patterns create a correct next todo with inherited metadata. |
| Reminders | All seven offsets are available only with due dates; polling prevents duplicate notifications. |
| Subtasks | Subtasks can be changed independently; progress is accurate; deleting a todo cascades. |
| Tags | Tags are unique per user, support custom colors, update all assigned todos, and filter results. |
| Templates | Templates persist supported fields and subtasks; using one creates an independent todo. |
| Search/filtering | Search covers titles/subtasks; every filter composes in the defined AND order; presets persist. |
| Export/import | JSON/CSV exports are valid; import validates data, remaps IDs, preserves relationships, and is transactional. |
| Calendar | Month navigation, todo placement, and Singapore holiday display are timezone correct. |

## Evidence to record

- Changed implementation paths.
- Added or changed Playwright spec paths.
- Validation command and result, or the explicit reason it was not run.
- Any acceptance criteria intentionally out of scope.
