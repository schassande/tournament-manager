# Attendee index by tournament and email

Last updated: 2026-09-14

## Objective

Provide a deterministic tournament/email-to-attendee lookup so Firestore Security Rules can resolve the authenticated user's tournament roles.

## Scope

### In scope

- Index attendees by tournament ID and lowercase email.
- Maintain the index on attendee creation, email addition/change/removal, and attendee deletion.
- Introduce server functions for attendee creation, update, and deletion, following the existing Person callable structure.
- Deny direct client creation, update, and deletion of attendees.
- Enforce immutable Person email after creation, in both Firestore rules and server mutation paths.
- On Person creation, link all attendees with the same normalized email to the created Person, across all tournaments.
- Identify frontend, backend, shared model, and Firestore rules impacts.

### Out of scope

- Existing document read permissions remain unchanged.
- Production migration and deployment during local implementation.
- Enforcement of `Attendee.roleRestrictions` (days, divisions, referee categories). The user explicitly deferred this work on 2026-09-14. Preserve the stored field without adding new authorization checks based on it.

## Functional requirements

The original specification defines the lookup as `<tournamentId>:<email>` -> `attendee.id`, with email converted to lowercase. Rules follow authenticated email + tournament ID -> index -> attendee -> roles.

All attendee mutations must go through server functions that maintain the index. A role-only update must be visible through the indexed attendee without duplicating roles in the index.

## Business rules

### User decision: Person identity (2026-09-14)

A Person represents an application user. Its email is supplied at creation and must not be changed or removed afterward. This is a confirmed requirement, not an optional recommendation. Other Person fields are not made immutable by this decision.

Firestore Person update rules must require the email to remain unchanged, including rejecting field removal and document replacement that alters it. Server mutation paths must independently enforce the same invariant because Admin SDK writes bypass rules. Immutable updates alone do not prevent deleting and recreating a linked Person under the same ID with a different email. Account ownership must be bound to trusted authentication identity.

### User decision: account creation and tournament rights (2026-09-14)

Only the user may create their own Person, as part of application account creation. Platform administrators and tournament managers cannot create a Person for another user.

A tournament manager creates Attendee records independently of user accounts. The manager may provide `Attendee.person.email`; when the corresponding account already exists, the manager also supplies its `Person.id` in `Attendee.person.personId`. The optional link must resolve to the same normalized email and cannot substitute for authenticated identity.

The attendee email is the authoritative address for the tournament/email index. An indexed attendee can exist before its user account. When a user creates an account with that email, they immediately obtain the rights already assigned to the attendee without a new manager approval. Account creation must also populate the Person links as specified below, but authorization continues to rely on the email index, not those links. Account creation must not create or overwrite tournament role assignments.

### User decision: link existing attendees on Person creation (2026-09-14)

When a Person is created, the server must find every Attendee whose `person.email` matches the new Person's normalized email, across all tournaments, and assign the created `Person.id` to `Attendee.person.personId`. Apply the same behavior to email/password and social registration. Zero matching attendees is a successful no-op.

Set the link even when an attendee already contains a different Person ID, including a stale reference left by a previously deleted account. Preserve all other attendee business fields, especially email, roles, restrictions, and tournament ID; update normal persistence change metadata as required by existing contracts. The tournament/email index remains unchanged because its key and attendee ID are unchanged.

This is a narrowly scoped server-side identity-linking action authorized by verified self-registration. It does not grant the registering user general attendee-editing rights or require that user to be a tournament manager.

Security implementation consequence: Person creation must authenticate the caller, derive ownership from the Authentication UID, and bind the immutable email to the authenticated account rather than trusting arbitrary payload identity fields.

### User decision: verified registration (2026-09-14)

Application registration completes only after email validation. A user may access the application only after completing that step or authenticating through a social provider such as Google that verifies ownership of the email. Preassigned attendee rights become available immediately after this validated registration, without another manager action.

Enforce verified email from trusted Firebase Authentication token claims (`email_verified == true`) in Person creation and email-based tournament authorization. A provider name or a client-supplied flag is not sufficient proof. Social authentication with a verified email satisfies the same condition without an additional application email-validation step. A pending unverified Authentication session must not be treated as a connected application user.

### User decision: Person deletion (2026-09-14)

A Person may be deleted only by a platform administrator or by the corresponding user as part of deleting their application account. A tournament manager has no deletion permission solely from that role. Self-deletion is an account-deletion workflow, not a general permission to delete any Person document.

### User decision: preserve attendees after account deletion (2026-09-14)

Deleting a Person/application account must not modify or delete any Attendee. Preserve all attendee fields, including email, roles, and the optional `person.personId`, even when that link refers to the deleted Person. Preserve the corresponding tournament/email index entries because they describe tournament membership independently of accounts.

Authorization must not require the optional Person link to resolve. A subsequent validated registration with the same email recovers preassigned rights through the index and updates matching attendee Person links through the new Person-creation action. Account deletion itself must not cascade into attendee updates, anonymization, role revocation, index cleanup, or Person-link removal. Consumers must tolerate an optional link whose Person no longer exists between deletion and any later registration.

### User decision: Person profile updates (2026-09-14)

Only the corresponding user or a platform administrator may update a Person's profile fields. A tournament manager has no update permission solely from that role. Both authorized actors must preserve the immutable email and protected Authentication ownership binding; administrator status does not grant an exception. Determine self-ownership from trusted authenticated identity and the existing protected binding, not from proposed changes. Enforce the same policy in Firestore rules and server mutation paths.

Authorization must use trusted authenticated identity and a protected ownership binding, never a caller-supplied Person ID, email, or owner field alone. Apply this policy to client access and server endpoints. Account deletion must preserve attendees and their tournament/email index entries as decided above. Account-specific cleanup and partial-failure retries must not alter tournament membership or permit identity takeover.

Verified ownership caveat: `Person.userAuthId` exists, but `frontend/src/page/user-create.page.ts` initializes it with an email, while `frontend/src/service/user.service.ts` also assigns Firebase Authentication UIDs. Audit and normalize existing bindings before relying on this field for self-deletion; prevent unauthorized ownership changes.

### User decision: unique tournament/email membership (2026-09-14)

At most one Attendee may have a given normalized email within a tournament. This is mandatory because the index maps one tournament/email key to exactly one attendee ID. The same email may occur in different tournaments. Attendees without an email have no index entry and are not subject to email uniqueness until an email is assigned.

Creation and email addition/change must atomically reject a key already owned by another attendee, including concurrent requests. Updating an attendee while retaining its own normalized email is allowed. Never overwrite another attendee's index entry or merge attendees automatically. All roles for that tournament/email belong to the single attendee.

Roles are authoritative and flags are computed server-side, as approved below. Enforcement of `roleRestrictions` is explicitly deferred and does not block this implementation.

## User interface and workflow

Existing attendee editing workflows must call the new server functions and report validation, permission, and duplicate-email errors. Existing reads remain unchanged.

Account registration creates the authenticated user's own Person after email validation. Tournament enrollment can precede registration: role resolution must work from the indexed attendee email even when `person.personId` is absent. Email/password registration must complete email validation before application login and rights activation; a social login providing a verified email satisfies this prerequisite.

The tournament creation wizard currently writes the tournament and its initial manager attendee atomically. The approved replacement creates the tournament, initial manager attendee, and index atomically on the server before direct attendee writes are denied.

## Data model and persistence

### Original requirement and Firestore correction

The original specification requests a string-only collection entry containing `attendee.id`. Firestore requires documents containing fields: the equivalent minimal document is `{ attendeeId: string }`.

Use the collection `attendee-index` with documents containing only `{ attendeeId: string }`. Normalize input emails by trimming surrounding whitespace and converting to lowercase; use the same normalization for token lookup and uniqueness. An absent or empty normalized attendee email has no index entry.

Construct the ID as `escape(tournamentId) + ':' + escape(normalizedEmail)`. Escape `%` as `%25` first, then `/` as `%2F` and `:` as `%3A` in each component, preserving other characters. This preserves the specified tournament/email key while preventing path and delimiter ambiguity. Implement equivalent backend and rules helpers and test them against shared cases. Reject malformed inputs and IDs exceeding Firestore's document-ID size limit before writing. No hashing or alternate email canonicalization (such as removing dots or plus suffixes) is required.

### Verified current model

`persistent-data-model/src/tournament.ts`, `Attendee`, stores the optional email at `person.email` and the optional Person link at `person.personId`. It also contains `roles`, boolean role flags, and optional `roleRestrictions`. The approved design makes roles authoritative and computes flags server-side; enforcement of `roleRestrictions` is out of scope.

## Errors, validation, and permissions

### Verified findings before implementation

- `firestore.rules` currently permits attendee writes to tournament managers identified by `Tournament.managerEmails`, or platform administrators. Updates cannot change `tournamentId`.
- `isRankingCoach()` resolves identity through the linked `Person.email`; `/person/{documentId}` permits writes by any authenticated user. Consequently, a mutable Person email is not a trustworthy role identity binding under the current rules.
- `isRefereeCoachAttendee()` uses the legacy top-level `attendee.personId`, unlike the current nested model.
- `functions/src/person/create-person.ts` validates payloads and performs an index transaction, but its handler does not check `request.auth`. Its authentication behavior must not be copied into privileged attendee endpoints.
- The catch-all rule denies access; new index writes must also be denied explicitly, with no overlapping allow granting access.
- The inspected `frontend/src/service/user.service.ts` does not yet enforce the confirmed verification workflow: `createUser()` immediately creates Person and sets the connected user, while `login()` and `autoLogin()` do not check `emailVerified`. This is a code/spec discrepancy to address during implementation, not a change to the confirmed requirement. Verify social login and restored sessions under the same policy.

### Security requirements

An index makes role lookup possible; it does not itself enforce authorization. Every protected operation must invoke the appropriate role check. Server SDKs bypass Firestore rules, so attendee functions must independently authenticate callers and authorize their tournament access and sensitive changes, especially roles and identity email.

Implement the following safeguards:

- Use the authenticated token identity and enforce the confirmed verified-email prerequisite for Person creation and email-based role resolution.
- Deny access when the token, index, or attendee is missing or invalid; verify that the attendee belongs to the target tournament and matches the indexed normalized email.
- Read roles from the current attendee and preserve existing operation-specific constraints; never accept caller-supplied actor roles as proof. Do not add enforcement of `roleRestrictions` in this change.
- Maintain attendee and index together in a transaction, including removal of the old key and collision checks. An asynchronous trigger alone leaves a stale authorization window.
- Preserve immutable tournament ownership and prevent unauthorized privilege assignment.
- Enforce the confirmed immutable Person email invariant. Do not assume that this alone secures creation, deletion/recreation, or attendee-to-Person linkage.
- Deny direct client reads and writes to the new index. Rules can use document lookups without granting clients read access to that document; this does not require changing existing reads.
- Budget all rule document access calls: the basic lookup needs two document reads, with additional authorization checks contributing to the request limits.

## Compatibility and migration

Existing attendees need an index backfill before rules depend on it. Audit duplicate and malformed emails first. Existing duplicate tournament/normalized-email pairs must be reported and resolved before the affected data is migrated; do not select a winner or merge roles automatically. Define deployment ordering before enabling the new restrictions. Preserve tournament creation and deletion and cover all import, bulk-write, and administrative mutation paths.

Person email changes and removal are forbidden after creation (confirmed user decision). Attendee email is independently assigned by the tournament manager and is authoritative for the index; it does not depend on an existing Person.

User-confirmed scope assumption (2026-09-14): the Google account email is stable. No Google email-change workflow or Person email migration is required by this change. This records the application's agreed scope, rather than a general claim about external provider capabilities. Email immutability and trusted authenticated ownership checks remain applicable.

## Technical specifications

### Readiness

Implemented locally. The index, identity/account workflows, role checks, registration linking, migration audit, and frontend callers are implemented. Enforcement of `roleRestrictions` remains excluded. Production migration and deployment are separate operating steps documented in doc/dev.md.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Rules | `firestore.rules`: attendee match, `isRankingCoach`, `isRefereeCoachAttendee`, manager helpers | Deny direct attendee/index writes; introduce deterministic actor resolution and integrate it into the agreed permissions. |
| Backend | `functions/src/person/create-person.ts` | Reuse callable/transaction structure with explicit authentication and authorization; add attendee mutation functions and shared validation/index logic. |
| Frontend | `frontend/src/service/attendee.service.ts` | Replace inherited direct mutation paths with typed server calls. |
| Tournament bootstrap | `frontend/src/service/tournament.service.ts`, `createWithManager` | Adapt the existing atomic tournament/manager creation workflow. |
| Shared data | `persistent-data-model/src/tournament.ts`, `Attendee` | Define index contract and consistent identity and role semantics. |
| Person identity | `firestore.rules`: person match; `functions/src/person/create-person.ts`; `frontend/src/service/person.service.ts` | Preserve email at creation and reject subsequent changes/removal in every mutation path; review delete/recreate and account binding. |
| Documentation | `doc/datamodel.md` | Document index and revised writes/bootstrap at implementation time; correct legacy attendee field descriptions. |

### Documentation review

The pre-change manager/admin write policy and getAfter bootstrap were reviewed against the original code. Implementation documentation now describes indexed authorization, server-only attendee writes, registration linking, and server tournament lifecycle operations. Legacy attendee field descriptions were corrected. The verified findings above are retained as pre-change evidence; current behavior is documented in doc/datamodel.md, doc/functions.md, doc/pages.md, and doc/dev.md.

### Approved replacement scope (2026-09-14)

The user approved the concrete replacement proposal below, including indexed manager/coach authorization, server-derived role flags, equivalent backend checks, and server-side tournament creation/deletion. The user subsequently authorized implementation of this scope.

| Existing control | Approved replacement |
|---|---|
| `isTournamentManager(tournament)` using `managerEmails` | Resolve the authenticated verified email through the tournament/email index and check the current attendee's `TournamentManager` role. `managerEmails` must no longer independently grant rights. |
| `canManageTournament(tournamentId)` | Keep the existing platform-admin alternative; resolve tournament manager rights through the index. This affects games, FIT data, allocation collections, allocation statistics, and ranking deletion checks. |
| Tournament update/delete | Use the same indexed manager/platform-admin authorization. |
| `isRefereeCoachAttendee(attendeeId, tournamentId)` | Resolve the actor through the index, require the supplied actor ID to equal the resolved attendee ID, and check coach eligibility. Remove the Person lookup and legacy top-level Person link. |
| `isRankingCoach(attendeeId, tournamentId)` | Apply the same indexed actor identity and coach eligibility checks, without requiring a linked Person. All ranking validators using this helper retain their operation-specific constraints. |
| Attendee create/update/delete and `canManageTournamentAfterWrite` | Deny client mutations; authorize manager/admin actions in transactional server endpoints. Replace the first-manager bootstrap with the dedicated server workflow below. |
| Backend `authorizeRankingCoach` and its callers | Use the same indexed actor lookup and verified identity so server ranking operations also work without a linked Person. |

Approved role representation: use `roles` as the authoritative source and compute boolean flags on the server for existing queries/UI. Preserve current coach eligibility, including combined roles and the `Coach` alias, rather than introducing `RefereeRanker`/`RefereeUpgrade` permissions implicitly. Enforcement of `roleRestrictions` is deferred to a future specification.

Preserve existing operation constraints: target tournament consistency, eligible upgrade referee, enabled ranking module, panel membership when editing another coach's ranking, status transitions, locks, and allowed changed fields. A target attendee may still have no account/email; only the acting user is resolved through the index.

Keep platform administration rooted in the existing `PlaformAdmin` collection, independently of tournament membership; require verified authenticated identity for its privileged checks. Preserve existing read policies, including the manager/admin category for FIT data, while changing how that category is resolved. Do not globally tighten `signedIn()` because it is also used by existing reads.

Implement server-side atomic creation of tournament + initial manager attendee + index, authorized for the verified creator without requiring a pre-existing tournament role. Tournament deletion must authorize before removing the caller's attendee/index and complete cleanup on the server; otherwise later client deletions would lose authorization. These lifecycle replacements were approved with the replacement scope.

Person creation, immutable identity, restricted deletion, and profile updates are confirmed separately. Profile updates are restricted to the corresponding user or a platform administrator, with no exception to email immutability or protected Authentication ownership.

### Implementation sequence

1. Audit existing attendee writers, role mappings, and Person ownership bindings; retain the approved operation permissions.
2. Implement the index model and shared normalization/escaping contract.
3. Implement authenticated, authorized transactional attendee mutation functions and bootstrap handling.
4. Update every client and server attendee mutation path.
5. Backfill and audit the index; deploy callers and rules in a compatible sequence.
6. Integrate role helpers into the agreed operations and run emulator authorization tests.

### Person-creation attendee linking

Extend the shared server Person-creation workflow used by both registration methods. Use the verified, persisted Person identity as the source of email and ID; do not accept a caller-provided list of attendees to modify.

Query attendees across tournaments with `where("person.email", "==", person.email)`, using the persisted normalized email. Creation and modification normalize attendee emails, and migration must normalize legacy values before rollout. Paginate only matching results; never scan the attendee collection during registration. The index document ID alone is not a queryable email field.

Update the nested `person.personId` field rather than replacing the embedded person object or the whole attendee. Recheck the current email before writing so a concurrent manager email change does not attach an unrelated attendee. Handle concurrent deletion without recreating the attendee. Concurrent attendee creation/email assignment must resolve an already-existing matching Person so registration and attendee writes converge to the correct link.

The operation must cover all matching attendees, including counts exceeding a single write batch, and must be idempotent and retryable after partial failure. Do not report the linking action as completed while matches remain unprocessed. A retry must reuse the same created Person and resume linking rather than create a duplicate or treat its own existing email index as a conflicting user. Final implementation must document batching/retry mechanics and verify concurrent mutation behavior. Authorization remains independent of link completion.

Update `doc/datamodel.md` to describe registration-time link population and the deliberately unchanged attendees on account deletion. Include the new workflow in Person endpoint documentation and frontend registration error handling.

### Firebase references

- [Rule conditions and access-call limits](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Document data model](https://firebase.google.com/docs/firestore/data-model)
- [Server libraries bypass rules](https://firebase.google.com/docs/firestore/security/rules-fields)

## Acceptance criteria

- Each attendee with an eligible email resolves to its current ID in its own tournament.
- Each tournament/normalized-email pair belongs to at most one attendee. Conflicting creation or email assignment is rejected atomically; the same email in another tournament and unchanged ownership of the current key are allowed.
- Creation, email changes/removal, and deletion maintain the index atomically.
- Clients cannot mutate attendees or the index directly.
- Unauthorized callers cannot use server endpoints to assign roles or bind their identity to a privileged attendee.
- Existing read permissions are preserved.
- Person email can be set at creation but cannot subsequently be changed or removed through client or server writes.
- Person profile updates are allowed only to the corresponding user or a platform administrator. Neither may change the immutable email or protected Authentication ownership binding.
- Only an authenticated user can create their own Person; creating another user's Person is denied, including for managers and platform administrators.
- An attendee can be created with an email before the corresponding Person exists. Completing registration with that verified email activates the preassigned rights without requiring a Person link or another manager action.
- Unverified email/password sessions cannot create Person or access tournament rights. Verified email/password and social login sessions can; restored sessions enforce the same prerequisite.
- A newly supplied or changed attendee Person link must match the linked Person's normalized email. Account deletion leaves existing links unchanged, and subsequent unrelated attendee updates must tolerate an unchanged link to a deleted Person.
- Person deletion is denied except for platform administrators and the corresponding user in the account-deletion workflow; a tournament-manager role alone does not grant this permission.
- Account/Person deletion leaves every attendee and tournament/email index entry unchanged, including optional Person links. A new validated account with the same email resolves the existing rights and links matching attendees to its newly created Person.
- Person creation assigns its ID to every matching attendee across tournaments, including missing or stale links, while preserving other business fields and the tournament/email index. Zero matches succeeds; large result sets and retries do not leave silently incomplete linking.
- Tournament creation/deletion and existing attendees remain supported after migration.
- The agreed role-protected actions reject callers without the required tournament permissions.
- Existing `roleRestrictions` values are preserved; this change introduces no enforcement of that field.

### List of new tests

- Case normalization, escaping, missing/invalid email, and index ID validity.
- Concurrent duplicate creation and email changes; no partial writes on failure.
- Old-key cleanup, attendee deletion, missing index/attendee, and cross-tournament mismatch.
- Unauthenticated, unverified-email, unauthorized, and authorized calls to mutation endpoints.
- Direct client attendee/index writes denied, with existing read behavior unchanged.
- Role revocation and existing operation constraints enforced; editing Person cannot impersonate a privileged attendee. Preserve `roleRestrictions` without introducing authorization behavior based on it.
- Person email modification/removal and replacement rejected; unrelated permitted updates still succeed. Cover server paths and delete/recreate attempts against linked identities.
- Self and platform-admin profile updates succeed; another user or a tournament manager without either permission is denied. Email or ownership changes are rejected even for platform administrators, through client and server paths.
- Person deletion by a platform administrator and self account-deletion succeed; another user or a tournament manager without either permission is denied. Forged or modified ownership fields cannot grant self-deletion rights.
- Account deletion preserves all attendee fields and tournament/email index entries. Missing linked Persons do not break attendee reads, unrelated updates, or indexed authorization after validated re-registration with the same email.
- Self-registration succeeds; Person creation with another identity or forged UID/email fails. A manager/admin cannot create another user's Person.
- Register after attendee creation and resolve preassigned roles with no Person link; reject a supplied Person link whose email differs. Registration does not change the attendee roles.
- Person creation links all normalized-email matches across tournaments for both registration methods; covers zero matches, missing links, stale links, existing correct links, and unrelated emails. Other business fields and index entries remain unchanged.
- Linking covers more than one write batch, resumes after partial failure without duplicate Person creation, and safely handles concurrent attendee email changes, deletion, and creation.
- First-manager bootstrap, backfill conflicts, and tournament deletion.
- Full rule access-call budgets for representative writes and batches.

## Open decisions

No blocking decisions remain. Confirmed decisions: only a user creates their own Person; its email is immutable after creation; deletion is restricted to platform administrators or the corresponding user during application account deletion. Managers declare tournament rights independently through attendees and optional emails/Person links. Registration with the attendee email gives access to preassigned rights without requiring a Person link.

Additional confirmed requirement: creating Person populates or replaces `person.personId` on every attendee with the same normalized email across tournaments. Account deletion still leaves attendees unchanged.

The replacement scope, manager authority, authoritative `roles` with server-derived flags, and server-side tournament bootstrap/deletion are approved. One attendee per tournament/normalized email is mandatory.

1. Resolved: only the corresponding user or a platform administrator may update Person profile fields; email and Authentication ownership remain protected.
2. Resolved: account deletion does not modify attendees, including optional Person links, and preserves their tournament/email index entries and preassigned rights.
3. Resolved scope assumption: the Google account email is stable; no email-change workflow is required in this specification.
4. Deferred by the user: enforcement of `roleRestrictions` will not be treated in this change. Authoritative roles and preservation of existing operation constraints are already approved.

## Implementation record (2026-09-14)

- Shared identity helpers: persistent-data-model/src/attendee-index.ts.
- Server attendee transactions and role authorization: functions/src/attendee/ and functions/src/identity/.
- Account creation/linking/deletion: functions/src/person/; tournament bootstrap/cascade: functions/src/tournament/.
- Operations run directly without persistent registration or deletion state. Every registration invocation reuses the matching Person and repeats linking. Registration queries only matching normalized emails in pages of 150 with transactional email rechecks and only updates Person links and normal change metadata.
- Angular services call the server for attendee and tournament lifecycle writes. Manager display no longer grants roles from managerEmails. Actor selection uses normalized email. Verified registration and the profile/account-deletion page are implemented.
- The database was reset before rollout; no offline migration or duplicate merge script is required. New writes maintain normalized emails and the attendee index directly.
- Existing operation constraints and authenticated/public read categories are retained; roleRestrictions is not enforced.
- Validation: 46 local Firestore/Auth emulator tests passed, including actual HTTP token verification, 505-attendee linking, failed-commit retries, identity protection, and ranking regressions. All 26 Angular ranking page tests passed. Functions, shared model, and Angular development builds passed. No production data was changed.

The implementation audit also found a statistics HTTP write path bypassing client rules. It now checks a verified bearer token, indexed manager/admin permissions, and the tournament of every supplied target. Its frontend caller and doc/functions.md were updated together.

### Filtered registration lookup (2026-09-14)

At the user's request, registration now filters on persisted normalized `person.email` before pagination. It never reads all attendees. The 14 targeted identity emulator tests pass, including a regression asserting that only matching attendee documents are read and the existing 505-attendee paging/retry cases. Functions compilation passed. Legacy normalization remains a migration prerequisite.

### Direct lifecycle operations (2026-09-14)

User decision: no temporary lifecycle collections, deletion receipts, or completion markers. Any new persistent collection requires explicit user approval. The approved attendee-index remains a business authorization index.

Registration creates/reuses Person and its email index transactionally, then directly links matching attendees through the normalized-email query. Account deletion checks owner/admin rights, deletes Authentication (an already absent Auth user is accepted), then deletes Person and its owned email index transactionally. Attendees remain untouched. Tournament deletion checks current manager/admin rights, removes related documents and attendee indexes in bounded pages, and deletes the tournament last. A call targeting an already absent Person or tournament returns not-found.

There is no persistent progress tracking or concurrent-write freeze. Partial account deletion after Authentication removal, or tournament deletion after manager membership removal, may require a platform administrator to finish. These rare concurrency/partial-failure limitations are accepted to keep the implementation direct.

Validation: Functions TypeScript compilation and all 47 Firestore/Auth emulator tests pass after removal of lifecycle state.

### Legacy migration decision

The database was emptied before implementation. The previously planned offline migration and attendee merge scripts were removed; no migration step is part of the deployment procedure. The runtime continues to enforce one attendee per normalized tournament/email pair.
