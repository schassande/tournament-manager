# Referee planning

Last updated: 2026-08-27

## Objective

Provide a planning page for the referees, referee coaches, matches, fields, and timeslots of the selected tournament allocation.

## Scope

### In scope

- Add a `Planning` entry to the `Referee` submenu of the current tournament menu.
- Display the planning page only when at least one existing and visible allocation fragment is available.
- Provide a scope selector based on existing and visible `FragmentRefereeAllocation` records.
- Display three dedicated tabs/components: `Referees Planning`, `Referees List`, and `Coaches`.
- Display the `Coaches` tab only when the connected user is an attendee of the tournament with `isRefereeCoach === true`; the other tabs remain public.
- Provide PDF and Excel exports for each tab containing only the data currently displayed by that tab.
- Keep the first row and first column fixed in the planning tables, with no duplicate scrolling in either direction.

### Out of scope

- Managing allocation visibility; visibility management already exists.
- Creating, editing, deleting, or publishing allocations from this page.
- Changing referee allocation rules or persisted allocation data.

## Functional requirements

The tournament model contains a selected main tournament allocation, which references allocation fragments for tournament days or parts of days. Each fragment can be visible or unpublished; only visible fragments are available for planning.

When no existing visible allocation is available, the page displays only a message stating that referees have not yet been allocated. The form and tabs are hidden in this state.

The page contains a one-line form with a PrimeNG select controlling the planning scope for the entire page. The selected value represents a `FragmentRefereeAllocation`, either for a full day (`Day`) or a part of a day (`PartDay`). The select lists only existing and visible fragments.

### Referees Planning tab

- Display one column per field available in the selected scope that contains at least one match, ordered by field display order.
- Display one row per timeslot in the selected scope, ordered according to the data model.
- Each cell displays the match description used by `GameRefereeAllocator`: division, `game.what`, and team names when known, in that order.
- The match title occupies the full cell width and has a 1px solid light-grey bottom border.
- All cell text is centered.
- The match title uses the background and font colors configured for its division.
- Under the match description, display one line per allocated referee, showing first name and last name only, ordered by referee position.
- The first header cell contains PDF-export and Excel-export icons.
- Export filenames include the selected scope.

### Referees List tab

Display a filter area above the table.

Line 1 contains:

- A PrimeNG autocomplete text search component with `showClear` enabled.
- A `Player Referee` checkbox when the tournament allows player referees.

Line 2 contains:

- A level selector with `All`, `Level 1` through `Level 6`.
- A category selector with `All`, `Junior`, `Open`, `Senior`, and `Master`.
- A gender selector with `All`, `Male`, and `Female`.
- An upgrade-only checkbox.

Select controls do not display separate text labels. Their default options are `All levels`, `All categories`, and `All genders`. The level, category, and gender selectors display a clear icon; clearing a selection restores its default value. The scope selector has no clear icon.

The table:

- Displays one column per timeslot in the selected scope, ordered according to the data model.
- Displays one row per referee available in the selected scope, ordered alphabetically.
- Displays the referee name as `First name Last name`, without the referee level.
- Displays the field name in each cell.
- Uses bold text when the field is a video field.
- Displays a `pi-youtube` icon beside video field names.
- Uses a pale red background when the field is a bad-quality field.
- Has PDF-export and Excel-export icons in the first header cell.
- Exports only the currently displayed data, with filenames that include the selected scope.

### Coaches tab

- Display one column per referee coach available in the selected scope.
- Display one row per timeslot in the selected scope, ordered according to the data model.
- In each cell, display the field name at the beginning of the match-description line, in bold for a video field.
- Display the match description used by `GameRefereeAllocator`: division and team names when known.
- Under the match description, display one line per allocated referee, showing level (for example `L3S*`), first name, and last name, ordered by referee position.
- Center the referee name in the cell; wrapping is allowed but the wrapped text remains centered.
- The first header cell contains PDF-export and Excel-export icons.
- Export only the currently displayed data, with filenames that include the selected scope.

## Business rules

- The selected scope applies consistently to all three tabs.
- The `Coaches` tab is visible only to a connected tournament attendee whose `isRefereeCoach` flag is true.
- Only fields available for the selected scope are displayed in `Referees Planning`.
- Only referees and referee coaches available for the selected scope are displayed in their respective tabs.
- The order of referees within a match is their allocation position.
- The order of fields, timeslots, and referees is deterministic as specified by each tab.
- A referee or referee coach is available for a scope when they belong to the tournament and are available for at least one timeslot in that scope. Persisted `TOTAL` and `PARTIAL` unavailability exceptions must be respected.
- A field is considered bad-quality when `Field.quality === 1`.
- The `Referees List` text search matches `firstName`, `lastName`, or `shortName` and is combined with all other filters using AND semantics.
- When match or attendee information is unknown, the unknown part is omitted and only known information is displayed; no artificial placeholder is added.

## User interface and workflow

The page is opened from the main menu icon in the top-left corner, through `Referee > Planning` when a tournament is selected.

The route is `/tournament/:tournamentId/referee-planning`.

The page must avoid a page-level scrollbar competing with the planning table scrollbar. The first column and first row remain visible while scrolling in the tables.

Each tab must be implemented as a dedicated component to keep the source files focused.

The exact export control implementation and export file format details are to be aligned with existing application conventions during implementation.

## Data model and persistence

The page reads existing tournament, day, part-day, timeslot, field, game, attendee, `TournamentRefereeAllocation`, `FragmentRefereeAllocation`, and `GameAttendeeAllocation` data. It does not introduce new persisted fields or modify allocation records.

The selected scope is a visible `FragmentRefereeAllocation` referenced by the selected/current `TournamentRefereeAllocation`. A full-day fragment is identified by `dayId`; a part-day fragment also has `partDayId`.

## Errors, validation, and permissions

The page is available to any user who can view the current tournament. No referee-specific role or additional permission is required.

If no visible fragment exists, only the not-yet-allocated message is displayed. Other loading and data errors must follow existing application conventions; the exact messages are to be clarified if no convention applies.

When required data fails to load, display an error message in the page, hide the tabs, and provide a `Retry` action that starts the loading process again.

## Compatibility and migration

No data migration is expected. Existing allocation visibility and allocation persistence workflows remain unchanged.

## Acceptance criteria

- `Referee > Planning` is available for a selected tournament.
- The page shows only the not-yet-allocated message when no visible allocation fragment exists.
- The scope selector lists only existing visible fragments and updates all tabs consistently.
- Each tab is implemented as a dedicated component.
- `Referees Planning` shows only available fields containing matches, with timeslots, match descriptions, and referee lines in deterministic order.
- `Referees List` provides the specified filters, ordering, field labels, and conditional cell styling.
- `Coaches` shows available coaches, field-prefixed match descriptions, and positioned referee details with centered wrapping text.
- The first row and first column remain fixed while scrolling, without duplicate scrollbars in one direction.
- Each tab exports only its displayed data to PDF and Excel, and the filename includes the selected scope.
- No allocation or visibility data is modified by using the planning page.
- Existing application documentation remains accurate after the route and page are added; `doc/pages.md` must be updated if the page is implemented.
- Loading failures display an in-page error, hide the tabs, and provide a working `Retry` action.

## Open decisions

None.

## Code findings

- The shared model defines fields with `video`, `quality`, and `orderView`; `FieldQuality` is `1 | 2 | 3` in `persistent-data-model/src/tournament.ts`.
- The shared model defines `Timeslot.start`, `Timeslot.end`, `Timeslot.playingSlot`, and `SlotType.playTime`; timeslots are nested in `Day.parts` in `persistent-data-model/src/tournament.ts`.
- Referee and coach identity, player status, gender, level/category/upgrade data, and unavailability are held by `Attendee` in `persistent-data-model/src/tournament.ts` and the referee model.
- Allocated attendees are represented by `GameAttendeeAllocation` in `persistent-data-model/src/referee-allocation.ts`, including `attendeeRole`, `attendeePosition`, and `half`.
- Existing services include `FragmentRefereeAllocationService` and `TournamentRefereeAllocationService`; allocation CRUD currently uses frontend Firestore services rather than a dedicated backend endpoint.
- `doc/pages.md` currently documents the referee pages and allocation pages but does not document a planning page.
- Existing allocation pages use PrimeNG controls and a scrollable grid; their precise route/menu conventions and reusable display helpers should be reused during implementation.

## Spec analysis

### Readiness

Ready for implementation.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Shared data model | `persistent-data-model/src/tournament.ts`, `persistent-data-model/src/referee-allocation.ts` | Read existing fields, timeslots, games, attendees, and allocations; no schema migration expected. |
| Frontend routing/menu | `frontend/src/app/app.routes.ts`, `frontend/src/component/main-menu.component.ts` | Add `/tournament/:tournamentId/referee-planning` and a `Referee > Planning` menu entry; no referee-specific permission is required. |
| Frontend page | Existing tournament referee/allocation pages | Add a container page, scope state, three dedicated tab components, scroll/fixed-header layout, and retryable loading error state. |
| Export | Existing frontend export utilities/conventions to be inspected during implementation | Add PDF and Excel export for each tab, limited to visible data. |
| Documentation | `doc/pages.md`, repository documentation rules | Update page documentation when the route and workflow are implemented. |

### Remaining assumptions

- The current/selected tournament allocation is the source of the fragments shown by the planning page.
- The page is read-only and does not need a new backend endpoint.
- Access is limited only by the existing ability to view the current tournament.
- Export implementation details and filename formatting will follow existing frontend conventions while preserving the required PDF/Excel formats and selected-scope naming.

### Recommended implementation breakdown

1. Add the route and menu entry and create the planning container page.
2. Build scope resolution and shared planning view models from existing persisted data.
3. Implement the three dedicated tab components and fixed-scroll layout.
4. Add retryable loading errors, PDF/Excel exports, and focused tests.
5. Update `doc/pages.md` and verify the frontend build and relevant tests.

### Recommended checks

- Verify scope filtering for full-day and part-day fragments.
- Verify field, timeslot, referee, and coach ordering.
- Verify all filter combinations and empty results.
- Verify video and bad-quality styling.
- Verify fixed headers/columns and absence of duplicate scrollbars.
- Verify exports contain only visible tab data and include the scope in filenames.
- Verify the no-visible-allocation state and data-loading failures.
- Run the frontend build and relevant unit tests.
