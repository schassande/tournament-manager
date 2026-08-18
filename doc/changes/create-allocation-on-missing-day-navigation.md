# Create a Missing Referee Allocation on Day Navigation

Last updated: 2026-08-18

## Objective

When a tournament spans multiple days and the selected tournament allocation has no fragment allocation for a day or a part of a day, allow the user to create the missing allocation directly from the day navigation area of `tournament-referees-allocation`.

## Scope

### In scope

- Detect days displayed in the day navigation area for which the selected tournament allocation has no corresponding allocation.
- Detect parts of a day for which the selected tournament allocation has no corresponding part-day allocation.
- Ask the user for confirmation before creating a missing allocation.
- Create the allocation for the requested day after the user confirms.

### Out of scope

- Changing the referee allocation algorithm.
- Changing referee or referee-coach assignments.
- Creating or changing tournament-level allocations.
- Automatically creating allocations without user confirmation.

## Functional requirements

- The feature applies to the `tournament-referees-allocation` page.
- It applies when the tournament contains multiple days.
- If no allocation exists for a displayed day or part-day, the corresponding navigation action must offer allocation creation.
- The confirmation message must be: `Do you want to create the allocation of the Day X?`, with `X` replaced by the selected day identifier.
- If the user confirms, an allocation must be created for the selected day.
- If the user declines, no allocation or allocation-selection data must be changed.

## Business rules

- A full-day allocation is identified by `dayId` with no `partDayId`.
- A part-day allocation is identified by `dayId` and `partDayId`.
- When a day has missing allocations, the day-level action creates a full-day allocation only; missing part-day allocations remain independent.
- An existing allocation must not be duplicated when the user navigates to a day or part that already has one.
- The allocation must belong to the currently selected `TournamentRefereeAllocation`.

## User interface and workflow

- The day name or date itself must be clickable when the corresponding day allocation is missing.
- The day navigation panel must also be displayed when the tournament has only one day with one part.
- When a day has exactly one part, display only the day name/date in its navigation panel; do not display `Full` or `Part` links.
- When the single part has an allocation, clicking the day name/date must open that part allocation.
- The day navigation area must make missing days or parts actionable.
- When the user activates a missing day or part, display a confirmation dialog before creation.
- On confirmation, create the allocation and navigate to or display the newly created allocation.
- On cancellation, keep the current allocation page unchanged.
- While loading the selected day allocation, display a non-dismissible modal with a spinner and block user input.

## Data model and persistence

- Use the existing `FragmentRefereeAllocation` model for the created allocation.
- Persist the new fragment allocation through the existing fragment-allocation persistence service.
- Add the created fragment descriptor to the selected `TournamentRefereeAllocation.fragmentRefereeAllocations` collection.
- Persist the updated tournament allocation so the new fragment is selected and discoverable on subsequent navigation.
- No new persistent fields are required by this feature.

## Errors, validation, and permissions

- Creation must be rejected or safely ignored if the selected tournament allocation, day, or required part-day context is unavailable.
- Persistence errors must not leave the UI presenting an allocation as successfully created.
- Existing page authentication and authorization rules remain unchanged.

## Compatibility and migration

- Existing `TournamentRefereeAllocation` and `FragmentRefereeAllocation` documents remain compatible.
- No data migration is required.
- Existing navigation to allocations must continue to work unchanged.

## Acceptance criteria

- Given a multi-day tournament and a selected allocation without a fragment for Day X, activating Day X displays the specified confirmation message.
- When the confirmation is accepted, exactly one full-day fragment allocation for Day X is persisted and becomes available for navigation.
- When the confirmation is rejected, no fragment allocation is persisted and the current view remains unchanged.
- If a full-day allocation already exists for Day X, navigation opens it without displaying a creation confirmation.
- Missing part-day allocations remain independent; the day-level action does not create them.
- Existing allocation navigation and referee assignment behavior continue to work.

## Open decisions

None. The day name or date is the interaction target for a missing day.

## Spec analysis

### Readiness

Ready for implementation

### Summary

The requested behavior has been normalized from `doc/WIP.md`. The creation workflow is partially supported by the existing allocation-management page. The day-level action creates only a full-day allocation, and the day name or date is the interaction target. Missing part-day allocations remain independent.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend page | `frontend/src/page/tournament-referees-allocation.page.ts`, `TournamentRefereesAllocationComponent` | Add missing-allocation navigation and confirmation handling. |
| Allocation management | `frontend/src/page/tournament-referees-allocations.page.ts`, `createFragmentAllocation` and `confirmAllocationCreation` | Reuse or extract existing fragment creation behavior. |
| Persistent model | `persistent-data-model/src/referee-allocation.ts`, `FragmentRefereeAllocation` and `FragmentRefereeAllocationDesc` | No model change expected. |
| Persistence | `frontend/src/service/fragment-referee-allocation.service.ts` and `tournament-referee-allocation.service.ts` | Persist the fragment and selected tournament-allocation descriptor. |
| Documentation | `doc/pages.md` and this change spec | Update page behavior documentation during implementation. |

### Remaining assumptions

- The selected tournament allocation is the `tournamentAllocation` loaded by the current detail-page route.
- A missing day action creates only a full-day allocation, as decided during specification analysis.
- The day name or date is the clickable interaction target, as decided during specification analysis.
- A single-part day uses its part allocation as the navigation target when that allocation exists.
- The existing fragment allocation defaults and naming rules can be reused for allocations created from this page.
- A confirmation dialog should use the existing PrimeNG confirmation infrastructure.

### Recommended implementation breakdown

1. Add the missing-day action to the day name or date in the navigation area.
2. Reuse the existing fragment creation and persistence workflow for a full-day allocation.
3. Add regression coverage for confirmation, cancellation, existing allocations, and missing allocations.
4. Update `doc/pages.md` with the final workflow.

### Recommended checks

- Run the frontend build and relevant unit tests.
- Verify full-day navigation with existing and missing allocations, and confirm that missing part-day allocations remain independent.
- Verify cancellation and persistence-failure behavior.
