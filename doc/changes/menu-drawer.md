# Menu drawer

Last updated: 2026-09-02

## Objective

Replace the current popup menu and the user popup menu with one PrimeNG drawer opened from the top-left menu icon. The drawer must be easier to read and faster to use because all available entries are displayed in one vertical list without nested submenus.

The top toolbar must be simplified: it contains only the menu icon on the left and the page title in the center. The user identity and authentication actions move into the drawer.

## Scope

### In scope

- Replace the current popup/tiered main menu with a drawer.
- Display menu entries as a single-level vertical list.
- Move the current user identity and authentication actions into the drawer.
- Make tournament-related entries depend on the selected tournament, enabled modules, and the current user's rights.
- Preserve the existing destinations and labels unless this specification explicitly changes them.

### Out of scope

- Changing authentication, tournament persistence, or route guards.
- Adding new tournament features or changing the behavior of existing pages.
- Designing a new permission model.

## Functional requirements

- The menu icon currently displayed at the top left opens a PrimeNG drawer.
- The drawer contains no interactive nested submenu. Every visible destination entry is directly selectable.
- The drawer is dynamically rebuilt when the connection state, selected tournament, enabled tournament modules, or effective user rights change.
- Selecting a menu entry navigates to its existing route and closes the drawer.
- Entries that are not available to the current user must not be displayed. Route guards remain the final security boundary.
- The drawer must remain usable with keyboard navigation and expose meaningful labels to assistive technologies.

## Business rules

- Global entries are independent of the selected tournament.
- Tournament entries are displayed only when a tournament is selected.
- A tournament entry is displayed only when its required module is enabled and the current user has the required right.
- A missing module configuration means that the module is not enabled, except where an existing page is explicitly part of the core tournament workflow.
- The current implementation uses `Tournament.enablesModules` for module flags and tournament attendee properties/roles for tournament rights. The implementation must not infer a right solely from the presence of a route.
- The existing `AuthGuard` remains authoritative for authentication-protected routes.

## User interface and workflow

The drawer is organized into these areas, in order:

1. Global navigation.
2. Current tournament navigation.
3. User identity and authentication actions.

A visible separator line is displayed between each of these three major areas. The `Game` and `Referee` headings are visual subsections inside the current-tournament area and use indentation rather than major-area separators.

The user area is displayed at the bottom of the drawer. The last row displays the same user icon and display name currently shown in the toolbar. The first name and last name are displayed on separate lines to reduce the required drawer width. When no user is connected, the name is `Guest`.

When no user is connected, the user area displays `Register` followed by `Log in`, then the identity line. When a user is connected, it displays `Log out` followed by `My Account`, then the identity line.

When a user is connected, `My Account` links to the existing `/user/:id` page.

## Data model and persistence

No data-model or persistence change is required. The drawer reads:

- the selected tournament from `TournamentService`;
- the connection state and current person from `UserService`;
- tournament module flags from `Tournament.enablesModules`;
- tournament attendee roles and flags from the existing attendee services.

The drawer's open/closed state does not need to be persisted.

## Errors, validation, and permissions

- If a destination is not available because the selected tournament or user context disappeared, the entry must be hidden or disabled rather than navigating to an invalid URL.
- A user without the required tournament right must not see the corresponding entry.
- Authentication failures continue to use the existing login flow and error handling.
- Hiding an entry is a usability rule, not an authorization mechanism; protected routes and backend rules remain unchanged.

## Compatibility and migration

- Existing routes remain unchanged.
- Existing deep links remain supported.
- The current tiered-menu component and the user popup menu are replaced only at the UI level.
- Existing tournaments without `enablesModules` remain compatible. Core entries remain available according to the visibility proposal below; module-specific entries require an explicit enabled module.

## Acceptance criteria

- The top toolbar has no user name or avatar on the right.
- The top toolbar height is 48 px, which is 20% less than the previous 60 px height.
- The page title is centered on the full page width, independently of the menu icon.
- Clicking the top-left menu icon opens a drawer containing only one-level entries.
- The drawer displays `Register`, `Log in`, and `Guest` from top to bottom in the user area for a disconnected user.
- The drawer displays `Log out`, `My Account`, and the connected user's identity from top to bottom in the user area.
- The drawer has no header or close button and is 13.2 rem wide, which is 10% wider than the previous 12 rem width.
- Visible separator lines divide the user, global-navigation, and current-tournament areas.
- With no selected tournament, no current-tournament entry is displayed.
- With a selected tournament, each entry is displayed only when its module and right conditions are satisfied.
- Clicking any visible entry navigates to the corresponding existing route and closes the drawer.
- Keyboard and screen-reader users can identify and activate the drawer, its close control, and each visible entry.
- Existing route guards and deep links continue to work.

## Open decisions

- Confirm the visual grouping/separators and the exact drawer width.

## Proposed drawer content

This proposal is based on the current menu in `frontend/src/component/main-menu.component.ts`, the routes in `frontend/src/app/app.routes.ts`, the module flags in `persistent-data-model/src/tournament.ts`, and the attendee roles in `persistent-data-model/src/person.ts`.

### Global entries

| Label | Icon | Route | Visibility |
|---|---|---|---|
| Home | `pi pi-home` | `/home` | Always visible |
| Tournaments | `pi pi-list` | `/tournament` | Always visible |

### Current tournament entries

The tournament name is displayed as a direct entry to the tournament home page. It is visible only when a tournament is selected and the user can access that tournament.

Top-level entries:

| Label | Icon | Route | Required module | Required right |
|---|---|---|---|---|
| `<Tournament name>` | `pi pi-trophy` | `/tournament/:tournamentId/home` | Core | Authenticated tournament user, or public access if the existing route remains public |
| General config | `pi pi-cog` | `/tournament/:tournamentId/edit` | Core | `TournamentManager` |

#### Game

This subsection is always expanded. Its entries are displayed with a small right indentation (margin) relative to the top-level entries.

| Label | Icon | Route | Required module | Required right |
|---|---|---|---|---|
| Games | `pi pi-calendar` | `/tournament/:tournamentId/game` | Core | `TournamentManager`, `GameAllocator`, or `ResultManager` |
| Import FIT | `pi pi-download` | `/tournament/:tournamentId/fit-import` | `FIT_IMPORT` | `TournamentManager` or the FIT import permission, if one is introduced |

#### Referee

This subsection is always expanded. Its entries are displayed with a small right indentation (margin) relative to the top-level entries.

| Label | Icon | Route | Required module | Required right |
|---|---|---|---|---|
| Referees | `pi pi-users` | `/tournament/:tournamentId/referee` | Core | `TournamentManager` or a referee-management right |
| Coaches | `pi pi-users` | `/tournament/:tournamentId/coach` | Core | `TournamentManager` or a referee-coach-management right |
| Allocations | `pi pi-calendar` | `/tournament/:tournamentId/allocation` | Core | `TournamentManager` or `RefereeCoach` |
| Planning | `pi pi-calendar` | `/tournament/:tournamentId/referee-planning` | Core | All users |
| Upgrades | Existing upgrade icon | `/tournament/:tournamentId/referee-upgrade` | `UPGRADE` | `TournamentManager` or `RefereeCoach` |

These are visual subsections of the drawer, not collapsible or interactive submenus. The groups and all eligible entries are always expanded.

The existing `DRAW_DESIGNER` module and `/tournament/:tournamentId/draw-designer` route are not currently present in the menu. They should be added as a direct `Draw Designer` entry only if that route is considered part of this change; otherwise they remain out of scope.

### Visibility implementation note

The current code does not yet provide a complete reusable permission predicate for all menu entries: most current tournament entries are displayed whenever a tournament is selected, while `Upgrades` is conditionally displayed when the connected attendee has `isRefereeCoach`. The role mapping above is the validated target behavior, not a statement of current behavior. Where the table refers to a specialized management right that is not yet represented by a dedicated role, the implementation must use the closest existing role without introducing a new permission model; this is especially relevant for referee management, referee-coach management, and FIT import.
