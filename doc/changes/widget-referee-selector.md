# Widget RefereeSelector

Last updated: 2026-08-19

## Objective

Replace the current PrimeNG `p-select` used by `game-referee-allocator` with a custom referee-selection widget. The widget must help users choose a referee for one match position more effectively than a simple select while preserving the existing allocation workflow.

## Scope

### In scope

- A base referee-allocation cell displaying the selected referee and a clear action.
- A popover opened for the primary selected cell.
- Context, search/filter controls, sorting controls, and a selectable referee-card list in the popover.
- Integration with `SelectionService`, keyboard actions, highlighting, and existing allocation persistence.
- In-memory filtering and sorting of at most 300 referees and their matches for the current allocation period.

### Out of scope

- Changes to the persisted referee, attendee, game, or allocation data model.
- A new backend endpoint for searching or sorting referees.
- Changes to coach allocation behavior, except where required to keep the existing component integration working.

## Functional requirements

The widget selects a referee for one position in a game. Its public output is the allocated attendee information, or `null` when the position is cleared.

The base element is a `div` with a solid light-grey 1px border and an 8px radius. It displays one-line, left-aligned referee identity and a trailing clear icon. Identity formatting is:

- Player referee: `PR` followed by the team name.
- Full-time referee: level/category/upgrade followed by first name and last name, for example `L3S* Laurent GARRIGUES`.

The cell may be selected. The primary selected cell opens the popover. The popover contains a context line, a single-line search/filter form, and a list of selectable referee cards.

The context line uses a thin `0.8rem` font and displays `HH:mm`, division, match type, `Result Required`, and the two teams as `A vs B` when known.

The form contains:

- A text input for search.
- A three-option sort selector: ascending level (default), descending level, or ascending number of games already allocated during the period.
- A level selector: All, Level 1 through Level 6.
- A category selector: All, Junior, Open, Senior, Master.
- An upgrade-only checkbox.
- A gender selector: All, Male, Female.
- A `PR` checkbox for player referees.
- A `Release eligibility constraints` checkbox, disabled by default. When enabled, it bypasses only automatic eligibility constraints (availability, overlapping allocation, consecutive playing-time, and daily playing-time limits); ordinary text search, explicit level/category/gender/PR filters, and sorting remain active.

Search terms are matched case-insensitively against `Attendee.person.search` and `Attendee.Team.name`.

When multiple search terms are entered, all terms must match (AND semantics), including both ordinary words and special tokens. Explicit form controls are also combined with the search expression.

Special search tokens are supported:

- `L1S` through `L6S`: filter by level and Senior category.
- `L1J` through `L6J`: filter by level and Junior category.
- `L1` through `L6`: filter by level.
- `*`: retain referees looking for an upgrade.

The `*` token can be combined with the other tokens, for example `L1*` and `L3S*`.

Each referee card displays:

- For a full-time referee, first name, last name, and gender tag are displayed at the top left; female is pink and male is blue.
- For a `PlayerReferee`, only the associated team name is displayed as the identity; no first name, last name, gender, level, category, or upgrade information is assumed or displayed.
- For a full-time referee, level/category/upgrade is displayed as a tag at the top right, using the badge-system color. No level/category/upgrade tag is displayed for a `PlayerReferee`.
- All matches for the period, with `HH:mm`, field, division, teams, and other referees.

The match list is displayed for both full-time referees and `PlayerReferees`. For a `PlayerReferee`, the absence of personal and referee-level information does not prevent displaying its allocated period matches.

## Business rules

- The current allocation page is the source of the in-memory referee and match information for the widget.
- Filtering and sorting are performed in memory.
- The maximum expected number of referees for a competition is 300.
- The existing allocation rules and persistence behavior remain unchanged.

An attendee is eligible for a game only when the attendee is available for the game's day and timeslot. Availability is read from `Attendee.unavailabilities` using the existing `findPartDayUnavailability()` and `isSlotUnavailable()` helpers in `persistent-data-model/src/referee-availability.ts`.

The effective allocation configuration is the fragment `generalConfig` when defined; otherwise it is the parent tournament-allocation `generalConfig`. The selector must apply at least these configured constraints:

- `maxGameInRowForReferee`: maximum consecutive game time for the referee.
- `maxRefereeGameTimePerDay`: maximum referee game time during the relevant day.

Validated time-calculation rule: constraints use playing time, not complete timeslot duration. Breaks contained in a timeslot do not count. For consecutive adjacent timeslots, the evaluator sums the `playTime` of each period in those timeslots. For example, two 50-minute timeslots containing two 20-minute periods each represent 80 minutes of referee playing time.

An attendee failing any mandatory availability or allocation constraint is not selectable for the current game. Ineligible referees are omitted without an explanatory message or disabled placeholder. The eligibility mechanism must be extensible so additional constraints, such as interleaved divisions, can be added without changing the selector component or duplicating filtering logic.

The allocator may explicitly enable the `Release eligibility constraints` mode for exceptional assignments. This mode is off by default to prevent accidental invalid allocations. It does not disable search or ordinary user-selected filters.

## User interface and workflow

Selection is managed by `SelectionService`; multiple cells may be selected. The primary selected cell has a 3px solid blue border. Other selected cells have a grey background, which takes priority over referee highlighting.

The page supplies highlighted referee IDs. The allocator applies the corresponding cell background colors.

Keyboard events are currently managed by `tournament-referees-allocation.page.ts`. The new widget must collaborate with the page and must not introduce a competing page-level keyboard handler.

When the primary cell is active, the page handles these keyboard events:

- `Delete` or `Backspace` clears the referee.
- `Enter` or `Space` opens the referee-selection widget with an empty search value.
- A letter or number opens the referee-selection widget and passes the typed character as the initial search text.

The initial letter/number must be preserved and inserted into the widget text input as part of the opening action. Once the popover is displayed, the text input automatically receives focus so the user can continue typing without an additional click. This transition must be transparent to the user: the opening key must not be lost, duplicated, or inserted into another page-level control.

After the popover is open and its text input has focus, subsequent character input is handled by the widget's input control. The page remains responsible for coordinating the opening action and the existing cell-level commands.

The widget must preserve accessible focus, keyboard navigation, labels, and visible focus states.

## Data model and persistence

No persisted schema change is currently required. The widget consumes existing `Referee`, `Attendee`, `Team`, `GameView`, `GameAttendeeAllocationView`, and allocation-period data.

The proposed data flow is:

1. `tournament-referees-allocation.page.ts` loads referees, games, and game-attendee allocations once for the current allocation period.
2. The page builds an in-memory referee index containing each referee's normalized search fields, display metadata, and the list of assigned matches for the period.
3. `tournament-referees-allocation.page.ts` coordinates the keyboard opening action and passes an optional initial search character to `game-referee-allocator`/`RefereeSelector`.
4. `game-referee-allocator` receives the current game context, selected referee ID, selection/highlight state, and the shared in-memory referee index.
5. `RefereeSelector` owns only transient widget state: popover visibility, initial search text, current search text, filter values, sort order, focused card, and the derived visible list. On opening, it focuses the text input after the popover is rendered.
6. The widget emits the selected attendee ID or `null`; `game-referee-allocator` performs the existing create/update/delete persistence through `GameAttendeeAllocationService` and updates the page's in-memory allocation view.

Derived values such as normalized search tokens, visible referees, sort order, formatted identity, context text, and match summaries should be computed in memory. Firestore reads must not occur for each keystroke, filter change, card opening, or sort change.

## Errors, validation, and permissions

The existing allocation-edit permission model applies. A selected referee ID must belong to the in-memory referee list for the current tournament. Persistence errors must leave the UI in a recoverable state and must not silently discard the previous allocation.

When no referee matches the active search and eligibility state, the widget displays a neutral `No eligible referee` empty-state message. It does not disclose which eligibility constraint excluded a referee. Loading and persistence-error presentation remain implementation details to be aligned with the existing page conventions; persistence failures must remain recoverable and must not silently discard the previous allocation.

## Compatibility and migration

Existing allocations must continue to load and persist through the current Firestore services. No migration is expected. The replacement must remain compatible with `SelectionService` copy, paste, delete, and multi-cell selection actions.

## Acceptance criteria

- The current `p-select` referee controls are replaced by the custom widget without changing the persisted allocation contract.
- A user can open the widget by mouse and by the specified keyboard actions.
- A letter or number typed on the selected cell is retained as the first search character, and the popover input receives focus automatically so typing can continue seamlessly.
- Search, special tokens, filters, and all three sort modes produce the documented results without backend requests.
- Search terms use AND semantics, and the `Release eligibility constraints` checkbox is off by default and bypasses only automatic eligibility constraints when enabled.
- Unavailable attendees and attendees exceeding the effective allocation limits are omitted by default; playing-time limits sum `Timeslot.slotType.playTime` across adjacent slots and exclude breaks.
- Referee cards display full-time referee identity/tags or, for a `PlayerReferee`, only the team name; both types display their period-match information.
- Selecting, replacing, and clearing a referee updates the existing allocation flow and emits the selected attendee or `null`.
- Selection borders, multi-selection background, and referee highlights remain correct.
- Existing copy/paste and delete keyboard workflows remain functional.
- The frontend compiles and relevant component/service tests cover filtering, token parsing, sorting, and selection output.
- Documentation in `/doc` remains accurate or is updated with the final behavior and technical decisions.

## Readiness

Ready for implementation.

## Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Existing allocator | `frontend/src/component/game-referee-allocator.component.ts` | Replace per-position `p-select` presentation while preserving allocation CRUD and `SelectionService` actions. |
| Allocation page | `frontend/src/page/tournament-referees-allocation.page.ts` | Initialize the page-scoped facade with referees, games, allocations, availability, and effective configuration; pass shared state to allocator instances. |
| Availability | `persistent-data-model/src/referee-availability.ts`, `Attendee.unavailabilities` | Reuse `findPartDayUnavailability()` and `isSlotUnavailable()` for day/part-day/timeslot eligibility. |
| Allocation configuration | `persistent-data-model/src/referee-allocation.ts`, `doc/changes/configure-allocation.md` | Read fragment `generalConfig` first, then tournament-allocation `generalConfig`; apply playing-time limits during candidate eligibility. The configuration spec must be amended during implementation because its original increment explicitly excluded algorithm consumption. |
| Persistence | `GameAttendeeAllocationService` and existing Firestore services | No new endpoint or persisted schema; selection output is translated into the existing create/update/delete flow. |
| Documentation | `/doc` and this specification | The final UI, eligibility behavior, and configuration-consumption rule must be reflected in the relevant documentation before implementation is complete. |

## Remaining assumptions

- The current `Game`, `Timeslot`, `SlotType`, `RefereeInfo`, `Person`, and `Attendee` fields are sufficient: `Timeslot.slotType.playTime`, `Person.gender`, `Person.search`, `RefereeInfo.badge`, `category`, `badgeSystem`, and `upgrade` are the primary sources.
- The game type and `Result Required` values are available on the current game/import model or will be mapped into `GameView`; if not, the context line will omit only the unavailable value rather than trigger another read.
- The exact visual styling of the neutral empty state, loading state, and persistence error can follow existing PrimeNG/page conventions and does not change the data-flow architecture.
- Exclusion reasons may be retained internally for diagnostics, but are not displayed in the selector.

## Recommended implementation breakdown

1. Define typed index, game-context, eligibility-constraint, and selector-output contracts with JSDoc.
2. Implement the page-scoped facade: initial snapshot, effective configuration, availability index, match summaries, and incremental allocation updates.
3. Implement pure token parsing, AND filtering, eligibility evaluation, sorting, and focused unit tests.
4. Implement the `RefereeSelector` popover with signals, `OnPush`, stable card tracking, keyboard/focus behavior, and the default-off release checkbox.
5. Integrate the selector into `game-referee-allocator` and preserve selection actions, highlighting, copy/paste, and persistence.
6. Update `/doc/changes/configure-allocation.md` and the relevant feature/page documentation to record that the configured limits are now consumed by manual selection.

## Recommended checks

- Test availability for total and partial part-day unavailability.
- Test adjacent slots, breaks, `playTime` summation, daily limits, and fragment-over-tournament configuration precedence.
- Test the extensible constraint pipeline and release mode independently from text/filter matching.
- Test AND semantics for ordinary words and special tokens, including combinations such as `L3S* Laurent`.
- Test incremental index updates after create, replace, and delete operations.
- Test keyboard activation, clear behavior, focus management, multi-selection styling, and empty state.
- Run the frontend typecheck/build and the relevant unit-test suites; verify no Firestore request is made for widget filtering or sorting.

## Technical findings and proposed implementation

Verified code facts:

- `frontend/src/component/game-referee-allocator.component.ts` currently owns the per-position selection and calls `GameAttendeeAllocationService` for create, update, and delete operations.
- `frontend/src/page/tournament-referees-allocation.page.ts` already loads tournament referees once, transforms them with `toSearchableReferees`, loads games and allocations, and passes the same referee array to every allocator instance.
- `GameView` already contains per-game referee allocation views, while the page currently reconstructs them from `GameAttendeeAllocation` records.
- `SelectionService` already exposes the primary selection and allocation actions used by the page and allocator.

Recommended implementation shape:

- Keep period-wide referee/match state owned by a dedicated facade service scoped to the allocation page, so every cell shares one immutable snapshot and one update path.
- Introduce a pure, typed `RefereeSelectorViewModel`/index builder and pure filter-token parser. Use Angular signals and `computed()` for transient widget state and visible-card derivation.
- Keep the custom selector presentation focused: it receives the current context and index and emits a selection intent. It must not read Firestore or directly mutate allocation views.
- Use a single allocation-update callback at `game-referee-allocator`/page level to preserve existing persistence, selection actions, and optimistic in-memory updates.
- Implement eligibility as a typed pipeline of pure constraint evaluators. Each evaluator receives the current game context, referee index entry, allocation snapshot, and effective configuration, and returns either an eligible result or a machine-readable exclusion reason. The facade composes the evaluators and exposes only eligible entries to the selector while retaining reasons for diagnostics and future UI use.
- Apply the eligibility pipeline only when the release-constraints checkbox is disabled; keep the regular search, explicit filters, and sorting pipeline active in both modes.
- Use `OnPush`, stable IDs in `@for`, pre-normalized lowercase search strings, and a single filtering/sorting pass per state change. At 300 referees, this is expected to remain comfortably within interactive latency; virtual scrolling is optional and should be added only if real match-card volume requires it.

Validated technical decision: the period-wide referee/match index is held by a dedicated facade service scoped to the allocation page. This improves separation and testability while avoiding a global cache that could retain data from another tournament.

Validated data-maintenance decision: the facade maintains a normalized index with incremental updates. Each referee has an indexed collection of compact period-match view models; an allocation change updates only the affected referee and match entries rather than rebuilding the complete period snapshot.

## Open decisions

No blocking decisions remain. The exact visual treatment of loading and persistence errors is intentionally delegated to existing page conventions; it does not affect the proposed contracts or performance model.
