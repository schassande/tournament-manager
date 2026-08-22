# Split and join tournament day parts

Last updated: 2026-08-22

## Objective

Allow tournament managers to reorganize and name the `PartDay` sections of a tournament day from the tournament configuration page, without changing any `Timeslot.id`.

## Scope

### In scope

- Add actions to the `Days` tab of the `tournament-edit` page to split one `PartDay` into two, merge two consecutive `PartDay` objects of the same `Day`, and move the boundary between two consecutive parts upward or downward.
- Preserve every existing timeslot identifier during all these operations.
- Add controls in each part header to split the current part, merge it with the preceding part, move the preceding part's last timeslot to the current part's beginning, and move the current part's first timeslot to the preceding part's end.
- Add a user-visible `PartDay.name`, initialize legacy missing names from `PartDay.id`, and display the name instead of the identifier in the day editor.
- Request a part name when creating or splitting a part, and allow an existing part name to be edited by clicking its displayed name.

### Out of scope

- Changing timeslot identifiers.
- Changing timeslot type or duration independently of reorganization.
- Reorganizing timeslots across different days.

## Functional requirements

1. Splitting a part opens a modal dialog containing a required part-name text input and a listbox control.
2. The listbox lists all timeslots of the selected part except its last timeslot; the selected value identifies the timeslot after which the part is split.
3. Creating a part opens a modal dialog requesting a required part name before the part is created.
4. Clicking the displayed part name opens a modal dialog allowing the name to be changed.
5. Merging is available for every part except the first part of its day and combines it with the preceding part.
6. The upward boundary action moves the preceding part's last timeslot to the beginning of the current part. It is available only when the preceding part contains at least two timeslots.
7. The downward boundary action moves the current part's first timeslot to the preceding part's last position. It is available only when the current part contains at least two timeslots.
8. All operations must keep timeslots chronological and preserve their existing `Timeslot.id` values.

## Business rules

The resulting parts must remain consecutive sections of the same day. Existing `PartDay.id` values must be preserved. A split generates a new unique identifier only for the newly created part. A merge keeps the identifier of the preceding part and removes the current part's identifier; parts must not be renumbered as a side effect. A split copies the source part's metadata to both resulting parts. A merge keeps the metadata of the preceding part. Split, merge, and boundary operations move timeslots without changing their `start`, `end`, `duration`, `slotType`, or `playingSlot` values. Part names must be non-empty after trimming.

## User interface and workflow

The controls are displayed in the upper-right area of each part. The part name is displayed as an editable button. The split control opens a modal with a required name input, the first eligible timeslot preselected, a required listbox, `Split` and `Cancel` buttons. The operation is applied only when `Split` is validated; cancelling must not mutate the day. Creation and name-edit dialogs use `Save` and `Cancel` buttons. No additional confirmation is required. The merge and boundary controls execute their respective operation. Labels, icons, keyboard behavior, and error feedback are to follow existing UI conventions.

## Data model and persistence

Use the existing `Day.parts: PartDay[]` and `PartDay.timeslots: Timeslot[]` structures, adding the persisted `PartDay.name: string` field. When loading legacy tournaments without this field, initialize it in memory from `PartDay.id`; newly saved data persists the initialized name. Timeslot identifiers are opaque and unique within a day; games and other business objects resolve a timeslot by `(dayId, timeslotId)`. Persistence follows the existing tournament-edit save workflow.

## Errors, validation, and permissions

Actions must be unavailable or rejected when their stated cardinality preconditions are not met. The existing tournament-edit permission, save, and error workflow must be reused; no dedicated endpoint or immediate save is required.

## Compatibility and migration

No batch data migration is expected. Existing references to timeslot and part-day identifiers must remain valid wherever the retained part or timeslot remains. New part identifiers are generated only for split-created parts; existing parts are not renumbered. Legacy missing names are initialized when a tournament is loaded.

## Acceptance criteria

- A manager can split a part at any eligible timeslot using the `Days` tab, with the first eligible timeslot initially selected.
- A manager can merge a part with its predecessor when eligible.
- A manager can move the boundary in either direction when the corresponding eligibility rule is met.
- All timeslots remain present, chronological, and retain their original identifiers.
- Split parts inherit the source metadata, and a merge retains the preceding part's metadata.
- New parts and split-created parts persist the name entered in their respective dialogs.
- Existing part names are displayed, and clicking a name allows it to be changed and saved.
- Split, merge, and boundary operations do not change timeslot timing or slot properties.
- Existing games, allocations, availability records, and other references resolved by `(dayId, timeslotId)` still resolve to the same timeslots.
- Ineligible controls are not displayed or cannot be triggered.
- Cancelling the split modal leaves the day unchanged.
- The updated tournament can be saved and reloaded with the resulting part structure.

## Open decisions

None. The existing tournament-edit save, permission, and error workflow is explicitly selected.

## Spec analysis

### Readiness

Ready for implementation

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend UI | `frontend/src/component/tournament-day-edit.component.ts` renders part headers and delegates mutations to `TimeslotService`. | Add controls, split modal workflow, and event handling in the day editor. |
| Frontend domain logic | `frontend/src/service/timeslot.service.ts` owns part/timeslot mutations, `adjustNextTimeSlot`, and `adjustNextPart`. | Add tested split, merge, and boundary operations while preserving slot IDs. |
| Persistent model | `persistent-data-model/src/tournament.ts` defines `Day`, `PartDay`, and `Timeslot`. | No schema change currently identified. |
| Cross-feature references | `doc/datamodel.md` states that `Game` and other references resolve slots by `(dayId, timeslotId)`. | Slot IDs must remain stable; moved slots must still resolve correctly. |
| Tests | `frontend/src/service/timeslot.service.spec.ts` exists. | Extend service-level regression coverage. |

### Remaining assumptions

- The existing tournament edit save workflow persists the mutated `Tournament` object.
- The operation applies only to parts within one day.
- A unique identifier can be generated for a newly created `PartDay` without renumbering existing parts.

### Recommended implementation breakdown

1. Implement and unit-test the part/timeslot transformations in `TimeslotService`.
2. Add the modal and action controls to the day editor using existing PrimeNG conventions.
3. Verify save/reload behavior and cross-feature timeslot resolution.
4. Keep `doc/datamodel.md` accurate; no data-model update is required because slot identity and persistence semantics are unchanged.

### Recommended checks

- Run the frontend test suite, including `timeslot.service.spec.ts`.
- The frontend test suite uses the repository's `ChromeHeadlessCI` Karma launcher with an isolated temporary Chrome profile.
- Build the frontend.
- Test split, merge, and both boundary directions with one and multiple timeslots.
- Verify all pre-existing timeslot IDs and references are unchanged after save and reload.
- Verify keyboard accessibility, labels, focus behavior, and ineligible action visibility.
