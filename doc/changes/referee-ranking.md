# Referee ranking

Last updated: 2026-09-13

## Objective

Let tournament referee coaches rank eligible referees individually and merge the selected panel's votes into a ranking used to decide who will referee the finals.

## Scope

### In scope

- A page at `/tournament/:tournamentId/basic-ranking`, available from the main left drawer when RANKING is enabled and the current user is a referee coach of that tournament.
- Multiple named tournament rankings, eligible referee selection, coach panels, individual ranking, panel computation, and Excel export.
- Two ranking collections, immediate persistence, backend cleanup, tournament-deletion integration, and ten algorithm test datasets.
- Five implementation stages, each requiring developer validation before the next stage starts.

### Out of scope

- Automatic allocation to finals.
- Panel-leader configuration or restriction to the existing RefereeCoachLeader role.
- Concurrency management, version checks, conflict rejection, or forced reloads.
- A new permission index or backend endpoints for ordinary ranking reads and saves.
- A standalone ranking-deletion interface for tournament managers.
- Feature implementation during this analysis.

## Functional requirements

1. Create a ranking by entering its name in a popup opened by `Create new Ranking`.
2. Select the current ranking using a PrimeNG Select displaying its name.
3. Configure eligible full-time referees and a panel selected from tournament referee coaches.
4. Allow any selected referee coach to choose any selected referee coach in a PrimeNG Select and edit the ranking defined by that coach, including their own. The target needs no application account. Only locked rankings of selected coaches contribute votes. Non-panel coaches retain editing of their own practice ranking; editing another coach requires both actor and target to be selected.
5. Allow every tournament referee coach, including non-panel coaches, to run Compute in PANEL_RANKING.
6. Allow every tournament referee coach to export the visible Panel data, including in CLOSED.
7. Save configuration selections and individual edits immediately; do not debounce individual ranking saves.
8. Preserve a previously computed result after relevant inputs change, with `Recompute required`, until Compute succeeds again.

## Business rules

### Lifecycle and permissions by state

`CONFIGURE => INDIVIDUAL_RANKING <=> PANEL_RANKING => CLOSED`.

All tournament referee coaches may perform these transitions, including those not selected for the panel. No transition back to CONFIGURE or out of CLOSED is supported.

| Action | CONFIGURE | INDIVIDUAL_RANKING | PANEL_RANKING | CLOSED |
| --- | --- | --- | --- | --- |
| Edit name, target N, referee selection, coach selection, majority | Yes | Yes | Yes | No |
| Edit chosen coach ranking while unlocked, subject to actor/target eligibility | No | Yes | Yes | No |
| Lock/unlock chosen coach ranking, subject to actor/target eligibility | No | Yes | Yes | No |
| Compute, for any tournament referee coach | No | No | Yes | No |
| Read and export existing data | Yes | Yes | Yes | Yes |
| Repair invalid references, including locked individual rankings | Yes | Yes | Yes | No |
| Confirmed standalone ranking deletion by a tournament referee coach | Yes | Yes | Yes | Yes |

The page-level role/module requirements apply to every UI action. Missing-referee empty states described below take precedence over tab actions.

Closure requires a previously computed, successfully saved, current panel result. Block CLOSED for a never-computed result or one marked `Recompute required`. An empty computed result is valid and is distinguishable from a never-computed result. Other transitions follow the stated lifecycle and ordinary field validation; do not add requirements for all coaches to vote, for a nonempty result, or for N filled positions.

### Configuration and defaults

- Eligible referees are tournament attendees with `isReferee === true` and no `player?.teamId`; exclude PlayerReferee attendees. This follows the existing full-time-referee definition.
- Eligible coaches are tournament attendees with `isRefereeCoach === true`. The typical panel has at most 15 coaches; this is an expectation, not a hard limit.
- Initial `nbRefereesToRank` is **15**. It is a display target, not an algorithm input/output limit or a prerequisite for locking.
- Initial `voteMajority` is `floor(selectedCoachCount / 2) + 1`, calculated from selected coaches, not locked votes. Examples: 5 coaches give 3; 101 give 51.
- Subsequent coach additions/removals never automatically recalculate or clamp the stored majority, even after manual changes or when the panel becomes empty.
- Creation uses empty referee and coach selections, CONFIGURE, and therefore an initial majority of 1 using the confirmed formula. Once coaches are selected, the user can change this stored threshold; no automatic initialization at a later status transition is introduced.
- Require a nonempty trimmed name. Duplicate display names are allowed; IDs distinguish records. Require finite positive safe integers for N and majority; reject empty, fractional, nonpositive, or nonnumeric values without persisting them.
- N may exceed the selected-referee count. Majority may exceed the selected-coach count: preserve it, show the existing `value / selected count`, and let the algorithm produce an empty result if no referee reaches the threshold. Do not silently alter either number when selections shrink.

The creation and numeric-validation details above are routine implementation defaults derived from the confirmed formula, default N, immediate-save workflow, and absence of count-based truncation. They do not add a new status or voting requirement.

### Removing referees and coaches

- Referee and coach selection is editable without removal confirmation in CONFIGURE. Removing a selected referee or coach in INDIVIDUAL_RANKING or PANEL_RANKING requires confirmation.
- A referee removal is an atomic backend operation: update selection, remove that ID from all associated coach rankings, remove its panel ID and corresponding stats row, and mark an existing panel result stale. Report success only after the full operation commits. Failure leaves all persisted documents unchanged.
- Removing a coach only changes panel membership. Preserve their individual ranking, ordered IDs, lock, and change timestamp. It remains visible in Panel as a practice ranking and contributes no votes while the coach is unselected. The coach retains editing of their own practice ranking; other coaches cannot edit it while its owner is unselected.
- Before CLOSED, remove deleted or ineligible referee references from selections and rankings on load/refresh. Preserve the relative order of remaining referees and the alignment of panel IDs/stats. Maintenance may clean a locked individual ranking without unlocking it; update its ranking timestamp only if its ordered list changes.
- In CLOSED, perform no repair writes. Preserve IDs, positions, statistics, and timestamps; display missing referees as `Deleted referee` (`Arbitre supprimé` in French), including in exported data.

### Deletion

A tournament referee coach may delete a whole ranking after confirmation, including in CLOSED. The confirmation explains that all associated individual rankings, including practice rankings, will also be deleted. Execute cross-owner deletion on the backend; this does not grant arbitrary standalone deletion of another coach's record.

A tournament manager has no standalone ranking-deletion action. Their Firestore read/delete rights exist to support the existing complete tournament-deletion workflow. Add both ranking collections to that cascade, including closed and practice data. If a manager also has the referee-coach role, the coach workflow remains available under that role.

### Individual votes and panel freshness

- Locking validates the coach's vote and prevents ordinary reordering. A coach may lock an incomplete ranking, including an empty list; there is no minimum N requirement.
- Compute does not wait for every selected coach to lock or create a ranking. Missing and unlocked rankings contribute nothing; the majority stays unchanged.
- A non-panel coach's ranking never contributes, regardless of lock state.
- Relevant changes to selected referees, panel membership, majority, selected-coach lock state, or contributing ordered rankings make an existing panel result stale. A ranking name or N change does not.
- Keep the previous panel result visible while stale. Do not automatically recompute. A failed save or Compute leaves the previous result and stale indication intact.
- Persist the result state so it survives a reload. This is business freshness tracking, not a concurrency protocol.

### Panel computation

Use one-based nomination ranks and the complete locked rankings of selected coaches.

1. Maintain `Map<string, number[]>` from eligible referee attendee ID to accumulated nomination ranks.
2. At round R, examine position R in every contributing coach ranking. Append R for each nomination, collecting all votes for that round before admitting any referee.
3. Admit each not-yet-admitted referee whose accumulated nomination count is **greater than or equal to** voteMajority. Crossing from 2 to 4 votes with threshold 3 qualifies and retains all 4 votes.
4. Sort new admissions within that round by comparing nomination ranks from the first position onward; the lower first differing rank comes first.
5. If one list is an exact prefix of the other, the **longer list comes first**. Thus `[1, 3, 5, 5]` precedes `[1, 3, 5]`.
6. If the lists are identical, compare referee first name alphabetically, then last name. Use attendee ID only as a stable final fallback for identical names. No manual tie resolution or shared ranks.
7. Append each ID and a copy of its nomination-rank list at the same index in the panel result. Never admit a referee twice. Freeze their stored statistics at admission; later nominations do not update those statistics.
8. Continue to the last position present in any contributing ranking. Include every qualifying referee, including after input rank N and beyond output position N. Referees never reaching the threshold are omitted.

Example: at majority 3, `[1, 3, 5]` precedes `[1, 4, 5]`. The original reference to two votes in that example was a typo: both lists contain three nominations. No contributing votes, or no referee reaching the threshold, yields empty IDs and statistics.

## User interface and workflow

### Page shell

- Enforce enabled RANKING module and tournament referee-coach membership in both drawer visibility and direct route access.
- Action bar: ranking Select, `Create new Ranking`, legal status transitions, and confirmed deletion of the selected ranking.
- Creation asks only for the name and selects the newly saved ranking. On initial load, select the first available ranking; switching rankings replaces the shared coach-ranking state.
- With no current ranking, explain that a ranking must be created using the button.
- A selected ranking exposes four tabs: `Referees`, `Coaches`, `Coach Ranking`, `Panel`.
- Preserve the existing `tab=me` URL value and internal ranking-me component paths for compatible links; the visible tab and editor wording use Coach Ranking.

### Referees tab

- Small form for name and target number N.
- Keep each label to the left of its input to minimize form height.
- Place the filters on the left and the name/target form on the far right of the same compact toolbar above the PickList. Label N `Ranked referees`; wrap only when the viewport is too narrow.
- PrimeNG PickList: available full-time referees on the left, selected referees on the right.
- The selected-list title includes the count (`x Selected referees`); do not repeat N next to that count.
- Center both PickList titles. Both lists use the Coach Ranking-tab identity format, e.g. `L2S* Jean DUPONT`: level, category except O, `*` when an upgrade is requested, first name and uppercase last name.
- While Referees is active, fill the viewport below the 48px application toolbar. The PickList uses the remaining height below the page controls and filters; overflow scrolls inside each list, not on the page.
- Place Level, Category, Upgrade and Gender filters in a compact row above and outside the PickList, with reduced control padding. Filter available items in memory; filtering does not remove selected items.
- Emit changes to the page for immediate persistence. Removals use the atomic backend operation and relevant confirmation.

### Coaches tab

- Show all tournament referee coaches in two columns, each with a PrimeNG checkbox.
- Persist membership changes immediately via page output events.
- Show `Vote majority: <input> / <selected coach count>` below the list.
- Removing a coach leaves their complete individual ranking unchanged.

### Coach Ranking tab

- Rename the visible Me tab to `Coach Ranking`.
- The purpose is to enter rankings for coaches without an account or unable to use the application. Distinguish the authenticated acting coach from the target coach whose opinion is ranked: selecting a target never changes the signed-in identity.
- Add a PrimeNG Select labeled `Coach` above the lists. Populate it from the shared coach cache filtered by the current ranking's selectedCoachAttendeeIds, including coaches without personId, email or account. Every selected referee coach may edit any selected referee coach, including themselves. Also include the current coach's own entry when they are outside the panel, so they can edit their practice ranking. For a non-panel actor, other selected coaches remain viewable but their editor and lock controls are read-only.
- Show the target's CoachRefereesRanking from the grouped records, without additional queries. Identify the target in the ranking heading instead of `My ranking`.
- Default to the current coach if eligible, otherwise the first eligible target sorted by short name and ID. Reset this local selection when switching tournament rankings; choose an eligible fallback if membership removes the target. With no target, show `Configure coaches first` and no editor. Existing missing-referee and CONFIGURE empty states take precedence.
- Merely selecting a coach never writes or creates a record. Disable target selection during an immediate save; apply the response to the original target, preserve saved data on failure and retain existing feedback.
- Page access remains available to tournament referee coaches. A non-panel coach may edit and lock/unlock only their own practice ranking. Editing another coach requires both actor and target to be selected. Apply the existing phase and lock restrictions to both cases.
- If selected referees are empty, display only `Configure referees first`.
- When Coach Ranking cannot be edited, explain the relevant phase/lock restriction: CONFIGURE shows only the Move to step Individual ranking message and hides the lists and lock control, CLOSED is read-only, and a locked vote points to the lock toggle. Add and drag/drop follow the existing lifecycle without silently advancing the phase.
- Both lists size to their content with a minimum width of 200px each, aligned left with a gap; stack them on narrow screens.
- Left side: unranked eligible referees, sorted by descending level. Use first name, last name, then ID for stable ordering within a level.
- Right side: ordered referees with one-based positions displayed at the left of each row. Show at least N+1 filled or empty slots, and a separator between N and N+1. Empty slots are presentation only; persisted ID arrays are dense.
- Both sides use level/category/upgrade, first name and uppercase last name, e.g. `L2S* Jean DUPONT`. Omit category O. Reuse existing badge and identity conventions.
- The toggle binds to `locked` and sits at the far right of the selected coach ranking heading, on the same line. An open/closed padlock icon replaces the visible Ranking unlocked/Ranking locked text; retain an accessible control label and state tooltip. Lock/unlock is available to an eligible actor for the chosen target in the two editable individual phases. Unlocking permits editing again; no reordering is permitted while locked.
- Drag left to right inserts at the chosen position; drag inside the right list reorders; dropping outside the right list returns the referee to the sorted left list. Dropping on empty trailing slots appends without persisting gaps; cancelling a drag makes no change.
- After every drag, the two lists partition the eligible selection exactly: no missing referee, no duplicates. On the left, use an icon-only right-arrow button for Add, retaining its accessible referee-specific label. On ranked rows, a horizontal-bars drag icon replaces the Up, Down and Remove buttons; the focusable icon supports ArrowUp/ArrowDown to reorder and Delete to remove.
- Create the selected target coach's empty, unlocked individual record lazily on the first permitted edit or lock action, using its deterministic ID. Viewing CONFIGURE or CLOSED must not create records. An absent record is displayed as empty.
- On load/refresh, perform the agreed cleanup before CLOSED; in CLOSED render missing-referee placeholders without writes.

### Panel tab and export

- Available to every tournament referee coach. Compute is available to all of them in PANEL_RANKING; selected panel membership is a vote filter, not Compute authorization.
- If selected referees are empty, display only `Configure referees first`.
- Large scrollable table with fixed header. Compute and Export are above it on the right; show current result state alongside these actions.
- Columns: Rank, Panel referee, Panel statistics, repeated Rank, one column for every coach with an existing individual ranking, including unlocked and empty rankings.
- Group selected coaches first, other coaches second, and sort each group alphabetically by short name. Lock state does not affect ordering. Use ID only as a final fallback.
- Table height covers the longest displayed ranking. Display empty cells for shorter rankings and nomination stats in readable list form, e.g. `[1, 3, 5]`.
- Excel export includes every displayed row and column in the same order, referee identity strings, stats, current ranking name/status, and the recomputation indicator when applicable. Export does not implicitly Compute and is permitted for all tournament referee coaches, including in CLOSED.
- Use one worksheet for this table with a header row and a filename based on tournament/ranking names. Reuse the project's XLSX download conventions.

## Data model and persistence

### Application contracts

Add `persistent-data-model/src/referee-ranking.ts` and export it from `src/index.ts`. Correct the source typo `selectedcoachAttendeeIds` to `selectedCoachAttendeeIds`, and type the panel field as PanelRefereesRanking so its required statistics are represented.

```typescript
/** Ordered referee IDs and ISO time of the most recent ranking edit. */
interface RefereesRanking {
  rankingLastChange: string;
  rankedRefereeAttendeeIds: string[];
}

/** Panel output with nomination histories aligned to ranked referee IDs. */
interface PanelRefereesRanking extends RefereesRanking {
  stats: number[][];
}

/** Persisted business state of the manually computed panel result. */
type PanelResultState = 'NOT_COMPUTED' | 'CURRENT' | 'STALE';

/** Tournament ranking configuration and its computed panel output. */
interface TournamentRefereeRanking extends PersistentObject {
  name: string;
  tournamentId: string;
  selectedRefereeAttendeeIds: string[];
  selectedCoachAttendeeIds: string[];
  nbRefereesToRank: number;
  voteMajority: number;
  status: 'CONFIGURE' | 'INDIVIDUAL_RANKING' | 'PANEL_RANKING' | 'CLOSED';
  panelRefereesRanking: PanelRefereesRanking;
  panelResultState: PanelResultState;
  /** Actor attendee used to validate ordinary direct client writes. */
  updatedByCoachAttendeeId: string;
  /** Target of the last individual-vote freshness batch; absent until such a batch occurs. */
  updatedCoachAttendeeId?: string;
}

/** One coach's ranking for one tournament ranking. */
interface CoachRefereesRanking extends RefereesRanking, PersistentObject {
  tournamentRefereeRankingId: string;
  tournamentId: string;
  coachAttendeeId: string;
  /** Authenticated editor; optional on legacy reads, required on ordinary client writes. */
  updatedByCoachAttendeeId?: string;
  locked: boolean;
}

/** Firestore-compatible representation of one nomination-statistics row. */
interface StoredPanelStatsRow {
  ranks: number[];
}
```

- Collections: `tournament-referee-ranking` and `coach-referees-ranking`, with matching exported collection constants.
- Parent IDs are generated. Individual IDs are deterministic and collision-free from `(tournamentRefereeRankingId, coachAttendeeId)`; use encoded pair components with an unambiguous separator in a shared helper. Validate that stored relationship fields match the ID.
- New parent: CONFIGURE, empty selections, N=15, majority=1, empty panel IDs/stats, `rankingLastChange: ''`, `panelResultState: 'NOT_COMPUTED'`, current coach as updatedByCoachAttendeeId. Empty timestamp means no panel computation has occurred; every successful Compute writes an ISO timestamp even for an empty result.
- New individual: current tournament/ranking IDs and the selected target coach attendee ID, authenticated actor as updatedByCoachAttendeeId, empty referee list, `locked: false`, ISO creation time. Ordered-list edits or actual cleanup update rankingLastChange. Lock-only changes update PersistentObject.lastChange but need not change the ranking timestamp.
- Keep inherited PersistentObject id/lastChange conventions; rankingLastChange remains ISO rather than the numeric base timestamp.
- Store panel statistics as `{ ranks: number[] }[]`, and convert to/from the application-facing `number[][]` in the service and backend mapper. Never write raw nested arrays to a Standard Firestore database. This preserves the original logical contract while accommodating its storage restriction. [Firebase supported data types](https://firebase.google.com/docs/firestore/manage-data/data-types).
- `panelResultState` is the minimal persisted representation of the confirmed never-computed/current/stale behavior. `updatedByCoachAttendeeId` follows the existing panel-upgrade-vote actor pattern; neither field is a revision counter.

## Errors, validation, and permissions

### Temporary read policy

Confirmed in question 28: **any authenticated user may read both ranking collections directly from Firestore**, including users outside the tournament. Anonymous reads are denied. This intentionally replaces the original coach-only collection-read policy. The application's page, menu, Compute and Export remain governed by tournament coach/module access. Do not confuse the UI restriction with confidentiality of authenticated Firestore reads.

No permission-index collection or backend API for ordinary reads/saves is introduced. Hardening collection reads later is outside this increment.

### Writes and maintenance

- Any authenticated tournament referee coach may ordinarily create/update their own individual ranking, including non-panel practice. Editing another coach requires both actor and target to be selected referee coaches of the same tournament. Both paths are allowed only in INDIVIDUAL_RANKING or PANEL_RANKING, with an existing parent and immutable tournament/ranking/coach identity fields. Locked records permit unlocking but not list editing in the same write; list changes require the previously unlocked state.
- Any tournament referee coach may create or edit parent configuration before CLOSED, perform valid status transitions, and save a computed panel result only in PANEL_RANKING.
- Authenticate the actor against the referenced tournament attendee and its linked person identity. Use the actual nested `Attendee.person.personId`/`person.email` fields; do not copy the existing upgrade rule's incorrect top-level personId reference. Validate the actor is a coach of the same tournament and matches the authenticated user's email.
- Validate direct-write field types, positive integer values, immutable relationships, unique ranking IDs, ranking IDs being a subset of the selected referee IDs, legal state changes, and parallel panel IDs/stats lengths. UI configuration selection must come from the shared eligible tournament attendee cache. Backend cleanup revalidates attendee existence and eligibility from stored data.
- On relevant parent edits, retain NOT_COMPUTED or set an existing result to STALE. When a contributing individual vote changes, save it and mark the parent stale in one write batch; allow that acting coach to update only the parent's panelResultState, updatedByCoachAttendeeId, updatedCoachAttendeeId and lastChange fields as part of this path. Authorize the selected target record, retaining its coach ownership and validating the actual actor separately; do not grant cross-tournament writes.
- Saving a computed result sets CURRENT, writes IDs/stats and its ISO time, and requires PANEL_RANKING and a tournament coach actor. Closure requires the stored CURRENT state and a nonempty computation timestamp. No revision comparison or conflict handling is added.
- Maintenance may remove invalid IDs across owners and preserve locks before CLOSED. Only the dedicated authenticated backend path receives this exception. CLOSED blocks repair and updates, but permits confirmed deletion.
- Standalone whole-ranking deletion is authorized for tournament referee coaches through the backend cascade. Manager direct Firestore read/delete permissions remain available for the complete tournament-deletion service and must not depend on attendee documents that that service may already have deleted; reuse tournament managerEmails authorization.
- Show recoverable errors for loads, saves, cleanup, Compute and export. Keep the previous saved data when an operation fails; do not mark failed changes saved. Normal direct saves follow the existing last-write behavior without extra concurrency controls.

## Compatibility and migration

- Stages 1-4 already introduced the collections, models and route. Preserve existing individual IDs, ownership, lists, locks and timestamps. Tournaments without rankings remain readable. Existing documents without the new optional metadata remain readable. Every new ordinary individual write supplies updatedByCoachAttendeeId; a parent updatedCoachAttendeeId is introduced only by an individual-vote freshness batch. No bulk backfill is required, and missing legacy actor metadata must not be fabricated on read.
- Preserve existing module-enabled semantics and the RANKING module name.
- Both new collections carry tournamentId so they fit the existing tournament deletion queries.
- A loaded parent without computation state should be treated as NOT_COMPUTED until explicitly computed; never infer computation from result length.
- Do not migrate or broaden unrelated upgrade permissions as part of this feature. Record pre-existing issues found during verification separately.

## Technical specifications

### Verified code findings

These are repository observations, separate from the requested changes and implementation choices below.

| Area | Existing evidence | Implementation impact |
| --- | --- | --- |
| Shared model | `persistent-data-model/src/tournament.ts`: Attendee, Tournament; `src/person.ts`; `src/persistence.ts` | Reuse attendee identity, full-time-referee definition, roles and base persistence contract; export new ranking types. |
| Attendee queries | `frontend/src/service/attendee.service.ts`: findTournamentReferees, findTournamentRefereeCoaches | Reuse the two queries and filter player referees in memory. |
| Firestore services | `frontend/src/service/abstract-persistent-data.service.ts`; `referee-upgrade-coach-vote.service.ts` | Reuse observable/query conventions and deterministic IDs; override ranking save paths to serialize stats and support freshness batches. |
| Actor metadata | `persistent-data-model/src/referee-upgrade.ts`: RefereeUpgradePanelVote.updatedByCoachAttendeeId | Follow the existing actor-attendee pattern for shared parent writes, using the actual current attendee model. |
| Routes and menu | `frontend/src/app/app.routes.ts`; `frontend/src/component/main-menu.component.ts`; `frontend/src/config/tournament-features.ts` | Add the ranking route/menu; RANKING already exists in the module catalog. |
| Auth | `frontend/src/app/auth-guard.ts`; `frontend/src/service/user.service.ts` | Existing guard establishes sign-in; feature route must additionally check tournament coach membership and enabled module. |
| Referee presentation | `frontend/src/component/referee-selector.component.ts`; `referees-list.component.ts` | Reuse badge/category/upgrade presentation and filter values. The full selector contains game-allocation behavior and is not a drop-in ranking widget. |
| Excel | `frontend/src/service/fit-excel-export.service.ts` | Reuse the existing XLSX workbook/download pattern. |
| Functions | `functions/src/index.ts`; `functions/src/common-persistence.ts` | Add focused authenticated backend operations for removal, repair and standalone cascade deletion; ordinary reads/saves stay direct. |
| Deletion | `frontend/src/service/tournament-deletion.service.ts`: RELATED_COLLECTIONS, deleteTournamentInternal; `frontend/src/page/tournament-list.page.ts`: removeTournament | Add both collections to the existing tournamentId query/delete cascade and progress totals. The tournament is deleted last, after attendees and other related documents. |
| Security/indexes | `firestore.rules`; `firestore.indexes.json` | Current fallback denies unknown collections; add explicit authenticated reads and appropriate writes/deletes. Validate final query shapes. |

Firestore rules require known document paths for identity lookups and are not post-query filters. Question 28 deliberately chooses authenticated collection reads instead of an additional membership lookup. Do not accidentally reinstate coach-only read conditions that break the required grouped queries. [Firebase rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).

### Delegated save contract (decision 30)

- Extend `RefereesRankingService.saveIndividual` and `prepareIndividualRanking` to receive separate `actorCoachAttendeeId` and `targetCoachAttendeeId` arguments in addition to parent, previous record and changes. Use target identity for deterministic IDs, immutable relationships and contribution checks; write actor identity into the individual updatedByCoachAttendeeId on every ordinary save. Page-derived eligibility is a UI guard; Firestore independently verifies authorization.
- Authenticate the actor using the existing tournament attendee/person identity lookup and RANKING gate. Validate that the target is a referee-coach attendee of the same tournament. Permit the action when actor equals target, or when both IDs belong to the parent's selectedCoachAttendeeIds. The target's personId, email and account are not authorization prerequisites for delegated writes.
- A new parent omits updatedCoachAttendeeId. When an individual action changes panelResultState to STALE, batch the target record with exactly these parent fields: panelResultState = STALE, updatedByCoachAttendeeId = actor, updatedCoachAttendeeId = target, and lastChange = the individual save timestamp. The target marker is metadata about that batch, not a UI selection, ownership field or revision counter.
- In `validIndividualFreshnessChange`, derive the deterministic child path from parent ID and the incoming updatedCoachAttendeeId. Verify a real contributing vote change using its before/after records, validate the child's actor equals the parent's incoming updatedByCoachAttendeeId, authenticate that actor, and enforce target eligibility and matching timestamps. Reject marker-only changes and isolated freshness batches without a valid contributing vote change. Other parent save paths preserve the optional target marker and do not use it as an authorization source.
- In `validIndividualWrite`, retain the existing requirement that a relevant vote change leaves the parent STALE using getAfter. If the parent is already STALE, its marker need not be rewritten; if it is NOT_COMPUTED, keep that state without a parent write. Non-contributing and practice edits do not write the parent. Each individual action still writes its actual actor metadata, including lock-only actions.
- Extend exact allowed-field lists and shared storage/mapping contracts for both optional fields. Optional TypeScript fields support legacy reads only: new ordinary individual writes must contain a valid actor. Backend maintenance preserves existing metadata, including its absence on legacy data, rather than pretending to be a coach edit. Existing callable request/response shapes remain unchanged; returned ranking objects retain metadata.
- Metadata-only or lock-only changes preserve rankingLastChange; ordered-list edits and initial lazy creation retain the established timestamp rules. Continue refusing combined unlock/reorder writes, invalid IDs and CLOSED updates. Deploy matching rules before enabling the revised frontend so delegated actions are not rejected by old owner-only rules.

### Frontend structure and data flow

1. Add `frontend/src/page/tournament-referee-ranking/tournament-referee-ranking.page.ts` with separate template/styles and four focused tab components, following frontend/AGENTS.md and the angular-formatting skill when implementation starts.
2. The page owns tournament context, current ranking selection, shared attendee cache, loaded parent rankings, loaded coach rankings, save feedback, and cleanup coordination. Use signals/derived state and OnPush rather than tab-specific refetches.
3. Load attendees once using exactly two query methods: referees and coaches. Cache and deduplicate by attendee ID for shared identity lookup. Load all tournament ranking documents with one `tournamentId == ...` query. When switching rankings, load all associated individual records in one `tournamentRefereeRankingId == ...` query. A refresh repeats the grouped load; never query per row or coach column.
4. Use `TournamentRefereeRankingService` for parent load/save, status updates, result state, and panel computation; use the requested `RefereesRankingService` for individual load/save and deterministic identity. Tab outputs delegate parent saves to the page. The Coach Ranking tab delegates target saves through the individual service and updates shared page state, passing actor and target separately.
5. Put the pure panel algorithm and nomination comparator in reusable helpers invoked by TournamentRefereeRankingService. Compute from the current grouped data, return the complete IDs/stats, and save the result without moving computation to a backend endpoint.
6. Persist only fields belonging to the current action instead of blindly saving stale copies of the entire parent from individual-vote actions. Use the existing Firestore client APIs plus focused write batches for vote/freshness updates; there is no application-level edit lock, version, conflict dialog, or retry-on-conflict workflow.
7. Referee removal and detected invalid-reference repair call the dedicated backend operation. On success, replace affected shared records from its response or refresh the grouped records. Do not apply speculative cleanup writes to CLOSED data.
8. Serialize `number[][]` to stored row maps in every parent save path and deserialize on load. Do not use the generic service's unconverted setDoc path for the panel object.
9. Keep PrimeNG as the first choice for Select, PickList, Checkboxes, tabs, dialogs and toggles. The two-list ranking interactions may use a focused drag/drop adapter; keep the partition invariant in pure state transformations shared with keyboard actions.
10. Use a consistent alphabetical comparator for names and short names, with stable ID fallback for exact duplicates. Add concise JSDoc for reusable contracts and helpers.

### Backend contracts

Use authenticated callable operations, following the repository's existing callable-function pattern, in focused modules under `functions/src/referee-ranking/`. Validate the Firebase caller, tournament, acting attendee and ownership server-side; client-provided attendee IDs are claims to verify, not authorization by themselves. Register exports in `functions/src/index.ts`.

| Proposed operation | Request | Response and behavior |
| --- | --- | --- |
| removeRankingReferees | `{ tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId, refereeAttendeeIds: string[] }` | `{ ranking, coachRankings }`; atomically remove the supplied currently selected referees and their references from all associated rankings, preserving aligned stats and individual locks. Supports one or several PickList removals. Reject CLOSED. |
| repairRefereeRanking | `{ tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId }` | `{ ranking, coachRankings, changed: boolean }`; derive invalid IDs from persisted attendee/selection data, not a caller-provided arbitrary replacement. Atomically repair affected data before CLOSED. For CLOSED, return unchanged records without repair writes. |
| deleteRefereeRanking | `{ tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId }` | `{ deletedRankingId, deletedCoachRankingCount }`; authorize a tournament referee coach and delete the parent and every associated individual record, including CLOSED/practice records. Do not expose this action to manager-only users. |

Use structured invalid-argument, unauthenticated, permission-denied, not-found, failed-precondition and operation-failure errors. No endpoint is required for ordinary collection reads, individual edits, configuration edits, or Compute. Existing client save paths must not bypass required atomic referee removal: deny direct selection shrinkage and direct cross-owner cleanup, and route them through the server operation.

For atomic removal/repair, read parent and affected records, validate all inputs before writing, then commit all changes in one backend transaction. If the operation exceeds supported atomic limits, fail without partial writes. This transaction implements the confirmed all-or-nothing removal requirement and does not introduce the rejected user-facing concurrency management.

For standalone deletion, remove children before the parent and report completion only when the cascade is complete. Reuse the existing batch-deletion approach where needed; retrying a failed cascade must tolerate already-deleted children. The all-or-nothing requirement was confirmed for referee removal, not for deleting an entire tournament.

### Result-state transitions

- Creation: NOT_COMPUTED.
- Input change before the first computation: remains NOT_COMPUTED.
- Successful Compute: CURRENT with saved output and ISO timestamp.
- Relevant input change after computation, including an empty computed result: STALE, preserving output except required invalid-reference cleanup.
- Failed Compute/save: retain prior result state and prior saved output.
- Closure: only from CURRENT; then prohibit updates/repair. Export and explicit deletion remain available as specified.

Selected-coach individual edits/lock changes update the parent marker in the same batch. Non-selected practice edits do not. Source fields triggering staleness are selected referee IDs, selected coach IDs, majority, and contributing individual votes; updating the marker itself does not trigger another write. This avoids listeners or functions that recursively dirty their own result.

### Firestore rules and query verification

- Add collection matches with `allow read` for any signed-in user.
- Define a focused ranking coach-identity predicate using an attendee ID and tournament ID. Ordinary parent writes supply updatedByCoachAttendeeId; individual writes must distinguish the authenticated actor from target coachAttendeeId. Selected membership now grants delegated individual editing rights; parent configuration, transitions, Compute and export keep their existing all-tournament-coach authorization. Own-practice writes remain allowed for a non-panel coach; delegated writes require both actor and target to be selected.
- Keep individual identity immutable; enforce actor/target eligibility, editable phase and lock semantics. Permit the accompanying narrow parent freshness write tied to the target vote and recording the actual actor.
- Parent field changes must respect the lifecycle and CLOSED immutability; status transitions follow the declared graph. Computed-result writes require PANEL_RANKING; closure requires CURRENT and a computation timestamp.
- Client referee selection additions may use the configuration save path; removals require backend atomic cleanup. Validate unique selected/ordered IDs and array shape. Reject non-selected ranked IDs.
- Manager deletion uses tournament.managerEmails and the existing canManageTournament convention; keep it usable after attendee deletion. Manager access remains available when RANKING is disabled so complete tournament deletion is not blocked.
- Admin SDK cleanup bypasses client rules, so mirror authorization, status and relationship checks in those handlers.
- The two single-field ranking load queries and tournament-deletion queries should use ordinary field indexes. Validate in the emulator; add a composite index only if the implemented query shape requires one. Do not introduce per-coach read queries.

### Documentation review

- `doc/datamodel.md` remains applicable to existing entities. During implementation add the two collections, model/storage mapping, result state, actor field, temporary authenticated reads, and deletion semantics.
- `doc/pages.md` already describes tournamentId-based cascade deletion. Add both ranking collections to that description and document the new route, tabs, phase matrix and read-access limitation.
- `doc/changes/menu-drawer.md` currently lacks the new entry; add the ranking link and its coach/RANKING gate when the menu is implemented. `doc/changes/tournament-home.md` already anticipates RANKING-gated access and remains consistent with this decision.
- Update `doc/functions.md` with the three backend contracts and authorization. Its overview currently says two business routes while the detailed list and index.ts include FIT routes; correct that relevant overview when documenting the added functions. No broad backend refactor is requested.
- Existing upgrade-vote rules deny deletion, while TournamentDeletionService currently lists those vote collections. This is a pre-existing mismatch that can block complete tournament deletion independently of ranking. The ranking change must not claim to repair it; record it in validation results and distinguish ranking cascade verification from a pre-existing upgrade-data failure.
- No application files or unrelated user edits were changed during this specification analysis.

### Coach Ranking revision: verified impacts and confirmed design

The 2026-09-13 request supersedes owner-only ordinary editing for selected actors and selected targets. Historical stage notes below describe the previous implementation, not the new authorization policy. Stage 4 must incorporate this revision and receive developer validation before Stage 5.

Verified code findings on 2026-09-13:

| Evidence | Required implementation |
| --- | --- |
| `frontend/src/page/tournament-referee-ranking/tournament-referee-ranking.page.ts`: currentCoach, ownRanking, saveIndividual; corresponding HTML binds ownRanking and labels the tab Me | Keep currentCoach as actor; add target selection and derive its ranking from coachRankings; wire PrimeNG Select and target-specific authorization. |
| `frontend/src/component/ranking-me/ranking-me.component.ts` and template | Reuse the existing editor, drag/drop, keyboard actions and locks; replace personal wording and accept target-dependent editing permissions. |
| `frontend/src/service/referees-ranking.service.ts`: saveIndividual; `persistent-data-model/src/referee-ranking.ts`: prepareIndividualRanking | Separate actor and target parameters. Derive identity and contribution from target, record actual actor and update JSDoc. |
| `firestore.rules`: validIndividualRecord, validIndividualWrite, validIndividualFreshnessChange | Existing rules authenticate the owner and derive the freshness-linked vote ID from the actor. Update both checks together to support delegated writes without allowing forged actors or unrelated freshness updates. |

Design confirmed by the user in decision 30 on 2026-09-13: retain ordinary direct Firestore saves and extend the existing actor-metadata pattern. Add updatedByCoachAttendeeId to individual records for the authenticated editor; coachAttendeeId still identifies the target. Add updatedCoachAttendeeId to the parent for narrow vote/freshness batches so rules can locate the exact target record with getAfter independently of actor identity. Keep immutable relationships and phase/lock checks; validate target tournament and referee-coach role without requiring a target account; require selected membership for both actor and target on delegated writes, while allowing own-practice writes outside the panel. Require actor metadata on new ordinary writes, accept existing documents without it on read and populate it on their next permitted save. Do not rewrite historical ranking timestamps or IDs; maintenance preserves metadata. No audit collection or ordinary-save endpoint is introduced. This extends the existing actor-metadata pattern to preserve direct saves and let Firestore verify the changed target vote separately from the authenticated editor.

Documentation review: the initial analysis verified the previous owner-only descriptions. Implementation now updates doc/pages.md and doc/datamodel.md for coach selection, delegated authorization, actor/target metadata and legacy reads. doc/dev.md documents the regression checks and coordinated rules/frontend rollout, including reloading old clients whose individual saves lack the required actor. doc/functions.md maintenance contracts remain accurate and unchanged.

Recommended implementation order: update model/service contracts and rules together; wire coach selection and editor permissions; add targeted regression tests and update page/model documentation; validate the revised Stage 4. Grouped query counts and the computation algorithm remain unchanged.

### Implementation stages and validation gates

Current stage: **Stages 1-3 validated by the developer; the Stage 4 Coach Ranking revision is implemented and tested locally, awaiting developer validation before Stage 5.**

Stage 4 revision delivery (2026-09-13): Coach Ranking uses a PrimeNG Select over the shared coach cache, includes selected coaches without accounts and the actor's own practice entry, and loads the target vote from existing grouped records. The target heading, lock, drag/drop and keyboard editor use target-specific authorization. Selection resets on ranking/membership changes, cancels obsolete drags and is disabled while saves are pending. Direct saves preserve target ownership, record the actual authenticated actor and atomically link any freshness transition to the target vote. Firestore checks actor identity, target role/tournament, both selected memberships for delegation, phase, lock and the exact narrow freshness batch. Legacy records remain readable without backfill; maintenance preserves metadata.

Stage 4 revision validation (2026-09-13): 54 targeted Angular tests and 28 Firestore emulator tests validated after targeted reruns of corrected test fixtures/assertions. Coverage includes a real PrimeNG selection and target Add/lock actions, accountless targets, unchanged actor votes and query counts, own practice and forbidden delegation, failed-save selection retention, fallback/reset, legacy metadata, forged actors/targets, atomic freshness rollback, already-stale/never-computed results, CLOSED and maintenance preservation. Shared-model and Functions compilation and the production Angular build passed. Documentation was updated in doc/pages.md, doc/datamodel.md and doc/dev.md; doc/functions.md remains accurate. No deployment was performed; publish matching rules before the revised frontend and reload existing clients. Stage 5 has not started.

Stage 4 delivery (2026-09-12): Me now displays the owner's ranking using the page's grouped records, without extra reads or creation on view. Dense insert/reorder/remove transformations are shared by native drag/drop and accessible Add/Up/Down/Remove buttons; cancellation saves nothing. Unranked identities are sorted by descending level, first name, surname and stable ID. The right list displays N+1 or more numbered slots with the N separator. Only the two active phases allow editing, and a locked record must first be unlocked. Empty and incomplete votes may be locked; CLOSED uses missing-referee placeholders without writes. Each action commits immediately and the page accepts the record only on success. Contributing vote changes and parent freshness use one batch; practice/unlocked non-contributing edits preserve freshness and panel output.

Stage 4 identity decision: after explanation, the developer explicitly approved escaping %, / and | in each pair component as %25, %2F and %7C, in that order, preserving Unicode. The shared helper replaces encodeURIComponent so the Firestore rules can reproduce the exact collision-free identity, including accented IDs; generated alphanumeric IDs keep their existing representation. This decision supersedes the previous helper's generic URL encoding.

Stage 4 deployment: the tested firestore.rules was compiled and published successfully to tournament-manager-90045 on 2026-09-12 using firebase.ranking-test.json. No Hosting or Functions deployment was performed. The local frontend can use the new owner writes immediately; publishing the hosted frontend follows the existing Hosting workflow.

Stage 4 validation: 38 targeted Angular tests and 22 Firestore emulator tests passed. Coverage includes actual checkbox rollback, native drag/drop events, keyboard action buttons, lazy creation, failed saves, owner/other-coach restrictions, immutable identities, locked-list restrictions, empty locks, practice votes, narrow freshness batches, failed atomic commits, CLOSED immunity and Unicode/separator ID verification. Production Angular, shared model and Functions builds passed. doc/pages.md and doc/datamodel.md were updated; maintenance callable contracts and doc/functions.md remain accurate. The existing upgrade-vote deletion mismatch remains outside this stage; no complete cascade claim is made. Stage 5 has not started.

Stage 3 deployment correction (2026-09-12): after the developer reported failed coach saves, a read of the active Firebase rules confirmed that the 08:55:24 UTC release lacked validRankingCoachChange. Published the tested local rules to tournament-manager-90045 at 12:01:05 UTC, resolving this missing deployment dependency. Configuration save failures now log the original error in the local frontend; 14 page tests and the production build passed. No Hosting or Functions deployment was performed for this correction.

Stage 3 delivery (2026-09-12): developer validation of Stage 2 was explicitly received before implementation. Coaches now displays tournament coaches using labelled PrimeNG checkboxes in two columns (one on narrow screens), with a positive safe-integer majority input saved on blur. Membership changes save immediately through page outputs and the direct Firestore parent service. Removals require confirmation in INDIVIDUAL_RANKING and PANEL_RANKING, and preserve all individual data, including locks and timestamps. Majority is never recalculated or capped by panel size. Changed membership or majority preserves NOT_COMPUTED or marks an existing result STALE without changing its IDs, statistics or computation timestamp. CLOSED is read-only. Cancellation and failed saves retain the committed configuration; ranking switches clear pending confirmation.

Stage 3 validation: 26 targeted Angular tests and 17 Firestore emulator tests passed, including native checkbox rollback, numeric input validation, confirmation/cancellation, unchanged individual documents, exact freshness requirements, unauthorized writes and CLOSED restrictions. Production Angular build and shared-model compilation passed. The model's npm build script could not locate a local tsc; compilation succeeded using the installed frontend TypeScript compiler with the model tsconfig. Functions compiled successfully during the preceding Stage 2 recheck and no Functions source was changed in Stage 3. Documentation reviewed and updated in doc/pages.md and doc/datamodel.md; doc/functions.md remains accurate because callable contracts are unchanged. Updated Firestore rules must be deployed with this stage; no deployment was performed. The pre-existing upgrade-vote deletion mismatch remains outside scope; these tests do not claim complete tournament cascade validation. Stage 4 (Me) has not started.

Stage 2 delivery (2026-09-12): the Referees tab now has immediate name/N saves on blur, safe positive-integer validation, a PrimeNG PickList and in-memory Level/Category/Upgrade/Gender filters above its available list. Multi-file tab code lives in `frontend/src/component/ranking-referees/`. PickList mutations affect disposable view arrays; page state changes only after a successful save. CONFIGURE removals are immediate; later open phases require confirmation. CLOSED is read-only and missing referees retain a placeholder.

The two authenticated callables `removeRankingReferees` and `repairRefereeRanking` validate current tournament coach identity and module access, then clean selection, all individual records (including locked/practice), and aligned panel statistics in one transaction. Both return `{ ranking, coachRankings, changed }` in application format. Cleanup preserves locks and timestamps of unchanged individual lists. Load detects invalid references after its grouped read and calls repair only when needed; a failed load/repair offers Retry and blocks editing/status changes until resolved. Ordinary metadata and selection additions still save directly through Firestore. Rules permit these fields, require stale marking after additions to a computed result, and deny direct selection shrinkage.

Stage 2 validation: 20 targeted Angular tests and 15 Firestore emulator tests passed, including a real failed commit with no partial writes. Production Angular and Functions builds passed. Functions dependencies were restored with npm ci. The Functions build exposed a pre-existing reference to an optional legacy `nbGamesToAllocate` field in tournament-home; a local intersection type now describes that legacy read without changing runtime behavior or the shared model. Deployment requires the updated rules and both new callables; no deployment was performed. Coaches selection/majority, individual editing and panel computation remain stages 3–5.

Stage 1 delivery (2026-09-12): shared models and Firestore statistics conversion, grouped-read services, creation/selection, legal status transitions, module/coach page access, drawer entry, and four dedicated tab shells. The page's TypeScript, HTML, CSS and tests are grouped in `frontend/src/page/tournament-referee-ranking/`, following the user's folder convention recorded in frontend/AGENTS.md. Referee/coach editing, individual saves, computation/export, cleanup endpoints and cascade integration remain in their specified later stages. Stage 1 rules intentionally allow only initial parent creation and status changes, plus authenticated reads and manager deletion rights.

Stage 1 creation regression (2026-09-12): the initial dialog used ngSubmit without a FormGroup directive, so native form submission did not invoke the save method. The dialog now binds to its typed FormGroup and the name input to formControlName. The regression test enters the name through the DOM and dispatches the actual submit event, verifying exactly one create-service call, selection of the saved ranking, closure of the dialog, and prevention of browser navigation. It failed before the correction and passed afterwards; all 13 ranking tests and the production Angular build passed. Direct method-call tests alone did not cover this wiring. The documented creation workflow in doc/pages.md remains accurate; this correction restores that specified behavior without changing persistence or permissions.

Verification: production Angular build passed; all 36 existing/new frontend tests passed before the file move, and the 12 ranking tests passed again after regrouping files. Nine Firestore REST emulator tests passed, and the shared model compiled. The optional existing Functions build could not run because its installed dependencies lack TypeScript and Node type definitions; no Functions source was modified in Stage 1. No deployment was performed by the implementation agent.

1. **Page:** models, storage mapping, services, route/menu/access, shared grouped loads, creation/selection/state, and security foundations.
2. **Referees:** selection/filter UI, backend atomic removal/repair and corresponding persistence validation.
3. **Coaches:** panel selection, confirmation, majority form and preserved individual data.
4. **Coach Ranking:** partitioned lists, drag/drop and keyboard actions, locks, immediate saves and freshness updates.
5. **Panel:** pure algorithm, table, Compute, stale/closure behavior, Excel, deletion integration, required tests and documentation completion.

Obtain developer validation after every stage before starting the next. Record the current stage and validation in this file or the project work log. This gate comes from the original specification and remains required.

## Acceptance criteria

- A tournament referee coach can open the route through the menu or directly only with RANKING enabled. Non-coaches cannot access the page; authenticated Firestore reads remain intentionally broader.
- New rankings use a trimmed name, CONFIGURE, empty selections, N=15, majority=1 and NOT_COMPUTED. Duplicate names do not merge records.
- Grouped loading uses two attendee queries, one parent-ranking query per tournament load and one coach-ranking query per selected ranking, without per-row reads.
- Referee/coach selection, filters, confirmation, save feedback and phase restrictions follow the specified matrix. Coach removal preserves their entire individual record.
- N and majority stay unchanged when selection counts shrink; membership changes do not reset a manually chosen majority.
- Every coach has one deterministic individual record per ranking; incomplete/empty lists may be locked. Only locked selected-coach votes contribute.
- Drag/drop and keyboard actions preserve unique partitioning, sorted unranked entries, dense ranked IDs, visible positions and the N/N+1 separator.
- All tournament referee coaches can Compute only in PANEL_RANKING, including non-panel coaches; neither leader status nor all selected votes are required.
- The ten algorithm fixtures and comparator checks below pass with exact ordered IDs and frozen stats.
- Relevant edits persist a stale result marker while keeping prior results visible; successful Compute clears it. Never-computed or stale results cannot close; an empty current result can.
- Before CLOSED, cleanup may remove invalid referees from locked rankings without unlocking them. After CLOSED, load/repair performs no writes, preserves stats and positions, and uses missing-referee placeholders.
- Atomic referee removal changes selection and all affected records together or leaves all of them unchanged on failure.
- Export contains the displayed panel/coach data and current state in the same order, including non-panel coach columns and missing-referee placeholders; any tournament coach can export in CLOSED.
- Confirmed coach deletion removes one ranking and all associated individual records. Manager-only users have no such UI action; complete tournament deletion includes both ranking collections.
- Anonymous collection reads and unauthorized ordinary writes fail; authenticated reads succeed even outside the tournament under the temporary policy.
- No revision/conflict handling or panel-leader feature is introduced. Stage validation and relevant documentation updates are complete before implementation is declared finished.

### Coach Ranking revision acceptance checks

- The tab label is Coach Ranking and the PrimeNG Select includes selected coaches without accounts. Signed-in selected coach A can choose B and see B's ranking without any extra query or write.
- A can create, reorder, lock and unlock B's ranking in the permitted phases; A's own record remains unchanged. Deterministic ID and coachAttendeeId identify B; actor metadata identifies A.
- An absent target record is created lazily on a permitted action. Parent/membership changes reset the target safely; pending saves cannot be redirected by changing the selection.
- Existing phase, lock, timestamp, dense-list and empty-state behavior remains intact. Failed saves retain the previous record.
- Rules deny forged actors, cross-tournament or ineligible targets and invalid phases. Verify that a non-panel coach can create, edit and lock/unlock their own practice vote, but cannot edit another coach; selected actors cannot edit another non-panel coach. Practice writes must not alter panel freshness. Verify target eligibility without any account identity on B.
- Delegated contributing changes requiring a freshness transition and their narrow parent updates succeed together or fail together. Rules verify the target vote, matching actor and timestamps, and deny isolated freshness updates or forged target markers. Cover CURRENT to STALE, already STALE, NOT_COMPUTED, lock-only timestamp preservation, missing required actor on new writes and spoofed actors even on non-contributing edits.
- Verify reading legacy individuals without updatedByCoachAttendeeId and parents without updatedCoachAttendeeId, then saving them with the required metadata. Neither IDs nor ownership may change; metadata-only upgrades preserve rankingLastChange.

### List of new tests

Implement ten algorithm datasets with explicit expected results. Notation: `AB` means ordered referee IDs `[A, B]`; `A:[1,1]` means that referee's frozen stats. Unless stated otherwise, every listed coach is selected and locked, all IDs are eligible, and alphabetical referee names follow their letter IDs. `N` defaults to 15.

| # | Purpose | Input coach rankings; majority | Expected panel in order |
| --- | --- | --- | --- |
| 1 | Unanimous identical rankings | AB, AB, AB; 2 | A:[1,1,1], B:[2,2,2] |
| 2 | Majority one and admission-time freezing | AB, BA; 1 | A:[1], B:[1] |
| 3 | Majority equals panel size | ABC, BAC, ACB; 3 | A:[1,1,2], B:[1,2,3], C:[2,3,3] |
| 4 | Same-round exact prefix favors more votes | AB, BA, XBA, YBA; 2 | B:[1,2,2,2], A:[1,2] |
| 5 | Full lexicographic example, including later nominations | AXYZWB, BXYZWA, XYAZWB, XYZBWA, XYZWAB, XYZWBA; 3 | X:[1,1,1,1], Y:[2,2,2,2], Z:[3,3,3], A:[1,3,5], B:[1,4,5], W:[4,4,5,5,5,5] |
| 6 | First-name then last-name exact tie | ABC, BCA, CAB; 1. A=Alex Zulu, B=Alex Alpha, C=Zoe Alpha | B:[1], A:[1], C:[1] |
| 7 | Multiple votes exceed threshold in one round | AB, AB, AB, AB; 3 | A:[1,1,1,1], B:[2,2,2,2] |
| 8 | Missing, unlocked, practice and incomplete votes | Selected locked A; selected unlocked BA; selected with no record; selected locked B; non-selected locked AB; majority 2 | Empty IDs and stats; no waiting and no majority reduction |
| 9 | Later votes do not modify already-admitted stats | AB, AB, BA; 2 | A:[1,1], B:[1,2,2] |
| 10 | All qualifiers beyond N; omit insufficient votes | ABC, ABD; 2; N=1 | A:[1,1], B:[2,2] |

These expected results were checked during specification analysis using a temporary calculation in the tool session; this is not an implementation test run. The feature code and its tests remain to be written.

Additional checks:

- Comparator: `[1,3,5]` precedes `[1,4,5]`; `[1,3,5,5]` precedes `[1,3,5]`; first differing nomination rank takes precedence over total vote count; identical names use stable ID order.
- Stats storage conversion round-trips without losing order, including empty output and missing-referee cleanup.
- UI state transformations preserve the partition under insert, reorder, removal, cancellation, locking and refresh.
- Rules/emulator tests cover authenticated/anonymous reads, owner/other-coach writes, all-coach Compute, state/lock restrictions, narrow freshness batches, invalid IDs and manager deletion after attendee deletion.
- Backend failure tests verify atomic removal, preservation of locked status and CLOSED immunity; deletion checks include practice records and cancellation.
- Targeted integration checks cover reload-persistent result state, failed-save feedback, closure prerequisites, required grouped query counts, Excel ordering and tournament cascade registration.
- Run the project-appropriate model/functions/frontend compilation and existing relevant tests at implementation stages; do not add concurrency tests for the explicitly excluded conflict protocol.

## Open decisions

Readiness: **Ready for implementation**.

No blocking decision remains. Decisions 29 and 30 are confirmed. The revision preserves own-practice editing and extends the existing direct-write metadata model to separate the authenticated actor from the target coach.

Remaining assumptions: routine selector defaults, alphabetical ordering and save-time disabling are specified above; no unresolved architecture or permission assumption remains. The user subsequently authorized implementation, whose delivery and checks are recorded in the Stage 4 revision notes above.

The temporary authenticated read policy, lifecycle, immediate saves and absence of concurrency management remain confirmed.

### Confirmed decision record

Decisions 1-28 were collected on 2026-09-12; decisions 29-30 were confirmed on 2026-09-13. Later clarifications supersede earlier wording where noted.

| Question | Final decision |
| --- | --- |
| 1 | Individual editing in INDIVIDUAL_RANKING and PANEL_RANKING, subject to lock. |
| 2 | Count only locked rankings of selected coaches. |
| 3 | Admit at or above majority after collecting every nomination in the round. |
| 4 | Identical histories: first name, then last name alphabetically. |
| 5 | Include every qualifying referee, without an N limit. |
| 6 | Removing a coach does not change their individual ranking. |
| 7 | Preserve previous output with a recomputation indicator; Compute is manual. |
| 8 | Default majority is floor(selected coach count / 2) + 1, not rounded 51%. |
| 9 | CLOSED prevents repair; preserve missing-referee positions and display a placeholder. |
| 10 | Coach-only page and menu require enabled RANKING, including direct URL. |
| 11 | All tournament coaches can export, including in CLOSED. |
| 12 | One deterministic individual document per ranking/coach pair. |
| 13 | Referee removal and affected cleanup succeed or fail atomically. |
| 14 | No minimum N requirement for locking. |
| 15 | Compute does not wait for missing/unlocked votes; keep majority unchanged. |
| 16 | Exact-prefix nomination histories: longer list first. |
| 17 | All tournament coaches can perform legal status transitions. |
| 18 | Closure requires a computed, current result. |
| 19 | Compute only in PANEL_RANKING; actor restriction was broadened by question 26. |
| 20 | No automatic majority recalculation on coach membership changes. |
| 21 | Default N is 15. |
| 22 | Before CLOSED, repair locked rankings while retaining their locks. |
| 23 | Confirmed whole-ranking deletion includes individual records and works in CLOSED; manager scope was clarified by question 27. |
| 24 | Panel coaches first, then other coaches, by short name within each group. |
| 25 | No concurrency management, version rejection or forced reload. |
| 26 | Any tournament referee coach can Compute; panel leader is not a supported feature. |
| 27 | Manager delete rights support complete tournament deletion only; no standalone ranking-delete workflow. |
| 28 | Temporary Firestore reads for all authenticated users; ordinary CRUD stays direct, preserving defined write restrictions and required backend cleanup. |
| 29 | Confirmed on 2026-09-13: non-panel coaches retain editing and lock/unlock of their own practice ranking. Editing another coach requires both actor and target to be selected. |
| 30 | Confirmed on 2026-09-13: add updatedByCoachAttendeeId to individual records and updatedCoachAttendeeId to the parent to validate delegated direct Firestore saves and target-linked freshness batches; preserve existing documents. |

### Revision requested on 2026-09-13

Confirmed by the user: rename Me to Coach Ranking; select the coach with PrimeNG Select; edit the ranking defined by that coach; any selected referee coach may edit any selected referee coach, including targets without an account or unable to use the application. Decision 29 is confirmed: preserve own-practice editing for non-panel coaches; editing another coach requires both to be selected. Decision 30 is confirmed: keep direct Firestore saves and add updatedByCoachAttendeeId on individual records plus updatedCoachAttendeeId on the parent for target-linked freshness batches, with backward-compatible reads.
