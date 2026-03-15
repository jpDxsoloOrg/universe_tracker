# Plan: Rename Players to Wrestlers - standalone fictional entities

**GitHub issue:** #3 — [Rename Players to Wrestlers - standalone fictional entities](https://github.com/jpDxsoloOrg/universe_tracker/issues/3)

## Context

After removing multi-user features (#2), the "Player" concept no longer makes sense. Wrestlers are standalone fictional entities in a global pool. They don't need a real person's name, email, or user account. The `currentWrestler` field becomes just `name`. The `userId` field is removed.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| After implementation | code-reviewer | Review the rename for completeness |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Step 1 → Steps 2+3 in parallel → Step 4
- **Agent types**:
  - Step 1: `generalPurpose` (backend data model + Lambda functions)
  - Step 2: `generalPurpose` (frontend types, API, components)
  - Step 3: `generalPurpose` (serverless.yml, i18n, seed data)
  - Step 4: `generalPurpose` (verify full rename, build, tests)

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/functions/players/` | Rename to `backend/functions/wrestlers/` | Rename directory |
| `backend/functions/players/*.ts` | Modify all | Rename Player→Wrestler, playerId→wrestlerId, remove userId |
| `backend/functions/standings/getStandings.ts` | Modify | Update player references to wrestler |
| `backend/functions/matches/*.ts` | Modify | Update participant references from playerId to wrestlerId |
| `backend/functions/championships/*.ts` | Modify | Update champion references |
| `backend/functions/tournaments/*.ts` | Modify | Update participant references |
| `backend/functions/dashboard/*.ts` | Modify | Update player references |
| `backend/functions/contenders/*.ts` | Modify | Update player references |
| `backend/functions/statistics/*.ts` | Modify | Update player references |
| `backend/functions/rivalries/*.ts` | Modify | Update player references |
| `backend/lib/dynamodb.ts` | Modify | Update table name references |
| `backend/serverless.yml` | Modify | Rename Players table to Wrestlers, remove UserIdIndex GSI, update function names and paths, update SeasonStandings references |
| `frontend/src/types/index.ts` | Modify | Rename Player→Wrestler interface, remove userId/currentWrestler |
| `frontend/src/services/api/players.api.ts` | Rename + Modify | Rename to wrestlers.api.ts, update endpoints |
| `frontend/src/components/admin/ManagePlayers.tsx` | Rename + Modify | Rename to ManageWrestlers.tsx |
| `frontend/src/components/Standings.tsx` | Modify | Update player references to wrestler |
| `frontend/src/components/Matches.tsx` | Modify | Update player references |
| `frontend/src/components/Championships.tsx` | Modify | Update references |
| `frontend/src/components/Tournaments.tsx` | Modify | Update references |
| `frontend/src/i18n/locales/en.json` | Modify | Rename player translation keys to wrestler |
| `frontend/src/i18n/locales/de.json` | Modify | Rename player translation keys to wrestler |
| `backend/scripts/seed-data.ts` | Modify | Create wrestlers instead of players |

## Implementation steps

### Step 1: Backend data model and Lambda functions

1. Rename `backend/functions/players/` directory to `backend/functions/wrestlers/`.
2. In all files under `backend/functions/wrestlers/`:
   - Rename `playerId` → `wrestlerId` in all variables, params, and DynamoDB keys.
   - Rename `Player` → `Wrestler` in all type references.
   - Remove `userId` field and `UserIdIndex` GSI references.
   - Replace `currentWrestler` field with just `name` (the wrestler's character name is the primary identifier).
   - Add new optional fields: `nickname`, `finisher`, `weight`, `height`, `hometown`, `alignment` (face/heel/tweener).
   - Update table name constant from `PlayersTable` to `WrestlersTable`.
3. Update `backend/functions/standings/getStandings.ts` — rename all player→wrestler references.
4. Update `backend/functions/matches/` — rename participant `playerId` → `wrestlerId` in all match functions.
5. Update `backend/functions/championships/` — rename champion references.
6. Update `backend/functions/tournaments/` — rename participant references.
7. Update `backend/functions/dashboard/`, `contenders/`, `statistics/`, `rivalries/` — rename player→wrestler.
8. Update `backend/lib/dynamodb.ts` — update table name helpers.
9. Update `backend/functions/seasons/` — rename player references in season standings.

### Step 2: Frontend types, API, and components

1. In `frontend/src/types/index.ts`:
   - Rename `Player` interface to `Wrestler`.
   - Remove `userId` and `currentWrestler` fields.
   - Add `nickname?: string`, `finisher?: string`, `weight?: string`, `height?: string`, `hometown?: string`, `alignment?: 'face' | 'heel' | 'tweener'`.
   - Rename `playerId` → `wrestlerId` in all interfaces that reference it (Match, SeasonStanding, etc.).
2. Rename `frontend/src/services/api/players.api.ts` to `wrestlers.api.ts`.
   - Update all endpoint paths from `/players` to `/wrestlers`.
   - Rename exported API object from `playersApi` to `wrestlersApi`.
3. Rename `frontend/src/components/admin/ManagePlayers.tsx` to `ManageWrestlers.tsx` (and CSS).
   - Update all internal player→wrestler references.
   - Remove `currentWrestler` field from form — the `name` field IS the wrestler name.
4. Update `frontend/src/components/Standings.tsx` — use `wrestler` terminology.
5. Update `frontend/src/components/Matches.tsx` — use `wrestler` terminology.
6. Update `frontend/src/components/Championships.tsx` — use `wrestler` terminology.
7. Update `frontend/src/components/Tournaments.tsx` — use `wrestler` terminology.
8. Update `frontend/src/components/admin/AdminPanel.tsx` — update link text and routes.
9. Update `frontend/src/components/admin/ScheduleMatch.tsx` and `RecordResult.tsx` — wrestler references.
10. Update router/App.tsx — update any `/players` routes to `/wrestlers` if exposed.

### Step 3: Infrastructure, i18n, and seed data

1. Update `backend/serverless.yml`:
   - Rename `PlayersTable` resource to `WrestlersTable`.
   - Remove `UserIdIndex` GSI.
   - Update environment variable from `PLAYERS_TABLE` to `WRESTLERS_TABLE`.
   - Rename Lambda function and API paths from `players` to `wrestlers`.
   - Update `SeasonStandingsTable` references if they use `playerId` in sort key (keep as `playerId` in DynamoDB but map in code, or rename to `wrestlerId`).
2. Update `frontend/src/i18n/locales/en.json` — rename all `player`/`players` keys to `wrestler`/`wrestlers`.
3. Update `frontend/src/i18n/locales/de.json` — same rename with German translations (Spieler → Wrestler).
4. Update `backend/scripts/seed-data.ts` — create wrestlers instead of players, use new field names.
5. Update `backend/scripts/clear-data.ts` — reference Wrestlers table.

### Step 4: Verify rename completeness

1. Search entire codebase for remaining `player`/`Player` references (excluding git, node_modules, docs/plans).
2. Fix any remaining references found.
3. Run `cd backend && npx tsc --project tsconfig.json --noEmit`.
4. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`.
5. Run backend and frontend tests.
6. Verify seed data script works with new table/field names.
