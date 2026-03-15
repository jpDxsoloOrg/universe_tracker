# Plan: Simplify to single-user admin model

**GitHub issue:** #2 — [Simplify to single-user admin model](https://github.com/jpDxsoloOrg/universe_tracker/issues/2)

## Context

The current system has 4 Cognito user groups (Admin, Moderator, Wrestler, Fantasy) with role-based access. The Universe Tracker only needs a single admin user. All multi-user features (fantasy, challenges, promos, self-service profiles, user management) must be removed.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| After implementation | code-reviewer | Review for leftover references to removed features |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2+3 in parallel → Step 4 → Step 5
- **Agent types**:
  - Step 1: `generalPurpose` (remove fantasy backend + frontend)
  - Step 2: `generalPurpose` (remove challenges backend + frontend)
  - Step 3: `generalPurpose` (remove promos backend + frontend)
  - Step 4: `generalPurpose` (remove user management, my profile, Cognito groups)
  - Step 5: `generalPurpose` (cleanup references, verify build)

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/functions/fantasy/` | Delete directory | Remove all fantasy Lambda functions and tests |
| `backend/functions/challenges/` | Delete directory | Remove all challenge Lambda functions and tests |
| `backend/functions/promos/` | Delete directory | Remove all promo Lambda functions and tests |
| `backend/functions/players/getMyProfile.ts` | Delete | Remove self-service profile endpoint |
| `backend/functions/players/updateMyProfile.ts` | Delete | Remove self-service profile endpoint |
| `backend/functions/players/handler.ts` | Modify | Remove routes for `/players/me` |
| `backend/functions/auth/postConfirmation.ts` | Delete | Remove Cognito post-confirmation trigger |
| `backend/serverless.yml` | Modify | Remove fantasy/challenges/promos/users functions, DynamoDB tables (FantasyConfig, WrestlerCosts, FantasyPicks, Challenges, Promos), Cognito groups (Moderator, Wrestler, Fantasy), postConfirmation trigger |
| `frontend/src/components/fantasy/` | Delete directory | Remove all fantasy UI components |
| `frontend/src/components/challenges/` | Delete directory | Remove all challenge UI components |
| `frontend/src/components/promos/` | Delete directory | Remove all promo UI components |
| `frontend/src/components/profile/` | Delete directory | Remove wrestler profile components |
| `frontend/src/components/auth/Signup.tsx` | Delete | Remove self-registration (only admin login needed) |
| `frontend/src/components/admin/FantasyConfig.tsx` | Delete | Remove fantasy admin config |
| `frontend/src/components/admin/FantasyConfig.css` | Delete | Remove fantasy admin styles |
| `frontend/src/components/admin/ManageFantasyShows.tsx` | Delete | Remove fantasy shows admin |
| `frontend/src/components/admin/ManageFantasyShows.css` | Delete | Remove fantasy shows admin styles |
| `frontend/src/components/admin/AdminChallenges.tsx` | Delete | Remove challenges admin |
| `frontend/src/components/admin/AdminChallenges.css` | Delete | Remove challenges admin styles |
| `frontend/src/components/admin/AdminPromos.tsx` | Delete | Remove promos admin |
| `frontend/src/components/admin/AdminPromos.css` | Delete | Remove promos admin styles |
| `frontend/src/components/admin/ManageUsers.tsx` | Delete | Remove user management admin |
| `frontend/src/components/admin/ManageUsers.css` | Delete | Remove user management admin styles |
| `frontend/src/services/api/fantasy.api.ts` | Delete | Remove fantasy API client |
| `frontend/src/services/api/challenges.api.ts` | Delete | Remove challenges API client |
| `frontend/src/services/api/profile.api.ts` | Delete | Remove profile API client |
| `frontend/src/services/api/users.api.ts` | Delete | Remove users API client |
| `frontend/src/types/index.ts` | Modify | Remove fantasy, challenge, promo, and profile-related type definitions |
| `frontend/src/components/admin/AdminPanel.tsx` | Modify | Remove links/routes to deleted admin pages |
| `frontend/src/i18n/locales/en.json` | Modify | Remove translation keys for deleted features |
| `frontend/src/i18n/locales/de.json` | Modify | Remove translation keys for deleted features |
| `frontend/src/App.tsx` (or router config) | Modify | Remove routes for fantasy, challenges, promos, profile, signup |

## Implementation steps

### Step 1: Remove Fantasy system (backend + frontend)

1. Delete the entire `backend/functions/fantasy/` directory.
2. Delete the entire `frontend/src/components/fantasy/` directory.
3. Delete `frontend/src/services/api/fantasy.api.ts`.
4. Delete `frontend/src/components/admin/FantasyConfig.tsx`, `FantasyConfig.css`, `ManageFantasyShows.tsx`, `ManageFantasyShows.css` and their tests.
5. Remove fantasy-related function definitions from `backend/serverless.yml` (the `fantasy` function and all its HTTP events).
6. Remove DynamoDB table definitions for `FantasyConfig`, `WrestlerCosts`, `FantasyPicks` from `backend/serverless.yml`.

### Step 2: Remove Challenges system (backend + frontend)

1. Delete the entire `backend/functions/challenges/` directory.
2. Delete the entire `frontend/src/components/challenges/` directory.
3. Delete `frontend/src/services/api/challenges.api.ts`.
4. Delete `frontend/src/components/admin/AdminChallenges.tsx` and `AdminChallenges.css`.
5. Remove challenges-related function definitions from `backend/serverless.yml`.
6. Remove `Challenges` DynamoDB table definition from `backend/serverless.yml`.

### Step 3: Remove Promos system (backend + frontend)

1. Delete the entire `backend/functions/promos/` directory.
2. Delete the entire `frontend/src/components/promos/` directory.
3. Delete `frontend/src/components/admin/AdminPromos.tsx` and `AdminPromos.css`.
4. Remove promos-related function definitions from `backend/serverless.yml`.
5. Remove `Promos` DynamoDB table definition from `backend/serverless.yml`.

### Step 4: Remove user management, my profile, and extra Cognito groups

1. Delete `backend/functions/players/getMyProfile.ts` and `updateMyProfile.ts`.
2. Update `backend/functions/players/handler.ts` to remove `/players/me` routes.
3. Delete `backend/functions/auth/postConfirmation.ts` and its test.
4. Remove the `users` function and `postConfirmation` function from `backend/serverless.yml`.
5. Remove Cognito user groups `ModeratorGroup`, `WrestlerGroup`, `FantasyGroup` from `backend/serverless.yml` (keep `AdminGroup` only).
6. Delete `frontend/src/components/admin/ManageUsers.tsx`, `ManageUsers.css`, and tests.
7. Delete `frontend/src/services/api/users.api.ts` and `frontend/src/services/api/profile.api.ts`.
8. Delete `frontend/src/components/profile/` directory.
9. Delete `frontend/src/components/auth/Signup.tsx` and its test (keep `Login.tsx` for admin login).

### Step 5: Cleanup references and verify

1. Update `frontend/src/types/index.ts` — remove all fantasy, challenge, promo, profile types. Fix the duplicate Dashboard type declarations.
2. Update `frontend/src/components/admin/AdminPanel.tsx` — remove links and routes to deleted admin pages.
3. Update router/App.tsx — remove routes for fantasy, challenges, promos, profile, signup.
4. Update navigation components — remove nav links for deleted features.
5. Clean up `frontend/src/i18n/locales/en.json` and `de.json` — remove translation keys for deleted features.
6. Search for any remaining imports or references to deleted modules and fix them.
7. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit` to verify no TypeScript errors.
8. Run `cd backend && npx tsc --project tsconfig.json --noEmit` to verify no TypeScript errors.
9. Run frontend and backend tests to verify nothing is broken.
