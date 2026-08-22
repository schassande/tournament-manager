# Robust Timeslot Identifiers

Last updated: 2026-08-22

## Objective

Make each timeslot identifier unique within a tournament day so that a timeslot can be moved between `PartDay` objects without changing its identity. A timeslot must be identified by `(dayId, timeslotId)`; `partDayId` must not participate in timeslot identity.

This specification records the current implementation and the expected functional and technical evolution.

## Scope

### In scope

- Analyze current timeslot identifier allocation in FIT import and timeslot-management code.
- Define a day-scoped identifier strategy for timeslots.
- Update affected models, services, import logic, user interfaces, persistence mappings, availability data, games, and tests.
- Preserve timeslot identity when moving a timeslot between parts of the same day.

### Out of scope

- Changing the identity scope of `Day`, `PartDay`, or `Field`.
- Keeping `Game.partDayId` as a persisted field; this field is explicitly removed by this change.
- Changing the meaning of `partDayId` for referee allocations; attendee slot unavailability is explicitly migrated to day-scoped timeslot references.
- Replacing `timeslotId` with a globally unique identifier across all days unless selected below.

## Functional requirements

- A timeslot identifier is unique among all timeslots in one `Day`, regardless of its `PartDay`.
- Timeslot lookup for a game uses `dayId` and `timeslotId` only; `Game` does not contain `partDayId`.
- Moving a timeslot between parts of the same day preserves its `timeslotId`.
- New timeslots receive an identifier not already used in the day.
- Removing or moving timeslots must not silently reassign existing identifiers.
- FIT import must reuse the existing opaque identifier when an imported timeslot matches an existing one by `(day date, start time)`.
- No backward-compatible data migration is required because the application is not in production; existing test data will be deleted before the new model is deployed.

## Business rules

- `partDayId` identifies the containing part for workflows that are explicitly part-day-scoped; it is not part of a timeslot key and is not stored on `Game`.
- The authoritative timeslot key is `(dayId, timeslotId)`.
- Timeslot identifiers remain stable when a part is split, joined, or its boundary is moved.
- Duplicate identifiers in newly created data must be rejected; legacy duplicates in the disposable test database do not require an application migration.

## User interface and workflow

- The day editor, game editor, referee allocation views, attendee availability views, and FIT import UI resolve timeslots using the day-scoped key.
- Moving a timeslot between parts keeps its `timeslotId` and updates only the containing `partDayId` where applicable.
- UI tracking keys remain unique when all parts of a day are rendered together.
- Duplicate identifiers in newly written data are displayed as a blocking validation error and cannot be silently resolved.

## Data model and persistence

Current model facts:

- `Timeslot` is embedded in `Day.parts[].timeslots[]` and has an `id` field.
- `Game` currently stores `dayId`, `partDayId`, and `timeslotId`; the approved model removes `partDayId`, while `timeslotId` is resolved with `dayId`.
- `PartDayUnavailability` currently stores `dayId`, `partDayId`, and `unavailableSlotIds[]`; the approved evolution removes `partDayId` from this structure and resolves unavailable slots through `(dayId, timeslotId)`.

Original allocation facts (before this change):

- `TimeslotService.addPartAfter` creates a timeslot with id `"1"`.
- `TimeslotService.addTimeSlotAfter` creates id `"1"`, then `renameTimeslots(part)` renumbers the affected part from `"1"`.
- `TimeslotService.removeTimeSlot` also renumbers only the affected part.
- FIT merge creates new timeslots with `newId('timeslot')`, while matching existing timeslots by date and start time in `FitMergeService`.
- The tournament editor creates imported timeslot identifiers from the source array position.

Implemented allocation facts:

- New timeslots created by `TimeslotService` and the tournament editor receive opaque UUID identifiers.
- `TimeslotService` no longer renumbers timeslots within a part after insertion or removal.
- FIT structure import reuses a timeslot by `(day date, start time)` across all parts of the day and allocates a new opaque identifier otherwise.

Required persistence changes:

- Remove assumptions that `timeslotId` is unique only inside a `PartDay`.
- Define the identifier format and allocation algorithm before implementation.
- Reset the disposable test database before deploying the new persisted structure; no migration/normalization code is required.
- Update `PartDayUnavailability` persistence and all consumers so it stores only the day-scoped slot references required by the approved model.
- Remove `Game.partDayId` from the TypeScript model and persisted game documents. A game's containing part must be derived from the day-scoped timeslot when needed.
- Update `doc/datamodel.md` if persisted field semantics change.

## Errors, validation, and permissions

- Before saving a day, validate uniqueness of `(dayId, timeslotId)`.
- Reject duplicate `(dayId, timeslotId)` values before persistence.
- A game reference is invalid when `(dayId, timeslotId)` cannot be resolved.
- Existing authorization rules remain unchanged.

## Compatibility and migration

No application data migration will be implemented. Before deploying the new model, delete the existing test database data and recreate test fixtures with UUID timeslot identifiers, day-scoped game references, and the new availability structure. The implementation must still avoid creating duplicate identifiers in newly written data.

## Acceptance criteria

- No two timeslots in one day share an identifier after creation, import, test-fixture reset, or editing.
- Moving a timeslot between parts preserves its identifier and keeps game references resolving.
- Splitting, joining, and moving part boundaries do not change timeslot identifiers.
- FIT import produces stable day-scoped identifiers without duplicates.
- Game, referee allocation, attendee availability, and UI lookup flows resolve the intended timeslot using `dayId` and `timeslotId`.
- Persisted `Game` objects no longer contain `partDayId`; views derive the containing part from `(dayId, timeslotId)` when required.
- The documented test-data reset is completed before deployment; no legacy migration path is required.
- Tests cover creation, movement, split/join, FIT import, duplicate detection, test fixtures, and affected lookups.
- Existing documentation is reviewed and updated where persisted identifier semantics change.

## Open decisions

1. **Identifier format and allocation strategy (decided):** use an opaque stable identifier, preferably a UUID, allocated once when a timeslot is created and preserved across all moves within the day.
2. **Legacy data compatibility (decided):** do not implement a migration. Delete the non-production test database data and recreate it using the new model.
3. **FIT matching (decided):** match imported and existing timeslots by `(day date, start time)`. When a match exists, preserve its opaque identifier; otherwise allocate a new UUID. Duration and slot type do not participate in identity matching.
4. **Availability semantics (decided):** remove `partDayId` from `PartDayUnavailability`; persist and resolve unavailable slots using `(dayId, timeslotId)` only.
5. **Game part reference (decided):** remove `Game.partDayId` from the model and persistence. Use `(dayId, timeslotId)` to resolve the containing part when a workflow needs it.

## Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Persistent model | `persistent-data-model/src/tournament.ts` | Enforce day-scoped identity while preserving part-day semantics where required. |
| Timeslot editing | `frontend/src/service/timeslot.service.ts` | Replace per-part renumbering and allocation; preserve IDs across moves. |
| FIT import | `frontend/src/service/fit-merge.service.ts`, `frontend/src/page/tournament-edit.page.ts` | Allocate and match IDs at day scope rather than by part or source position. |
| Game model and views | `persistent-data-model/src/tournament.ts`, `frontend/src/page/tournament-games.page.ts`, referee allocation components | Remove persisted `Game.partDayId`; derive the containing part from the day-scoped timeslot. |
| Availability | `frontend/src/component/attendee-unavailability.component.ts`, `persistent-data-model/src/referee-availability.ts` | Remove `partDayId` from attendee slot-unavailability persistence and migrate references to day-scoped IDs. |
| Documentation | `doc/datamodel.md`, FIT and split/join change specs | Update persisted semantics and workflows after decisions. |

## Readiness

Implementation completed. The identifier format, test-data reset strategy, FIT matching rule, attendee availability scope, and removal of `Game.partDayId` are implemented. Referee allocation data remains explicitly part-day-scoped.

## Recommended implementation breakdown

1. Implement and document the UUID allocation and day-scoped lookup invariants.
2. Implement shared day-scoped lookup and allocation helpers with JSDoc and unit tests.
3. Update the timeslot editor and split/join workflows.
4. Update games, allocations, availability, and UI tracking/lookups.
5. Update FIT import and validation logic.
6. Update data-model documentation and run frontend, model, and import tests.

## Recommended checks

- Search all `timeslotId`, `slot.id`, `renameTimeslots`, and part-local lookup patterns.
- Reset the test database and recreate fixtures with multiple parts and UUID timeslot IDs.
- Test moving a played game's timeslot to another part without changing game identity.
- Import the same FIT snapshot twice and confirm stable IDs.
- Verify `doc/datamodel.md` and related change specifications describe the final key semantics.
