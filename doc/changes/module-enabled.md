# Tournament module configuration

Last updated: 2026-09-02

## Objective

Allow users to enable or disable the available modules for an existing tournament from the tournament configuration page.

## Scope

### In scope

- Add a tab to the existing tournament configuration page for module configuration.
- Reproduce the module list displayed by the tournament creation wizard.
- Enable or disable modules for the current tournament.
- Apply the module incompatibility rules defined by the tournament wizard specification.
- Persist the selected modules in `Tournament.enablesModules`.

### Out of scope

- Adding new module types.
- Changing the module descriptions or the module-selection workflow in the tournament creation wizard.
- Implementing the functionality provided by any individual module.

## Functional requirements

- The tournament configuration page shall expose a dedicated module-configuration tab.
- The tab shall display the same module list as the Modules step of `doc/changes/tournament-wizard.md`.
- Each module shall be displayed with a PrimeNG checkbox, its feature name, and its description, using the same three-column presentation as the wizard.
- Changing a checkbox shall update the selected module list for the current tournament.
- The selected module list shall be persisted in `Tournament.enablesModules`.
- The module-selection rules shall remain consistent with the wizard:
  - `FIT_IMPORT` and `DRAW_DESIGNER` are mutually exclusive.
  - Selecting one of these modules shall automatically clear the other without an additional message.

## Business rules

- The available modules are:
  - `RANKING`
  - `UPGRADE`
  - `SCORECARD`
  - `DRAW_DESIGNER`
  - `ONLINE_WATER_CARRIER`
  - `PRINTED_WATER_CARRIER`
  - `AUTOMATIC_ALLOCATION`
  - `FIT_IMPORT`
- Module identifiers and persistence shall use the existing `ModulesNames` type and `Tournament.enablesModules` field.
- Users without access to `tournament-edit.page.ts` cannot access this tab.

## User interface and workflow

- The module tab shall be part of the existing tabs on `tournament-edit`.
- The module list shall use the names and descriptions defined in the tournament wizard.
- Existing persisted module selections shall be shown when the page is loaded.
- Missing `Tournament.enablesModules` shall be treated as an empty selection in the UI.
- The tab label shall be `Features`.
- Each checkbox change shall be saved immediately through the same workflow used by the other `tournament-edit` tabs; no dedicated Save/Cancel workflow is required.
- Save-failure feedback shall use the existing tournament configuration error workflow.

## Data model and persistence

- Reuse `Tournament.enablesModules?: ModulesNames[]`; no new persistence field is required.
- Updating the module selection shall persist the complete selected `ModulesNames[]` list for the tournament.
- The existing tournament persistence service and save workflow shall be reused where applicable.

## Errors, validation, and permissions

- A module update shall not persist an invalid state in which both `FIT_IMPORT` and `DRAW_DESIGNER` are selected.
- Persistence errors shall be surfaced according to the existing tournament configuration error workflow.
- No additional module-specific permission check is required inside the tab because access to the tournament configuration page already controls access.

## Compatibility and migration

- Existing tournaments without `enablesModules` shall remain readable and shall display no enabled modules.
- No data migration is required because `enablesModules` is optional.
- Existing tournament configuration tabs and workflows shall remain unchanged apart from adding the module tab.

## Acceptance criteria

- A user can open the tournament configuration page and access a module-configuration tab.
- The tab displays the same eight modules, names, descriptions, and checkbox behavior as the wizard's Modules step.
- Existing enabled modules are checked after loading the tournament.
- Disabling a module removes it from `Tournament.enablesModules` after the selected persistence workflow completes.
- Enabling a module adds it to `Tournament.enablesModules` after the selected persistence workflow completes.
- `FIT_IMPORT` and `DRAW_DESIGNER` cannot both remain selected.
- A tournament without `enablesModules` loads successfully with all module checkboxes cleared.
- Users without access to the tournament configuration page cannot access or persist module changes through this feature.
- Save failures are communicated without leaving the UI in a misleading persisted state.

## Open decisions

- None.

## Spec analysis

### Readiness

Ready for implementation

### Summary

The target page, module list, persisted field, incompatibility rule, immediate-save interaction, and access boundary are identified. No implementation-blocking decision remains.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend page | `frontend/src/page/tournament-edit.page.ts` | Add a tab and module-selection UI to the existing tournament configuration page. |
| Wizard behavior | `frontend/src/page/tournament-wizard.page.ts`, `frontend/src/page/tournament-wizard.page.html` | Reuse the eight module options, descriptions, and FIT/Draw Designer exclusivity behavior. |
| Shared model | `persistent-data-model/src/tournament.ts` | Reuse `ModulesNames` and optional `Tournament.enablesModules`; no schema addition is required. |
| Persistence | `frontend/src/page/tournament-edit.page.ts` and `TournamentService` save workflow | Persist the complete module list using the existing tournament save path. |
| Documentation | `doc/changes/tournament-wizard.md`, `/doc` | Keep the wizard and tournament-configuration documentation aligned; review user-visible workflow documentation after implementation. |

### Remaining assumptions

- The module tab belongs on `tournament-edit`, alongside General, Fields, Days, Divisions and teams, and Managers.
- `undefined` and an empty module list have the same meaning for display: no module is enabled.
- Access to the `tournament-edit` page is the authorization boundary for this feature.
- The wizard's current module definitions are authoritative unless the user decides otherwise.

### Recommended implementation breakdown

1. Extract or reuse a shared typed module-option definition so the wizard and edit page cannot diverge.
2. Add the module tab and display the persisted selection.
3. Implement the selected-module update and FIT/Draw Designer exclusivity behavior.
4. Persist the selection through the existing tournament save workflow.
5. Add tests and update the relevant documentation.

### Recommended checks

- Verify all eight module identifiers and descriptions match the wizard.
- Verify loading, enabling, disabling, and clearing an absent `enablesModules` field.
- Verify both directions of FIT/Draw Designer exclusivity.
- Verify the existing tournament-edit page access boundary and save/error workflow.

