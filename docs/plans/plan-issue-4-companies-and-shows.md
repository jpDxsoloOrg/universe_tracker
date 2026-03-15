# Plan: Add Companies and Shows with multi-company events

**GitHub issue:** #4 — [Add Companies and Shows with multi-company events](https://github.com/jpDxsoloOrg/universe_tracker/issues/4)

## Context

Companies are the core organizational unit. A company owns a roster of wrestlers, divisions, and championships. Shows are programming a company runs (e.g., "Monday Nitro"). Events can be hosted by one or more companies — when booking matches, the available wrestler pool is the union of all hosting companies' rosters.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| During implementation | test-engineer | Generate tests for new CRUD endpoints |
| After implementation | code-reviewer | Review new data model and API design |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Step 1 → Steps 2+3 in parallel → Step 4 → Step 5
- **Agent types**:
  - Step 1: `generalPurpose` (backend Companies CRUD + DynamoDB)
  - Step 2: `generalPurpose` (backend Shows CRUD + Events update)
  - Step 3: `generalPurpose` (frontend Companies management)
  - Step 4: `generalPurpose` (frontend Shows management + Events update)
  - Step 5: `generalPurpose` (match booking roster filtering, verification)

## Files to create

| File | Purpose |
|------|---------|
| `backend/functions/companies/handler.ts` | Router for company endpoints |
| `backend/functions/companies/getCompanies.ts` | GET /companies |
| `backend/functions/companies/createCompany.ts` | POST /companies |
| `backend/functions/companies/updateCompany.ts` | PUT /companies/{companyId} |
| `backend/functions/companies/deleteCompany.ts` | DELETE /companies/{companyId} |
| `backend/functions/shows/handler.ts` | Router for show endpoints |
| `backend/functions/shows/getShows.ts` | GET /shows |
| `backend/functions/shows/createShow.ts` | POST /shows |
| `backend/functions/shows/updateShow.ts` | PUT /shows/{showId} |
| `backend/functions/shows/deleteShow.ts` | DELETE /shows/{showId} |
| `frontend/src/components/admin/ManageCompanies.tsx` | Admin CRUD for companies |
| `frontend/src/components/admin/ManageCompanies.css` | Styles |
| `frontend/src/components/admin/ManageShows.tsx` | Admin CRUD for shows |
| `frontend/src/components/admin/ManageShows.css` | Styles |
| `frontend/src/services/api/companies.api.ts` | Companies API client |
| `frontend/src/services/api/shows.api.ts` | Shows API client |

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/serverless.yml` | Modify | Add Companies and Shows tables, CompanyIndex GSI on Wrestlers, Lambda functions, API routes |
| `backend/functions/wrestlers/createWrestler.ts` | Modify | Add optional `companyId` field |
| `backend/functions/wrestlers/updateWrestler.ts` | Modify | Allow setting/changing `companyId` |
| `backend/functions/wrestlers/getWrestlers.ts` | Modify | Support `?companyId=` filter param |
| `backend/functions/events/createEvent.ts` | Modify | Add `companyIds` array field |
| `backend/functions/events/getEvents.ts` | Modify | Return `companyIds` |
| `backend/functions/matches/createMatch.ts` | Modify | Validate wrestlers belong to event's hosting companies |
| `backend/functions/championships/createChampionship.ts` | Modify | Add `companyId` field |
| `backend/functions/divisions/createDivision.ts` | Modify | Add `companyId` field |
| `frontend/src/types/index.ts` | Modify | Add Company, Show interfaces; update Wrestler, Event, Championship, Division with companyId |
| `frontend/src/components/admin/AdminPanel.tsx` | Modify | Add links to manage companies and shows |
| `frontend/src/components/admin/ScheduleMatch.tsx` | Modify | Filter wrestler picker by event's hosting companies |
| `frontend/src/components/admin/CreateEvent.tsx` | Modify | Add company selector (multi-select) |
| `frontend/src/i18n/locales/en.json` | Modify | Add company and show translation keys |
| `frontend/src/i18n/locales/de.json` | Modify | Add German translations |
| `frontend/src/App.tsx` | Modify | Add routes for companies and shows |

## Implementation steps

### Step 1: Backend Companies CRUD

1. Create `Companies` DynamoDB table in `serverless.yml`:
   - PK: `companyId`
   - Attributes: `name`, `abbreviation`, `imageUrl`, `description`, `createdAt`, `updatedAt`
2. Add `CompanyIndex` GSI to Wrestlers table: partition key `companyId`.
3. Create `backend/functions/companies/` with handler.ts and CRUD functions following existing patterns (use `handlerFactory` and `createRouter`).
4. Add Lambda function definition and HTTP events in `serverless.yml`:
   - `GET /companies` (public)
   - `POST /companies` (admin)
   - `PUT /companies/{companyId}` (admin)
   - `DELETE /companies/{companyId}` (admin) — block if company has wrestlers assigned
5. Update `backend/functions/wrestlers/` to support optional `companyId`:
   - `createWrestler.ts`: accept optional `companyId`, validate company exists if provided.
   - `updateWrestler.ts`: allow setting/clearing `companyId`.
   - `getWrestlers.ts`: support `?companyId=` query param to filter by company; support `?unassigned=true` for global pool.

### Step 2: Backend Shows CRUD + Events update

1. Create `Shows` DynamoDB table in `serverless.yml`:
   - PK: `showId`
   - Attributes: `name`, `companyId`, `description`, `schedule` (weekly/ppv/special), `createdAt`, `updatedAt`
   - GSI: `CompanyShowsIndex` (companyId) for querying shows by company
2. Create `backend/functions/shows/` with handler.ts and CRUD functions.
3. Add Lambda function definition and HTTP events in `serverless.yml`:
   - `GET /shows` (public, support `?companyId=` filter)
   - `POST /shows` (admin, requires `companyId`)
   - `PUT /shows/{showId}` (admin)
   - `DELETE /shows/{showId}` (admin)
4. Update Events to support `companyIds`:
   - `backend/functions/events/createEvent.ts`: accept `companyIds: string[]` (required, at least one).
   - `backend/functions/events/getEvents.ts`: return `companyIds` in response.
   - Optionally link events to a show via `showId` field.
5. Update `backend/functions/championships/` to support `companyId` field.
6. Update `backend/functions/divisions/` to support `companyId` field.

### Step 3: Frontend Companies management

1. Add `Company` and `Show` interfaces to `frontend/src/types/index.ts`.
2. Create `frontend/src/services/api/companies.api.ts` with CRUD methods.
3. Create `frontend/src/components/admin/ManageCompanies.tsx`:
   - List all companies with edit/delete actions.
   - Create company form (name, abbreviation, description, image upload).
   - Show roster count per company.
4. Add company management route and nav link in AdminPanel.

### Step 4: Frontend Shows management + Events update

1. Create `frontend/src/services/api/shows.api.ts` with CRUD methods.
2. Create `frontend/src/components/admin/ManageShows.tsx`:
   - List shows grouped by company.
   - Create show form (name, company selector, schedule type, description).
3. Update `frontend/src/components/admin/CreateEvent.tsx`:
   - Add multi-select for hosting companies (`companyIds`).
   - Show selected companies' combined roster count.
4. Add show management route and nav link in AdminPanel.
5. Add i18n keys for companies and shows in both locale files.

### Step 5: Match booking roster filtering + verification

1. Update `frontend/src/components/admin/ScheduleMatch.tsx`:
   - When an event is selected, look up its `companyIds`.
   - Filter wrestler picker to only show wrestlers from those companies' rosters.
   - If no event selected, show all wrestlers.
2. Update `backend/functions/matches/createMatch.ts`:
   - If match has an `eventId`, look up the event's `companyIds`.
   - Validate all participant wrestlers belong to one of the hosting companies.
3. Run TypeScript validation: `cd frontend && npx tsc --project tsconfig.app.json --noEmit` and `cd backend && npx tsc --project tsconfig.json --noEmit`.
4. Run tests to verify no regressions.
5. Update seed data to create sample companies, shows, and assign wrestlers to companies.
