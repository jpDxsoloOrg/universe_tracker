# Plan: Add Companies and Shows with multi-company events

**GitHub issue:** #4 — [Add Companies and Shows with multi-company events](https://github.com/jpDxsoloOrg/universe_tracker/issues/4)

## Context

Companies are the core organizational unit in WWE Universe Mode. A company owns a roster of wrestlers, divisions, and championships. Shows are programming a company runs (e.g., "Monday Nitro", "Raw"). Events can be hosted by one or more companies — when booking matches, the available wrestler pool is the union of all hosting companies' rosters.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2+3 in parallel → Step 4 → Step 5
- **Agent types**:
  - Step 1: `general-purpose` (backend Companies CRUD + Shows CRUD + serverless.yml + dynamodb.ts)
  - Step 2: `general-purpose` (backend updates to existing entities: Wrestlers, Events, Championships, Divisions + seed data)
  - Step 3: `general-purpose` (all frontend: types, API services, admin components, i18n, routes)
  - Step 4: `general-purpose` (backend match booking validation + frontend match scheduling filter)
  - Step 5: `general-purpose` (verification and cleanup)

## Implementation steps

### Step 1: Backend new entity CRUD (Companies + Shows)

Create the Companies and Shows entities in the backend following existing patterns.

**1. serverless.yml changes:**

Add environment variables:
```yaml
COMPANIES_TABLE: ${self:service}-companies-${self:provider.stage}
SHOWS_TABLE: ${self:service}-shows-${self:provider.stage}
```

Add IAM permissions for new tables (follow existing pattern - add to the DynamoDB Action list's Resource array).

Add Lambda function definitions:
```yaml
companies:
  handler: functions/companies/handler.handler
  events:
    - http:
        path: companies
        method: any
        cors: *corsConfig
    - http:
        path: companies/{companyId}
        method: any
        cors: *corsConfig
        authorizer: adminAuthorizer

shows:
  handler: functions/shows/handler.handler
  events:
    - http:
        path: shows
        method: any
        cors: *corsConfig
    - http:
        path: shows/{showId}
        method: any
        cors: *corsConfig
        authorizer: adminAuthorizer
```

Add DynamoDB table resources:
```yaml
CompaniesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ${self:provider.environment.COMPANIES_TABLE}
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: companyId
        AttributeType: S
    KeySchema:
      - AttributeName: companyId
        KeyType: HASH

ShowsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ${self:provider.environment.SHOWS_TABLE}
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: showId
        AttributeType: S
      - AttributeName: companyId
        AttributeType: S
    KeySchema:
      - AttributeName: showId
        KeyType: HASH
    GlobalSecondaryIndexes:
      - IndexName: CompanyShowsIndex
        KeySchema:
          - AttributeName: companyId
            KeyType: HASH
        Projection:
          ProjectionType: ALL
```

Add CompanyIndex GSI to WrestlersTable:
```yaml
# Add to WrestlersTable AttributeDefinitions:
- AttributeName: companyId
  AttributeType: S
# Add GSI:
- IndexName: CompanyIndex
  KeySchema:
    - AttributeName: companyId
      KeyType: HASH
  Projection:
    ProjectionType: ALL
```

**2. backend/lib/dynamodb.ts:**
Add `COMPANIES: process.env.COMPANIES_TABLE!` and `SHOWS: process.env.SHOWS_TABLE!` to TableNames.

**3. backend/functions/companies/ (new directory):**

Create following existing patterns:
- `handler.ts` - createRouter with routes for GET/POST /companies, GET/PUT/DELETE /companies/{companyId}
- `createCompany.ts` - Use handlerFactory: requiredFields=['name'], optionalFields=['abbreviation', 'imageUrl', 'description'], idField='companyId', entityName='company'
- `getCompanies.ts` - Scan CompaniesTable, return all
- `getCompany.ts` - Get by companyId, enrich with roster count (scan wrestlers with companyId filter)
- `updateCompany.ts` - Standard update pattern with buildUpdateExpression
- `deleteCompany.ts` - Check for assigned wrestlers first (scan WrestlersTable for companyId), block if any found. Also check for shows.

**4. backend/functions/shows/ (new directory):**
- `handler.ts` - createRouter with routes
- `createShow.ts` - Use handlerFactory: requiredFields=['name', 'companyId'], optionalFields=['description', 'schedule'], idField='showId', entityName='show'. Validate companyId exists.
- `getShows.ts` - Support ?companyId= filter (query CompanyShowsIndex), fall back to scan
- `getShow.ts` - Get by showId
- `updateShow.ts` - Standard update, validate companyId if changed
- `deleteShow.ts` - Standard delete, check for events using this show

**5. backend/scripts/create-tables.ts:**
Add CompaniesTable and ShowsTable definitions.

### Step 2: Backend updates to existing entities

Update Wrestlers, Events, Championships, and Divisions to support companyId.

**1. Wrestlers:**
- `createWrestler.ts` - Add 'companyId' to optionalFields. In validate(), if companyId provided, verify company exists.
- `updateWrestler.ts` - Allow setting/clearing companyId. Validate company exists if provided.
- `getWrestlers.ts` - Support `?companyId=` query param to filter by company. Support `?unassigned=true` for global pool (no companyId).

**2. Events:**
- `createEvent.ts` - Add 'companyIds' to optionalFields (array of company IDs). Validate all companyIds exist.
- `updateEvent.ts` - Allow updating companyIds. Validate.
- `getEvents.ts` - Return companyIds in response.
- `getEvent.ts` - Return companyIds, enrich with company names.

**3. Championships:**
- `createChampionship.ts` - Add 'companyId' to optionalFields. Validate if provided.
- `updateChampionship.ts` - Allow setting companyId.

Note: Check if championships use handlerFactory or custom handlers.

**4. Divisions:**
- Division handler already exists. Add 'companyId' to optionalFields in create. Add to update allowed fields.

**5. Seed data:**
- `backend/functions/admin/seedData.ts` - Add sample companies (e.g., "WWF", "WCW", "ECW"), sample shows, assign wrestlers to companies.
- `backend/scripts/seed-data.ts` - Same updates.

**6. Clear data:**
- `backend/functions/admin/clearAll.ts` - Add COMPANIES and SHOWS tables to clear list.

**7. Data transfer:**
- `backend/functions/admin/dataTransferConfig.ts` - Add Companies and Shows to datasets.

### Step 3: All frontend changes

**1. Types (`frontend/src/types/index.ts` or new file):**

Add Company interface:
```typescript
export interface Company {
  companyId: string;
  name: string;
  abbreviation?: string;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

Add Show interface:
```typescript
export interface Show {
  showId: string;
  name: string;
  companyId: string;
  description?: string;
  schedule?: 'weekly' | 'ppv' | 'special';
  createdAt: string;
  updatedAt: string;
}
```

Update Wrestler: add `companyId?: string`
Update Championship: add `companyId?: string`
Update Division: add `companyId?: string`
Update LeagueEvent (in event.ts): add `companyIds?: string[]`, `showId?: string`

**2. API services:**

Create `frontend/src/services/api/companies.api.ts`:
- Use crudFactory or custom: getAll, getById, create, update, delete

Create `frontend/src/services/api/shows.api.ts`:
- getAll (with ?companyId= filter), getById, create, update, delete

Export from `frontend/src/services/api/index.ts`.

**3. Admin components:**

Create `frontend/src/components/admin/ManageCompanies.tsx` + CSS:
- List companies with edit/delete
- Create form: name (required), abbreviation, description, image upload
- Show roster count per company
- Follow ManageDivisions.tsx pattern

Create `frontend/src/components/admin/ManageShows.tsx` + CSS:
- List shows grouped by company
- Create form: name (required), company selector (required), schedule type, description
- Follow ManageDivisions.tsx pattern

**4. AdminPanel.tsx:**
Add 'companies' and 'shows' tabs. Companies should come early in the tab order (after wrestlers).

**5. App.tsx:**
No new public routes needed for now (companies/shows are admin-managed).

**6. i18n:**
Add translation keys for companies and shows in en.json and de.json:
- companies section: name, abbreviation, description, createCompany, editCompany, deleteCompany, noCompanies, confirmDelete, rosterCount, etc.
- shows section: similar pattern

**7. Update existing components:**
- CreateEvent.tsx: Add multi-select for hosting companyIds
- ManageWrestlers.tsx: Add company selector dropdown when creating/editing
- ManageChampionships.tsx: Add company selector
- ManageDivisions.tsx: Add company selector

### Step 4: Match booking roster filtering

**1. Backend (`backend/functions/matches/scheduleMatch.ts`):**
- If match has eventId, look up event's companyIds
- Validate all participant wrestlers belong to one of the hosting companies' rosters
- If no eventId, allow any wrestler

**2. Frontend (`frontend/src/components/admin/ScheduleMatch.tsx`):**
- When event is selected, fetch event details to get companyIds
- Filter wrestler picker to show only wrestlers from those companies + unassigned pool
- If no event selected, show all wrestlers

### Step 5: Verification and cleanup

1. Run `cd backend && npx tsc --project tsconfig.json --noEmit`
2. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`
3. Run backend tests
4. Run frontend tests
5. Fix any failures
6. Search for inconsistencies

## Dependencies and order

- Steps 1, 2, and 3 can run in parallel (no file overlap)
- Step 4 depends on Steps 1+2+3
- Step 5 depends on Step 4

**Suggested order:** Steps 1+2+3 → Step 4 → Step 5

## Testing and verification

- TypeScript compilation passes (both frontend and backend)
- All existing tests pass
- New CRUD endpoints return correct responses
- Company deletion blocked when wrestlers assigned
- Show deletion blocked when events reference it
- Wrestlers filterable by companyId
- Events accept companyIds array
- Match booking validates roster membership

## Risks and edge cases

- **CompanyIndex GSI on Wrestlers**: Adding GSI to existing table requires careful schema definition. Since we haven't deployed yet, this is safe.
- **Backward compatibility**: Existing data has no companyId. All companyId fields are optional, so existing entities work fine.
- **Multi-company events**: Union of rosters may have duplicates if a wrestler is somehow assigned to multiple companies. wrestlerId should be unique so dedup is natural.
