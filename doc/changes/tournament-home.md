# Tournament home

Last updated: 2026-09-07

## Objective

Provide an attractive, public tournament home page that gives every tournament participant a concise overview of the tournament and, when authenticated, exposes the actions relevant to the current user's tournament roles.

## Scope

### In scope

- A public route at `/tournament/:tournamentId/home`, accessible without authentication.
- A read-only public overview of tournament dates, venue, divisions, teams, fields, referee staffing, referee levels, player-referee configuration, and match/allocation indicators.
- A private action area whose links depend on the authenticated user's roles, enabled tournament modules, and tournament phase.
- A responsive layout with a public overview area and a right-side action column (approximately 30% on wide screens).
- Persisted allocation counters on `FragmentRefereeAllocation`, initially set to zero; a later allocation change will populate them.

### Out of scope

- Editing tournament data from the home page.
- A venue map or field plans; these may be added later.
- Implementing the Draw Designer itself; the home page only links to its existing placeholder/page when applicable.
- Computing or refreshing persisted allocation counters while loading the home page.
- Implementing allocation, upgrade voting, ranking, or scheduling workflows themselves.

## Functional requirements

### Public overview

The page must display, read-only:

- The tournament name, venue, city, country, start date, end date, and each tournament day's start and end times.
- Every division and the team names belonging to that division.
- The number of fields, the number of fields with video
- The number of full-time referees and the number of player referees.
- A referee pyramid grouped by relative badge level and split by gender.
- Whether player referees are allowed and, when they are allowed, the percentage of player referees among all referees.
- The total number of matches, the number of matches with an allocation, and the number of matches still to allocate.

### Authenticated action area

The action area must be rendered as a list of links. It must support the Tournament Manager and Referee Coach roles and must show only actions the current user is allowed to use. Only routes that currently exist may be rendered; missing or not-yet-implemented routes must not produce links.

Before the tournament, relevant actions include:

- Referee recruitment/management: link to the referees page.
- Referee Coach recruitment/management: link to the referee coaches page.
- Match definition, for Tournament Managers and Game Allocators only:
  - FIT Import when the `FIT_IMPORT` module is enabled.
  - Draw Designer when the `DRAW_DESIGNER` module is enabled.
  - Manual/import game management.
- Referee and Referee Coach allocation once referees and matches exist.

During the tournament, a Referee Coach may access links for adjusting referee allocations, voting for upgrades, and ranking referees, subject to the corresponding enabled modules and permissions.

Before and during the tournament, authorized users may access referee planning and match planning.

The content adapts to the phase derived from the tournament dates in the tournament time zone: before when `now < startDate`, during when `startDate ≤ now ≤ endDate`, and after when `now > endDate`.

## Business rules

### Referee pyramid

The pyramid has one row for each of these relative levels, from highest to lowest:

1. The highest badge in each system: `6/6`, `5/5`, or `4/4`.
2. One level below the maximum: `5/6`, `4/5`, or `3/4`.
3. Two levels below the maximum: `4/6`, `3/5`, or `2/4`.
4. Three levels below the maximum: `3/6`, `2/5`, or `1/4`.
5. Four or more levels below the maximum: `1/5`, and `1/6` or `2/6`; player referees belong in this row.

Each row has a blue bar on the left for male referees and a pink bar on the right for female referees. Each bar displays the total referees in that gender/level and, among them, the number seeking an upgrade.

An attendee is a full-time referee when `isReferee === true` and the attendee is not associated with a team (`player?.teamId` is absent). An attendee associated with a team and acting as a referee is a player referee. The implementation must use the team association as the authoritative distinction, with `isPlayer` treated as supporting legacy data only.

Gender values are `M` or `F` in the current model. Missing or unrecognized gender values must be counted as `M` for the pyramid and gender totals.

### Indicator calculations

The following calculation rules are proposed from the current data model and must be confirmed:

- Date values in the persistent model are Unix timestamps in seconds; convert them to JavaScript milliseconds when using Angular `DatePipe`. Day start/end is the minimum timeslot start and maximum timeslot end across all parts and timeslots for the day; display in the tournament time zone.
- Field count: `tournament.fields.length`; video count is the number of fields with `video === true`.
- Division/team display: use `tournament.divisions` and each division's `teams` array.
- Total matches: count all `Game` documents belonging to the tournament.
- Allocated and remaining matches: use the current `TournamentRefereeAllocation`, resolve its selected fragments, and aggregate their persisted `nbGamesAllocated` and `nbGamesToAllocate` counters; do not recalculate these values from `GameAttendeeAllocation`.
- Player-referee percentage: player referees divided by all referees, multiplied by 100; display `0%` when the denominator is zero.
- Persisted allocation counters: add `nbGamesAllocated` and `nbGamesToAllocate` to `FragmentRefereeAllocation`; both are fragment-level, new fragments initialize them to `0`, and the home page must read them without recomputing them.

## User interface and workflow

- Use a prominent tournament header followed by overview indicator cards/sections.
- Present dates and daily times in a compact schedule block.
- Format daily dates as English weekday followed by `DD/MM/YYYY` (for example, `Wednesday, 21/01/1970`).
- Present divisions and teams in a readable grouped list.
- Sort divisions by category and age: men's (`MO`, `M30`, `M35`, ...), women's (`WO`, `W27`, `W35`, ...), then mixed (`XO`, `X30`, ...); display each division name with its configured font and background colors.
- Present fields and referee metrics as separate overview cards.
- Present the referee pyramid as a horizontal mirrored bar chart: male bars extend left, female bars extend right, with totals and upgrade counts inside or adjacent to each bar.
- Place the authenticated action list in a right-side column on wide screens and above/below the overview on narrow screens.
- Show loading and empty states for data that is not yet available; do not expose edit controls in the public area.
- Use accessible labels and text alternatives for chart values; color must not be the sole way of distinguishing genders or status.

## Data model and persistence

Existing sources include `Tournament`, `Field`, `Day`, `PartDay`, `Timeslot`, `Division`, `Team`, `Attendee`, `Game`, and `GameAttendeeAllocation` in `persistent-data-model/src/`.

The home page currently loads only `Tournament` in `frontend/src/page/tournament-home.page.ts`. Public indicators must be loaded through a dedicated aggregate endpoint/service that returns only anonymized overview data. It must not expose emails, availability, upgrade votes, detailed statistics, or other personal data.

`FragmentRefereeAllocation` in `persistent-data-model/src/referee-allocation.ts` must gain the persisted counters `nbGamesAllocated` and `nbGamesToAllocate`, initialized to zero. No migration is currently specified; legacy documents must remain readable with a zero fallback unless a different migration policy is selected.

## Errors, validation, and permissions

- Missing or invalid `tournamentId` redirects to the tournament list, as in the current page behavior.
- A missing tournament redirects to the tournament list.
- Public overview data must be read-only and must not require an authenticated user.
- Action links must not be displayed unless the current user's attendee/role and module permissions allow the action.
- Missing optional data must produce an explicit empty state rather than a broken chart or negative counter.
- The action mapping is:
  - `TournamentManager` or `GameAllocator`: referee and coach management, game management, FIT Import when enabled, Draw Designer when enabled, and referee/coach allocation.
  - `RefereeCoach`: referee/coach allocation, available planning routes, upgrade when `UPGRADE` is enabled, and ranking when `RANKING` is enabled.
  - Any authorized user: available planning consultation routes.
  - Functionality without an existing route is omitted.

## Compatibility and migration

- Preserve the existing public home route and current-tournament selection behavior.
- Preserve compatibility with tournaments that do not contain optional module configuration, player-referee configuration, or the new allocation counters.
- No historical data migration is currently required; missing counters should be treated as zero unless the confirmed design requires a backfill.

## Acceptance criteria

- An unauthenticated visitor can open the tournament home route and see the complete public overview for a valid tournament.
- The page is read-only in the public area and is responsive on desktop and mobile widths.
- Daily times, divisions, teams, fields, referee totals, pyramid values, player-referee percentage, and match/allocation indicators follow the confirmed calculation rules.
- The pyramid has the five specified relative levels, mirrored gender bars, totals, and upgrade counts, including empty levels.
- Authenticated users see only permitted links, with module-dependent links hidden when modules are disabled.
- Invalid/missing tournament data and missing optional fields are handled without runtime errors.
- Existing route behavior and legacy tournament documents remain compatible.
- Frontend build and relevant tests pass.

## Open decisions

1. Confirmed: use a dedicated public aggregate endpoint/service returning only the anonymized indicators required by the home page.
2. Confirmed: `nbGamesAllocated` and `nbGamesToAllocate` are fragment-level counters with a default value of `0`.
3. Confirmed: `Game` is authoritative for the total match count; the current `TournamentRefereeAllocation` and its selected fragments are authoritative for allocated and remaining counts.
4. Confirmed: a full-time referee is an attendee with `isReferee === true` and no `player?.teamId`; a referee associated with a team is a player referee.
5. Confirmed: missing or unrecognized gender values are counted as `M`.
6. Confirmed: before is `now < startDate`, during is `startDate ≤ now ≤ endDate`, and after is `now > endDate`, evaluated in the tournament time zone.
7. Confirmed: use only existing routes; managers/game allocators get management and enabled-module links, referee coaches get allocation/planning and enabled upgrade/ranking links, and no link is rendered for functionality without a route.

## Spec analysis: tournament-home.md

### Readiness

Ready for implementation.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend page | `frontend/src/page/tournament-home.page.ts`, `frontend/src/app/app.routes.ts` | Replace placeholder content while preserving the public route and tournament loading behavior. |
| Shared model | `persistent-data-model/src/tournament.ts`, `referee.ts`, `referee-allocation.ts` | Reuse existing tournament/referee data and add confirmed allocation counters. |
| Data access | `frontend/src/service/tournament.service.ts`, collection names and existing services | Add typed reads or a public aggregate contract; verify Firestore rules/security. |
| Actions | `frontend/src/config/tournament-features.ts` and route definitions | Derive links from roles, enabled modules, and existing routes. |
| Documentation | `doc/datamodel.md` and this file | Update persisted-field documentation if the model changes; this spec records the current design decisions. |

### Remaining assumptions

- The current tournament document remains the source for public tournament metadata.
- The new counters are optional on legacy documents and default to zero.
- A later allocation feature will populate counters; this home-page change will not recompute them.
- The public aggregate endpoint will perform the required server-side reads and return only anonymized overview data.

### Recommended implementation breakdown

1. Add the confirmed shared-model fields and their defaults.
2. Implement typed data loading and public-read/security handling.
3. Implement public overview cards, grouped data, and the accessible referee pyramid.
4. Implement role/module/phase-aware action links.
5. Add tests, update `doc/datamodel.md` if required, and verify the frontend build.

### Recommended checks

- Test zero/one/many values for every indicator and empty pyramid levels.
- Test legacy tournaments without optional fields and counters.
- Test authenticated and unauthenticated access, role combinations, and disabled modules.
- Test responsive layout and keyboard/screen-reader access to chart values.
- Verify Firestore rules or the aggregate endpoint expose only intended public data.
