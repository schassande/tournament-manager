# Referee email display and editing

Last updated: 2026-10-30

## Objective

Allow tournament managers to display and edit referee email addresses directly from the `tournament-referees` page, and make it visible when an email is linked to an application account.

## Scope

### In scope

- Add a `Show emails` toggle after `Do you use Player Referees?`.
- Conditionally display an editable `Email` column in the referee table.
- Display a user icon for an email that has a non-empty `personId` when the cell is not being edited.
- Display a live percentage for full-time referees, excluding player referees, whose email and `personId` are both present.
- Preserve the existing attendee email/person-link consistency behavior when an email is edited.

### Out of scope

- Changes to the persistent data model.
- Persisting the toggle state or the percentage.
- Changes to account registration, authentication, or person management.

## Functional requirements

1. The `tournament-referees` page shall provide a `Show emails` toggle immediately after the existing `Do you use Player Referees?` toggle.
2. When `Show emails` is enabled, the referee table shall contain an `Email` column between `Gender` and `Action`.
3. The email cell shall use the same edit mechanism and authorization behavior as the other editable referee cells, and shall be disabled for player referees just like the existing person fields.
4. The email cell shall remain editable when the attendee has no `person` object; editing it shall use an independent email value and shall not create a `person` object until a value is actually saved.
5. When the email cell is not being edited and the referee has both an email and a non-empty `personId`, the UI shall display a user icon immediately before the email.
6. When `Show emails` is enabled, the page shall display a user icon and a percentage after the toggle text.
7. The percentage shall be calculated from the current in-memory referee list and shall not be persisted.

## Business rules

- The percentage denominator is the number of full-time referees, defined as referees that are not player referees.
- The percentage numerator is the number of those full-time referees whose attendee has both a non-empty email and a non-empty `personId`.
- The percentage is recalculated from the current page data after attendee changes.
- Editing an attendee email must resolve the matching `personId` through the existing email-to-person index. If no matching person exists, the `personId` is cleared; otherwise it is updated to the matching person ID.
- Email persistence shall be debounced by one second: each keystroke updates only transient page state, and the attendee is saved only after one second without further typing.
- The final email value is trimmed and converted to lowercase before the attendee is saved and indexed.
- Existing authorization rules for editing attendee cells remain unchanged.

## User interface and workflow

- The toggle is checked by default when at least one loaded referee has both a non-empty email and a non-empty `personId`; otherwise it is off.
- With the toggle off, the email column and the email statistic are hidden.
- With the toggle on, the email column is shown between `Gender` and `Action`.
- The email column remains editable using the same interaction pattern as the other table cells.
- For player referees, the email input is disabled, consistently with the existing person fields.
- When no `person` object exists, the email editor uses an independent transient value; saving a non-empty value creates the required attendee person data through the existing save flow.
- The email editor resets its one-second save timer after every keystroke.
- The user icon indicates that the displayed email is linked to an application account.
- The icon and percentage are shown only while `Show emails` is enabled.

## Data model and persistence

- No persistent data model change is required.
- The existing attendee `person.email` and optional `person.personId` fields are used.
- The existing `email_personid` index is used by the attendee mutation workflow to resolve the person link.
- The toggle and percentage are transient page state.

## Errors, validation, and permissions

- Existing email validation, attendee save errors, and permission checks remain applicable.
- If saving an edited email fails, the existing save-error behavior shall be preserved.
- The feature must not grant additional rights to edit attendee data.
- Accessibility labels and keyboard behavior shall be provided for the new toggle and icon according to the existing frontend conventions.

## Compatibility and migration

- No migration is required.
- Existing referee records without an email or person link remain valid and display an empty email cell without the linked-account icon.
- Existing page behavior when `Show emails` is disabled remains unchanged.

## Technical specifications

- Implement the UI in `frontend/src/page/tournament-referee.page.ts` and its existing inline template/styles as applicable.
- Reuse the page's existing referee view model (`Referee`, `attendee.person`, and `isPR`) and attendee save flow.
- Derive the percentage from the loaded referee list rather than introducing a stored field or backend endpoint.
- Preserve the existing server-side attendee mutation behavior in `functions/src/attendee/mutations.ts`, which resolves or clears `person.personId` from the normalized email index during attendee saves.
- Use the project's existing icon/component conventions for the user icon and toggle.

## Acceptance criteria

- The `Show emails` toggle appears immediately after `Do you use Player Referees?`.
- The email column is hidden when the toggle is off and appears between `Gender` and `Action` when it is on.
- Email values can be edited with the same rights and save workflow as the other editable referee cells.
- A non-editing email cell with both an email and a `personId` shows a user icon immediately before the email; other cells do not.
- The displayed percentage equals the number of full-time referees with both fields divided by the number of full-time referees, using the current page data.
- Editing an email updates or clears `personId` through the existing email index behavior.
- Typing an email sends no save request while typing and sends one save request after one second of inactivity.
- No new persistent field is created and the toggle/statistic are not persisted.

### List of new tests

- Component/template test for toggle placement and conditional email-column visibility.
- Component/template test for email-column order and linked-account icon visibility.
- Component test for percentage calculation with full-time, player-referee, missing-email, and missing-person-link cases.
- Save-flow test confirming that email edits use the existing attendee save path.
- Debounce test confirming that rapid email input results in one save after one second of inactivity.
- Regression test confirming that the existing attendee mutation resolves or clears `personId` from the email index.

## Open decisions

- None.

## Spec analysis

### Readiness

Ready for implementation

Implementation status: Implemented in `frontend/src/page/tournament-referee.page.ts`; frontend build verified on 2026-10-30.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend page | `frontend/src/page/tournament-referee.page.ts` contains the toggle, referee table, inline editing, and `attendeeChanged`. | Add transient toggle state, email column, account-link icon, and derived statistic. |
| Attendee persistence | `functions/src/attendee/mutations.ts` resolves `person.personId` through `email_personid` during save and clears stale links. | Reuse the existing behavior; no backend change is currently specified. |
| Persistent model | `doc/datamodel.md` documents `person.email`, optional `person.personId`, and `email_personid`. | No schema or migration change. |
| Documentation | This change specification is the relevant documentation file. | Keep this file aligned with the decisions made during analysis. |

### Remaining assumptions

- The email field is independently editable when no `person` object exists; the save flow creates person data only when a value is saved.

### Recommended implementation breakdown

1. Add the toggle and derived display state to the referee page.
2. Add the conditional email column and linked-account icon.
3. Add the live full-time referee percentage.
4. Add focused component and persistence regression tests.

### Recommended checks

- Run the frontend unit tests and production build.
- Verify keyboard access and accessible labeling for the toggle and icon.
- Verify that attendee saves preserve existing person-link resolution and authorization behavior.


