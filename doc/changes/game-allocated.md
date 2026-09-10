# Allocated games counter

Last updated: 2026-09-10

## Objective

Calculate and persist the number of fully allocated games represented by each `FragmentRefereeAllocation`. The value is displayed by the tournament home page through the existing persisted allocation counters.

## Scope

### In scope

- Recalculate `FragmentRefereeAllocation.nbGamesAllocated` after every referee assignment or removal in `GameRefereeAllocator`.
- Count only games belonging to the affected allocation fragment.
- Persist the recalculated counter in `FragmentRefereeAllocation`.
- Keep the allocation UI usable while the calculation and persistence are in progress.
- Display the allocation percentage in the top-right navigation area of `TournamentRefereesAllocationComponent`, immediately before the statistics drawer icon.

### Out of scope

- Changing the tournament home page layout or its existing aggregate endpoint.
- Recalculating `nbGamesToAllocate`.
- Changing referee allocation rules, game data, or the persisted allocation model.
- A backend counter-maintenance workflow, unless required by the final design decision.

## Functional requirements

- A game is fully allocated when the number of referee assignments on that game reaches the effective `GeneralAllocationConfiguration.nbRefereePerGame` value.
- A game with fewer referee assignments than that value is not fully allocated.
- The counter includes all games in the fragment only. A fragment may represent a complete day or a part of a day.
- After each referee is assigned, replaced, or removed, recalculate the counter and save it on the corresponding `FragmentRefereeAllocation`.
- Referee-coach assignments do not contribute to the counter.
- The calculation must use the in-memory list of loaded games and their referee assignments when that list is complete for the fragment.
- The displayed percentage is calculated from the persisted `nbGamesAllocated` value and the number of games in the displayed period/fragment: `nbGamesAllocated / gameCount * 100`.
- Do not display the percentage when `nbGamesAllocated` is missing.
- Do not display the percentage when the displayed period/fragment contains no games.

## Business rules

- Count each game at most once, even if malformed data contains duplicate referee assignments for a position.
- Count referee assignments, not arbitrary attendee assignments or referee-coach assignments.
- The effective allocation configuration is resolved with fragment precedence, then tournament precedence, then the default configuration; `nbRefereePerGame` defaults to 3.
- Legacy fragments without `nbGamesAllocated` remain readable; their missing value is treated as zero by consumers until a qualifying allocation change updates it.

## User interface and workflow

- The allocation grid remains immediately available for further user interaction while the counter update runs asynchronously.
- Counter-update failures must not block or visibly interrupt referee allocation. They must be logged for diagnosis.
- No new blocking dialog, loading screen, or navigation step is required.
- The percentage is a non-interactive text indicator and must appear immediately before the existing icon that opens the allocation statistics drawer.
- The indicator must refresh when the allocation data or displayed fragment changes.
- Display the percentage as a rounded whole number followed by ` %`.
- Use the current frontend `allocation()` signal for `nbGamesAllocated`; the frontend workflow that saves the updated fragment must also update this signal with the saved allocation.
- After a referee allocation change, mirror the frontend-calculated allocated-game value into the local allocation signal when the optional statistic already exists.

## Data model and persistence

- Reuse the existing optional field `FragmentRefereeAllocation.nbGamesAllocated?: number` from `persistent-data-model/src/referee-allocation.ts`.
- Persist the counter through the existing `FragmentRefereeAllocationService`/Firestore persistence mechanism.
- No new collection, field, or migration is required.
- The update must target the fragment whose allocation was modified.

## Errors, validation, and permissions

- Preserve the existing Firestore permissions and authentication behavior.
- A failed counter write must be handled independently from the successful game-attendee allocation write.
- Counter recalculations and writes for the same fragment must be serialized in mutation order so an older asynchronous result cannot replace a newer counter.

## Compatibility and migration

- Existing `FragmentRefereeAllocation` documents without `nbGamesAllocated` remain compatible.
- Existing game-attendee allocation documents remain compatible, including the canonical `fragmentRefereeAllocationId` link.
- No automatic initial recalculation, backfill, or data migration is planned. Existing counters are updated only after a subsequent referee allocation change.

## Technical specifications

- The primary integration point is `frontend/src/component/game-referee-allocator.component.ts`, which already handles referee creation, replacement, and deletion and emits `allocationChanged`.
- Reuse `frontend/src/service/allocation-problem.service.ts` `resolveAllocationConfiguration()`, which applies fragment-over-tournament-over-default precedence.
- Use the existing loaded `GameView[]`/game referee assignments to compute the number of qualifying games for the fragment.
- Add a focused calculation/persistence helper in a service when this keeps the component methods short and testable.
- Update the relevant frontend tests for assignment creation, replacement, deletion, complete/incomplete games, day fragments, part-day fragments, and failed asynchronous persistence.
- Review `doc/datamodel.md`; its current description of `nbGamesAllocated` as a workflow-maintained optional counter remains accurate, but it should be updated if the final implementation changes its semantics or initialization.
- Add a derived signal or equivalent view-model value on `frontend/src/page/tournament-referees-allocation.page.ts`; do not persist the percentage as a new field.
- Implement the derived value with a calculation method on `FragmentRefereeAllocationService` and render it before the `pi-chart-bar` statistics icon.
- Keep the percentage as a pure derived value from the local `allocation()` signal and the displayed game count; do not add a Firestore listener for this indicator.
- Use the already loaded displayed-period game list for the denominator and the loaded `allocation().nbGamesAllocated` for the numerator's allocated-game value.

## Acceptance criteria

- Assigning a referee updates the persisted counter for the affected fragment when the game reaches the configured referee count.
- Removing or replacing a referee updates the persisted counter when a game changes from complete to incomplete or vice versa.
- A game below the configured referee count is not counted.
- Referee-coach changes do not alter `nbGamesAllocated`.
- Only games in the affected day or part-day fragment are counted.
- The counter is persisted without blocking continued allocation interaction.
- A persistence failure is logged and does not undo or block the game-attendee allocation change.
- Existing fragments with no counter remain readable and are not migrated unintentionally.
- When `nbGamesAllocated` exists and the fragment contains games, the allocation percentage is visible immediately before the statistics drawer icon.
- When `nbGamesAllocated` is absent or the fragment has no games, no allocation percentage is rendered.
- The percentage changes when the displayed fragment or its allocation data changes.

### List of new tests

- Unit tests for complete and incomplete games at the configured threshold.
- Unit tests excluding coach allocations and games outside the fragment.
- Unit tests for day-level and part-day fragment filtering.
- Component/service tests for referee add, replace, and remove flows.
- Tests proving allocation interaction continues when counter persistence is delayed or fails.
- Tests for rapid successive updates proving that serialized writes preserve the final counter.
- Tests for the allocation percentage with zero, partial, and complete allocation values.
- Tests that the percentage is hidden when `nbGamesAllocated` is missing or the fragment has no games.

## Open decisions

None. The percentage is displayed as a rounded whole percentage, for example `67 %`.

## Verified repository impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Shared model | `persistent-data-model/src/referee-allocation.ts`, `FragmentRefereeAllocation.nbGamesAllocated` | Reuse the existing optional persisted field. |
| Allocation workflow | `frontend/src/component/game-referee-allocator.component.ts` | Trigger recalculation after referee create, replace, and delete operations. |
| Allocation page UI | `frontend/src/page/tournament-referees-allocation.page.ts` | Derive and display the fragment allocation percentage before the statistics drawer icon. |
| Configuration | `frontend/src/service/allocation-problem.service.ts`, `resolveAllocationConfiguration()` | Existing fragment-over-tournament-over-default precedence is available in code. |
| Persistence | `frontend/src/service/fragment-referee-allocation.service.ts` and inherited persistence methods | Save the updated fragment counter through the existing Firestore service. |
| Home page | `frontend/src/page/tournament-home.page.ts` and `functions/src/tournament-home.ts` | Existing consumers already read/aggregate `nbGamesAllocated`; no home-page change is currently required. |
| Documentation | `doc/datamodel.md`, `doc/changes/tournament-home.md` | Review accuracy; update if initialization or counter semantics change. |

## Readiness

Ready for implementation.

## Summary

The requested behavior is a frontend-maintained persisted counter on `FragmentRefereeAllocation`, driven by referee allocation mutations and calculated from the loaded fragment games. The allocation page will also display a derived rounded whole percentage based on `nbGamesAllocated` and the number of games in the displayed fragment, immediately before the statistics drawer icon. The existing model and persistence services are sufficient. The confirmed decisions are fragment-over-tournament-over-default configuration precedence, no automatic initial/backfill recalculation, serialized updates per fragment, and rounded whole-number percentage formatting.

## Remaining assumptions

- The loaded allocation page contains every game in the displayed fragment when the counter is calculated.
- A fully allocated game is determined by referee-role assignments only.
- Existing home-page and backend aggregate behavior remains unchanged.
- The allocation mutation workflow can enqueue counter work without delaying the user's next allocation interaction.

## Recommended implementation breakdown

1. Add a focused counter calculation and serialized persistence path around the allocation workflow.
2. Cover mutation, filtering, asynchronous failure, and concurrency cases with tests.
3. Review and update `doc/datamodel.md` and related documentation if semantics change.

## Recommended checks

- Run the relevant frontend unit tests and compile the frontend.
- Verify Firestore writes contain the expected fragment identifier and counter.
- Exercise rapid successive referee edits and confirm the persisted value is not stale.
- Verify the tournament home page displays the updated aggregate after reload.
