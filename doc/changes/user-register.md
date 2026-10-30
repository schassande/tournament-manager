# User registration form

Last updated: 2026-10-30

## Objective

Make the user registration page readable and clearly separate the two supported account creation methods: Google authentication and email/password authentication.

## Scope

### In scope

- Redesign `/user/create` as a readable, responsive form.
- Support Google-based account creation.
- Support email/password account creation.
- Collect country, gender, and short name in both creation modes.
- Collect first name, last name, email, and password in the email/password mode.
- Default gender to Male.

### Out of scope

- Changes to the user profile page after registration.
- Changes to tournament attendee creation.
- Changes to the Firebase Authentication providers themselves.

## Functional requirements

- The page shall expose two clearly identifiable creation modes:
  - Google authentication.
  - Email/password authentication.
- Email/password mode shall request first name, last name, email, and password.
- Both modes shall request country, gender, and short name; photo is not requested.
- Gender shall be initialized to Male (`M`).
- The form shall prevent submission while required data is invalid or a creation request is in progress.
- After email/password registration sends the verification email, the user shall be redirected to a dedicated `Account validation required` page.
- The account validation page shall explain that the verification link must be followed and provide a button navigating to `/user/login`.
- Existing verified-registration and Person creation/linking behavior shall remain compatible unless explicitly changed by this feature.

## Business rules

- A registered user is represented by a Firebase Authentication identity and a corresponding Person profile.
- The email/password flow must preserve the existing email verification requirement before the Person is finalized.
- Country selection must continue to provide the region required by the Person model.
- Gender values use the existing project values `M` and `F`.

## User interface and workflow

- The page shall present the two creation modes as vertically stacked radio buttons.
- The page shall use one action button labelled `Register` in email/password mode and `Register with google` in Google mode.
- The email/password mode shall display fields for first name, last name, email, password, country, gender, and short name.
- Clicking the Google action shall authenticate with Google, retrieve first name, last name, and email from the verified Google profile, keep those fields read-only, and create the user using country, gender, and short name from the form.
- Google mode shall not display the first name, last name, or email fields.
- The country field shall be initially suggested from the browser language region when it matches a configured country, and shall remain editable.
- Labels, spacing, field widths, validation messages, and the primary action shall be readable on desktop and mobile layouts.
- The form shall display a clear loading state and actionable errors.
- The account validation page shall be a separate route and shall not display the registration form.

## Data model and persistence

- The existing `Person` fields remain the target: `firstName`, `lastName`, `email`, `shortName`, `countryId`, `regionId`, `gender`, and `userAuthId`. The optional `photoUrl` field is not collected by this registration form.
- No new persisted field is required by this specification.
- Existing authentication, pending-registration, and attendee-linking persistence must be reused.

## Errors, validation, and permissions

- Required fields shall be validated before submission.
- Email/password mode shall validate email format and password constraints already enforced by the application.
- Authentication failures and duplicate/invalid account errors shall be shown without losing valid form data.
- Existing authorization rules for self-registration and Person creation remain unchanged.

## Compatibility and migration

- Existing accounts and Person documents require no migration.
- Existing `/user/login` Google and email/password login behavior must remain compatible with the revised registration flow.
- The new account validation route shall remain publicly accessible.
- Existing documentation in `doc/pages.md` and `doc/datamodel.md` must be reviewed and updated if the workflow or field behavior changes.

## Technical specifications

- Update `frontend/src/page/user-create.page.ts` and its template/styles, preserving Angular reactive forms and the existing `UserService` and `RegionService` contracts where possible.
- Reuse the existing Google authentication service path used by `UserLoginComponent`.
- Keep the form model explicit for mode-specific fields and common profile fields.
- Use the existing country list and region lookup rather than duplicating reference data.
- Add or update component tests for both modes, default gender, validation, loading, and error states.

## Acceptance criteria

- The registration page is visually readable and responsive.
- Users can select Google or email/password creation as distinct flows.
- Email/password creation asks for first name, last name, email, and password.
- Both flows ask for country, gender, and short name, with no photo field.
- Gender defaults to Male.
- Invalid submissions are rejected with visible validation feedback.
- Existing verification and Person-linking behavior remains functional.

### List of new tests

- Renders both creation modes and switches between them.
- Displays the correct fields for each mode.
- Initializes gender to `M`.
- Validates required fields and email/password constraints.
- Submits the email/password flow with the expected Person data.
- Submits the Google flow with the expected common profile data.
- Displays loading and authentication/creation errors.
- Redirects email/password registration to the account validation page and navigates to login from its button.

## Open decisions

- Decision: Google mode retrieves first name, last name, and email from the verified Google profile. These identity fields are read-only. The single Google action performs authentication and then user creation; country, gender, and short name remain form fields.

## Spec analysis

### Readiness

Ready for implementation

### Summary

The current `UserCreateComponent` uses a reactive form and now provides vertically stacked mode radios, a single mode-specific action button, and a Google workflow that retrieves immutable identity data before creating the Person.

### Verified impacts

| Area | Evidence | Expected impact |
|---|---|---|
| Frontend registration | `frontend/src/page/user-create.page.ts` | Split the UI into two readable creation modes and add the Google flow. |
| Authentication | `frontend/src/service/user.service.ts`, login Google flow | Reuse the existing Google provider path, prefill verified identity data, and preserve verification behavior. |
| Person model | `doc/datamodel.md` | Reuse existing fields; no schema migration expected. |
| Page documentation | `doc/pages.md` | Update the `/user/create` workflow description after the behavior is decided. |

### Remaining assumptions

- The existing `M`/`F` gender representation remains authoritative.
- Country remains required and continues to determine `regionId`.
- No new backend contract is required unless the current Google service cannot complete Person creation.

### Recommended implementation breakdown

1. Refactor the registration component into a responsive mode-based form.
2. Integrate Google authentication, profile prefill, and shared Person completion.
3. Add tests and update `doc/pages.md`.

### Recommended checks

- Verify the page at narrow and wide viewport sizes.
- Verify both authentication providers, repeated submission, and error recovery.
- Verify email verification and existing attendee linking after registration.
