# Plan: Bulk import wrestlers via CSV/JSON upload

**GitHub issue:** #5 — [Bulk import wrestlers via CSV/JSON upload](https://github.com/jpDxsoloOrg/universe_tracker/issues/5)

## Context

Users should be able to import many wrestlers at once into the global pool (or optionally into a company) via CSV or JSON file. Individual creation still works alongside this. This is critical for setting up a new universe with a large roster quickly.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| During implementation | test-engineer | Generate tests for import endpoint |
| After implementation | code-reviewer | Review validation logic and error handling |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2 in parallel → Step 3
- **Agent types**:
  - Step 1: `generalPurpose` (backend import endpoint)
  - Step 2: `generalPurpose` (frontend import UI with CSV/JSON parsing)
  - Step 3: `generalPurpose` (integration testing, verification)

## Files to create

| File | Purpose |
|------|---------|
| `backend/functions/wrestlers/importWrestlers.ts` | POST /wrestlers/import handler |
| `frontend/src/components/admin/ImportWrestlers.tsx` | Import UI with file upload, preview, results |
| `frontend/src/components/admin/ImportWrestlers.css` | Styles for import UI |
| `frontend/public/templates/wrestler-import-template.csv` | Downloadable CSV template |

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/functions/wrestlers/handler.ts` | Modify | Add route for POST /wrestlers/import |
| `backend/serverless.yml` | Modify | Add HTTP event for import endpoint (if separate function needed for timeout) |
| `frontend/src/services/api/wrestlers.api.ts` | Modify | Add importWrestlers method |
| `frontend/src/components/admin/ManageWrestlers.tsx` | Modify | Add link/tab to import UI |
| `frontend/src/components/admin/AdminPanel.tsx` | Modify | Add import option in admin nav |
| `frontend/src/i18n/locales/en.json` | Modify | Add import-related translation keys |
| `frontend/src/i18n/locales/de.json` | Modify | Add German translations |

## Implementation steps

### Step 1: Backend import endpoint

1. Create `backend/functions/wrestlers/importWrestlers.ts`:
   - Accept JSON body: `{ wrestlers: WrestlerImport[], companyId?: string }`.
   - `WrestlerImport` type: `{ name: string, nickname?: string, finisher?: string, weight?: string, height?: string, hometown?: string, alignment?: 'face' | 'heel' | 'tweener', imageUrl?: string }`.
   - Validate each entry: `name` is required, non-empty, trimmed.
   - If `companyId` provided, validate the company exists.
   - Check for duplicate names within the import batch.
   - Optionally check for existing wrestlers with same name in DB (flag as warnings).
   - Use DynamoDB `BatchWriteItem` — handle 25-item batch limit by chunking.
   - Generate `wrestlerId` (UUID) for each wrestler.
   - Set `createdAt` and `updatedAt` timestamps.
   - Return: `{ imported: number, failed: number, total: number, errors: Array<{ index: number, name: string, reason: string }> }`.
2. Add route in `backend/functions/wrestlers/handler.ts` for `POST /wrestlers/import`.
3. Consider Lambda timeout — bulk imports may need more than the default 6s. Set timeout to 30s for this function if using a separate Lambda, or ensure the wrestlers handler has sufficient timeout.
4. Admin auth required.

### Step 2: Frontend import UI

1. Create `frontend/src/components/admin/ImportWrestlers.tsx`:
   - **File upload section**: Accept `.csv` and `.json` files via file input.
   - **CSV parsing**: Parse CSV in browser using simple split logic (handle quoted fields with commas). Map column headers to wrestler fields.
   - **JSON parsing**: Parse JSON array directly.
   - **Optional company selector**: Dropdown to assign all imported wrestlers to a company.
   - **Preview table**: Show parsed wrestlers in a table before import. Highlight any validation issues (missing name, invalid alignment).
   - **Import button**: Sends parsed data to `POST /wrestlers/import`. Show loading spinner.
   - **Results panel**: Show success count, failure count, and error details.
   - **Template download**: Link to download the CSV template file.
2. Create `frontend/public/templates/wrestler-import-template.csv` with headers and 2-3 example rows.
3. Add `importWrestlers` method to `frontend/src/services/api/wrestlers.api.ts`.
4. Update `frontend/src/components/admin/ManageWrestlers.tsx` — add a tab or button to switch to the import view.
5. Add i18n translation keys for import UI labels, buttons, and messages.

### Step 3: Verification

1. Test importing a CSV with 5 wrestlers — verify all created in DynamoDB.
2. Test importing a JSON with 30+ wrestlers — verify batch chunking works.
3. Test validation: missing name, invalid alignment, duplicate names in batch.
4. Test importing with `companyId` — verify wrestlers assigned to company.
5. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`.
6. Run `cd backend && npx tsc --project tsconfig.json --noEmit`.
7. Run tests.
