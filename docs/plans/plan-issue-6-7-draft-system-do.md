# Plan: Draft system — global pool + inter-company drafts

**GitHub issues:** #6 — [Draft system - companies draft from global wrestler pool](https://github.com/jpDxsoloOrg/universe_tracker/issues/6) and #7 — [Inter-company drafts](https://github.com/jpDxsoloOrg/universe_tracker/issues/7)

## Context

Implement a complete draft system for WWE Universe Mode. Companies draft wrestlers in an organized turn-based event. Issue #6 covers drafting from the global unassigned pool. Issue #7 extends this with inter-company drafts (drafting from other companies' rosters) and wrestler protection (franchise tag).

Both issues share a single DynamoDB table (Drafts, with picks embedded) and use the same Lambda function and frontend components. Implementing together avoids rework.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2 in parallel → Step 3+4 in parallel → Step 5
- **Agent types**:
  - Step 1: `general-purpose` (backend — new Drafts Lambda CRUD + draft actions + tests)
  - Step 2: `general-purpose` (frontend — types, API service, i18n, admin wiring)
  - Step 3: `general-purpose` (frontend — ManageDrafts component + DraftBoard component + CSS)
  - Step 4: `general-purpose` (frontend — ActiveDraft component for live picking + DraftHistory + tests)
  - Step 5: `general-purpose` (verification and cleanup)

## Implementation steps

### Step 1: Backend — Drafts CRUD, draft actions, and tests

**1a. Update `backend/serverless.yml`:**

Add environment variable under `provider.environment`:
```yaml
DRAFTS_TABLE: ${self:service}-drafts-${self:provider.stage}
```

Add IAM permission entries under `provider.iam.role.statements[0].Resource`:
```yaml
- arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.DRAFTS_TABLE}
- arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.DRAFTS_TABLE}/index/*
```

Add Lambda function (place after `shows` function):
```yaml
drafts:
  handler: functions/drafts/handler.handler
  timeout: 30
  events:
    - http:
        path: drafts
        method: get
        cors: *corsConfig
    - http:
        path: drafts
        method: post
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}
        method: get
        cors: *corsConfig
    - http:
        path: drafts/{draftId}
        method: put
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}
        method: delete
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}/start
        method: post
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}/pick
        method: post
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}/protect
        method: post
        cors: *corsConfig
        authorizer: adminAuthorizer
    - http:
        path: drafts/{draftId}/complete
        method: post
        cors: *corsConfig
        authorizer: adminAuthorizer
```

Add DynamoDB table under `resources.Resources`:
```yaml
DraftsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ${self:provider.environment.DRAFTS_TABLE}
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: draftId
        AttributeType: S
    KeySchema:
      - AttributeName: draftId
        KeyType: HASH
```

**1b. Update `backend/lib/dynamodb.ts`:**

Add to TableNames: `DRAFTS: process.env.DRAFTS_TABLE!`

**1c. Update `backend/scripts/create-tables.ts`:**

Add DraftsTable to the local table creation array.

**1d. Update `backend/functions/admin/clearAll.ts`:**

Add `TableNames.DRAFTS` to the tables cleared.

**1e. Create `backend/functions/drafts/handler.ts`:**

Router with routes:
```
GET    /drafts                  → getDrafts
POST   /drafts                  → createDraft
GET    /drafts/{draftId}        → getDraft
PUT    /drafts/{draftId}        → updateDraft
DELETE /drafts/{draftId}        → deleteDraft
POST   /drafts/{draftId}/start  → startDraft
POST   /drafts/{draftId}/pick   → makePick
POST   /drafts/{draftId}/protect→ protectWrestler
POST   /drafts/{draftId}/complete→ completeDraft
```

**1f. Create `backend/functions/drafts/createDraft.ts`:**

Uses `parseBody` and manual validation (NOT handlerFactory — too custom).

Body interface:
```typescript
interface CreateDraftBody {
  name: string;
  type: 'global' | 'inter-company';
  participatingCompanyIds: string[];
  rounds: number;
  snakeOrder?: boolean;           // default true
  draftOrder?: string[];          // optional manual order, defaults to participatingCompanyIds
  protectedPicksPerCompany?: number; // for inter-company (default 0)
  includeGlobalPool?: boolean;    // for inter-company (default false)
}
```

Validation:
- `name` required, non-empty
- `type` must be `global` or `inter-company`
- `participatingCompanyIds` must be array of 2+ companies, all must exist
- `rounds` must be positive integer
- If `draftOrder` provided, must contain exactly the same company IDs
- `protectedPicksPerCompany` only valid for inter-company type

Creates item:
```typescript
{
  draftId: uuidv4(),
  name, type, participatingCompanyIds, rounds,
  snakeOrder: body.snakeOrder ?? true,
  draftOrder: body.draftOrder || body.participatingCompanyIds,
  protectedPicksPerCompany: type === 'inter-company' ? (body.protectedPicksPerCompany ?? 0) : 0,
  includeGlobalPool: type === 'inter-company' ? (body.includeGlobalPool ?? false) : true,
  status: 'setup',
  currentRound: 0,
  currentPickIndex: 0,
  picks: [],           // Array of DraftPick objects (embedded, not separate table)
  protections: [],     // Array of { companyId, wrestlerId, protectedAt }
  createdAt: now,
  updatedAt: now,
}
```

Note: Picks are embedded in the draft document rather than a separate table. This simplifies queries and keeps all draft data together. A draft with 300 picks is ~30KB, well within DynamoDB's 400KB limit.

**1g. Create `backend/functions/drafts/getDrafts.ts`:**

Scan DRAFTS table, return all drafts sorted by createdAt desc.

**1h. Create `backend/functions/drafts/getDraft.ts`:**

Get by draftId. Return 404 if not found. Include all picks and protections.

**1i. Create `backend/functions/drafts/updateDraft.ts`:**

Only allowed when status is `setup`. Can update: name, rounds, snakeOrder, draftOrder, protectedPicksPerCompany, includeGlobalPool. Use `buildUpdateExpression`. Validate draftOrder if changed.

**1j. Create `backend/functions/drafts/deleteDraft.ts`:**

Only allowed when status is `setup` or `completed`. Delete the draft.

**1k. Create `backend/functions/drafts/startDraft.ts`:**

- Validate draft exists and status is `setup`
- For inter-company type: validate all protections are complete (each company has protected exactly protectedPicksPerCompany wrestlers, or skip if 0)
- Set status to `active`, currentRound to 1, currentPickIndex to 0
- Return updated draft

**1l. Create `backend/functions/drafts/makePick.ts`:**

Body: `{ companyId: string, wrestlerId: string }`

Validation:
1. Draft exists and status is `active`
2. It's the correct company's turn based on currentPickIndex, currentRound, draftOrder, and snakeOrder
3. Wrestler exists
4. Wrestler is eligible:
   - For `global` type: wrestler must have no companyId (unassigned)
   - For `inter-company` type: wrestler must belong to a participating company OTHER than the picking company, OR be in global pool if `includeGlobalPool` is true
   - Wrestler must NOT be in the protections list
   - Wrestler must NOT already be picked in this draft

Actions:
1. Add pick to the draft's `picks` array: `{ pickNumber, round, companyId, wrestlerId, previousCompanyId (for inter-company), pickedAt }`
2. Update wrestler's `companyId` to the picking company
3. Advance currentPickIndex:
   - Calculate total picks per round = participatingCompanyIds.length
   - If snake order: odd rounds go forward, even rounds go reverse
   - When all picks in a round are done, advance currentRound
   - If all rounds complete, auto-complete the draft (set status to `completed`)
4. Use `transactWrite` to atomically update both the draft and the wrestler

Return: the pick that was just made + updated draft state (currentRound, currentPickIndex, status)

**1m. Create `backend/functions/drafts/protectWrestler.ts`:**

Body: `{ companyId: string, wrestlerId: string }`

Validation:
1. Draft exists, status is `setup`, type is `inter-company`
2. Company is a participating company
3. Wrestler exists and belongs to the company
4. Company hasn't exceeded protectedPicksPerCompany
5. Wrestler not already protected in this draft

Action: Add `{ companyId, wrestlerId, protectedAt }` to draft's protections array.

**1n. Create `backend/functions/drafts/completeDraft.ts`:**

- Validate draft exists and status is `active`
- Set status to `completed`
- Return updated draft

**1o. Create `backend/functions/drafts/__tests__/handler.test.ts`:**

Test handler routing: GET/POST /drafts, GET/PUT/DELETE /drafts/{id}, POST start/pick/protect/complete.

**1p. Create `backend/functions/drafts/__tests__/drafts.test.ts`:**

Test all handler functions:
- createDraft: valid global draft, valid inter-company draft, missing name, invalid type, fewer than 2 companies, company not found
- getDrafts: returns all drafts
- getDraft: returns draft, 404 for missing
- updateDraft: updates name, rejects update when active
- deleteDraft: deletes setup draft, rejects deleting active draft
- startDraft: starts setup draft, rejects starting active draft
- makePick: valid pick, wrong company's turn, wrestler not in pool, already picked wrestler, auto-completes when all rounds done
- protectWrestler: valid protection, not inter-company type rejection, exceeded limit
- completeDraft: completes active draft, rejects completing setup draft

Mock `dynamoDb` (get, put, update, scan, transactWrite) and `uuid`. Follow exact patterns from existing test files like `companies.test.ts`.

### Step 2: Frontend — types, API service, i18n, admin wiring

**2a. Add types to `frontend/src/types/index.ts`:**

```typescript
export interface DraftPick {
  pickNumber: number;
  round: number;
  companyId: string;
  wrestlerId: string;
  previousCompanyId?: string;
  pickedAt: string;
}

export interface DraftProtection {
  companyId: string;
  wrestlerId: string;
  protectedAt: string;
}

export interface Draft {
  draftId: string;
  name: string;
  type: 'global' | 'inter-company';
  status: 'setup' | 'active' | 'completed';
  participatingCompanyIds: string[];
  rounds: number;
  currentRound: number;
  currentPickIndex: number;
  draftOrder: string[];
  snakeOrder: boolean;
  protectedPicksPerCompany: number;
  includeGlobalPool: boolean;
  picks: DraftPick[];
  protections: DraftProtection[];
  createdAt: string;
  updatedAt: string;
}
```

**2b. Create `frontend/src/services/api/drafts.api.ts`:**

```typescript
import { API_BASE_URL, fetchWithAuth } from './apiClient';
import type { Draft } from '../../types';

export const draftsApi = {
  getAll: async (signal?: AbortSignal): Promise<Draft[]> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts`, {}, signal);
  },
  getById: async (draftId: string, signal?: AbortSignal): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {}, signal);
  },
  create: async (data: {
    name: string;
    type: 'global' | 'inter-company';
    participatingCompanyIds: string[];
    rounds: number;
    snakeOrder?: boolean;
    draftOrder?: string[];
    protectedPicksPerCompany?: number;
    includeGlobalPool?: boolean;
  }): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (draftId: string, data: Partial<Draft>): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (draftId: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {
      method: 'DELETE',
    });
  },
  start: async (draftId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/start`, {
      method: 'POST',
    });
  },
  makePick: async (draftId: string, companyId: string, wrestlerId: string): Promise<{ pick: DraftPick; draft: Draft }> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/pick`, {
      method: 'POST',
      body: JSON.stringify({ companyId, wrestlerId }),
    });
  },
  protect: async (draftId: string, companyId: string, wrestlerId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/protect`, {
      method: 'POST',
      body: JSON.stringify({ companyId, wrestlerId }),
    });
  },
  complete: async (draftId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/complete`, {
      method: 'POST',
    });
  },
};
```

Import DraftPick type from the types file. Export from `frontend/src/services/api/index.ts`.

**2c. Update `frontend/src/components/admin/AdminPanel.tsx`:**

- Add `'drafts'` to the AdminTab type union
- Add `'drafts'` to VALID_TABS array
- Import ManageDrafts component
- Add `drafts: <ManageDrafts />` to tabContent

**2d. Update `frontend/src/config/navConfig.ts`:**

- Add `{ path: '/admin/drafts', i18nKey: 'admin.panel.tabs.drafts' }` to the `leagueSetup` group items
- Add `'/admin/drafts'` to `leagueSetup` array in `getAdminGroupForPath`

**2e. Add i18n keys to `frontend/src/i18n/locales/en.json`:**

Under `admin.panel.tabs` add: `"drafts": "Drafts"`

Add a new top-level `drafts` section:
```json
"drafts": {
  "title": "Draft Management",
  "createDraft": "Create Draft",
  "editDraft": "Edit Draft",
  "deleteDraft": "Delete Draft",
  "confirmDelete": "Are you sure you want to delete this draft?",
  "noDrafts": "No drafts yet. Create your first draft to get started.",
  "name": "Draft Name",
  "type": "Draft Type",
  "typeGlobal": "Global Pool",
  "typeInterCompany": "Inter-Company",
  "companies": "Participating Companies",
  "rounds": "Number of Rounds",
  "snakeOrder": "Snake Order",
  "snakeOrderHelp": "Reverses pick order each round (1→2→3, 3→2→1, ...)",
  "draftOrder": "Draft Order",
  "randomizeOrder": "Randomize Order",
  "protectedPicks": "Protected Picks per Company",
  "includeGlobalPool": "Include Global Pool Wrestlers",
  "status": "Status",
  "statusSetup": "Setup",
  "statusActive": "Active",
  "statusCompleted": "Completed",
  "startDraft": "Start Draft",
  "completeDraft": "End Draft Early",
  "confirmStart": "Start the draft? Companies will begin picking wrestlers.",
  "confirmComplete": "End this draft early? Remaining picks will be skipped.",
  "draftBoard": "Draft Board",
  "round": "Round",
  "pick": "Pick",
  "currentPick": "Current Pick",
  "availableWrestlers": "Available Wrestlers",
  "makePick": "Pick",
  "picked": "Picked",
  "noPicks": "No picks made yet",
  "pickSuccess": "Wrestler drafted successfully!",
  "protection": "Protection Phase",
  "protectWrestler": "Protect",
  "protectedWrestlers": "Protected Wrestlers",
  "protectionRemaining": "{{remaining}} protection(s) remaining",
  "protectionComplete": "All protections set",
  "source": "From",
  "viewDraft": "View Draft",
  "backToList": "Back to Drafts",
  "selectCompanies": "Select at least 2 companies",
  "draftHistory": "Draft History",
  "totalPicks": "Total Picks"
}
```

**2f. Add German translations to `frontend/src/i18n/locales/de.json`:**

Under `admin.panel.tabs` add: `"drafts": "Drafts"`

Add `drafts` section with German translations:
```json
"drafts": {
  "title": "Draft-Verwaltung",
  "createDraft": "Draft erstellen",
  "editDraft": "Draft bearbeiten",
  "deleteDraft": "Draft löschen",
  "confirmDelete": "Möchten Sie diesen Draft wirklich löschen?",
  "noDrafts": "Noch keine Drafts. Erstellen Sie Ihren ersten Draft.",
  "name": "Draft-Name",
  "type": "Draft-Typ",
  "typeGlobal": "Globaler Pool",
  "typeInterCompany": "Inter-Company",
  "companies": "Teilnehmende Companies",
  "rounds": "Anzahl der Runden",
  "snakeOrder": "Snake-Reihenfolge",
  "snakeOrderHelp": "Kehrt die Reihenfolge jede Runde um (1→2→3, 3→2→1, ...)",
  "draftOrder": "Draft-Reihenfolge",
  "randomizeOrder": "Reihenfolge zufällig",
  "protectedPicks": "Geschützte Picks pro Company",
  "includeGlobalPool": "Globale Pool-Wrestler einschließen",
  "status": "Status",
  "statusSetup": "Vorbereitung",
  "statusActive": "Aktiv",
  "statusCompleted": "Abgeschlossen",
  "startDraft": "Draft starten",
  "completeDraft": "Draft vorzeitig beenden",
  "confirmStart": "Draft starten? Companies beginnen mit der Auswahl.",
  "confirmComplete": "Draft vorzeitig beenden? Verbleibende Picks werden übersprungen.",
  "draftBoard": "Draft-Übersicht",
  "round": "Runde",
  "pick": "Pick",
  "currentPick": "Aktueller Pick",
  "availableWrestlers": "Verfügbare Wrestler",
  "makePick": "Auswählen",
  "picked": "Ausgewählt",
  "noPicks": "Noch keine Picks",
  "pickSuccess": "Wrestler erfolgreich gedraftet!",
  "protection": "Schutzphase",
  "protectWrestler": "Schützen",
  "protectedWrestlers": "Geschützte Wrestler",
  "protectionRemaining": "{{remaining}} Schutz(e) verbleibend",
  "protectionComplete": "Alle Schutze gesetzt",
  "source": "Von",
  "viewDraft": "Draft ansehen",
  "backToList": "Zurück zu Drafts",
  "selectCompanies": "Wählen Sie mindestens 2 Companies",
  "draftHistory": "Draft-Verlauf",
  "totalPicks": "Picks gesamt"
}
```

### Step 3: Frontend — ManageDrafts component (list + create/edit form)

**3a. Create `frontend/src/components/admin/ManageDrafts.tsx`:**

This is the main draft management component. Three views controlled by state:

**List View** (default):
- Fetch all drafts on mount
- Show table with columns: Name, Type, Status, Companies, Rounds, Picks, Actions
- Status badge colored by state (setup=gray, active=green, completed=blue)
- Actions: View (always), Edit (setup only), Delete (setup/completed), Start (setup only)
- "Create Draft" button at top

**Create/Edit Form View**:
- Name input (required)
- Type selector: radio buttons for Global / Inter-Company
- Company multi-select: checkboxes for all companies (fetch from companiesApi.getAll())
- Rounds number input (min 1)
- Snake Order toggle (checkbox, default true)
- Draft Order: show selected companies in a sortable list (drag or up/down buttons). "Randomize" button.
- For inter-company: Protected Picks per Company (number input, default 0), Include Global Pool toggle
- Submit button → calls draftsApi.create() or draftsApi.update()

**Draft Detail View** (when a draft is selected):
- Shows draft info header (name, type, status)
- If status=setup and type=inter-company and protectedPicksPerCompany > 0: show protection phase UI
- If status=active: show active draft picking UI
- If status=completed: show completed draft board
- Draft board grid always visible: rows = rounds, columns = companies
- Shows each pick in the grid cell: wrestler name + source company badge (for inter-company)

**3b. Create `frontend/src/components/admin/ManageDrafts.css`:**

Styles following ManageCompanies.css pattern. Key classes:
- `.manage-drafts` container
- `.draft-list` — table of drafts
- `.draft-form` — create/edit form
- `.draft-detail` — detail view wrapper
- `.draft-board` — grid/table for picks display
- `.draft-board-cell` — individual pick cell
- `.draft-board-cell.current` — highlighted current pick
- `.draft-board-cell.empty` — empty future pick
- `.status-badge` — colored status indicator
- `.company-selector` — multi-select checkboxes
- `.draft-order-list` — sortable company order
- `.protection-section` — protection phase UI
- `.available-pool` — wrestler selection list
- `.wrestler-pick-card` — wrestler in available pool
- `.pick-info` — pick details (wrestler name, source)

### Step 4: Frontend — ActiveDraft picking UI + tests

**4a. Create `frontend/src/components/admin/ActiveDraft.tsx`:**

Component for the live picking interface during an active draft.

Props: `{ draft: Draft, onUpdate: (draft: Draft) => void }`

Sections:
1. **Current Pick Banner**: Shows "Round X — Company Y's Pick" with company name highlighted
2. **Available Wrestlers Panel**:
   - For global type: fetch wrestlers with `?unassigned=true`
   - For inter-company: fetch all wrestlers, filter to those from participating companies (excluding current picker's roster) + optionally global pool. Exclude protected and already-picked wrestlers.
   - Search/filter input for wrestler name
   - List of available wrestlers as cards with name, alignment badge, stats
3. **Pick Button**: Select a wrestler then click "Pick" → calls `draftsApi.makePick()`
4. **Pick confirmation**: Brief success message, then auto-advances to next pick display

State management:
- `availableWrestlers`, `selectedWrestlerId`, `picking` (loading), `pickResult`
- Refresh available wrestlers after each pick
- If draft auto-completes (all rounds done), show completion message

**4b. Create `frontend/src/components/admin/ProtectionPhase.tsx`:**

Component for the inter-company draft protection phase.

Props: `{ draft: Draft, companies: Company[], onUpdate: (draft: Draft) => void }`

Sections:
1. For each participating company, show:
   - Company name + protection count (X/Y protected)
   - List of company's wrestlers with "Protect" button
   - Already protected wrestlers shown with a shield icon
2. When all companies have completed protections, show "Ready to Start" message

**4c. Create `frontend/src/components/admin/__tests__/ManageDrafts.test.tsx`:**

Test cases:
1. Renders draft list with create button
2. Fetches drafts on mount
3. Shows create form when button clicked
4. Creates draft with required fields
5. Shows draft detail when view clicked
6. Delete button visible for setup/completed drafts only

Mock draftsApi, companiesApi, wrestlersApi. Follow existing test patterns.

### Step 5: Verification

1. Run `cd backend && npx tsc --project tsconfig.json --noEmit`
2. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`
3. Run backend tests: `cd backend && npx vitest run`
4. Run frontend tests: `cd frontend && npx vitest run`
5. Fix any failures.

## Dependencies and order

- Steps 1 and 2 have no file overlap and can run in parallel.
- Steps 3 and 4 depend on Step 2 (types and API service must exist) but not on Step 1. They can run in parallel with each other.
- Step 5 depends on all previous steps.

**Suggested order:** Steps 1+2 → Steps 3+4 → Step 5

## Testing and verification

- TypeScript compilation passes (both frontend and backend)
- All existing tests pass
- Draft CRUD operations work correctly
- Snake order pick advancement works
- Global draft: only unassigned wrestlers available
- Inter-company draft: wrestlers from other companies available (minus protected)
- Wrestler companyId updates on pick
- Protection phase works for inter-company drafts
- Draft board displays picks correctly

## Risks and edge cases

- **Embedded picks vs separate table**: Picks are embedded in the draft document. A draft with 10 companies × 30 rounds = 300 picks is ~30KB, well within DynamoDB's 400KB limit. If future needs require >400KB, picks can be moved to a separate table.
- **Concurrent picks**: Since this is single-user, race conditions aren't a concern. The transactWrite ensures atomic wrestler + draft updates.
- **Snake order calculation**: Need careful indexing. For N companies and snake order: even-numbered rounds (0-indexed) go in reverse.
- **Auto-completion**: When the last pick is made, the draft auto-completes. The completeDraft endpoint allows early termination.
