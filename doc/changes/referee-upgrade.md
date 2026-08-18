# Referee Upgrade

Last updated: 2026-08-17

## Objective

Provide the tournament referee-coach panel with a tool to evaluate and decide whether referees should be upgraded during a tournament.

## Scope

### In scope

- A tournament page at `/tournament/:tournamentId/referee-upgrade`.
- Individual coach votes, visible to all referee coaches in the tournament.
- A panel decision and the associated follow-up actions.
- Summary views for upgraded referees, referees to see again, and referees to talk to.
- Shared frontend/backend types and Firebase persistence services for coach and panel votes.
- A menu entry named `Referee upgrade`.

### Out of scope

- Automatically changing the referee's badge or referee information after a panel decision.
- Evaluation of referees who are not marked as seeking an upgrade.
- Any workflow for referee-coach upgrades; this feature concerns referees only.

## Functional requirements

### Eligible referees

Eligible referees are tournament attendees whose `referee.upgrade` section is present in `RefereeInfo` and whose requested upgrade badge is not `0`:

```ts
upgrade?: {
  badge: number;
  badgeSystem: RefereeBadgeSystem;
};
```

The current shared model stores this information on `Attendee.referee` (`persistent-data-model/src/tournament.ts` and `persistent-data-model/src/referee.ts`). A badge value of `0` means that no upgrade is requested.

### Vote values

The shared type must be:

```ts
type UpgradeVote = 'Yes' | 'Not yet' | 'Possible' | 'DNS' | 'Voting';
```

- `Yes`: the coach considers that the referee has the required level.
- `Possible`: the coach considers that the referee may have the required level, but the decision should be confirmed after seeing the referee again.
- `Not yet`: the coach considers that the referee does not yet have the required skills.
- `DNS`: Do Not See; the coach did not see the referee, or did not see enough of the referee to decide.
- `Voting`: the coach has not voted yet.

Votes are public to all referee coaches of the tournament.

### Shared and persisted models

The common upgrade reference is:

```ts
interface RefereeUpgradeVote {
  tournamentId: string;
  refereeAttendeeId: string;
  vote: UpgradeVote;
}
```

The persisted models must be defined as follows, with the exact inheritance/field syntax adapted to the repository's TypeScript model conventions:

```ts
interface RefereeUpgradeCoachVote extends PersistentObject {
  tournamentId: string;
  refereeAttendeeId: string;
  coachAttendeeId: string;
  vote: UpgradeVote;
  comments: string[];
}

interface RefereeUpgradePanelVote extends PersistentObject {
  tournamentId: string;
  refereeAttendeeId: string;
  vote: UpgradeVote;
  updatedByCoachAttendeeId: string;
  needToSee: string[];
  needToTalk: string | null;
}
```

The frontend must provide an Angular service for each persisted model. The Firebase collection names and document identity are defined below; backend security enforcement must validate the documented permissions.

## Business rules

- Every eligible referee is displayed in the coach and panel workflows.
- On page load, create the connected referee coach's missing coach votes with `Voting` and empty comments; do not create coach-vote documents for other coaches.
- On page load, create a missing panel vote for every eligible referee with `Voting`, no follow-up assignments, and the connected coach as the initial author.
- A coach's initial vote is `Voting`.
- A panel vote is initially `Voting`.
- The panel's `needToTalk` control is enabled only when the panel vote is `Not yet` and defaults to `null`, displayed as `Nobody`.
- The `Upgraded` summary contains referees whose panel vote is `Yes`.
- The `To See` summary is derived from `RefereeUpgradePanelVote.needToSee`.
- The `To talk` summary is derived from `RefereeUpgradePanelVote.needToTalk`.
- Empty coach comments are omitted from aggregated comments. Each non-empty comment line is prefixed with the coach short name, and each displayed comment line has a bullet point. Line breaks entered in the coach comment field are persisted as separate `comments` array elements.

`needToTalk` is only actionable for a `Not yet` panel vote. `needToSee` may remain populated for other panel outcomes, including `Possible`.

## User interface and workflow

The page is available to attendees with the tournament `RefereeCoach` role. It contains five tabs: `Coach vote`, `Panel Vote`, `Upgraded`, `To See`, and `To talk`.

### Coach vote tab

The table contains:

- Last name (read-only)
- First name (read-only)
- Badge/badge system, displayed for example as `4/5` (read-only)
- Category (`RefereeCategory`, read-only)
- Gender (read-only)
- Vote, a PrimeNG select with all `UpgradeVote` values and default `Voting` (editable)
- Comment, a multiline editable field intended especially to explain `Not yet` or `Possible`; entered line breaks are persisted as separate `comments` array elements

Rows are sorted by current badge ascending, category in the order Junior, Open, Senior, Master, then last name and first name alphabetically. Filters are available for badge values `1` through `5` and categories Junior, Open, Senior, and Master.

Vote values are color-coded with pastel backgrounds in the `Coach vote` and `Panel Vote` tables: `Yes` uses pastel green with black text, `Not yet` pastel red with black text, `Possible` pastel blue with black text, `DNS` light gray with black text, and `Voting` keeps the default background.

### Panel Vote tab

All panel members may edit the panel vote. The table contains:

- Last name, first name, badge/badge system, category, and gender (read-only)
- Panel Vote, a PrimeNG select with all `UpgradeVote` values and default `Voting` (editable)
- One read-only column per coach, showing that coach's vote; columns are sorted by coach short name
- `Need to See`, an editable PrimeNG multi-select of coaches, using coach short names
- `Need to talk`, an editable PrimeNG select of coaches, using coach short names; default `Nobody`; enabled when Panel Vote is `Not yet`
- `Comment`, the concatenation of non-empty coach comment lines prefixed by coach short name, with a bullet point before each line (read-only)

Rows use the same sorting and filters as the `Coach vote` tab. The table must support horizontal scrolling while freezing the first two displayed columns: `Last name`, then `First name`.

### Upgraded tab

This read-only summary lists referees whose panel vote is `Yes`, with last name, first name, badge/badge system, and category. It uses the same sorting and badge/category filters as the vote tables.

### To See tab

This read-only summary lists each coach/referee pair from `needToSee`, with coach short name, referee last name, and referee first name. Rows are sorted by coach and then referee last name and first name, and the table is filterable by coach.

### To talk tab

This read-only summary lists each coach/referee pair from `needToTalk`, with coach short name, referee last name, referee first name, and aggregated comments. Each displayed comment line has a bullet point. Rows are sorted by coach and then referee last name and first name, and the table is filterable by coach.

## Data model and persistence

The feature requires new shared types in `persistent-data-model`, new Firebase collection constants, and Angular persistence services. Backend persistence and authorization must validate `tournamentId`, attendee identities, eligibility, and the referee-coach role rather than trusting client data.

The selected persistence approach is to use dedicated root-level Firebase collections, with one document per vote and `tournamentId` stored as a field used for filtering.

Vote document IDs are deterministic composite IDs: `tournamentId_refereeAttendeeId_coachAttendeeId` for coach votes, and `tournamentId_refereeAttendeeId` for panel votes. This enforces one coach vote per coach/referee/tournament and one panel vote per referee/tournament.

The Firebase collections are `referee-upgrade-coach-vote` and `referee-upgrade-panel-vote`.

The panel consists of all tournament attendees with the `RefereeCoach` role. No separate panel-membership configuration is required.

When the panel vote changes away from `Not yet`, `needToTalk` is cleared to `null`, while `needToSee` is retained.

Table sorting and badge filters use the referee's current `referee.badge`, not the requested upgrade badge.

Votes are retained in Firebase for traceability when a coach or referee is removed, loses the relevant role, or is no longer eligible, but they are excluded from active views.

Verified repository conventions include `PersistentObject extends WithId`, attendee role flags in `persistent-data-model/src/tournament.ts`, and reusable persistence helpers in `functions/src/common-persistence.ts`. No existing upgrade-vote collection or service was found.

## Errors, validation, and permissions

- Only referee coaches belonging to the tournament may access the page.
- All referee coaches may view all coach votes and panel data.
- Only eligible referees may receive votes.
- Votes must be one of the five `UpgradeVote` values.
- Comments must be persisted and displayed without empty entries.

The exact backend authorization mechanism, concurrent-edit handling, and user-visible error messages should follow existing application conventions; no feature-specific decision is required for implementation.

## Compatibility and migration

No existing persisted upgrade-vote data or collections were found, so no data migration is currently identified. Adding the feature requires route/menu integration and new shared model exports. Existing attendees without `referee.upgrade` must remain unaffected.

## Acceptance criteria

- An authorized referee coach can open the new route from the tournament menu.
- Only eligible referees appear in the upgrade workflow.
- A coach can view and persist one vote and comments per eligible referee, with `Voting` as the initial state.
- Every referee coach can see all persisted coach votes.
- Panel members can view coach votes, edit panel votes, assign coaches to `Need to See` and `Need to talk`, and see aggregated comments.
- The five tabs display the required datasets, sorting, filtering, and read-only/editable behavior.
- The panel vote `Not yet` state enables `Need to talk`; other states follow the clarified rule.
- Unauthorized users and invalid or ineligible writes are rejected by the backend.
- Existing application routes and attendee workflows remain functional.
- Documentation is updated for the new data model, route, permissions, and workflow.

## Open decisions

- Comment length limits and any additional sanitization rules.

## Verified implementation impact

| Area | Evidence | Expected impact |
|---|---|---|
| Shared model | `persistent-data-model/src/referee.ts`, `persistent-data-model/src/tournament.ts` | Add upgrade vote types and preserve existing referee eligibility fields. |
| Persistence | `persistent-data-model/src/collection-names.ts`, `functions/src/common-persistence.ts` | Add collection contracts and backend persistence/validation. |
| Frontend route | `frontend/src/app/app.routes.ts` | Add lazy-loaded `tournament-referee-upgrade` page. |
| Frontend services | `frontend/src/service/abstract-persistent-data.service.ts`, `frontend/src/service/attendee.service.ts` | Add vote services and reuse tournament attendee lookup. |
| Menu | `frontend/src/component/main-menu.component.ts` | Add the `Referee upgrade` tournament menu entry. |
| Documentation | `doc/datamodel.md`, `doc/pages.md`, `doc/functions.md` | Update data model, page, persistence, and authorization documentation during implementation. |

## Readiness

Ready for implementation.

## Summary

The feature is specified as a referee upgrade voting workflow for all tournament referee coaches, with public coach votes, a shared panel decision, follow-up assignments, and five workflow or summary tabs.

## Remaining assumptions

- Existing application conventions will determine the maximum comment length and any text sanitization.

## Recommended implementation breakdown

1. Add shared models and Firebase collection constants.
2. Add backend persistence, validation, and authorization for coach and panel votes.
3. Add Angular services, route, menu entry, and the five-tab page.
4. Update data-model, page, function, and permission documentation.

## Recommended checks

- Run shared model, frontend build, and backend tests.
- Verify authorization for referee coaches and rejection of invalid or ineligible writes.
- Verify deterministic document IDs and concurrent update behavior.
- Verify sorting, filters, frozen columns, comment line splitting, and bullet rendering.
- Verify that inactive attendees' historical votes remain persisted but are absent from active views.
