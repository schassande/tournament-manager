# Simple Allocations Management Page

Last updated: 2026-08-21

## Objective

Provide a simplified mode for managing referee allocations on the `tournament-referees-allocations` page. The simplified mode is intended for users who do not need to manage multiple tournament allocations or multiple fragment allocations for the same part of a day.

## Scope

### In scope

- Add a top-right link to switch between simple and advanced modes.
- Provide a day-oriented layout in simple mode.
- Use the active/selected tournament allocation in simple mode.
- Use one current/selected fragment allocation for each part of a day in simple mode.
- Automatically create a missing fragment allocation when the user opens its edit action.
- Provide tournament-level allocation configuration from simple mode.

### Out of scope

- Managing multiple tournament allocations from simple mode.
- Managing multiple fragment allocations for the same part of a day from simple mode.
- Configuring a particular fragment allocation from simple mode.
- Changing the advanced mode workflow.
- Changing referee allocation algorithms or assignment data.

## Functional requirements

- The page must expose simple mode and advanced mode.
- Simple mode is the default mode when no saved mode preference exists.
- The selected mode must be persisted in browser local storage and restored when the page is opened again.
- The mode-switch link must display `Advanced version` in simple mode and `Simple version` in advanced mode.
- The link must be blue, underlined, have a pointer cursor on hover, and have a right margin of 10 pixels.
- Simple mode must use only the active/selected tournament allocation. If several tournament allocations exist, the other allocations remain manageable only in advanced mode.
- The tournament allocation used by simple mode is exclusively the allocation whose `current` flag is `true`.
- If no tournament allocation exists when simple mode is first opened, the first tournament allocation must be created automatically.
- The automatically created first tournament allocation must use the existing tournament-allocation name-generation behavior, be marked `current`, and be displayed without requiring a naming popup.
- For each day or part of a day, the selected fragment allocation is the single descriptor stored for that day or part of a day in `TournamentRefereeAllocation.fragmentRefereeAllocations`; the descriptor `id` identifies the fragment allocation.
- If no descriptor exists for the day or part of a day, the missing fragment allocation must be created automatically when the user activates the edit action.
- Simple mode must display one day container for each tournament day.
- Each day container must display `Day X`, the date in `YYYY-MM-DD` format, the day of the week, and an edit action.
- If a day contains one part of a day, the complete day container must be clickable and no `Edit` button must be displayed.
- If a day contains multiple parts of a day, the page must display one edit action per part, labelled `Edit <partDayId>`.
- Activating an edit action must create the missing fragment allocation, if necessary, before routing to `tournament-referee-allocation`.
- The day containers must be centered and separated by 10 pixels.
- Below the day containers, centered, the page must display a `pi-cog` icon and a `Configure` link.
- Activating either configuration control must open the tournament-level allocation configuration popup.

## Business rules

- Simple mode never offers controls for choosing or creating another tournament allocation.
- Simple mode never offers controls for choosing or creating an additional fragment allocation for the same part of a day.
- The tournament allocation used by simple mode is exclusively the allocation whose `current` flag is `true`.
- If no tournament allocation exists, simple mode must create the first tournament allocation automatically before displaying its day actions.
- The automatic first allocation must be marked `current` and must use the existing generated-name behavior.
- The fragment allocation used by simple mode is identified by the unique descriptor for the relevant day or part of a day in `TournamentRefereeAllocation.fragmentRefereeAllocations`.
- The descriptor's `id` is the selected fragment allocation identifier; simple mode must not choose a different fragment allocation independently.
- Automatic creation occurs when the user activates the edit action, not merely when the simple-mode page is displayed.
- The generated name for an automatically created allocation must follow the name-generation behavior currently used by the application.

## User interface and workflow

- The mode switch must be available in the top-right corner in both modes.
- The simple-mode layout must keep day containers centered while preserving the required 10-pixel spacing.
- The edit action must navigate to `tournament-referee-allocation` after any required creation succeeds.
- The configuration popup must edit the selected tournament allocation, not a fragment allocation.
- The first tournament allocation must be created before the simple-mode day layout is displayed when no tournament allocation exists.
- If automatic allocation creation fails, the page remains displayed, navigation does not occur, and a retryable error is shown.
- The mode preference is local to the current browser and does not need to be synchronized between users or devices.

## Data model and persistence

- Use the existing `TournamentRefereeAllocation` model and its `current` flag for tournament-level selection where applicable.
- Use existing `fragmentRefereeAllocations` descriptors, including `dayId` and optional `partDayId`, to identify fragment allocations.
- Persist automatically created fragment allocations through the existing fragment-allocation persistence workflow.
- Persist the updated tournament allocation descriptor list when a fragment allocation is created.
- No new persisted data structure is currently required.
- Fragment selection is already persisted in the selected tournament allocation's descriptor list; no additional simple-mode selection state is required.

## Errors, validation, and permissions

- Existing allocation-edit permissions must apply to automatic creation and tournament-level configuration.
- Creation or navigation must not proceed as if successful when automatic allocation creation fails.
- When automatic creation fails, the page must remain displayed, navigation must not occur, and an error must be shown so the user can retry.
- Accessibility requirements for the icon-only configuration action, including its accessible name and keyboard activation, must be preserved or added.

## Compatibility and migration

- Existing allocation documents and the advanced workflow must remain compatible.
- Existing tournament and fragment allocations must remain readable without migration.
- No data migration is currently expected.

## Acceptance criteria

- A user can switch between simple and advanced modes from the top-right link.
- The link text and required styling are correct in each mode.
- Simple mode displays one centered container per tournament day with the required day, date, weekday, and edit information.
- A day with one part displays no edit button and the complete day container opens the allocation editor.
- A day with multiple parts displays one correctly named edit action per part.
- Activating an edit action creates a missing fragment allocation before navigating to `tournament-referee-allocation`.
- Existing current/selected allocations are edited without creating duplicates.
- Simple mode does not expose controls for managing additional tournament or fragment allocations.
- The centered cog icon and `Configure` link open tournament-level configuration.
- Existing advanced-mode allocation management remains available and functional.
- Creation and configuration honor existing allocation-edit permissions and report failures according to the clarified error behavior.

## Open decisions

None.

## Verified code findings

- `frontend/src/page/tournament-referees-allocations.page.ts` currently renders the advanced grid, tournament-allocation cog actions, fragment selectors, and fragment edit actions.
- The implemented simple-mode preference uses the browser local-storage key `tournament-referees-allocations-mode` with values `simple` and `advanced`; the default is `simple`.
- The implemented simple-mode first tournament allocation uses a generated `Allocation-<random-number>` name, is marked `current`, and is persisted before the day layout is rendered.
- Simple-mode edit actions use the selected tournament allocation's descriptor matching `dayId` and optional `partDayId`; a missing descriptor creates a fragment and persists the replacement descriptor before navigation.
- For compatibility with legacy data, when exactly one tournament allocation exists but is not marked `current`, simple mode uses that sole allocation.
- The existing page uses `TournamentRefereeAllocation.current` to mark the current tournament allocation and `FragmentRefereeAllocationDesc.dayId`/`partDayId` to map fragments.
- `Day.date` is a Unix timestamp in seconds; simple-mode weekday rendering must use `DateService.toDayOfWeek()` rather than Angular `DatePipe` numeric input.
- `frontend/src/service/tournament-referee-allocation.service.ts` and `frontend/src/service/fragment-referee-allocation.service.ts` provide the existing persistence services.
- The route to the allocation-edit page is registered in `frontend/src/app/app.routes.ts`.
- The existing code generates fragment allocation names in `createFragmentAllocation()`; simple mode should reuse that behavior.
- The existing allocation configuration popup supports tournament and fragment scopes; simple mode must restrict its entry point to tournament-level configuration.
- Documentation review: the related allocation-configuration and missing-allocation-navigation specifications remain relevant; this document adds a distinct simple-mode workflow and must stay aligned with them.

## Readiness

Ready for implementation.

## Summary

Simple mode is the default and is remembered in browser local storage. It uses the tournament allocation marked `current`. If none exists, the first tournament allocation is created automatically, marked `current`, and given the generated `Allocation-<random-number>` name. For each day or part of a day, the selected fragment allocation is the one referenced by the corresponding descriptor in `fragmentRefereeAllocations`; a missing descriptor triggers creation on edit. Creation failures keep the user on the page and display a retryable error.

## Remaining assumptions

- The random suffix in automatically generated tournament-allocation names is not user-visible behavior beyond ensuring a non-empty name.
- The existing allocation-edit permission model applies to automatic creation and configuration.

## Recommended implementation breakdown

1. Add simple/advanced mode state with simple as the default and local-storage persistence.
2. Add automatic creation and current-allocation selection handling.
3. Add the day-container simple-mode view and edit actions using the persisted fragment descriptors.
4. Reuse the existing fragment creation and routing workflow, with explicit failure handling.
5. Add the simple-mode tournament configuration entry point and preserve advanced-mode controls.

## Recommended checks

- Verify mode defaulting, local-storage restoration, and switching in both directions.
- Verify automatic creation of the first current tournament allocation.
- Verify one-day/one-part and multi-part day rendering and exact edit labels.
- Verify descriptor-based fragment selection and no duplicate creation.
- Verify creation failure prevents navigation and exposes a retryable error.
- Verify tournament-level configuration opens from both the cog icon and `Configure`.
- Verify advanced mode remains unchanged and existing allocation documents remain readable.
