# Water Carriers Statistics

Last updated: 2026-10-24

## Objective

Provide statistics showing which referees contribute as water carriers during a competition.

## Scope

### In scope

- Add a `Water carriers stats` tab to the planning page, immediately after the existing `Water carriers` tab.
- Display referee-level statistics for the time period selected on the planning page.
- Provide filtering and refresh controls equivalent to the existing `Referee List` tab.

### Out of scope

- Changes to the existing water-carrier allocation workflow.
- Recalculation of the number of matches refereed when that value is already available from allocation statistics.

## Functional requirements

- The feature is enabled only when the competition's `water carrier online` feature is enabled.
- The tab is visible to referees and referee coaches participating in the competition.
- The table must contain one row per relevant referee and these columns:
  - Referee first name and last name; referee level is not displayed.
  - Number of matches refereed.
  - Number of matches in which the referee acted as a water carrier.
  - Percentage ratio between the two counts, displayed without decimal places and with a `%` suffix.
- The table must be sortable by every column in ascending and descending order.
- The number of matches refereed must come from the existing allocation statistics.
- The number of matches as a water carrier must be calculated when the page loads by loading all competition attendees whose role is `WaterCarrier`.
- The percentage ratio must be calculated on demand.
- Add a filter bar above the table, identical to the one in the `Referee List` tab on the same page.
- Add a `Refresh` button at the right end of that filter bar to reload the data.

## Business rules

- The selected planning-page time period applies to all displayed statistics.
- When the number of matches refereed is zero, display an em dash (`—`) instead of a percentage.
- Water-carrier assignments must be matched to referees by exact `attendeeId`; no name, email, or `personId` fallback is used.

## User interface and workflow

- The new tab appears after `Water carriers` in the planning page tab order.
- The tab is available only to participating referees and referee coaches, subject to the feature flag described above.
- On initial load, the page loads the water-carrier attendee data and displays the table.
- Selecting `Refresh` reloads the data using the current time period and filter state.
- The filter fields, filtering semantics, empty state, and loading/error presentation should match `Referee List` unless explicitly specified otherwise.

## Data model and persistence

- No persistent data-model change is currently specified.
- Existing allocation statistics provide the number of matches refereed.
- Competition attendees with role `WaterCarrier` provide the source records for water-carrier participation.
- The referee identity is matched using exact `attendeeId` equality between the water-carrier assignment and the referee statistics record.

## Errors, validation, and permissions

- The feature must remain unavailable when the competition's water-carrier-online feature is disabled.
- Access is limited to referees and referee coaches participating in the competition.
- Loading, refresh, empty-result, and data-loading error behavior must match the existing `Referee List` and planning-page conventions.

## Compatibility and migration

- No migration is expected because no persistent schema change is specified.
- Existing planning tabs and allocation statistics must remain unchanged.

## Technical specifications

- Reuse the planning-page tab, filtering, sorting, time-period, permissions, and refresh patterns where available.
- Reuse the existing allocation-statistics data source for matches refereed.
- Query competition attendees filtered by role `WaterCarrier` for water-carrier match counts.
- Compute the percentage in the presentation/data-access layer at load or refresh time rather than persisting it.
- Identify the exact frontend components, services, backend functions, queries, and tests after inspecting the current implementation.

## Acceptance criteria

- The tab is present, ordered correctly, and gated by the water-carrier-online feature flag.
- Authorized participating referees and referee coaches can view the table for the selected period.
- Every required column is present, sortable in both directions, and formatted as specified.
- The matches-refereed value comes from existing allocation statistics.
- Water-carrier counts are based on competition attendees with role `WaterCarrier` and respect the selected period.
- Filtering and refresh behave consistently with the `Referee List` tab.
- Unauthorized users and competitions without the feature enabled cannot access the feature.
- Existing planning functionality continues to work.

### List of new tests

- Feature-flag visibility tests.
- Permission and participation tests.
- Correct tab ordering and table-column tests.
- Time-period filtering tests.
- Water-carrier attendee aggregation tests.
- Reuse of allocation-statistics match counts.
- Zero-match ratio handling tests.
- Sorting, filtering, refresh, loading, empty, and error-state tests.

## Open decisions

- Define the percentage when the number of matches refereed is zero.
- Water-carrier counts include only assignments whose associated match or allocation fragment belongs to the selected planning period.
- The authoritative field used to determine period membership is the match's `fragmentRefereeAllocationId`.

## Spec analysis

### Readiness

Ready for implementation.

### Summary

The feature adds a period-aware, feature-gated statistics tab to the referee planning page. It reuses allocation statistics for matches refereed, counts `WaterCarrier` assignments by exact `attendeeId` within the selected `fragmentRefereeAllocationId`, and computes a non-persistent percentage. A zero denominator is displayed as `—`.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Planning UI | `frontend/src/page/referee-planning/referee-planning.page.ts` and `.html` | Add the tab, visibility rule, selected-period integration, and refresh wiring. |
| Water-carrier data | `frontend/src/component/water-carrier/`, `frontend/src/service/water-carrier.service.ts`, `persistent-data-model/src/water-carrier.ts` | Reuse existing assignment identifiers and period structures; add statistics loading/aggregation as needed. |
| Allocation statistics | `functions/src/allocation-statistics.ts`, `doc/changes/allocation-statistics.md` | Consume existing referee match counts; do not recalculate them. |
| Permissions and feature flags | `frontend/src/config/tournament-features.ts`, existing planning-page access rules | Gate the tab on `ONLINE_WATER_CARRIER` and participating referee/referee-coach access. |
| Documentation | `doc/pages.md`, `doc/features.md`, `doc/functions.md`, `doc/datamodel.md` | Review and update descriptions when the implementation changes the documented planning behavior. |

### Remaining assumptions

- Existing `Referee List` filter, sorting, loading, error, and empty-state conventions are reusable for the new tab.
- The selected period is represented by the match's `fragmentRefereeAllocationId`.
- No persistent schema or migration is required.

### Recommended implementation breakdown

1. Add the tab and access/feature gating to the referee planning page.
2. Add a statistics data contract and service/query that combines allocation statistics with `WaterCarrier` assignments for the selected fragment.
3. Add the filtered, sortable table and ratio formatting, including `—` for zero matches refereed.
4. Wire period changes and `Refresh` to reload the data.
5. Update affected documentation and add focused frontend/backend tests.

### Recommended checks

- Run the focused referee-planning and water-carrier test suites.
- Verify feature gating, participation permissions, exact attendee matching, period filtering, sorting, refresh, and all loading states.
- Verify that existing planning tabs and allocation statistics remain unchanged.
