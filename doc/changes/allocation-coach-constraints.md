# Allocation coach constraints

Last updated: 2026-08-26

## Objective

Apply the coach-allocation constraints configured in `GeneralAllocationConfiguration` when referee coaches are allocated to games.

The configuration is stored at tournament-allocation level or fragment-allocation level, as described by `configure-allocation.md`.

## Scope

### In scope

- Enforce `maxGameInRowForRefereeCoach` during referee-coach allocation.
- Enforce `refereeCoachTwoField` during referee-coach allocation.
- Enforce each coach attendee's persisted unavailability during referee-coach allocation.
- Resolve the effective configuration using fragment-level, tournament-allocation-level, then default precedence.
- Preserve compatibility with allocation documents that do not contain `generalConfig`.
- Add regression coverage for the coach constraint rules.
- Centralize allocation problems for referees and referee coaches and expose them globally and locally in the allocation grid.

### Out of scope

- Changing the `GeneralAllocationConfiguration` data structure.
- Changing the allocation configuration form or persistence workflow already specified in `configure-allocation.md`, unless required to expose or consume these existing fields.
- Changing referee-only constraints, allocation statistics, or unrelated allocation rules.

## Functional requirements

- The referee-coach allocator must use the effective `GeneralAllocationConfiguration` for the allocation fragment being edited or generated.
- `maxGameInRowForRefereeCoach` is expressed in minutes and limits the maximum consecutive game time assigned to one referee coach.
- When `refereeCoachTwoField` is `false`, one referee coach must not be allocated on more than one field during the same timeslot.
- When `refereeCoachTwoField` is `true`, one referee coach may be allocated on at most two fields during the same timeslot, with one half-time on each game.
- The constraints apply to manual allocation and to any automatic allocation introduced later. There is currently no automatic allocation workflow in the repository.
- Candidates that would violate a constraint are excluded from the selectable coach list. Every save operation must also validate the resulting allocation and reject invalid data.
- A coach is not eligible for a game when the coach attendee is unavailable for that game's day and timeslot.
- Existing invalid allocations are preserved. They are reported when the relevant allocation is edited, but are not automatically repaired or deleted.

## Technical implementation

### Coach candidate calculation

The manual allocation page already loads the complete tournament coach list and passes it to `GameRefereeAllocatorComponent` through its `coaches` input. For each game, the component will derive the selectable list by evaluating every coach in that list against the current game and the other games visible in the active allocation period.

The calculation is deliberately direct and synchronous. A tournament has approximately 15 coaches, so building an index or scheduling asynchronous batches for coaches would add complexity without a measurable benefit. The list is recalculated when the current game, allocation snapshot, or effective configuration changes.

The evaluator will apply these checks in order:

1. The coach attendee is available for the target day and timeslot, using `findDayUnavailability()` and `isSlotUnavailable()` from `persistent-data-model/src/referee-availability.ts`.
2. The coach is not already allocated to the target game.
3. The coach's assignments in the active fragment are collected from the loaded `GameView[]` values.
4. The same-timeslot field-count rule is applied: maximum one field when `refereeCoachTwoField` is `false`, maximum two fields when it is `true`.
5. The consecutive-time rule is evaluated with the existing referee algorithm and `timeslot.slotType.playTime`.

The current game must be excluded from the historical assignment set before evaluating a replacement or already selected coach. Existing invalid selections must remain displayed, but must not make an otherwise valid candidate appear invalid solely because of that same current-game assignment.

### Reuse of the referee mechanism

The coach implementation will reuse the referee mechanism at the business-rule level, not by forcing coaches into the referee index model. In particular, it will reuse:

- `effectiveAllocationConfiguration()` for fragment, tournament, and default precedence;
- `findDayUnavailability()` and `isSlotUnavailable()` for attendee availability;
- the chronological consecutive-time algorithm currently implemented by `isRefereeEligible()`.

The coach-specific evaluator will be a separate typed function or service because coaches have different same-timeslot semantics: referees are currently forbidden from sharing a timeslot, while coaches may share it on two fields when configured. The evaluator must accept the complete game snapshot and return an eligibility result with a stable reason code, for example `unavailable`, `same-timeslot-limit`, or `consecutive-time-limit`.

The existing asynchronous `RefereeSelectorFacade.prepareAsync()` and referee index will not be reused for coaches. They support a richer referee search and are justified by the larger referee list; they are unnecessary for approximately 15 coaches.

### Manual UI integration and persistence validation

`GameRefereeAllocatorComponent` will receive the data required by the evaluator: the current game, the coach list, the active fragment allocation, the tournament allocation, and the period game snapshot. Its PrimeNG multiselect will use the eligible coach list as options while preserving currently selected coaches that are historical invalid assignments.

`coachesSelected()` will validate each newly requested coach immediately before creating or updating a `GameAttendeeAllocation`. The same validation function will run immediately before every coach allocation write, so a stale UI list cannot create a new invalid assignment. Invalid requests are rejected without deleting existing assignments and expose the evaluator reason to the user.

The evaluator will be pure and independent from Angular and Firestore. This permits unit tests to cover the rules directly and allows a future automatic allocator to call the same function without duplicating logic.

## Allocation problem diagnostics

### Central problem model

The allocation page will maintain one derived, centralized list of all detected problems for the active fragment. The list covers both referees and referee coaches and is recalculated from the current in-memory allocation snapshot after loading and after every allocation change.

The implementation will introduce a shared typed problem model, for example:

```ts
type AllocationProblemKind =
  | 'missing-referee'
  | 'referee-unavailable'
  | 'referee-consecutive-time'
  | 'referee-daily-time'
  | 'referee-same-timeslot'
  | 'coach-unavailable'
  | 'coach-consecutive-time'
  | 'coach-same-timeslot';

interface AllocationProblem {
  id: string;
  kind: AllocationProblemKind;
  message: string;
  dayId: string;
  timeslotId: string;
  fieldId?: string;
  gameId?: string;
  attendeeId?: string;
  attendeeRole?: 'Referee' | 'Coach';
}
```

The exact TypeScript location may be chosen during implementation, but the model must be independent from the UI and stable enough to support grouping, counting, testing, and navigation. Problem IDs must be deterministic for the same allocation state so Angular rendering does not duplicate rows after refresh.

### Problem calculation

A dedicated pure diagnostics function/service will inspect every game in the active fragment and return the complete `AllocationProblem[]`. It will reuse the coach and referee eligibility/constraint functions wherever possible, while also evaluating existing assignments rather than only prospective candidates.

The diagnostics list must include:

- missing referee positions, preserving the existing `missingRefereeSlots()` behavior;
- referee assignments that violate availability, same-timeslot, consecutive-time, or daily-time rules;
- coach assignments that violate attendee availability, the configured same-timeslot field limit, or the configured consecutive-time limit.

Availability problems are computed from the persisted `Attendee.unavailabilities` values. An absent entry means available; `TOTAL` and `PARTIAL` entries are interpreted through `findDayUnavailability()` and `isSlotUnavailable()`.

The diagnostics must not mutate or automatically repair allocations. Historical invalid assignments are included in the list and remain visible in the grid.

### Global display

The existing red warning triangle in the allocation header becomes the entry point for the complete problem list. It is displayed whenever the centralized list is non-empty and its accessible label includes the total problem count. The current tooltip-only behavior is replaced or supplemented by a modal/dialog containing:

- the total number of problems;
- a readable message for every problem;
- grouping or filtering by problem type and role when useful;
- the affected game and attendee when applicable;
- an action to navigate to or focus the affected grid location.

Selecting a problem in the dialog must close the dialog and activate the corresponding game/field cell using the existing selection/navigation mechanism. A missing-referee problem should continue to support the current shortcut that selects the first empty referee position; other problems select the affected game and, where possible, the affected attendee cell.

The navigation target is the exact visual element responsible for the problem: the referee position cell, the coach chip, or the match context/header cell. The target receives keyboard focus when possible and is visually emphasized briefly after navigation. If the target is currently hidden by a display preference, the page must enable the relevant display area before focusing it, or clearly indicate the closest visible target.

The dialog is the authoritative global view. The triangle must not encode only the number of incomplete referee matches, because coach and referee constraint violations must also be reachable from it.

### Local display

Each problem must also be visible at its source location in the allocation grid:

- A coach chip is rendered with the existing error/red visual treatment when that coach allocation is involved in one or more coach problems. The visual treatment must remain readable with the coach's configured colors, for example by using a red border/background and accessible contrast.
- A referee allocation cell is rendered with a red background when the referee assignment is involved in one or more referee problems.
- A match context/header cell remains red when referee positions are missing, as it is today.
- If several problems affect the same element, the element is highlighted once and the dialog contains each distinct problem.

Every red-highlighted element must expose a tooltip explaining the problem when hovered or focused. The tooltip content is generated from the corresponding `AllocationProblem` entries and must identify the failed rule in user-facing language. When several problems affect one element, the tooltip lists all distinct explanations rather than only the first one. The tooltip is supplementary; the problem dialog remains the complete list for keyboard and screen-reader access.

The local styles are derived from the same `AllocationProblem[]` list as the dialog; the UI must not implement independent duplicate eligibility checks.

### State and refresh behavior

The active allocation page will expose a signal or equivalent derived state for `allocationProblems`, plus lookup helpers such as `hasProblemsForGame(gameId)`, `hasProblemsForAttendee(gameId, attendeeId)`, and `problemCountForGame(gameId)`. The problem list is refreshed after successful allocation changes and whenever the loaded game, attendee, or configuration snapshot changes.

Persistence failures remain operation errors and must not be silently converted into allocation problems. A problem represents a persisted or currently loaded allocation inconsistency; an unsuccessful write is reported by the existing operation error handling.

## Business rules

Configuration precedence is:

1. The fragment-level configuration, when defined.
2. Otherwise, the tournament-allocation configuration, when defined.
3. Otherwise, the documented default values.

The default value of `maxGameInRowForRefereeCoach` is 160 minutes. The default value of `refereeCoachTwoField` is `false`.

Availability is evaluated before allocation constraints. An attendee is available by default when `unavailabilities` is absent or has no matching day entry. A matching `TOTAL` entry makes every timeslot of the day unavailable; a matching `PARTIAL` entry makes only the listed `unavailableSlotIds` unavailable.

Consecutive time is calculated exactly like the existing referee eligibility logic in `frontend/src/service/referee-selector.service.ts`: sort the coach's assignments and the candidate game by timeslot start; add `timeslot.slotType.playTime` while the next timeslot starts at or before the previous timeslot end; otherwise reset the run to the current slot's play time. Reject the candidate as soon as the run exceeds `maxGameInRowForRefereeCoach`.

The two-field rule is evaluated separately and may allow two assignments in the same timeslot; it must not be replaced by the referee-only same-timeslot prohibition.

## User interface and workflow

The existing allocation configuration workflow remains the source of these settings. Constraint violations are surfaced by filtering invalid candidates and by rejecting invalid saves. Existing invalid assignments remain visible and are reported when edited.

## Data model and persistence

No data-model change is currently required.

- `TournamentRefereeAllocation.generalConfig?: GeneralAllocationConfiguration`
- `FragmentRefereeAllocation.generalConfig?: GeneralAllocationConfiguration`
- `GeneralAllocationConfiguration.maxGameInRowForRefereeCoach`
- `GeneralAllocationConfiguration.refereeCoachTwoField`
- `Attendee.unavailabilities?: PartDayUnavailability[]`

These types are declared in `persistent-data-model/src/referee-allocation.ts`.

Availability helpers and the persisted representation are defined in `persistent-data-model/src/referee-availability.ts` and `persistent-data-model/src/tournament.ts`.

## Errors, validation, and permissions

Existing configuration validation and allocation-edit permissions remain applicable.

The allocation operation must reject any resulting coach allocation that violates the effective configuration. No override is allowed.

## Compatibility and migration

Existing documents without `generalConfig` remain valid and use the documented defaults through configuration precedence.

No migration is required. Existing invalid coach assignments are not deleted or repaired automatically.

## Acceptance criteria

- The effective configuration is resolved at the correct allocation scope.
- A coach cannot be assigned to overlapping fields in one timeslot when `refereeCoachTwoField` is `false`.
- An unavailable coach cannot be selected or saved for a game in an unavailable timeslot.
- A coach can be assigned to two fields in one timeslot when `refereeCoachTwoField` is `true`, provided each assignment occupies one half-time.
- A coach cannot exceed `maxGameInRowForRefereeCoach` consecutive minutes, using the same calculation as referee eligibility.
- Existing allocations without configuration continue to work with default values.
- Existing invalid allocations remain persisted and visible, and are reported when edited.
- Constraint behavior is covered by automated regression tests.
- The red warning triangle is shown for any missing-referee, referee-constraint, or coach-constraint problem.
- Opening the triangle displays every current allocation problem in a dialog, including its type and location.
- Selecting a problem from the dialog navigates to or focuses its affected game and field.
- Selecting a problem from the dialog navigates to and focuses the exact affected referee cell, coach chip, or match context cell.
- Invalid coach chips and referee assignment cells are highlighted in red at their source location.
- Missing-referee match context cells remain highlighted in red.
- Every red-highlighted element displays a tooltip explaining all problems affecting it on hover or keyboard focus.
- The selectable coach list is computed synchronously from the loaded coach list and current allocation snapshot; no coach-specific asynchronous index is created.
- Availability is checked with the shared attendee availability helpers before the allocation constraints.
- The final user-facing behavior for rejected or filtered assignments is documented.

## Open decisions

None.

## Code findings

- `GeneralAllocationConfiguration` and both optional persisted `generalConfig` fields are defined in `persistent-data-model/src/referee-allocation.ts`.
- The configuration workflow and precedence for manual referee selection are documented in `doc/changes/configure-allocation.md`.
- The allocation UI is implemented in `frontend/src/page/tournament-referees-allocations.page.ts`.
- Manual coach assignment is handled by `frontend/src/component/game-referee-allocator.component.ts`.
- Coach availability is persisted on `Attendee.unavailabilities` and evaluated by `findDayUnavailability` and `isSlotUnavailable` in `persistent-data-model/src/referee-availability.ts`.
- Referee candidate filtering is implemented in `frontend/src/service/referee-selector.service.ts`; its chronological consecutive-time algorithm is the reference for coaches.
- The allocation header currently renders the warning triangle and tooltip in `frontend/src/page/tournament-referees-allocation.page.ts`; it currently reports only incomplete referee positions and selects the first empty referee slot.
- The game context/header currently turns pale red when referee positions are incomplete in `frontend/src/component/game-referee-allocator.component.ts`.
- The repository TODO identifies coach availability and consecutive-match constraint checks as unfinished work (`doc/TODO.md`).

## Implementation readiness

Ready for implementation.

## Spec analysis: allocation-coach-constraints.md

### Readiness

Ready for implementation

### Summary

Coach availability and constraints apply to manual allocation and to any future automatic allocation. The recommended solution is a shared, pure eligibility/validation service that first evaluates attendee availability, then resolves the effective configuration and applies the allocation rules. The UI filters invalid candidates and every write is validated. Existing invalid allocations remain persisted and are reported when edited.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Shared model | `persistent-data-model/src/referee-allocation.ts`, `persistent-data-model/src/tournament.ts` | Reuse the existing optional `generalConfig` and `Attendee.unavailabilities` fields; no migration. |
| Configuration | `doc/changes/configure-allocation.md` and `frontend/src/page/tournament-referees-allocations.page.ts` | Reuse fragment/tournament/default precedence and existing settings. |
| Manual allocation UI | `frontend/src/component/game-referee-allocator.component.ts` | Compute a synchronous eligible coach list and reject invalid save attempts. |
| Availability | `persistent-data-model/src/referee-availability.ts` | Reuse the existing normalized availability helpers for coach eligibility. |
| Allocation context | `frontend/src/page/tournament-referees-allocation.page.ts` and `persistent-data-model/src/tournament.ts` | Use games, fields, timeslots, `slotType.playTime`, and allocation records to evaluate constraints. |
| Existing referee logic | `frontend/src/service/referee-selector.service.ts` | Match its chronological consecutive-time algorithm for coaches. |
| Documentation | `doc/datamodel.md`, `doc/TODO.md` | The data model remains accurate; the TODO item concerning coach constraints is addressed by this change. |

### Remaining assumptions

- A future automatic allocator must call the same shared validation logic rather than duplicate the rules.
- The existing `GameAttendeeAllocation.half` representation is used to verify the one-half-per-game condition for the two-field case.
- The active allocation page has a complete in-memory `GameView[]` snapshot for the games whose coach assignments affect eligibility.

### Recommended implementation breakdown

1. Extract a pure typed coach eligibility evaluator that checks attendee availability, resolves configuration, and evaluates same-timeslot and consecutive-time rules.
2. Pass the active period game snapshot to the coach allocator and integrate the evaluator into synchronous candidate filtering.
3. Add mandatory validation immediately before coach allocation persistence and preserve existing invalid selections.
4. Introduce a pure centralized allocation-problem evaluator covering missing referees, referee rules, and coach rules.
5. Expose the problem list as page state, replace the triangle tooltip with a problem dialog, and wire problem selection to exact grid navigation and focus.
6. Derive red local styles and problem tooltips for coach chips, referee cells, and incomplete match headers from the centralized problem list.
7. Add unit and component tests for availability defaults, `TOTAL` and `PARTIAL` entries, configuration precedence, same-timeslot limits, two-field assignments, consecutive slots, gaps, problem aggregation, exact navigation/focus, tooltips, and pre-existing invalid assignments.
8. Reuse the eligibility and diagnostics functions from any future automatic allocator.

### Recommended checks

- Run frontend type-check/build and the existing unit-test suite.
- Verify a coach cannot be selected on two fields in one timeslot when `refereeCoachTwoField` is `false`.
- Verify two half-time assignments are allowed when it is `true`, while a third assignment is rejected.
- Verify consecutive-time results match `isRefereeEligible` for equivalent schedules.
- Verify missing configuration falls back to defaults and persisted historical allocations are not deleted.
- Verify absent, `TOTAL`, and `PARTIAL` attendee availability entries produce the expected coach eligibility.
