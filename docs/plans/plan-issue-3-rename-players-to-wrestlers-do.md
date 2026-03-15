# Plan: Rename Players to Wrestlers

**GitHub issue:** #3 — [Rename Players to Wrestlers - standalone fictional entities](https://github.com/jpDxsoloOrg/universe_tracker/issues/3)

## Context

After removing multi-user features (#2), the "Player" concept no longer makes sense. Wrestlers are standalone fictional entities in a global pool - no real person name, email, or user account needed. `currentWrestler` field becomes just `name`. `userId` field is removed. `UserIdIndex` GSI is removed.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2+3 in parallel → Step 4
- **Agent types**:
  - Step 1: `general-purpose` (all backend changes)
  - Step 2: `general-purpose` (all frontend changes)
  - Step 3: `general-purpose` (documentation and wiki)
  - Step 4: `general-purpose` (verification and cleanup)

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/functions/players/` → `backend/functions/wrestlers/` | Rename dir + modify all files | Rename directory, update all player→wrestler refs |
| `backend/functions/matches/*.ts` + tests | Modify | playerId→wrestlerId in participants/winners/losers |
| `backend/functions/standings/*.ts` + tests | Modify | player→wrestler in standings |
| `backend/functions/championships/*.ts` + tests | Modify | champion refs |
| `backend/functions/tournaments/*.ts` + tests | Modify | participant refs |
| `backend/functions/dashboard/*.ts` + tests | Modify | player→wrestler |
| `backend/functions/contenders/*.ts` + tests | Modify | player→wrestler |
| `backend/functions/statistics/*.ts` + tests | Modify | player→wrestler |
| `backend/functions/rivalries/*.ts` | Modify | player→wrestler |
| `backend/functions/seasonAwards/*.ts` + tests | Modify | playerId→wrestlerId |
| `backend/functions/seasons/*.ts` + tests | Modify | player refs in season standings |
| `backend/functions/activity/*.ts` + tests | Modify | player→wrestler |
| `backend/functions/events/*.ts` + tests | Modify | participant refs |
| `backend/functions/admin/*.ts` + tests | Modify | seed data, clear, transfer |
| `backend/functions/divisions/*.ts` + tests | Modify | player→wrestler refs |
| `backend/functions/images/*.ts` + tests | Modify | if player refs exist |
| `backend/functions/docs/docsEmbed.generated.ts` | Modify | OpenAPI schema |
| `backend/lib/dynamodb.ts` | Modify | PLAYERS→WRESTLERS table name |
| `backend/serverless.yml` | Modify | Table, env vars, functions, routes, GSI removal |
| `backend/scripts/*.ts` | Modify | seed/clear/create-tables |
| `frontend/src/types/index.ts` | Modify | Player→Wrestler, remove userId/currentWrestler |
| `frontend/src/types/contender.ts` | Modify | playerId→wrestlerId |
| `frontend/src/types/event.ts` | Modify | playerId→wrestlerId |
| `frontend/src/types/statistics.ts` | Modify | playerId→wrestlerId |
| `frontend/src/services/api/players.api.ts` → `wrestlers.api.ts` | Rename + modify | Rename file, update endpoints |
| `frontend/src/services/api/index.ts` | Modify | playersApi→wrestlersApi export |
| `frontend/src/services/__tests__/*.test.ts` | Modify | Update API test refs |
| `frontend/src/components/admin/ManagePlayers.tsx` → `ManageWrestlers.tsx` | Rename + modify | Rename component |
| `frontend/src/components/admin/ManagePlayers.css` → `ManageWrestlers.css` | Rename | CSS file |
| `frontend/src/components/admin/AdminPanel.tsx` | Modify | Menu item, import |
| `frontend/src/components/admin/ScheduleMatch.tsx` | Modify | Participant refs |
| `frontend/src/components/admin/RecordResult.tsx` | Modify | Winner/loser refs |
| `frontend/src/components/admin/CreateTournament.tsx` | Modify | Participant refs |
| `frontend/src/components/admin/ManageChampionships.tsx` | Modify | Champion refs |
| `frontend/src/components/admin/ManageSeasonAwards.tsx` | Modify | Award winner refs |
| `frontend/src/components/admin/MatchCardBuilder.tsx` | Modify | Participant refs |
| All frontend admin `__tests__/` | Modify | Update test refs |
| `frontend/src/components/Standings.tsx` + test | Modify | Player→Wrestler |
| `frontend/src/components/Dashboard.tsx` + test | Modify | Player→Wrestler |
| `frontend/src/components/Championships.tsx` + test | Modify | Player→Wrestler |
| `frontend/src/components/Tournaments.tsx` + test | Modify | Player→Wrestler |
| `frontend/src/components/MatchSearch.tsx` + test | Modify | Player→Wrestler |
| `frontend/src/components/PlayerHoverCard.tsx` → `WrestlerHoverCard.tsx` | Rename + modify | Component rename |
| `frontend/src/components/PlayerHoverCard.css` → `WrestlerHoverCard.css` | Rename | CSS file |
| `frontend/src/components/SeasonAwardsPage.tsx` | Modify | Player→Wrestler |
| `frontend/src/components/statistics/*.tsx` + tests | Modify | PlayerStats→WrestlerStats etc. |
| `frontend/src/components/contenders/*.tsx` + tests | Modify | Player→Wrestler |
| `frontend/src/components/events/*.tsx` | Modify | Player→Wrestler |
| `frontend/src/hooks/usePlayerStats.ts` → `useWrestlerStats.ts` | Rename + modify | Hook rename |
| `frontend/src/App.tsx` + test | Modify | Routes, imports |
| `frontend/src/config/navConfig.ts` | Modify | Nav labels |
| `frontend/src/contexts/AuthContext.tsx` + test | Modify | If player refs |
| `frontend/src/mocks/*.ts` | Modify | Mock data |
| `frontend/src/i18n/locales/en.json` | Modify | Translation keys |
| `frontend/src/i18n/locales/de.json` | Modify | Translation keys |
| `CLAUDE.md` | Modify | All player→wrestler documentation |
| `README.md` | Modify | Player→Wrestler |
| `frontend/public/wiki/*.md` | Modify | Wiki articles |
| `frontend/public/wiki/de/*.md` | Modify | German wiki articles |
| `frontend/public/wiki/index.json` | Modify | Wiki index |
| `e2e/` files | Modify | E2E test refs |

## Implementation steps

### Step 1: All backend changes

Rename the entire Player domain to Wrestler across the backend. This is a comprehensive rename affecting ~60+ files.

**Directory rename:**
1. Copy `backend/functions/players/` to `backend/functions/wrestlers/` and delete the old directory.

**Core rename rules (apply everywhere under backend/):**
- `playerId` → `wrestlerId` (variable names, DynamoDB keys, path params, function params)
- `Player` → `Wrestler` (type names, interfaces, comments)
- `player` → `wrestler` (variable names, object keys, string literals, comments)
- `players` → `wrestlers` (variable names, array names, route paths, table refs)
- `PLAYERS` → `WRESTLERS` (env var names, constants)
- `PlayersTable` → `WrestlersTable` (CloudFormation resource name)

**Field changes in Wrestler entity:**
- Remove `userId` field from create/update/seed
- Remove `currentWrestler` field — the `name` field IS the wrestler identity
- Add optional fields to Wrestler type: `nickname?: string`, `finisher?: string`, `weight?: string`, `height?: string`, `hometown?: string`, `alignment?: 'face' | 'heel' | 'tweener'`

**Specific files:**
1. `backend/functions/wrestlers/` (was players/): handler.ts, getPlayers→getWrestlers, createPlayer→createWrestler, updatePlayer→updateWrestler, deletePlayer→deleteWrestler, getPlayerStatistics→getWrestlerStatistics. Update routes: `/players`→`/wrestlers`, `/players/{playerId}`→`/wrestlers/{wrestlerId}`.
2. `backend/functions/matches/` (scheduleMatch, recordResult, getMatches, handler + all tests): participants/winners/losers are wrestlerId arrays.
3. `backend/functions/standings/getStandings.ts` + tests: `players: Player[]` → `wrestlers: Wrestler[]`.
4. `backend/functions/championships/` + tests: `currentChampion` stays but is wrestlerId.
5. `backend/functions/tournaments/` + tests: participants are wrestlerIds.
6. `backend/functions/dashboard/getDashboard.ts` + tests: `totalPlayers`→`totalWrestlers`, `mostWinsPlayer`→`mostWinsWrestler`.
7. `backend/functions/contenders/` + tests: playerId→wrestlerId.
8. `backend/functions/statistics/` + tests: playerId→wrestlerId, player→wrestler.
9. `backend/functions/rivalries/` : playerId→wrestlerId.
10. `backend/functions/seasonAwards/` + tests: playerId→wrestlerId, playerName→wrestlerName.
11. `backend/functions/seasons/deleteSeason.ts` + tests: playerId refs in SeasonStandings.
12. `backend/functions/activity/getActivity.ts` + tests: player→wrestler.
13. `backend/functions/events/` + tests: player→wrestler.
14. `backend/functions/admin/seedData.ts`: create wrestlers, remove userId/currentWrestler. `clearAll.ts`: WRESTLERS table. `dataTransferConfig.ts`: Players→Wrestlers dataset.
15. `backend/functions/divisions/` + tests: player→wrestler.
16. `backend/functions/docs/docsEmbed.generated.ts`: update OpenAPI schema.
17. `backend/lib/dynamodb.ts`: `PLAYERS: process.env.PLAYERS_TABLE!` → `WRESTLERS: process.env.WRESTLERS_TABLE!`
18. `backend/serverless.yml`: env var `PLAYERS_TABLE`→`WRESTLERS_TABLE`, function `players`→`wrestlers`, handler path `functions/wrestlers/handler.handler`, HTTP paths `/players`→`/wrestlers`, DynamoDB resource `PlayersTable`→`WrestlersTable`, REMOVE `UserIdIndex` GSI and `userId` attribute def, update IAM refs.
19. `backend/scripts/seed-data.ts`, `clear-data.ts`, `create-tables.ts`: update table/field refs.

**Important:** The `SeasonStandings` table has `playerId` as sort key. Rename it to `wrestlerId` in code references but note that the DynamoDB attribute name in the table definition also needs updating. The `PlayerIndex` GSI on SeasonStandings should be renamed to `WrestlerIndex`.

### Step 2: All frontend changes

Rename the entire Player domain to Wrestler across the frontend. This affects ~80+ files.

**File renames:**
1. `frontend/src/services/api/players.api.ts` → `wrestlers.api.ts`
2. `frontend/src/components/admin/ManagePlayers.tsx` → `ManageWrestlers.tsx`
3. `frontend/src/components/admin/ManagePlayers.css` → `ManageWrestlers.css`
4. `frontend/src/components/PlayerHoverCard.tsx` → `WrestlerHoverCard.tsx`
5. `frontend/src/components/PlayerHoverCard.css` → `WrestlerHoverCard.css`
6. `frontend/src/components/statistics/PlayerStats.tsx` → `WrestlerStats.tsx`
7. `frontend/src/components/statistics/PlayerStats.css` → `WrestlerStats.css`
8. `frontend/src/components/statistics/PlayerStatsContent.tsx` → `WrestlerStatsContent.tsx`
9. `frontend/src/components/statistics/EmbeddedPlayerStats.tsx` → `EmbeddedWrestlerStats.tsx`
10. `frontend/src/hooks/usePlayerStats.ts` → `useWrestlerStats.ts`
11. Any test files for the above (rename accordingly)

**Core rename rules (apply everywhere under frontend/src/):**
- `playerId` → `wrestlerId`
- `Player` → `Wrestler` (types, component names)
- `player` → `wrestler` (variables, props)
- `players` → `wrestlers` (arrays, route paths)
- `playersApi` → `wrestlersApi`
- `ManagePlayers` → `ManageWrestlers`
- `PlayerHoverCard` → `WrestlerHoverCard`
- `PlayerStats` → `WrestlerStats`
- `usePlayerStats` → `useWrestlerStats`

**Type changes in `frontend/src/types/index.ts`:**
- Rename `Player` → `Wrestler`
- `playerId: string` → `wrestlerId: string`
- Remove `userId?: string`
- Remove `currentWrestler: string`
- Add: `nickname?: string`, `finisher?: string`, `weight?: string`, `height?: string`, `hometown?: string`, `alignment?: 'face' | 'heel' | 'tweener'`
- In `Standings` interface: `players: Player[]` → `wrestlers: Wrestler[]`
- In `RoundRobinStanding`: `playerId` → `wrestlerId`
- In `DashboardChampion`: `playerId` → `wrestlerId`
- In `DashboardQuickStats`: `totalPlayers` → `totalWrestlers`, `mostWinsPlayer` → `mostWinsWrestler`
- In `SeasonAward`: `playerId` → `wrestlerId`, `playerName` → `wrestlerName`
- In `MatchFilters`: `playerId` → `wrestlerId`

**Also update:**
- `frontend/src/types/contender.ts` - playerId→wrestlerId
- `frontend/src/types/event.ts` - playerId→wrestlerId
- `frontend/src/types/statistics.ts` - playerId→wrestlerId, PlayerStats→WrestlerStats

**API service layer:**
- Rename `players.api.ts` → `wrestlers.api.ts`
- Change all endpoint paths from `/players` to `/wrestlers`
- Rename exported object from `playersApi` to `wrestlersApi`
- Update `frontend/src/services/api/index.ts` to export `wrestlersApi`

**i18n translations:**
- `frontend/src/i18n/locales/en.json`: Rename all "player"/"Player" translation keys and values to "wrestler"/"Wrestler". Keys like `player`, `player1`, `player2`, `playerStats`, `loadingPlayers`, `noPlayersFound`, `createFirstPlayer`, etc.
- `frontend/src/i18n/locales/de.json`: Same renames. German "Spieler" can stay as-is where it already means "player" in a wrestling context, or change to "Wrestler" to match the English term.

**Components (all under frontend/src/components/):**
- Update imports, type annotations, variable names, JSX text, route paths
- Remove `currentWrestler` field from ManageWrestlers form - `name` IS the wrestler name
- Update all mock data in test files

**Hooks:**
- `usePlayerStats` → `useWrestlerStats`: rename hook, params, return types

**Config/routing:**
- `navConfig.ts`: update menu labels
- `App.tsx`: update route paths and imports

**Mocks:**
- `contenderMockData.ts`, `eventMockData.ts`: update playerId→wrestlerId

### Step 3: Documentation and wiki updates

1. `CLAUDE.md`: Update all player→wrestler references in Data Model, API Endpoints, Common Tasks, Code Examples, Troubleshooting sections.
2. `README.md`: Update project description and examples.
3. Wiki articles under `frontend/public/wiki/`: Update all markdown files with wrestler terminology.
4. Wiki articles under `frontend/public/wiki/de/`: Same for German.
5. `frontend/public/wiki/index.json`: Update slugs/titles if needed.
6. `e2e/` files: Update any player references.
7. `backend/docs/openapi.yaml`: Update Player→Wrestler schema, /players→/wrestlers paths.

### Step 4: Verification and cleanup

1. Search entire codebase for remaining `player`/`Player`/`PLAYER` references (excluding node_modules, .git, docs/plans).
2. Fix any remaining references.
3. Run `cd backend && npx tsc --project tsconfig.json --noEmit`.
4. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`.
5. Run backend tests: `cd backend && npm test`.
6. Run frontend tests: `cd frontend && npm test`.
7. Fix any failures.

## Dependencies and order

- Steps 1, 2, and 3 have **no file overlap** and can run in parallel.
- Step 4 depends on Steps 1+2+3 completing.

**Suggested order:** Steps 1+2+3 → Step 4

## Testing and verification

- TypeScript compilation passes (both frontend and backend)
- All existing tests pass (with updated assertions)
- No remaining "player"/"Player" references in code (excluding docs/plans, node_modules)
- API routes use `/wrestlers` instead of `/players`
- `Wrestler` type has no `userId` or `currentWrestler` fields

## Risks and edge cases

- **DynamoDB sort key rename**: SeasonStandings uses `playerId` as SK. Code references must change to `wrestlerId` but existing data in DynamoDB would still use old attribute name. Since we haven't deployed yet, this is safe.
- **Import cycle**: Renaming files may create stale imports. TypeScript compiler will catch these.
- **i18n key changes**: Must update all translation references in components simultaneously with the key renames.
- **Test mock data**: Many tests have hardcoded player objects that need field updates.
