# Draw Designer

Last updated: 2026-11-18

## Objective

Allow tournament managers to define the competition structure for each division and allocate the resulting matches in the tournament schedule. Provide a public read-only view of the active draw.

The feature is delivered in three implementation stages, in this order:

1. DrawDivision design screen.
2. Match planning screen.
3. Public draw visualization screen.
4. Platform DrawType administration screen.

Each stage must be tested before the next stage starts. The developer must ask before moving to the next stage.

Before the draw design screen is used, persisted draw-type templates may be initialized explicitly from the Platform DrawType administration screen.

## Scope

### In scope

- Managing several draw definitions for one division, with exactly one active draw per division.
- Designing steps, groups, team ordering, point calculations, and draw games.
- Allocating and deallocating draw games in the tournament schedule.
- Detecting and correcting invalid persisted allocations when the planning screen loads.
- Public read-only visualization of the active draw.

### Out of scope

- The live match score-entry screen; it must not be implemented at this stage.
- Creating real `Game` records while designing a draw; real games are created only when a draw game is allocated.

## Functional requirements

### Draw model

- A division groups teams by category and has its own competition structure.
- The persisted draw definition is represented by the existing `DivisionDraw` model.
- A draw is composed of ordered `Step` objects. Each step distributes input teams into `Group` objects and produces ranked output teams for the next step.
- A tournament manager may create several draw definitions for the same division for experiments or alternatives.
- `Tournament.currentDrawDivisionIds` identifies the active draws. It must contain at most one draw identifier for each division.
- `Game` allocation data uses the existing model fields `dayId`, `timeslotId`, and `fieldId`. The implementation must use `timeslotId`; no `slotId` or additional `partId` field is introduced.
- `PDrawType` is the persisted form of `DrawType` and contains the `enabled` flag.
- `default_drawlibs` remains the source definition for the initial persisted templates; it is not itself a database collection.

### Persisted DrawType initialization

- Provide a dedicated `PDrawTypeService` for loading and persisting `PDrawType` records in the `draw-type` collection.
- Do not trigger initialization during application startup or user connection.
- The Platform DrawType administration screen invokes the `initializePDrawTypes` callable asynchronously when the administrator requests default initialization.
- The initialization action is available only to platform administrators and must not block unrelated application navigation.
- The initialization lists all `PDrawType` records. If at least one record exists, it does nothing.
- If no record exists, copy every `DrawType` from `default_drawlibs` into a new `PDrawType` record with `enabled: true`, a Firestore-generated document identifier, and the current `lastChange` value.
- The initialization must be authorized server-side using the `platform-admin` authority. The legacy `PlaformAdmin` collection remains accepted for compatibility; a normal user or tournament manager cannot seed templates.
- Initialization must be safe to retry and must not overwrite or duplicate an already populated collection.

### Draw design screen

Route: `/tournament/<tournamentId>/draw-designer`.

Only tournament managers may access this screen.

The action bar contains:

- A division selector.
- A draw selector containing draws for the selected division.
- An action to create a draw for the selected division. The client generates a random five-character uppercase alphanumeric name and persists the new draw immediately. Name collisions are not checked or handled. If it is the first draw for the division, it becomes active automatically.
- A short team count for the selected division.
- The selectors, team count, and create action are displayed together in the first row, which has a distinct background color.
- Each selector label is displayed inline with its Select; the team count follows the Division Select, and the create action follows the Draw Select.
- The selected draw section displays the draw name and activation/deactivation, deletion, and save actions on its first row.
- The selected draw managers and point calculations sections are displayed after the Steps section. Managers use an email add form and a list containing each manager's email, display name, and remove action. The active status text is not displayed because the activation state is represented by the action button.
- Each step displays its group table as the value of a `Groups` form field and provides actions below the table to apply neutral or ranked group names from the shared `GroupNames` definitions.
- The draw-type Select displays the selected `DrawType.description` below it when present; otherwise it displays the default group/game count summary.
- Saving is refused when any configured step requires point calculation and the draw has no point calculation defined.
- Saving is refused when the draw contains no step.
- The selected draw status and its activation/deactivation and deletion actions are displayed in a second row below.
- An action to delete the selected draw. Refuse deletion when the draw is active or contains a planified, running, or finished match.
- An `Active` indicator when the selected draw is active.
- A `Deactivate` action when the selected draw is active; it removes the draw identifier from `Tournament.currentDrawDivisionIds`.
- An `Activate` action that removes the selected division's other draw identifier from `Tournament.currentDrawDivisionIds` and adds the selected draw identifier.

When a division and draw are selected, display the draw designer for that division.

The designer contains:

- A red warning when any step is `RUNNING` or `FINISHED`; editing is not allowed in that state.
- A save action aligned to the right.
- A dense form for the draw name and a selector for existing tournament managers represented by `Attendee` records. Persist the selected attendee identifiers in `managerAttendeeIds`.
- A form for `DivisionDraw.pointCalculations` with a point-calculation selector, add action, delete action, and editor for the selected calculation's name, win points, lost points, and draw points.
- The division team list, with reordering. The resulting order is persisted as the input ranking of the first step.

Each step is displayed in a card containing:

- The step name field.
- A draw-type selector containing persisted `PDrawType` values whose `nbTeam` equals the division team count.
- A `spreadTeamsAlgo` selector using the existing `SpreadTeamsAlgo` values.
- An `ouputTeamRankingStrategy` selector using the existing `OuputTeamRankingStrategy` values. When a persisted step does not contain this attribute, initialize it to `GROUP_ORDER`.
- The selected draw type's group count and game count.
- A group table with columns: team count, draw/group type, game count, group name, and point-calculation name.
- The first three group columns are read-only and come from the selected draw type. The group name is editable. The point-calculation column is shown only when the group type requires point-calculation configuration.
- The step status in the top-right corner.

The steps section also contains an `Add step` action. It appends a `DRAFT` step, assigns the next position, uses the first compatible enabled `PDrawType`, initializes its groups without draw games, and copies the division team order into the first step's input ranking. The action is disabled while the draw is locked by a running or finished step. If no compatible enabled `PDrawType` exists, the action remains visible and the page displays an explicit initialization/activation warning.

Each step exposes a right-aligned icon-only action bar. The `DRAFT` action bar contains `pi-palette` for drawing the step and `pi-trash` for deleting it. The `DRAWN`, `PLANIFYING`, and `PLANIFIED` action bar contains `pi-eraser` to return the step to draft. The `RUNNING` action bar contains the danger action `pi-stop` to cancel the step. Every icon button has an accessible label and a tooltip explaining its action. The delete action uses the PrimeNG confirmation dialog before removing the step, then immediately persists the updated draw.

When a step's draw type changes, update its groups but do not create `Group.games`/`DrawGame` records immediately. On save, create or remove draw games when the draw type changed. New draw games have status `DRAWN`.

### Step lifecycle

Each `Step` follows this lifecycle:

- `DRAFT`: the step structure is being defined and no draw games are currently allocated for competition.
- `DRAWN`: the draw games have been generated by `DivisionDrawService.drawStep`.
- `PLANIFYING`: at least one draw game is allocated to a real `Game` whose schedule contains a `dayId`, `timeslotId`, and `fieldId`.
- `PLANIFIED`: every draw game of the step is allocated to such a real `Game`.
- `RUNNING`: at least one allocated game has started.
- `FINISHED`: every game of the step is finished.
- `CANCELED`: the step is canceled; changing the status does not perform any additional deletion or deallocation.

The Draw Designer exposes a step action to move a `DRAFT` step to `DRAWN`. The action invokes `DivisionDrawService.drawStep`, which allocates the step's teams and creates its draw games. The generated draw games have status `DRAWN`.

The Draw Designer exposes a step action to request a return from `DRAWN`, `PLANIFYING`, or `PLANIFIED` to `DRAFT`. The action requires a PrimeNG confirmation dialog. The confirmation explicitly warns that the linked real games and the step's draw games will be permanently deleted. Before `RUNNING`, the operation must make the step editable again by deleting these records.

The Draw Designer exposes cancellation only for a `RUNNING` step. Cancellation only changes the step status to `CANCELED`.

The step status is recalculated whenever draw games or their linked real games change. Before a step is running, any scheduling change that leaves at least one but not all draw games allocated sets the status to `PLANIFYING`; when all draw games are allocated it sets the status to `PLANIFIED`. Once a game has started, the step is `RUNNING`; once all games are finished, it is `FINISHED`.

### Match planning screen

The planning screen allocates matches to the tournament schedule, which is defined by tournament days, parts, timeslots, and fields.

The page contains:

- A single-line toolbar with a day selector, a match-highlight selector, and the percentage of matches allocated.
- A left selection panel.
- A right planning table.

The highlight selector supports division, step, group, and team entries. Their labels are respectively the division short name, `<division>-<step>`, `<division>-<step>-<group>`, and `<division>-<team>`. Highlighted matches have a yellow background; other matches have a light-gray background.

The planning table has one row per timeslot of the selected day and one column per field available for that day. It must scroll horizontally and vertically while keeping the field header row and timeslot column visible.

Each occupied cell displays the division short name/step plus a red deallocation cross, round/`what`, and the home/away teams. Match information is centered horizontally and vertically both in occupied cells and in the unallocated-match list. Hide the team line when neither team is known and display `?` for an unknown side. Occupied cells use the division category color; empty cells are white.

The selection panel provides linked division, step, and group filters, followed by the filtered list of unallocated `DrawGame` records. Each item uses the same three-line match display as a planning cell. The item width must use a shared configurable variable matching the planning-cell width.

Allocation behavior:

- Dragging an unallocated draw game to a free timeslot/field creates a `Game`, sets `DrawGame.gameId`, and changes the draw-game status to `PLANIFIED`. `Game.homeTeamId` and `Game.awayTeamId` are optional so a game may be allocated before one or both teams are known.
- After each allocation, recompute the owning step status: the first allocation changes `DRAFT`/`DRAWN` to `PLANIFYING`, and allocation of the last unallocated draw game changes it to `PLANIFIED`.
- Dragging an allocated match to an occupied cell swaps the two matches; dragging it to an empty cell moves it.
- Dragging a match outside the planning table or clicking its cross deallocates it. The `Game` is retained but its allocation fields are cleared, the draw-game status becomes `DRAWN`, and the draw game returns to the selection panel.
- Allocation and deallocation are applied immediately.
- Deallocation before a game has started recomputes the owning step status as `PLANIFYING` when at least one draw game remains allocated, or `DRAWN` when none remains allocated.
- Reject any operation where one team would play on two different fields in the same timeslot. Validate on drop; a rejected operation must not modify either match.

### Public draw visualization screen

Route: `/draw/<tournamentId>`. All application users, including unauthenticated users, may access this read-only screen.

The toolbar contains a division selector and a step selector for the active draw of the selected division. The first division and first step are selected by default. If the selected division has no active draw, hide the step selector.

The selected step displays its name and group views. Group rendering is specific to `GroupType`, with Angular components for supported group type families: `CUP...` displays a bracket according to level; `POOL...` and wins-based groups display a team ranking table.

Each group-specific component uses a shared match component that displays all matches chronologically (day, time, field), including scores. If the current user is a tournament administrator, scores are editable. Score-change events update the group-specific component and, when applicable, subsequent matches. The view also displays the final ranking, supports tournament-manager-only changes and validation of the ranking, persists the decision, recalculates dependent matches, and displays input teams.

## Business rules

- Only one draw may be active per division.
- Draw editing is forbidden when any step is `RUNNING` or `FINISHED`.
- Deletion is refused when the draw is active or contains a planified, running, or finished match.
- A draw type may be selected for a step only when its configured team count equals the division team count, as currently specified.
- Group metadata derived from a draw type is not user-editable except for group name and applicable point-calculation configuration.
- `Step.ouputTeamRankingStrategy` is editable in the Draw Designer with a default value of `GROUP_ORDER` for newly created or legacy steps where the attribute is missing.
- Draw games are generated only during save after a draw-type change; they default to `DRAWN`.
- A step can be removed from the draw designer only while it is `DRAFT`. The user must confirm the removal through the PrimeNG confirmation dialog, and the updated draw is persisted immediately after confirmation.
- A step can be drawn only from `DRAFT`; drawing invokes `DivisionDrawService.drawStep` and creates the step's draw games.
- A step can return to `DRAFT` from `DRAWN`, `PLANIFYING`, or `PLANIFIED` only through an explicit user action and confirmation. The operation permanently deletes the step's `DrawGame` records and their linked real `Game` records so that the structure can be changed before competition starts.
- A step cannot return to `DRAFT` after it has reached `RUNNING`, `FINISHED`, or `CANCELED`.
- `PLANIFYING` means at least one, but not all, draw games have a linked real game with complete `dayId`, `timeslotId`, and `fieldId` allocation coordinates. `PLANIFIED` means all draw games meet that condition.
- The step status must be updated after allocation, deallocation, game start, game finish, and cancellation operations; it must not remain permanently `DRAFT`.
- `RUNNING` is reached when at least one game of the step is started. `FINISHED` is reached only when all games of the step are finished.
- Cancellation is status-only and does not delete draw games or real games. It is only allowed from `RUNNING`.
- The lifecycle computation uses `DrawGame.status`: a `PLAYING` draw game means the step is `RUNNING`, and the step is `FINISHED` only when every draw game has status `FINISHED`.
- Real games are created on allocation, not during draw design.
- A team cannot be scheduled on two fields in the same timeslot.
- Only tournament managers may change or validate a final ranking; validation persists the tournament decision and recalculates dependent matches.

## User interface and workflow

The workflow is: select division, select or create a draw, configure and save the draw, activate exactly one draw for the division, then allocate its draw games in the planning screen. The public screen reads only the active draw. Informational success messages in the Draw Designer, such as `Draw saved.`, disappear automatically after three seconds.

The exact confirmation dialogs, empty states, loading indicators, and error presentation are to be clarified. Concurrent saves overwrite the persisted version with the current user's submitted data.

### Tournament navigation menu

When the `DRAW_DESIGNER` module is enabled for a tournament, the tournament manager menu contains an entry labelled exactly `Draw designer`, linking to `/tournament/<tournamentId>/draw-designer`. The entry belongs to the existing `Games` group and is displayed before the existing `Games` entry. The entry is shown only to tournament managers because the draw designer is a manager-only screen.

The existing match-management entry is labelled `Games` and remains in the same group. The current implementation route is `/tournament/<tournamentId>/game`.

### Screen inventory and proposed roadmap

Verified current screens and routes:

- `Games`: existing match list/import screen at `/tournament/<tournamentId>/game`.
- `Draw designer`: manager draw-configuration screen at `/tournament/<tournamentId>/draw-designer`.
- Referee/coaching configuration and allocation screens already exist under their current routes.

Proposed future screens derived from this specification:

- `Game allocator`: implement the match-planning screen described in this document. It should allocate `DrawGame` records to day/timeslot/field cells and enforce the same-timeslot team constraint.
- `Draw viewer`: implement the public active-draw visualization at `/draw/<tournamentId>`.
- `Score entry`: implement a manager/result-manager score-entry screen after draw visualization and dependent ranking updates are defined.
- `Tournament dashboard`: provide a status view for active draw, allocation progress, games needing scores, and unresolved scheduling conflicts.
- `Draw validation`: provide a pre-publication checklist for missing point calculations, incomplete steps, unallocated games, and invalid team references.
- `Schedule quality`: provide diagnostics for field capacity, team rest time, duplicate allocations, and empty schedule slots.

These roadmap items are proposals, not additional implementation requirements for the current stage. `Game allocator` is the next screen in the required draw implementation order; it is not currently implemented as a dedicated page.

### Platform DrawType administration screen

Route: `/admin/draw-types`.

Only platform administrators may access this screen. The global navigation menu contains an `Admin` section at the bottom with a `Draw types` entry linking to this route, visible only to platform administrators identified by `platform-admin`. It is the final screen in the implementation order.

On screen initialization, load all persisted `PDrawType` records through `PDrawTypeService`, including disabled records. The defaults created by the explicit initialization action must therefore appear after the list is refreshed. If the collection is empty, display an empty state with an `Initialize defaults` action and keep the creation action available.

The screen contains:

- A first-row filter for the number of teams managed by the `PDrawType`. It contains `All` followed by each existing `nbTeam` value and defaults to `All`.
- Below the filter, a left panel containing the unpaginated list of filtered draw types, sorted by ascending `nbTeam` and then alphabetically by name, displaying only each draw type name.
- A right panel for creating or editing the selected draw type. It edits the name, `enabled`, and the composed subgroup list; `nbTeam` is calculated as the sum of subgroup `nbTeams`, while `nbGroup`, `nbGames`, and `requirePointCalculationConfig` are calculated automatically and displayed read-only.
- Creating a draw type starts with an unsaved blank form: empty name and no subgroups. `nbTeam` is displayed read-only and remains the sum of subgroup `nbTeams`. `Save` is disabled until the configuration is valid.
- Subgroup add, delete, and edit operations for `position`, `nbTeams`, `groupType`, and `nbGames`; derived fields must be recalculated consistently.
- Before saving, subgroup positions must be unique and contiguous from `0`, the sum of subgroup `nbTeams` must equal `nbTeam`, and subgroup numeric values must be valid non-negative integers, with type-specific minimums enforced where required.
- `Delete`, `Cancel`, and `Save` actions. `Cancel` exits the screen. `Save` always requires confirmation before persisting. Validation or persistence errors block the form and are displayed to the administrator.
- An enabled/disabled control for `PDrawType.enabled`.
- A disabled `PDrawType` is excluded from Draw Designer selectors and draw-type changes, while existing steps containing its snapshot remain unchanged.

Deletion, activation, and deactivation are platform-administrator-only operations. A `PDrawType` may be deleted even when existing steps contain a copied `DrawType`, because steps are independent snapshots.

## Data model and persistence

Verified existing model facts:

- `DivisionDraw` contains `tournamentId`, `divisionId`, `name`, `steps`, `managerAttendeeIds`, and `pointCalculations`.
- `Step` contains status, position, name, draw type, spread algorithm, input/output ranked teams, and groups.
- `Step.drawType` is an integral snapshot copy of the selected `PDrawType`; it does not persist a live reference to the `PDrawType` identifier. Later modification, disabling, or deletion of the source `PDrawType` does not affect existing steps.
- `Group` contains position, type, name, draw games, ranked teams, and type-specific data.
- `DrawGame` contains an optional `gameId`, round, description, result requirement, status, and team references.
- `PDrawType` is persisted and contains `nbTeam`, groups, and derived game/group counts.
- `Game` contains tournament, schedule, division, day, timeslot, field, team, and draw-game linkage fields through `scheduleInfo`.
- `Tournament.currentDrawDivisionIds` is optional and stores active draw identifiers.
- The current `Step.status` model contains the legacy value `DRAWED`; it must be replaced by the lifecycle value `DRAWN` and extended with `PLANIFYING`. Persisted legacy `DRAWED` values must remain readable and be normalized to `DRAWN` when loaded or saved.
- `Step.ouputTeamRankingStrategy` is optional for backward-compatible reads; loaded steps without it are initialized in memory with `GROUP_ORDER` and persisted with that value on the next draw save.

The implementation must preserve existing persisted data and use explicit mapping between the UI model and these existing interfaces. Any required data-model change must also update `doc/datamodel.md`.

## Errors, validation, and permissions

- Enforce tournament-manager authorization for draw design and planning actions.
- Enforce read-only access for unauthenticated users on the public draw screen.
- Validate all allocation operations against existing day, part, timeslot, and field identifiers.
- On planning-screen load, repair invalid persisted data: deallocate games whose field or timeslot no longer exists; deallocate duplicate-team matches on the same timeslot, retaining the match whose allocation has the earliest persisted allocation timestamp; delete `Game` records not referenced by any draw game; and clear `DrawGame.gameId` when it references no existing game.
- On planning-screen load or after repair, recompute step lifecycle statuses from the persisted draw-game and real-game states.
- Show a generic message when loading caused planning data to be modified.
- Execute planning-data repairs server-side in a transaction before returning the planning data. The client displays a generic notification when the transaction changed data.

## Compatibility and migration

- Existing tournaments, draws, draw games, and games must remain readable. Making `Game.homeTeamId` and `Game.awayTeamId` optional is backward-compatible for existing records.
- No migration is currently specified.
- Compatibility behavior for missing or malformed `currentDrawDivisionIds`, missing schedule references, and legacy field names is to be clarified.

## Technical specifications

### Loading and performance

Load the tournament by ID to obtain divisions, days, parts, timeslots, and fields. Load all division draws for the tournament in one query. Load all tournament games in one query. The target scale is approximately five tournament days, up to 500 matches per day, and up to 20 divisions; complete client-side loading is considered acceptable for a responsive interface.

The first implementation stage persists `DivisionDraw` records in the `division-draw` collection and reads persisted `PDrawType` templates from the `draw-type` collection.

The `PDrawTypeService` must use Firestore-generated identifiers for newly persisted templates. The explicit administration action is exposed through the secured `initializePDrawTypes` backend callable so that platform-admin authorization and the empty-collection check are performed atomically on the trusted side.

### Implementation constraints

- Implement the three screens in the order defined in Objective.
- Use Angular components, services, and existing persistent models; separate UI state, transport, persistence, and draw logic.
- Add concise JSDoc for new reusable contracts and functions.
- Implement draft-step deletion in the Draw Designer next to the `Draw` action, using the existing draw persistence service to persist the updated ordered step list immediately after confirmation.
- Add tests for draw generation, active-draw uniqueness, allocation/deallocation, duplicate-team validation, repair behavior, and public rendering logic as applicable to the existing test setup.
- Centralize step lifecycle computation in a reusable service or domain helper used by Draw Designer, Draw Planning, and game-status update flows. The computation must inspect all draw games in the step and their linked real games rather than relying only on a UI-local status.
- Use `DrawGame.status` as the authoritative started/finished indicator: `PLAYING` starts the step lifecycle, and all draw games must be `FINISHED` before the step becomes `FINISHED`.
- Review and update documentation for every functional or technical behavior change.

### Verified code observations

- The repository uses `DivisionDraw` and `timeslotId`; these names are authoritative for this feature.
- `SpreadTeamsAlgo` currently includes `Random`, `Best teams together`, `Spread best teams`, and `Manual`.
- Group types and point-calculation requirements are defined in `persistent-data-model/src/schedule.ts`; use persisted values rather than UI-only alternatives.
- Draw managers are selected from existing `Attendee` records and persisted as attendee IDs.
- The current `Game` model requires schedule, division, and team fields in addition to allocation coordinates. This feature changes `homeTeamId` and `awayTeamId` to optional fields so unknown draw-game teams can be planned.

## Acceptance criteria

- A tournament manager can create, select, edit, save, activate, and delete division draws subject to status and active-draw rules.
- A draw-type change updates group configuration on screen and generates the correct draw games only when saved.
- A manager can add a step when the draw is editable; missing compatible draw types produce an explicit warning rather than a silently disabled action.
- A manager can deactivate the selected active draw.
- Team ordering, point calculations, group names, and applicable configuration persist and reload correctly.
- A manager can allocate, move, swap, and deallocate matches with immediate persistence.
- Invalid duplicate-team allocations are rejected without changing the schedule.
- Loading repairs the invalid persisted cases listed above and informs the user when repairs occurred.
- The planning table, filters, highlight behavior, colors, and unknown-team display match the requirements.
- Unauthenticated users can view the active draw, while only tournament administrators can edit scores.
- The public draw view renders supported cup, pool, and wins-based group types and propagates score updates to dependent data.
- When `DRAW_DESIGNER` is enabled, a tournament manager sees `Draw designer` first in the `Games` menu group and it navigates to the draw designer route.
- The implementation is covered by relevant automated tests and documentation remains accurate.

### List of new tests

- Draw creation naming, immediate persistence, automatic activation, and one-active-draw enforcement.
- Draw-type initialization, retry safety, Firestore-generated identifiers, enabled defaults, and non-admin rejection.
- Draw edit lock for `RUNNING` and `FINISHED` steps.
- Step lifecycle transitions, including drawing, return-to-draft confirmation, allocation/deallocation, running, finished, cancellation, and legacy `DRAWED` normalization.
- Output team ranking strategy display, editing, default initialization, and persistence for legacy steps.
- Cancellation is available only from `RUNNING` and remains status-only.
- Draw-type filtering, group regeneration, and save-time draw-game creation/deletion.
- Adding a step, default position/status, first-step team ranking, and locked-state behavior.
- Draft-step deletion visibility, PrimeNG confirmation, ordered-list update, and immediate persistence.
- Team ordering and point-calculation persistence.
- Allocation, move, swap, deallocation, and status transitions.
- Duplicate-team same-timeslot rejection.
- Planning-load repair rules and generic repair notification.
- Highlight/filter selection and unknown-team display.
- Public access and administrator-only score editing.
- Group-specific rendering and score propagation for supported group types.
- Menu visibility, label, group placement, ordering, and route for the enabled `DRAW_DESIGNER` module.
- DrawType administration filtering, sorting, CRUD, enabled state, subgroup editing, cancel behavior, and platform-admin access.
- DrawType administration validation, save confirmation, cancel navigation, deletion of snapshot-source templates, and disabled-template behavior.

## Open decisions

- Define confirmation and error dialogs.
- Confirm supported group-type families and bracket/ranking algorithms for the first implementation stage.

## Implementation notes

- The match planning screen is available to authenticated tournament managers at
  `/tournament/<tournamentId>/draw-planning`.
- It uses the existing `division-draw` and `game` collections, keeps the planning-cell width in a shared CSS
  variable, and supports day/selection filters, allocation, movement, swapping, deallocation, highlight colors,
  unresolved-team display, and same-timeslot team conflict rejection.
- The planning table centers field names in column headers and times in row headers for easier scanning.
- The frontend performs the documented persisted-data repair checks when loading. A trusted transactional callable
  remains required before this screen can be used in deployments where Firestore client writes are not permitted.

## Readiness

Ready for implementation of the Step lifecycle. Confirmation and error-dialog wording, and the supported group-type algorithms, remain non-blocking open decisions.

## Summary

The draw designer, DrawType initialization, Platform DrawType administration, and Step lifecycle requirements are specified. The Step lifecycle uses `DrawGame.status` for running and finished detection, deletes linked `Game` and `DrawGame` records when returning to `DRAFT`, and normalizes legacy `DRAWED` values to `DRAWN`.

## Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Persistent model | `persistent-data-model/src/schedule.ts`, `persistent-data-model/src/tournament.ts` | Reuse existing draw models and resolve terminology mismatches. |
| Game allocation | `persistent-data-model/src/tournament.ts` | Create/update `Game` using `timeslotId`, `fieldId`, and `scheduleInfo`; define unknown-team handling. |
| Frontend | `frontend/AGENTS.md`, existing placeholder page | Add staged Angular screens and services following project conventions. |
| Backend/security | `functions/AGENTS.md` and existing persistence architecture | Validate manager actions and repair/write operations at the trusted boundary. |
| Documentation | Repository rules and `doc/datamodel.md` | Update model documentation if persisted fields or semantics change. |

## Remaining assumptions

- Existing persistent interfaces are authoritative unless a clarified decision requires a documented model change. `Game.homeTeamId` and `Game.awayTeamId` are the documented exception and must become optional.
- The three screens will be implemented incrementally and reviewed between stages.
- The target data volume is small enough for complete client-side loading, subject to measurement during implementation.

## Recommended implementation breakdown

1. Update the persistent model and documentation for optional game team identifiers.
2. Implement and test the draw design screen and persistence operations.
3. Implement and test planning, allocation constraints, transactional repair, and overwrite-on-save behavior.
4. Implement and test public draw visualization and score propagation.

## Recommended checks

- Type-check and build the frontend after each stage.
- Run focused model/service/component tests and the complete test suite before advancing stages.
- Verify Firestore/query authorization and transactional behavior for all writes.
- Test empty, partially configured, malformed, and legacy draw data.
- Review `/doc` and `doc/datamodel.md` after each persisted behavior change.
