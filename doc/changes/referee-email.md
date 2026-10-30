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
- In both pages, an email matching the current authenticated user's normalized email is never editable.
- A dark-gray lock icon is displayed immediately after that email; the icon has no background styling.

## Data model and persistence

- No persistent data model change is required.
- The existing attendee `person.email` and optional `person.personId` fields are used.
- The existing `email_personid` index is used by the attendee mutation workflow to resolve the person link.
- The toggle and percentage are transient page state.
- The current user email is obtained from the existing authenticated-user state and compared after normalization.

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
- The current user's email cannot enter edit mode on either page and displays the dark-gray lock icon.
- No new persistent field is created and the toggle/statistic are not persisted.

### List of new tests

- Component/template test for toggle placement and conditional email-column visibility.
- Component/template test for email-column order and linked-account icon visibility.
- Component test for percentage calculation with full-time, player-referee, missing-email, and missing-person-link cases.
- Save-flow test confirming that email edits use the existing attendee save path.
- Debounce test confirming that rapid email input results in one save after one second of inactivity.
- Permission/UI test confirming that the current user's email cell is non-editable and shows the lock icon on both pages.
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

- The same email behavior is required on `frontend/src/page/tournament-referee-coach/tournament-referee-coach.page.ts` for referee coaches.
- The referee-coach percentage uses all loaded referee coaches as denominator and coaches with both email and `personId` as numerator.
- The referee-coach email editor uses the same one-second debounce and final `trim().toLowerCase()` normalization.

### Referee-coach scope

- Add a `Show emails` toggle to the referee-coach page.
- Display an editable Email column before `Action`, aligned left, with the linked-account user icon.
- Show the live percentage when enabled; its default state is checked when at least one loaded coach has both an email and a `personId`.
- Reuse the existing attendee save workflow and preserve the existing authorization behavior.

## Email uniqueness and attendee merge

### Functional requirements

- Within one tournament, two attendees must not have the same normalized non-empty email.
- An email change that collides with another attendee in the same tournament must not be applied automatically.
- The user shall be warned and offered exactly two choices: cancel the email change, or request a merge of the two attendees.
- The collision warning shall identify the other attendee using its person information and roles.
- The merge shall be executed by a backend callable/function and shall be atomic from the user's perspective.

### Merge rules

- The attendee currently being edited is always retained; the colliding attendee is merged into it and then deleted. No second winner-selection prompt is shown.
- The retained attendee keeps its document ID and existing data unless a field-specific merge rule says otherwise.
- Roles and rights from the deleted attendee are injected into the retained attendee using set-union semantics; duplicate roles are removed.
- The boolean `isReferee`, `isPlayer`, `isRefereeCoach`, and `isTournamentManager` flags are recalculated from the merged authoritative roles.
- `unavailabilities` are combined using set semantics; duplicate equivalent entries are removed.
- `roleRestrictions` are combined using set semantics; duplicate equivalent entries are removed.
- `comments` from both attendees are concatenated in retained-attendee-first order, with a newline between non-empty comment blocks; empty comments are omitted.
- For the nested `player`, `person`, `referee`, and `refereeCoach` data, each non-empty value is retained. If both attendees provide a value for the same field, the current value from the retained attendee wins.
- The merge must preserve all other non-conflicting referee, player, coach, manager, and business data. No conflicting value may be silently discarded outside the rules above.
- After a successful merge, the frontend shall open the retained attendee's edit dialog so the user can review the merged values.
- Every reference to the deleted attendee ID in all data belonging to the tournament must be replaced by the retained attendee ID.
- References in derived statistics and indexes must be updated consistently, or the affected derived documents must be deleted and recomputed when replacement is not semantically safe.
- The deleted attendee document and its obsolete attendee-index entry must be removed only after all dependent references have been migrated successfully.
- The operation must be transactional or use an explicit resumable workflow when Firestore transaction limits prevent one transaction; it must not leave a partially migrated attendee graph.

### Identified attendee references to migrate

The backend merge must inspect and handle these persisted fields and derived document identifiers:

- `tournament.managerAttendeeIds[]`.
- `fragment-referee-allocation.refereeAllocatorAttendeeIds[]` and `refereeCoachAllocatorAttendeeIds[]`.
- `game-attendee-allocation.attendeeId` and its deterministic document ID.
- `tournament-referee-allocation-statistics.refereeAttendeeId`, `tournamentStatistics.buddies[].buddyAttendeeId`, and `tournamentStatistics.games[].refereeCoachAttendeeIds[]`.
- `fragment-referee-allocation-statistics.refereeAttendeeId`, `buddies[].buddyAttendeeId`, and `games[].refereeCoachAttendeeIds[]`.
- `referee-upgrade-coach-vote.refereeAttendeeId` and `coachAttendeeId`, including its deterministic document ID.
- `referee-upgrade-panel-vote.refereeAttendeeId` and `updatedByCoachAttendeeId`, including its deterministic document ID.
- `tournament-referee-ranking.selectedRefereeAttendeeIds[]`, `selectedCoachAttendeeIds[]`, `updatedByCoachAttendeeId`, and `updatedCoachAttendeeId`.
- `coach-referees-ranking.coachAttendeeId` and `updatedByCoachAttendeeId`, including its deterministic child document ID; `rankedRefereeAttendeeIds[]` must also be updated.
- `water-carrier.attendeeId` and its deterministic document ID.
- `attendee-index.attendeeId`, whose key is derived from `tournamentId` and normalized email.

The complete implementation must also scan the actual Firestore collection definitions and nested allocation/ranking payloads before coding, so this list is verified against the deployed model rather than treated as an exhaustive assumption.

### Backend contract

- Add a dedicated authenticated backend callable for attendee merge; do not implement the merge as a sequence of ordinary frontend attendee saves.
- The request must include the tournament ID, source attendee ID, retained attendee ID, and a collision/merge confirmation token or equivalent server-verifiable intent.
- The backend must re-read both attendees, re-check the normalized email collision, verify tournament scope and caller permissions, validate all references, and execute the migration atomically or resumably.
- Ordinary attendee saves must continue rejecting duplicate normalized emails without mutating either attendee.

### Additional acceptance criteria

- A duplicate email save is rejected and leaves both attendees and all indexes unchanged.
- The warning displays the other attendee's person information and roles and offers cancel or merge.
- Cancelling restores the edited email without changing persistence.
- Choosing a retained attendee merges roles and all listed references, then removes the other attendee and its obsolete index entry.
- A failed merge leaves a retryable, diagnostically clear state without silently losing roles, allocations, votes, rankings, statistics, or manager rights.

### Open decisions

- The retained attendee rule is resolved: the attendee currently being edited is retained automatically.
- The precedence rules for conflicting attendee data are resolved by the field-specific merge rules above.
- Comment concatenation is resolved: omit empty values and join non-empty blocks with a newline.

- Run the frontend unit tests and production build.
- Verify keyboard access and accessible labeling for the toggle and icon.
- Verify that attendee saves preserve existing person-link resolution and authorization behavior.


