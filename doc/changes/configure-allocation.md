# Allocation configuration

Last updated: 2026-08-19

## Objective

Allow users to configure referee allocation parameters at tournament-allocation level and, optionally, at fragment-allocation level.

This increment originally covered defining and persisting the configuration. The manual `RefereeSelector` now consumes the configured referee limits during candidate filtering; automatic allocation generation remains outside this feature.

## Scope

### In scope

- Add a configuration workflow to the `tournament-referees-allocations` page.
- Allow configuration of a `TournamentRefereeAllocation`.
- Allow configuration of a `FragmentRefereeAllocation`.
- Display a modal form with Save, Cancel, and Delete actions.
- Persist tournament-level configuration in `TournamentRefereeAllocation.generalConfig`.
- Persist fragment-level configuration in `FragmentRefereeAllocation.generalConfig`.
- Keep both `generalConfig` fields optional.

### Out of scope

- Applying the configuration during referee allocation generation or modification.
- Changing allocation statistics.
- Changing the structure of tournament or fragment selection.

## Functional requirements

The configuration is represented by `GeneralAllocationConfiguration`.

The form must expose the parameters defined by that type:

- `maxGameInRowForReferee`: integer between `20` and `60`, representing the maximum consecutive minutes for a referee; default `50` minutes.
- `maxGameInRowForRefereeCoach`: integer between `20` and `200`, representing the maximum consecutive minutes for a referee coach; default `160` minutes.
- `allocateRefereeCoach`: whether referee coaches must be allocated; default `false`.
- `refereeCoachTwoField`: whether a referee coach may be allocated to two games in one timeslot, one half-time each; default `false`.
- `nbRefereePerGame`: number of referees to allocate per game, potentially including a backup; default `3`.
- `maxRefereeGameTimePerDay`: integer between `20` and `200`, representing the maximum game minutes for a referee per day; default `140` minutes.

The JSDoc defines the units: the duration fields are expressed in minutes, and `nbRefereePerGame` is expressed as a number of referees per game. The two boolean fields represent yes/no choices. It defines no additional range constraint for `nbRefereePerGame`, and no additional constraint for the two boolean parameters.

The accepted form proposal is:

- `maxGameInRowForReferee`: integer input in minutes, min `20`, max `60`, default `50`.
- `maxGameInRowForRefereeCoach`: integer input in minutes, min `20`, max `200`, default `160`.
- `maxRefereeGameTimePerDay`: integer input in minutes, min `20`, max `200`, default `140`.
- `nbRefereePerGame`: integer input in referees per game, min `1`, no maximum, default `3`.
- `allocateRefereeCoach`: checkbox labelled `Allocate referee coaches`.
- `refereeCoachTwoField`: checkbox labelled `Allow referee coaches on two fields`.

When the selected scope has no configuration, opening the modal initializes a new `GeneralAllocationConfiguration` in the form with the documented default values. Saving updates the configuration at the selected scope. Cancelling leaves the persisted configuration unchanged. Delete removes the `GeneralAllocationConfiguration` object at the selected scope, closes the modal, and does not require confirmation.

## Business rules

Configuration precedence is:

1. A fragment-level configuration is used when it is defined.
2. Otherwise, the tournament-allocation configuration is used when it is defined.
3. Otherwise, the documented default values are used.

The precedence rule is also used by manual referee selection: fragment configuration takes precedence over tournament-allocation configuration, followed by the documented defaults.

## User interface and workflow

The `tournament-referees-allocations` page provides configuration icons for tournament allocations and fragment allocations. Selecting a tournament-allocation icon edits `TournamentRefereeAllocation.generalConfig` for that tournament allocation. Selecting a fragment-allocation icon edits `generalConfig` for the selected fragment. Each action opens a modal containing the configuration form, Save, Cancel, and Delete buttons.

The form uses the accepted controls and labels listed in the functional requirements. Save is disabled while one or more values are invalid, including empty values.

The modal also provides a `Delete` button. Delete removes the complete `generalConfig` object for the selected tournament allocation or fragment allocation, closes the modal, and does not display a confirmation prompt.

## Data model and persistence

`TournamentRefereeAllocation.generalConfig?: GeneralAllocationConfiguration` stores tournament-allocation configuration.

`FragmentRefereeAllocation.generalConfig?: GeneralAllocationConfiguration` stores fragment-allocation configuration.

The existing persistent model already declares these optional fields. `GeneralAllocationConfiguration` is declared in `persistent-data-model/src/referee-allocation.ts` and must be exported for direct frontend reuse.

## Errors, validation, and permissions

The numeric fields must enforce their documented integer ranges. A user who has permission to modify the allocation may create, modify, and delete its configuration. No additional permission restriction applies.

If saving or deleting fails, an error message is displayed inside the modal. The modal remains available so the user can review or retry the operation.

## Compatibility and migration

Existing allocation documents without `generalConfig` remain valid. Missing configuration must continue to represent the fallback to the next applicable scope or to defaults.

No data migration is currently required.

## Acceptance criteria

- A user can open configuration for a tournament allocation from `tournament-referees-allocations`.
- A user can open configuration for a selected fragment allocation from `tournament-referees-allocations`.
- The form exposes all six `GeneralAllocationConfiguration` parameters.
- Save persists the configuration at the intended scope.
- Opening a scope without configuration initializes the form with all documented default values.
- Cancel does not change persisted data.
- Delete removes only the selected scope's `generalConfig`, closes the modal, and does not ask for confirmation.
- Invalid or empty values disable Save and display validation feedback in the modal.
- Persistence failures display an error message inside the modal.
- Users with allocation-edit permission can create, modify, and delete the configuration; no additional permission is required.
- The frontend uses the exported shared `GeneralAllocationConfiguration` type.
- Existing documents without `generalConfig` remain readable.
- Manual referee selection consumes `maxGameInRowForReferee` and `maxRefereeGameTimePerDay`; automatic allocation generation is not required to consume the configuration by this document.

## Open decisions

None.

## Code findings

- The page already renders cog icons for tournament and fragment allocations in `frontend/src/page/tournament-referees-allocations.page.ts`.
- The current handlers `configureTournamentAllocation()` and `configureFragmentAllocation()` do not receive an allocation argument and are placeholders for this workflow.
- Firestore persistence is performed through the existing frontend persistent-data services; no dedicated backend endpoint is currently used for allocation CRUD.
- The persistent model defines the daily game-time field as `maxRefereeGameTimePerDay` in `persistent-data-model/src/referee-allocation.ts`.
- The JSDoc for `GeneralAllocationConfiguration` defines defaults for all six parameters. It does not define a range for `nbRefereePerGame`.
- The JSDoc specifies minutes for the three duration fields and referees per game for `nbRefereePerGame`.

## Implementation readiness

Ready for implementation.
