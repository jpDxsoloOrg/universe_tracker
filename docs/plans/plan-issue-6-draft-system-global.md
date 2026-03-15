# Plan: Draft system - companies draft from global wrestler pool

**GitHub issue:** #6 — [Draft system - companies draft from global wrestler pool](https://github.com/jpDxsoloOrg/universe_tracker/issues/6)

## Context

Companies draft wrestlers from the global unassigned pool into their roster. The draft is an organized event where companies take turns picking wrestlers. Supports configurable rounds, manual or randomized order, and snake-style drafting (order reverses each round).

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| During implementation | test-engineer | Generate tests for draft logic |
| After implementation | code-reviewer | Review draft state machine and pick validation |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Step 1 → Steps 2+3 in parallel → Step 4
- **Agent types**:
  - Step 1: `generalPurpose` (backend data model + CRUD)
  - Step 2: `generalPurpose` (backend draft logic — start, pick, complete)
  - Step 3: `generalPurpose` (frontend draft management admin)
  - Step 4: `generalPurpose` (frontend draft board + live drafting UI)

## Files to create

| File | Purpose |
|------|---------|
| `backend/functions/drafts/handler.ts` | Router for draft endpoints |
| `backend/functions/drafts/getDrafts.ts` | GET /drafts |
| `backend/functions/drafts/getDraft.ts` | GET /drafts/{draftId} |
| `backend/functions/drafts/createDraft.ts` | POST /drafts |
| `backend/functions/drafts/updateDraft.ts` | PUT /drafts/{draftId} |
| `backend/functions/drafts/startDraft.ts` | POST /drafts/{draftId}/start |
| `backend/functions/drafts/makePick.ts` | POST /drafts/{draftId}/pick |
| `backend/functions/drafts/completeDraft.ts` | POST /drafts/{draftId}/complete |
| `frontend/src/components/admin/ManageDrafts.tsx` | Draft management list + create |
| `frontend/src/components/admin/ManageDrafts.css` | Styles |
| `frontend/src/components/admin/DraftBoard.tsx` | Live drafting interface |
| `frontend/src/components/admin/DraftBoard.css` | Styles |
| `frontend/src/services/api/drafts.api.ts` | Drafts API client |

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/serverless.yml` | Modify | Add Drafts + DraftPicks tables, Lambda function, API routes |
| `frontend/src/types/index.ts` | Modify | Add Draft, DraftPick interfaces |
| `frontend/src/components/admin/AdminPanel.tsx` | Modify | Add draft management link |
| `frontend/src/i18n/locales/en.json` | Modify | Add draft translation keys |
| `frontend/src/i18n/locales/de.json` | Modify | Add German translations |
| `frontend/src/App.tsx` | Modify | Add draft routes |

## Implementation steps

### Step 1: Backend data model and CRUD

1. Add DynamoDB tables to `serverless.yml`:
   - **DraftsTable**: PK `draftId`. Attributes: `name`, `status` (setup/active/completed), `type` ("global"), `participatingCompanyIds`, `rounds`, `currentRound`, `currentPickIndex`, `draftOrder` (array of companyIds), `snakeOrder` (boolean), `totalPicks`, `createdAt`, `updatedAt`.
   - **DraftPicksTable**: PK `draftId`, SK `pickNumber`. Attributes: `round`, `companyId`, `wrestlerId`, `wrestlerName` (denormalized for display), `pickedAt`. GSI: `CompanyPicksIndex` (companyId, draftId).
2. Create `backend/functions/drafts/handler.ts` using `createRouter`.
3. Create `getDrafts.ts` — scan DraftsTable, return all drafts sorted by createdAt desc.
4. Create `getDraft.ts` — get draft by ID, also query all picks from DraftPicksTable for this draft.
5. Create `createDraft.ts`:
   - Required: `name`, `participatingCompanyIds` (at least 2), `rounds`.
   - Optional: `snakeOrder` (default true), `draftOrder` (if not provided, randomize).
   - Validate all company IDs exist.
   - Set status to `setup`, currentRound to 0, currentPickIndex to 0.
6. Create `updateDraft.ts` — only allowed when status is `setup`. Update name, rounds, order, companies.

### Step 2: Backend draft logic (start, pick, complete)

1. Create `startDraft.ts`:
   - Validate draft is in `setup` status.
   - Set status to `active`, currentRound to 1, currentPickIndex to 0.
   - If no draftOrder set, randomize the participatingCompanyIds.
   - Calculate `totalPicks` = rounds × participatingCompanyIds.length.
2. Create `makePick.ts`:
   - Validate draft is `active`.
   - Determine whose turn it is based on `currentRound`, `currentPickIndex`, `draftOrder`, and `snakeOrder`.
   - Accept body: `{ wrestlerId: string }`.
   - Validate wrestler exists and has no `companyId` (is in global pool).
   - In a transaction:
     a. Create DraftPick record with sequential `pickNumber`.
     b. Update wrestler's `companyId` to the picking company.
     c. Advance `currentPickIndex`. If past end of round, increment `currentRound` and reset index (applying snake reversal if enabled).
     d. If all picks made (`pickNumber === totalPicks`), auto-set status to `completed`.
   - Return the pick and updated draft state.
3. Create `completeDraft.ts`:
   - Allow manual completion (e.g., ending draft early).
   - Set status to `completed`.

### Step 3: Frontend draft management

1. Add `Draft` and `DraftPick` interfaces to `frontend/src/types/index.ts`:
   ```typescript
   interface Draft {
     draftId: string;
     name: string;
     status: 'setup' | 'active' | 'completed';
     type: 'global' | 'inter-company';
     participatingCompanyIds: string[];
     rounds: number;
     currentRound: number;
     currentPickIndex: number;
     draftOrder: string[];
     snakeOrder: boolean;
     totalPicks: number;
     picks?: DraftPick[];
     createdAt: string;
     updatedAt: string;
   }
   interface DraftPick {
     draftId: string;
     pickNumber: number;
     round: number;
     companyId: string;
     wrestlerId: string;
     wrestlerName: string;
     pickedAt: string;
   }
   ```
2. Create `frontend/src/services/api/drafts.api.ts` with methods: getAll, getById, create, update, start, makePick, complete.
3. Create `frontend/src/components/admin/ManageDrafts.tsx`:
   - List all drafts with status badges.
   - Create draft form: name, select companies (multi-select), rounds, snake order toggle, manual order or randomize.
   - Actions per draft: Edit (setup only), Start, View Board, Complete.
4. Add admin nav link and route.

### Step 4: Frontend draft board (live drafting UI)

1. Create `frontend/src/components/admin/DraftBoard.tsx`:
   - **Draft grid**: Rows = rounds, columns = companies. Each cell shows the picked wrestler (or empty if not yet picked).
   - **Current pick indicator**: Highlight which company is currently picking.
   - **Available wrestlers panel**: List of all unassigned wrestlers. Search/filter by name.
   - **Pick action**: Click a wrestler to draft them. Confirm dialog. Shows which company is picking.
   - **Auto-advance**: After a pick, the board updates to show the next company's turn.
   - **Snake order visualization**: Show arrow indicating order direction per round.
   - **Completed state**: Show final draft results, all picks locked.
2. Polish the UI:
   - Company logos/abbreviations in column headers.
   - Wrestler images in pick cells.
   - Round labels on left.
   - Pick number overlay.
3. Add i18n keys for all draft UI labels.
4. Run TypeScript validation and tests.
