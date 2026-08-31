# Allocation statistics

Last updated: 2026-08-26

## Manual refresh when statistics are missing

Manual refresh uses the referees available for the displayed allocation period for Fragment scope, and all referees registered in the tournament for Tournament scope, rather than the persisted statistics population. This allows a new or otherwise empty fragment, including a fragment with only a small number of games, to trigger the backend computation and create its initial statistics. Refresh requests are sent in batches of at most 10, and individual request failures are logged while the remaining requests and final reload continue.

## Bug fix: coach allocation role recognition

Coach allocations created from the allocation page use the `Coach` attendee role. The shared `isRefereeCoach()` predicate therefore recognizes `Coach`, `PlayerCoach`, `CoachReferee`, and `PlayerCoachReferee`, so the backend statistics calculation includes all supported coach assignment roles. The Coaches view leaves the average level empty when `nbCoachedGames` is zero; persisted statistics may continue to use `-1` as the no-data sentinel.

## Objective

Provide allocation statistics for referees and trigger their recalculation whenever referee or referee-coach assignments change on the allocation page.

The persisted statistics are represented by `TournamentRefereeAllocationStatistics` and `FragmentRefereeAllocationStatistics`. The backend calculation logic already exists; this change adds the calculation triggers and the allocation-page display.

## Scope

### In scope

- Trigger recalculation after adding or removing a referee or referee coach from a game.
- Display referee statistics in a drawer opened from the allocation page.
- Provide filtering and the General, Games, Buddies, Coaches, and Teams views.
- Implement the statistics Drawer in a dedicated frontend component so its presentation and state are isolated from the allocation grid page.
- Support statistics scoped either to the current fragment (part or full day) or to the tournament allocation.

### Out of scope

- Changing the persisted statistics model or rewriting the existing backend calculation algorithm.
- Changing referee or coach allocation rules.
- Adding statistics for roles other than referees.

## Functional requirements

### Recalculation triggers

From the allocation page, call the backend statistics computation whenever a game allocation changes:

- Adding or removing a referee coach on a game recalculates statistics for all referees assigned to that game.
- Adding a referee on a game recalculates statistics for all referees assigned to that game, including the new referee.
- Removing a referee from a game recalculates statistics for all referees still assigned to that game and for the referee that was removed.

The computation API accepts a `gameId` and discovers the referees assigned to the game. It also accepts `attendeeIds`, which is used to pass the identifier of a referee removed from a game. The exact frontend invocation and error-handling workflow are to be clarified.

The frontend calls the computation API after the allocation save succeeds and does not wait for the computation to complete before continuing the allocation workflow or refreshing the UI.

### Statistics display

- Statistics must be easily accessible from the allocation page but must not be permanently visible.
- Use a PrimeNG drawer occupying approximately 50% of the screen.
- The drawer opens from the right.
- Use `p-drawer`, with a width of approximately 40% on large screens and 100% on small screens.
- Allow the user to resize the right-positioned drawer by dragging its left edge. Keep the width between 320px (or the viewport width on smaller screens) and 90% of the viewport, and support equivalent Arrow/Home/End keyboard resizing when the resize handle has focus.
- Store the selected drawer width as a user-local preference. On loading and browser-window resizing, discard the preference and restore the responsive default when it is outside the current viewport bounds.
- Add an icon to the left of the home icon in the allocation-page navigation area to open the drawer.
- Clear the active allocation-grid selection when opening the drawer so keyboard events are not handled by `RefereeSelector` while the drawer is active.
- The drawer contains a compact filter area at the top and a tab area below it.
- The layout should be inspired by `RefereeSelector`.
- Display a refresh icon in the top-right corner of the statistics drawer.
- Clicking the refresh icon starts a manual recalculation in the currently selected scope (Fragment or Tournament), regardless of the active display filters. The Fragment scope uses all referees available for the displayed allocation period; the Tournament scope uses all referees registered in the tournament. Neither scope relies on the already persisted statistics population.
- While the manual recalculation is running, replace the refresh icon with a spinner and prevent another manual refresh from starting.
- Parallelize the calculations in batches of at most 10 referees. The spinner remains visible until every batch has completed.
- After all calculations have completed, reload the statistics and update the drawer contents.
- Referee levels are displayed as colorized rounded badges before the referee name, using the configured referee badge colors.

## Business rules

- The displayed population consists only of referees for whom a statistics document exists in the selected scope; it is not the complete tournament referee list.
- The resulting statistics population is further limited by the selected search and referee attributes.
- Fragment scope uses only the currently displayed allocation fragment: the complete day for a day-level fragment, or only the part of the day for a part-day fragment.
- Tournament scope means the complete tournament allocation.
- Only referee statistics are displayed, even though referee-coach allocations can trigger recalculation.
- When statistics are missing, stale, or still being recalculated, keep the last available data without a visual state distinction. Recalculation and loading errors are logged without a blocking or user-visible error message.

## User interface and workflow

### Filters

The filter area contains:

- A text input for search.
- A `Force refresh` button at the end of the first filter row.
- When the search input is not empty, display an icon button in the input to clear the search text.
- Select controls do not display separate text labels. Their default options are `All levels`, `All categories`, and `All genders`.
- The level, category, and gender selects display a clear icon; clearing a selection restores its default value. The scope select has no clear icon.
- A level selector: All, Level 1 through Level 6.
- A category selector: All, Junior, Open, Senior, Master.
- An upgrade-only checkbox.
- A gender selector: All, Male, Female.
- A `Player Referee` checkbox for player referees.
- Two radio buttons for the display scope: the current day or part-of-day name, and Tournament. The technical term `Fragment` must not be shown to users.
- For a full-day allocation, display `Day X`, where `X` is the day number. For a part-day allocation, display the `PartDay` name.

### Tabs

Each tab displays a specific part of the statistics and may use a table or a list:

- TimeSlot
- General
- Games
- Buddies
- Coaches
- Teams

### TimeSlot tab

Display the same referee-by-timeslot matrix as the `Referees List` planning view. The matrix uses the referees selected by the allocation-statistics filters, the timeslots of the selected scope, and the corresponding referee allocations. It keeps the existing field, video, bad-quality, sticky-header, and sticky-referee-column behavior. Export icons are hidden in the drawer; the planning view keeps its PDF and Excel exports. The matrix is implemented by a shared dedicated component used by both views.

Clicking a timeslot header highlights that column, including its header and empty cells, in pale blue. This highlight has priority over the other cell colors. Clicking the highlighted header removes the highlight, and selecting another header moves the highlight to that column. Clicking a populated cell closes the drawer and selects the corresponding referee position in the allocation grid, scrolling it into view.

### General tab

Display a sortable table for the selected referees. Columns:

- Referee level prefix `<level><category><upgrade>` followed by a space and the referee first name and last name; no parentheses or `L` prefix are used.
- `gameIds.length`.
- `nbGamesOnBadField`.
- `nbGamesOnVideo`.
- `firstTimeSlot`.
- `lastTimeSlot`.
- In the `First slot` column, use a pale blue background when the referee's first slot is the first slot of the day.
- In the `Last slot` column, use a pale orange background when the referee's last slot is the last slot of the day.

In Tournament scope, omit the `First slot` and `Last slot` columns because the tournament-wide statistics do not represent a single day.

All General columns must be sortable using PrimeNG table functionality. Clicking a column header selects that column; clicking the same header again toggles ascending and descending order. This applies to the referee name, all counters, and both time-slot columns. The first and last slot background highlights remain attached to their respective values when sorting.

### Games tab

Display:

- Radio buttons on one line to sort referee cards by ascending game count, descending game count, or referee name.
- One card per selected or filtered referee.

Each card contains the complete `<level><category><upgrade>` prefix, followed by a space and the referee first name and last name. The level prefix is displayed with the configured referee badge colors. The number of games, followed by the number of games per division when greater than zero, is displayed as plain text in the card body, below the referee name and without parentheses. The referee's games are sorted chronologically: first by tournament day, then by the timeslot start time, and finally by field when needed.

For each game, display: time slot, field, division, home team, away team, referees, and coaches. Do not display the redundant `Referees` or `Coaches` labels. When a game has no coach, omit the coach text and its separator entirely. In Tournament scope, display the day as `Day X`; in a day or part-day scope, omit the day because it is redundant with the selected fragment.

Clicking a game row closes the drawer and selects the corresponding referee cell in the currently displayed allocation grid. Keyboard activation with Enter or Space has the same behavior.

### Buddies tab

Display:

- Radio buttons on one line to sort referee cards by ascending or descending total number of games refereed with buddies, or by referee name.
- One card per selected or filtered referee.

Each card contains the referee name prefixed by `<level><category><upgrade>` without card-content indentation. Below the title, display the number of buddies followed by the `buddiesBadgeAvg` summary (the average level of the buddies) as plain text on its own line. The card content below the title uses 20px left padding. Each buddy displays `<level><category><upgrade>` followed by a space, first name, last name, and the number of games. Buddies within each card are sorted alphabetically by referee name.

### Coaches tab

Display a sortable table for the selected or filtered referees. Columns:

- Referee level prefix `<level><category><upgrade>` followed by a space and the referee first name and last name; no parentheses or `L` prefix are used.
- `averageCoachingLevel`, the average level of the coaches who coached the referee.
- Total number of games with at least one coach.
- One column per coach; each cell contains the number of times that coach saw the referee.

All columns must be sortable using PrimeNG table functionality. Clicking a column header selects that column; clicking the same header again toggles ascending and descending order.

### Teams tab

Display:

- A filter for the minimum number of games, defaulting to 2.
- A sortable table with referee, division, team name, and number of refereed games columns.

All columns must be sortable using PrimeNG table functionality. Clicking a column header selects that column; clicking the same header again toggles ascending and descending order. By default, sort by the number of refereed games column in descending order.

## Data model and persistence

- Use `FragmentRefereeAllocationStatistics` for fragment-scoped data and `TournamentRefereeAllocationStatistics` for tournament-scoped data.
- Existing frontend services provide access to both statistics collections: `FragmentRefereeAllocationStatisticsService` and `TournamentRefereeAllocationStatisticsService`.
- The existing backend route is `/refereeAllocationStatistics/compute` and accepts `tournamentAllocationId`, `fragmentAllocationId`, `refereeAttendeeIds`, and/or `gameId` according to its current contract.
- No new persisted fields are currently required.
- Allocation changes made in `GameRefereeAllocator` trigger the existing computation route after the Firestore write completes. The request targets the changed game; when a referee is removed, its identifier is also sent so its persisted statistics are recalculated with no assigned games. An open statistics drawer reloads after the recalculation.
- Map `firstTimeSlotIdx` and `lastTimeSlotIdx` to the corresponding tournament time-slot display values. Resolve referee and coach names, levels, categories, upgrade markers, divisions, teams, fields, and game details from the existing tournament and attendee data. Generate Coaches columns dynamically from the coaches present in the selected statistics and display zero when a referee has no occurrence with a given coach.

## Errors, validation, and permissions

- Recalculation failures must not block or visibly interrupt the allocation workflow; they are logged and the last available statistics remain displayed.
- A manual refresh completes only after all scheduled referee calculations have settled; failures are logged and the successfully recalculated statistics are still reloaded into the drawer.
- Statistics loading and recalculation states do not require separate user-visible indicators; the last available statistics remain displayed when present.
- Existing Firestore permissions and backend authentication behavior remain unchanged unless the implementation requires a documented API-contract change.

## Compatibility and migration

- Existing persisted statistics and allocation documents must remain compatible.
- No migration is planned.
- Optional `partDayId` is omitted from persisted day-level statistics documents instead of being written as `undefined`.
- The backend computation is already implemented, but its current route contract and data resolution must be respected by the frontend.

## Acceptance criteria

- Adding a referee recalculates statistics for all referees on the affected game, including the new referee.
- Removing a referee recalculates statistics for the remaining referees and the removed referee.
- Adding or removing a referee coach recalculates statistics for all referees on the affected game.
- The statistics drawer can be opened from the allocation page and is right-positioned without permanently occupying the page; it uses `p-drawer` at approximately 40% width on large screens and 100% on small screens.
- The drawer width can be changed by dragging its left edge and remains within the documented minimum and maximum bounds; the resize handle is keyboard accessible.
- The selected width is stored in the user-local preferences and is validated on initial loading and browser-window resizing.
- All specified filters and five tabs are available.
- General, Coaches, and Teams tables support the specified sorting behavior.
- Repeated clicks on a table column header toggle ascending and descending order.
- Games and Buddies cards show the specified summaries and details.
- Buddies cards provide one-line radio buttons for ascending buddy-game count, descending buddy-game count, and referee name.
- A Buddies card title contains only the referee identity; its average buddy level is plain text on the following line, and the remaining card content has 20px left padding.
- The Buddies summary line starts with the number of buddies.
- Buddies within each card are sorted alphabetically by referee name.
- Fragment and Tournament scopes display the corresponding persisted statistics, and only referees with an available statistic are listed.
- Missing, loading, and failed statistics states do not block allocation; available statistics remain displayed and failures are logged.
- The manual refresh spinner disappears only after all recalculation batches have completed, including failed calculations.
- The manual refresh covers every available referee in the selected fragment scope, or every tournament referee in the selected tournament scope, not only referees with an existing statistics document or referees currently visible after filtering.

## Open decisions

None.

## Verified repository impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Backend | `functions/src/allocation-statistics.ts`, exported from `functions/src/index.ts` | Consume the existing computation route; implementation must account for its current query parameters. |
| Persistent model | `persistent-data-model/src/referee-allocation.ts` | Reuse existing statistics interfaces; no model extension identified. |
| Frontend allocation workflow | `frontend/src/page/tournament-referees-allocation.page.ts`, `frontend/src/component/game-referee-allocator.component.ts` | Trigger computation after referee and coach mutations and load/display statistics. |
| Frontend persistence services | `frontend/src/service/fragment-referee-allocation-statistics.service.ts`, `frontend/src/service/tournament-referee-allocation-statistics.service.ts` | Reuse existing collection access services. |
| Documentation | `doc/datamodel.md` documents both statistics collections and fields | Existing data-model documentation remains accurate for the requested feature; this spec records the new UI/workflow behavior. |

## Readiness

Ready for implementation.
