# Water carrier

Last updated: 2026-09-29

## Objective

Manage match water carriers through a dedicated `Water Carrier` tab on the Planning page, supporting paper-based and online self-allocation.

## Scope

### In scope

- Paper planning download when `PRINTED_WATER_CARRIER` is enabled.
- Public online planning and referee self-allocation when `ONLINE_WATER_CARRIER` is enabled.
- Reuse the period selected on the Planning page and existing match allocation records.

### Out of scope

- A maximum number of water carriers per match: there is currently no limit.
- Authoritative scheduling-conflict prevention across simultaneous sessions or direct client writes; conflict blocking is a frontend workflow check.
- Implementing the feature during this specification analysis.

## Functional requirements

### Paper self-allocation

- Enable this feature only when `PRINTED_WATER_CARRIER` is enabled.
- Provide a button in the `Water Carrier` tab to download the selected period's match planning as a PDF for tournament managers and coaches.
- Each match cell contains match information, assigned referees, and blank space equivalent to four lines for handwriting two or three names after printing.
- Confirmed decision 4 (2026-09-28): generate the PDF in the browser and download it directly. Use A4 landscape pages, adding pages as needed to preserve the four lines of handwriting space per match.
- Download is available only when the module is enabled, the selected fragment is visible and belongs to the current tournament allocation, and the authenticated tournament attendee is a Tournament Manager or coach.

### Online self-allocation

- Enable this feature only when `ONLINE_WATER_CARRIER` is enabled.
- Everyone can read the page. Online planning and self-allocation are available only when referee allocations for the selected period are visible.
- Display the selected period's matches with assigned referees and without coaches.
- Provide a water-carrier area for every match.
- Clicking a match's water-carrier area adds or removes the current user as a water carrier for that match.
- Highlight matches where the current referee is assigned as a referee or as a water carrier.
- Only a user with an account and a tournament attendee holding the `Referee` role can modify their own water-carrier assignment. The attendee must contain an email and a linked person identifier.
- Referees without an account cannot self-allocate; the public reading requirement still applies.

## Business rules

- There is no limit on the number of water carriers assigned to a match.
- Self-allocation concerns only the current user's assignment.
- Confirmed decision 2 (2026-09-28): reject a new water-carrier self-assignment if the referee is already assigned as a referee or water carrier to the same match or another match with an overlapping time interval, or is declared unavailable during the target match.
- Confirmed decision 7 (2026-09-28): enforce this conflict policy in the frontend using the available planning and availability data before writing. This does not guarantee the absence of conflicts between simultaneous sessions; no additional server coordination or scheduling-lock mechanism is required.
- Confirmed decision 3 (2026-09-28): each water-carrier assignment belongs to both its match and its allocation fragment, through `GameAttendeeAllocation.gameId` and `fragmentRefereeAllocationId`.
- Display only existing fragments referenced by the `TournamentRefereeAllocation` whose `current === true`, and only when the fragment's `visible === true`. Do not fall back to a non-current tournament allocation.
- Water-carrier visibility follows the associated fragment. Changing the current tournament allocation changes the displayed fragments; assignments remain attached to their original match and fragment and are not transferred to another fragment. A shared fragment retains the same assignments wherever it is referenced.
- `WaterCarrier` is the role of a match assignment; acquiring this assignment does not replace the attendee's `Referee` role.

## User interface and workflow

- Extend `/tournament/:tournamentId/referee-planning` with a dedicated `Water Carrier` tab using the page's selected period.
- Module composition: show the tab when at least one water-carrier module is enabled; independently show the paper download button and online planning according to their modules and permissions. When both are enabled, show both in the same tab.
- Preserve the existing no-visible-allocation state, including when no current tournament allocation exists or it references no visible existing fragments.
- Match presentation: reuse the existing field/timeslot grid, match descriptions, division colors, and referee display ordering. Display water carriers by first name and last name, with a stable alphabetical order.
- Provide keyboard-operable self-allocation controls and distinguish the current user's referee and water-carrier assignments with accessible indicators.
- The paper export downloads a browser-generated A4 landscape PDF.
- Confirmed decision 6 (2026-09-28): provide a `Refresh` button to reload planning through the aggregate read API, and reload after each successful personal assignment change. Do not poll or add a real-time subscription for other users' changes.
- Keep the selected fragment after refresh when it remains available. If it becomes hidden or leaves the current allocation, remove its displayed planning and reconcile the selection with the newly available fragments.

## Data model and persistence

### Requirements from the original specification

- Persist assignments as `GameAttendeeAllocation` records.
- Extend `AttendeeRole` with `WaterCarrier`.
- For every `WaterCarrier` assignment, require `gameId` and `fragmentRefereeAllocationId`, even though the latter remains optional in the shared interface for compatibility with other assignment roles.

### Verified code facts at analysis time

- `persistent-data-model/src/person.ts` defines `AttendeeRole`; `WaterCarrier` is not yet present.
- `persistent-data-model/src/referee-allocation.ts` defines `GameAttendeeAllocation` with `tournamentId`, optional `fragmentRefereeAllocationId`, `gameId`, `attendeeId`, `attendeeRole`, required `attendeePosition`, and required `half`.
- The linked account field is `Attendee.person.personId`, not a nested `person.id`. `Attendee.person.email` contains the tournament identity email.
- `Person.userAuthId` binds an account to Firebase Authentication. The attendee model explicitly warns that a person link alone does not prove authorization.
- Both requested module names already exist in `persistent-data-model/src/tournament.ts` and `frontend/src/config/tournament-features.ts`.

### Persistence scope and implementation conventions

- Use one `WaterCarrier` assignment per tournament, fragment, match, and attendee; guarantee uniqueness under concurrent requests.
- Use a deterministic document ID derived from the encoded tournament, fragment, game, and attendee identifiers with a `WaterCarrier` namespace. Validate its correspondence to the payload in the write rules. Do not use auto-generated IDs for these assignments.
- Use `attendeeRole: 'WaterCarrier'` and `half: 0` for a whole-match assignment, consistent with existing whole-match allocation writes.
- Use `attendeePosition: 0` for water-carrier assignments; this field neither limits capacity nor determines display order.
- Keep water carriers out of referee and coach counts, statistics, and allocation algorithms.

## Errors, validation, and permissions

### Confirmed simplification (2026-09-29)

The user approved replacing scope-coordinate validation with identity, ownership, and same-tournament checks. This decision supersedes the initial scope-proof design.

- Remove `GameAttendeeAllocation.waterCarrierScope`, `WaterCarrierWriteScope`, and the public match `writeScope` DTO field. No replacement attribute is introduced.
- Firestore create/update/delete checks keep verified authentication, the authoritative tournament/email attendee index, the indexed attendee's `Referee` role and linked account, ownership, the `WaterCarrier` assignment role, and existence of the game and fragment in the attendee's tournament.
- Preserve deterministic IDs, fixed whole-match values, and immutable tournament, game, fragment, attendee, and role fields during updates.
- The read API continues to verify module activation and to expose only visible fragments of the current allocation. The interface retains module, conflict, and availability checks.
- Firestore writes no longer check module activation, fragment visibility, membership in the current allocation, or the game's period/field correspondence to the fragment. An authenticated eligible referee using Firestore directly may therefore write their own assignment to a hidden/non-current fragment or a mismatched match/fragment pair within the same tournament. This tradeoff is explicitly accepted; foreign ownership, cross-tournament references, and referee/coach role conversion remain forbidden.
- Removal is a direct delete of the owned assignment, without first rewriting lookup coordinates. The initial implementation was not deployed; no production migration is required for this change.
- Validation of this simplification: Functions TypeScript and Angular production builds passed; the combined identity/ranking/water-carrier emulator suites passed 64 tests, and the water-carrier component/page suites passed 10 tests. API tests verify that match DTOs have no write-scope field. Documentation for the data model, API and rollout was updated; the page and feature usage documentation remains accurate because the normal UI workflow is unchanged.

- Validate tournament membership, role, authenticated account linkage, ownership, and same-tournament game/fragment references at the trusted write boundary.
- Do not authorize from a client-supplied email or attendee identifier alone.
- Reject attempts to modify another attendee's assignment or create an assignment for a game from another tournament.
- Prevent duplicate assignments and repeated-click races. Failed writes must preserve or restore the last confirmed state and display a retryable error.
- Block conflicting self-allocation in the frontend and explain whether the cause is a referee assignment, another water-carrier assignment, or declared unavailability. Keep removal of one's existing assignment possible when a conflict exists, subject to the feature's visibility and authorization requirements.
- Public read access must expose only planning information required by the feature, not attendee emails or other account details.
- Read planning through an API that verifies that the requested planning is public/visible and returns all data needed to render it in one response.
- Create and update water-carrier assignments directly in Firestore. Extend the security rules to authorize only the authenticated attendee's own `GameAttendeeAllocation`, with `attendeeRole === 'WaterCarrier'` and `attendeeId` matching their tournament attendee ID.
- For updates, validate both the existing and resulting record: self-service access cannot take over another attendee's assignment or convert a referee/coach assignment into a water-carrier assignment. Keep tournament, game, attendee, role, and allocation scope identifiers immutable through this self-service path.
- Apply the same ownership and role checks to deletion to support the originally required self-removal workflow.
- Confirmed decision 5 (2026-09-28): allow paper PDF download for authenticated tournament managers and coaches of the selected tournament. Other referees and anonymous readers do not have access to the export control.
- Interpret coaches using the project's referee-coach terminology: `Coach` is an alias for `CoachReferee` in `persistent-data-model/src/person.ts`, and the existing Planning coach tab uses `Attendee.isRefereeCoach`. Reuse the tournament coach eligibility convention, with verified account linkage.
- PDF permission does not grant water-carrier self-allocation rights; the original authenticated `Referee` requirement still applies to writes.

## Compatibility and migration

- Existing referee and coach records must keep their meaning. Existing tournaments require no water-carrier records to be created in advance.
- No new module names are required.
- Review role selectors and consumers of `AttendeeRole` so an assignment-only role does not unintentionally change tournament registration workflows.
- Reuse the existing match and fragment references; no match-only water-carrier storage or migration of existing referee/coach assignments is required. Hiding a fragment or switching the current tournament allocation does not delete its water-carrier assignments.

## Technical specifications

Readiness: **Ready for implementation**.

All seven required decisions are resolved. The confirmed design combines an aggregate public read API, direct Firestore writes protected by ownership rules, frontend conflict validation, browser-generated PDF downloads, and manual refresh. Remaining library choices and internal symbol names do not change these requirements.

### Implementation record (updated 2026-09-29)

Status: **Implemented and locally validated; not deployed**.

- Implemented the public route `GET /api/waterCarrier/planning` in `functions/src/water-carrier/`, shared DTOs/helpers in `persistent-data-model/src/water-carrier.ts`, and the dedicated component in `frontend/src/component/water-carrier/`. The Planning page now lives in `frontend/src/page/referee-planning/` with separate TypeScript, HTML, CSS, and tests.
- Direct write rules resolve the actor through the existing tournament/email index, load authoritative attendee roles, and verify the linked Person UID. They validate same-tournament game/fragment references, fixed WaterCarrier fields, immutable ownership and canonical document IDs.
- The initial lookup-coordinate design was removed under the approved 2026-09-29 simplification. Neither persisted allocations nor API match DTOs contain scope proof attributes. Existing assignment identity is unchanged when a shared fragment is reused or reordered; deletion needs no preparatory update.
- The existing referee/coach reset operation preserves WaterCarrier records. Existing role filters keep them out of referee/coach views and statistics. `WaterCarrier` is intentionally excluded from the attendee membership-role catalog.
- PDF generation uses dynamically loaded `jspdf` and bundled `NotoSans-Regular.ttf` (SIL Open Font License in `frontend/public/fonts/OFL.txt`, source: `https://github.com/notofonts/noto-fonts`). Five fields per horizontal section, compact repeated page headers, and four 4mm-spaced writing lines densify the A4 landscape export while preserving handwriting space. A cell too tall for a page produces an explicit generation error rather than a clipped PDF.
- With only the printed module enabled, anonymous/non-export readers receive period metadata but no match grid. With the online module enabled, the public projection includes matches. Private actor context is never shared-cacheable.
- Existing protected collection reads remain confined to the original tabs. Anonymous visitors reach the water-carrier tab through the aggregate read API without those reads. Manual refresh and successful writes reload the selected period; withdrawn periods are reconciled by reloading the available list.
- Deep links resolve the tournament named in the route through its already-public tournament document when it differs from the local selection. All actual water-carrier planning data still comes from the aggregate API; no prior browser selection is required.
- Documentation updated: `doc/pages.md`, `doc/features.md`, `doc/datamodel.md`, `doc/functions.md`, `doc/dev.md`, and the original planning specification. Backend/rules and frontend tests cover authorization, publication, duplicates, refresh behavior, and snapshot conflicts; PDF fixtures cover one and multiple pages and accented names.
- Validation: Functions TypeScript build and Angular development/production builds passed. The combined WaterCarrier, identity, and ranking emulator suites passed 63 tests. The WaterCarrier component/page and existing allocation-page tests passed 13 tests, including anonymous deep-link loading. Two PDF generation tests passed; visual checks and extracted Unicode text verified a 56-match, 12-page landscape fixture. Production build reports optimization warnings from jsPDF's optional rendering dependencies; PDF generation remains lazy-loaded.

### Confirmed architecture decision (2026-09-28)

- Use a read API and direct Firestore writes, as explicitly selected by the user. The API centralizes visibility checks and loads all required planning data in one call; Firestore rules enforce authenticated ownership of water-carrier writes.
- The read request identifies the tournament and requested planning period. The server resolves the published allocation scope and rejects a scope that is not public/visible. Return the period, fields, timeslots, match descriptions, assigned referee display information, and water-carrier assignments required by the view together, without per-match or per-attendee client requests. Exact DTO names will follow repository conventions.
- Resolve only `TournamentRefereeAllocation.current === true`; filter its referenced fragments by existence and `visible === true`. Validate explicit fragment requests against this same selection. Never expose a visible fragment merely because it exists outside the current allocation. Filter match assignments by both `gameId` and `fragmentRefereeAllocationId`.
- Select only public display fields from attendee records. Do not return email addresses or private account information. Anonymous planning reads go through this API, without opening direct anonymous reads on the source collections.
- Replace the water-carrier view's dependency on authenticated client-side collection loading with the aggregate API response, including the information required to initialize its period selection. Verify the anonymous route can reach this view without first executing protected planning reads.
- Resolve the current user to their account-linked tournament attendee using the existing trusted identity model. `attendeeId` means `Attendee.id`, not the Firebase Authentication UID or `Person.id`.
- Extend `firestore.rules` for create/update and the required self-removal operation; validate same-tournament game/fragment references, `Referee` eligibility, and account ownership. Audit existing manager write permissions so another permissive rule cannot bypass the intended water-carrier ownership restriction.
- Per the 2026-09-29 simplification, current-allocation membership and visibility are checked by the read API, not by write rules. Module, availability and conflict checks remain in the application workflow. Direct own-assignment writes to hidden/non-current or period-mismatched fragments are an accepted limitation.
- Keep the frontend API transport and direct allocation writes in focused services. Provide typed request/response contracts and JSDoc. Add Firestore emulator tests for ownership, role preservation, and visibility checks.
- Reuse the existing `firestore.rules` identity helpers (`verifiedIdentity`, `actorId`, `validActor`) and verify the linked `Person.userAuthId` against the authenticated UID. Keep authorization separate from frontend scheduling-conflict checks.
- Confirmed identity clarification (2026-09-28): resolve the writer exclusively through `attendee-index/{encodedTournamentId}:{encodedNormalizedEmail}` using `actorId(tournamentId)`. The email comes from the verified authentication token, with the existing `normalizedEmail` and `identityComponent` conventions; never use a caller-provided email or attendee identifier to select the actor.
- Load `attendee/{resolvedAttendeeId}`, validate its tournament/email consistency with `validActor`, and require `'Referee' in attendee.roles`. Require the target `GameAttendeeAllocation.attendeeId` to equal that resolved attendee ID and its `attendeeRole` to be `WaterCarrier`. The account-link check is additional to this indexed role check, not a replacement for it. Deny access if the index or indexed attendee is missing or inconsistent.
- For creation, validate the proposed record; for updates, validate ownership and `WaterCarrier` role on both existing and proposed records; for deletion, validate the existing record. This restriction concerns water-carrier self-service and does not replace the existing authorization of other allocation roles.

### Read and write contracts

- Read request: required `tournamentId`, optional selected `fragmentRefereeAllocationId`. Without an explicit selection, return the available visible scopes and the first scope's planning; when none exists, return an empty planning state. An explicit unavailable fragment must not return its planning.
- Read response: available visible scope descriptors, selected scope, fields and timeslots, match descriptions, and referee/water-carrier display allocations. Return only the public fields required for rendering and PDF generation, without write-scope coordinates.
- When authenticated, include a private current-attendee context in the same response: the verified attendee identifier, export/self-allocation eligibility, and conflict-blocking information for the displayed matches. Build that context from the attendee's availability and assignments in the current allocation, including overlaps outside the displayed fragment, without disclosing unpublished planning details. Do not serve personalized responses from a shared public cache.
- Creation writes the deterministic own-assignment document with `tournamentId`, `fragmentRefereeAllocationId`, `gameId`, `attendeeId`, `attendeeRole: 'WaterCarrier'`, `attendeePosition: 0`, `half: 0`, and the existing persistence metadata. Removal deletes that document. Any supported update must preserve the immutable scope, owner, and role fields.
- Disable a match's self-allocation control while its write is pending. Use explicit desired-state operations (assign/unassign) so retries do not accidentally toggle an already completed operation. Reload through the read API after success.

### Verified impacts

| Area | Evidence | Expected impact |
| --- | --- | --- |
| Planning page | `frontend/src/page/referee-planning.page.ts`, `RefereePlanningComponent` | Extend tab state and views; reuse the period selector. Current loading reads tournament data once using `take(1)`. |
| Published periods | `RefereePlanningComponent.applyData` | Current code falls back to the first allocation. Remove this fallback from the Planning period selection and use only visible fragments referenced by an allocation with `current === true`. Apply the same selection in the read API. |
| Planning exports | `frontend/src/service/referee-planning.service.ts`, `exportPdf` | Existing export opens browser printing; implement browser-side PDF generation and direct download for water-carrier planning, using A4 landscape pagination. |
| Persistence | `frontend/src/service/game-attendee-allocation.service.ts` | Reuse the collection and typed allocation contract, with feature-specific authorization and uniqueness handling. |
| Authorization | `firestore.rules` | Games, attendees, and allocation reads currently require authentication; allocation writes currently require tournament management rights. Public reading and referee self-service cannot work through the current rules unchanged. |
| Role classification | `persistent-data-model/src/person.ts`, `isReferee`, `isRefereeCoach`; `functions/src/allocation-statistics.ts` | Preserve explicit role filtering so water carriers are excluded from referee/coach statistics. Audit other allocation consumers. |

### Confirmed PDF implementation direction

- Generate a PDF document client-side from the selected visible period's aggregate planning data, through a focused export service with a typed input contract.
- Trigger a direct `.pdf` download; the browser print dialog is not the water-carrier export workflow. No server-side PDF generation endpoint is needed.
- Show the export control and execute the application export action only for the current tournament's authenticated managers or coaches, after checking module activation and the selected fragment's visibility/current-allocation membership.
- Use A4 landscape pages and paginate the grid as necessary instead of shrinking the reserved handwriting area to fit the entire planning on one page. Preserve match information, assigned referees, and the four-line blank area together when paginating.
- Verify the resulting file visually with short and multi-page planning examples, including long match descriptions and referee names. Select the PDF library during implementation according to the frontend's existing dependencies and required text/font support.

### Conflict validation implementation requirements

- Evaluate actual match time overlap within the tournament, including the target match itself; comparing game IDs alone is insufficient.
- Resolve assignment conflicts against fragments of the current tournament allocation, without mixing in alternative allocation versions. Water-carrier records are identified by both match and fragment.
- Reuse the attendee's persisted availability exceptions for the target period and match interval.
- Recheck conflicts in the frontend immediately before creating an assignment, using the latest loaded snapshot and confirmed local changes. Keep the displayed blocking reason consistent with this result; no extra pre-write reload is required.
- Compare intervals using `startA < endB && startB < endA`; back-to-back matches do not overlap. Respect the match day and the existing timeslot duration model.
- Conflict checks are not Firestore security guarantees. A stale snapshot, simultaneous sessions, or a direct client write can produce a scheduling conflict; this limitation is explicitly accepted in decision 7. Firestore ownership, role, same-tournament references, and duplicate-document protections remain mandatory; visibility is enforced by the read API.

### Confirmed refresh implementation direction

- Use the same aggregate API request for initial loading, manual refresh, and reloading after a successful personal create/update/delete. Return all required display data in each response.
- Expose loading and error states, prevent overlapping refresh actions, and ignore responses for a previously selected tournament or fragment.
- Distinguish write failures from refresh failures: a committed assignment remains committed even if reloading fails. Display a refresh error and allow retry rather than reporting the write as failed.
- No periodic timer or real-time transport is required. Changes by other users become visible on the next manual refresh or reload following a personal change.

### Recommended implementation breakdown

1. Implement the shared contracts and focused frontend conflict evaluator according to the confirmed decisions.
2. Extend the shared role contract and document assignment fields and uniqueness semantics.
3. Implement the aggregate public planning read API with server-side visibility checks, and extend Firestore rules for direct authenticated self-allocation writes, including concurrent write handling.
4. Add a dedicated water-carrier component and feature-specific service, integrated with existing period selection and module checks.
5. Implement browser-side PDF generation and direct download in A4 landscape, paginated to preserve four lines of handwriting space per match.
6. Add targeted tests for authorization, visibility, persistence, and display behavior.
7. Update existing documentation alongside implementation.

### Documentation review

- `doc/pages.md` currently documents a read-only Planning page with three tabs; implementation must document the additional tab and self-allocation workflow.
- `doc/changes/referee-planning.md` describes the original read-only scope; record the extension and reconcile public-access statements with the chosen implementation.
- `doc/datamodel.md` documents `GameAttendeeAllocation`; update its role, scope, position, and half semantics when the decisions are resolved.
- `doc/features.md` and `doc/functions.md` must reflect the new capabilities and aggregate planning API contract.
- Existing documentation remains descriptive of the existing three-tab implementation, except that the statement of public access is not supported by the current authenticated Firestore reads. The confirmed read API addresses this discrepancy for the water-carrier workflow; implementation must document the actual access paths accurately.

## Acceptance criteria

1. Each module independently enables its corresponding feature for the selected visible period.
2. The browser generates and directly downloads an A4 landscape PDF containing match details, assigned referees, and four lines' worth of blank handwriting space per match, spanning multiple pages when needed.
3. The online planning can be read by everyone through one API call returning all required planning data after a server-side public/visible check, without exposing private attendee data.
4. Only an authenticated, account-linked attendee with the `Referee` role can add or remove their own water-carrier assignment.
5. Repeated and concurrent requests cannot create duplicate self-assignments or affect other attendees.
6. The online grid contains referees and water carriers but no coaches, and highlights the current user's assignments.
7. There is no water-carrier capacity limit.
8. Hidden periods cannot be read through the API, modified through the displayed planning, or downloaded through the application. Direct Firestore own-assignment writes are intentionally not gated by period publication/current status.
9. Existing referee and coach assignments and statistics remain unaffected.
10. The frontend blocks self-allocation when its latest loaded data shows the attendee already refereeing or water carrying the same or an overlapping match, or unavailable during the match. Absence of conflicts across simultaneous sessions is not guaranteed.
11. Water-carrier assignments are scoped to both match and fragment. Only visible fragments referenced by the current tournament allocation are offered or returned; there is no fallback when no current allocation exists.
12. Tournament managers and coaches can download the paper PDF when the module and visibility conditions hold; anonymous visitors and attendees without either role cannot use the application export action.
13. A `Refresh` action reloads the complete planning through the API; each successful personal change also reloads it. There is no polling or automatic subscription to other users' changes.

### List of new tests

- Module combinations, period switching, and absent/hidden allocation states.
- Aggregate public planning response completeness, rejection of unpublished scopes, anonymous route loading, and exclusion of private identity information.
- Firestore rules allow eligible own `WaterCarrier` create/update/removal and reject foreign ownership, changed identity/scope fields, and conversion of other allocation roles.
- Firestore identity tests cover normalized/encoded `tournamentId:email` index lookup, missing or inconsistent index entries, an indexed attendee without the `Referee` role, and a payload attendee ID different from the indexed actor. Having `attendeeRole: 'WaterCarrier'` alone never proves referee eligibility.
- Self-allocation with eligible identity; rejection of anonymous writes, wrong role, missing/deleted account link, other-attendee writes, and cross-tournament requests.
- Add/remove persistence, duplicate clicks, concurrent requests, and failed writes.
- Frontend conflict rejection for the same match and overlapping matches in either referee or water-carrier roles, declared unavailability, and successful allocation without conflicts, including back-to-back matches; removal remains possible when an existing assignment conflicts. Do not assert server-side conflict prevention between distinct concurrent assignments.
- Same match in distinct fragments keeps distinct water-carrier assignments; switching current allocations selects only their referenced visible fragments, and shared fragments retain their assignments.
- Hidden, missing, and non-current fragments are excluded from API results; no current allocation produces the empty state, not a fallback. Direct own-assignment writes to hidden/non-current fragments, disabled modules, and mismatched periods of the same tournament are allowed. Missing or cross-tournament game/fragment references are rejected.
- Browser-generated PDF direct download, A4 landscape page dimensions, selected-period filtering, and visual verification of handwriting space and multi-page pagination.
- PDF export authorization for a tournament manager and a coach; rejection for an anonymous reader, a referee without either export role, and a manager/coach of another tournament. Coach-only export eligibility does not authorize self-allocation.
- Current-user highlighting and referee/coach statistics regression coverage.
- Manual refresh, automatic reload after a successful personal write, preservation of a still-valid selected fragment, loss of fragment visibility, stale response handling, and refresh failure after a committed write.

## Open decisions

None blocking implementation. Decisions 1 through 7 and the 2026-09-29 simplified write authorization are resolved above. The latter supersedes the initial scope-proof write checks without changing the public-read visibility rules.

Implementation conventions such as water-carrier alphabetical display order and neutral position value are specified above. The PDF library and internal DTO/service names can be selected during implementation. The accepted limitation is that frontend conflict checks operate on a snapshot and do not prevent scheduling conflicts across simultaneous sessions.
