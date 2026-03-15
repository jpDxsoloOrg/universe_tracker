# Plan: Bulk import wrestlers via CSV/JSON upload

**GitHub issue:** #5 — [Bulk import wrestlers via CSV/JSON upload](https://github.com/jpDxsoloOrg/universe_tracker/issues/5)

## Context

Users need to bulk-import many wrestlers at once to quickly populate a new universe. The backend needs a `POST /wrestlers/import` endpoint that accepts an array of wrestler objects, validates each, and uses DynamoDB BatchWriteItem (chunked in batches of 25). The frontend needs a file upload UI with CSV/JSON parsing, preview table, and results summary. Individual wrestler creation remains unchanged.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Steps 1+2 in parallel → Step 3
- **Agent types**:
  - Step 1: `general-purpose` (backend import endpoint + tests)
  - Step 2: `general-purpose` (frontend import UI + API service + i18n + tests)
  - Step 3: `general-purpose` (verification and cleanup)

## Implementation steps

### Step 1: Backend import endpoint and tests

**1. Add `batchWrite` utility to `backend/lib/dynamodb.ts`:**

Add a `batchWrite` method to the `dynamoDb` object that wraps `BatchWriteCommand` from `@aws-sdk/lib-dynamodb`. It should accept a table name and an array of items, chunk them into batches of 25, and handle unprocessed items with retry:

```typescript
batchWrite: async (tableName: string, items: Record<string, unknown>[]) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }
  for (const chunk of chunks) {
    const params = {
      RequestItems: {
        [tableName]: chunk.map(item => ({ PutRequest: { Item: item } })),
      },
    };
    let result = await docClient.send(new BatchWriteCommand(params));
    // Retry unprocessed items (simple retry, not exponential backoff)
    let retries = 0;
    while (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0 && retries < 3) {
      result = await docClient.send(new BatchWriteCommand({ RequestItems: result.UnprocessedItems }));
      retries++;
    }
  }
}
```

Import `BatchWriteCommand` from `@aws-sdk/lib-dynamodb` at the top of the file.

**2. Create `backend/functions/wrestlers/importWrestlers.ts`:**

- Parse body expecting `{ wrestlers: WrestlerImport[], companyId?: string }`.
- `WrestlerImport`: `{ name: string, nickname?: string, finisher?: string, weight?: string, height?: string, hometown?: string, alignment?: 'face' | 'heel' | 'tweener', imageUrl?: string }`.
- Validate:
  - `wrestlers` is a non-empty array, max 500 items.
  - Each entry must have a non-empty `name` (trimmed).
  - If `alignment` provided, must be one of `face`, `heel`, `tweener`.
  - Check for duplicate names within the batch (case-insensitive).
  - If `companyId` provided, verify company exists in COMPANIES table.
- For each valid wrestler, build a DynamoDB item with: `wrestlerId` (uuid), `name`, optional fields, `companyId` (if provided), `wins: 0`, `losses: 0`, `draws: 0`, `createdAt`, `updatedAt`.
- Use `dynamoDb.batchWrite(TableNames.WRESTLERS, validItems)` for bulk insert.
- Return `{ imported: number, failed: number, total: number, errors: Array<{ index: number, name: string, reason: string }> }`.
- Wrap in try/catch, return serverError on unexpected failure.

**3. Update `backend/functions/wrestlers/handler.ts`:**

Add route: `{ resource: '/wrestlers/import', method: 'POST', handler: importWrestlersHandler }`.
Import the handler from `./importWrestlers`.

**4. Update `backend/serverless.yml`:**

Add HTTP event to the `wrestlers` function:
```yaml
- http:
    path: wrestlers/import
    method: post
    cors: *corsConfig
    authorizer: adminAuthorizer
```

Also increase the wrestlers function timeout to 30 seconds (to handle large imports):
```yaml
wrestlers:
  timeout: 30
```

**5. Create `backend/functions/wrestlers/__tests__/importWrestlers.test.ts`:**

Test cases:
- Successfully imports array of valid wrestlers, returns 201 with correct counts.
- Returns 400 when body is null.
- Returns 400 when wrestlers is not an array.
- Returns 400 when wrestlers array is empty.
- Returns 400 when wrestlers array exceeds 500.
- Returns 400 when a wrestler is missing name.
- Returns 400 when duplicate names in batch.
- Returns 400 when invalid alignment value.
- Validates companyId exists when provided, returns 404 if not found.
- Handles partial failures (some valid, some invalid entries) — imports valid ones, returns errors for invalid.
- Handles batch chunking (mock batchWrite to verify it's called).
- Returns 500 on unexpected error.

Mock `dynamoDb` (get, batchWrite), `uuid`, following the pattern in existing test files like `scheduleMatch.test.ts`.

### Step 2: Frontend import UI, API, i18n, and tests

**1. Add `bulkImport` method to `frontend/src/services/api/wrestlers.api.ts`:**

```typescript
bulkImport: async (wrestlers: Partial<Wrestler>[], companyId?: string): Promise<BulkImportResponse> => {
  return fetchWithAuth(`${API_BASE_URL}/wrestlers/import`, {
    method: 'POST',
    body: JSON.stringify({ wrestlers, companyId }),
  });
}
```

Add `BulkImportResponse` interface:
```typescript
export interface BulkImportResponse {
  imported: number;
  failed: number;
  total: number;
  errors: Array<{ index: number; name: string; reason: string }>;
}
```

**2. Create `frontend/public/templates/wrestler-import-template.csv`:**

```csv
name,nickname,finisher,weight,height,hometown,alignment
"Stone Cold Steve Austin","The Rattlesnake","Stone Cold Stunner","252","6'2","Victoria, TX","tweener"
"The Rock","The Great One","Rock Bottom","260","6'5","Miami, FL","face"
```

**3. Create `frontend/src/components/admin/ImportWrestlers.tsx`:**

Component structure:
- **Props**: `onImportComplete: () => void` callback to refresh wrestler list after import.
- **State**: `file`, `parsedWrestlers`, `validationErrors`, `importing`, `importResult`, `selectedCompanyId`, `companies`.
- **File upload**: `<input type="file" accept=".csv,.json" />`.
- **CSV parsing function**: Split by newlines, parse header row, map data rows to wrestler objects. Handle quoted fields with commas inside quotes (simple regex or manual parse).
- **JSON parsing function**: `JSON.parse(fileContent)` — validate it's an array.
- **Company selector**: Fetch companies on mount, optional dropdown.
- **Preview table**: Show parsed wrestlers in a table with columns: #, Name, Nickname, Finisher, Weight, Height, Hometown, Alignment. Highlight rows with validation issues.
- **Client-side validation**: Check required `name` field, valid `alignment` values, duplicate names.
- **Import button**: Calls `wrestlersApi.bulkImport(parsedWrestlers, selectedCompanyId)`.
- **Results panel**: Shows imported/failed counts and error details list.
- **Template download**: Link to `/templates/wrestler-import-template.csv`.
- **Clear/Reset button**: Clear file and results to start over.

**4. Create `frontend/src/components/admin/ImportWrestlers.css`:**

Style the import UI following the pattern of ManageCompanies.css — file upload area, preview table, results panel, error list.

**5. Update `frontend/src/components/admin/ManageWrestlers.tsx`:**

Add an "Import Wrestlers" button/section that toggles showing the `ImportWrestlers` component. When import completes, refresh the wrestler list.

**6. Add i18n keys to `frontend/src/i18n/locales/en.json`:**

Under a new `import` section within `wrestlers`:
```json
"import": {
  "title": "Import Wrestlers",
  "description": "Upload a CSV or JSON file to bulk import wrestlers.",
  "selectFile": "Select File",
  "downloadTemplate": "Download CSV Template",
  "preview": "Preview",
  "import": "Import",
  "importing": "Importing...",
  "results": "Import Results",
  "imported": "Imported",
  "failed": "Failed",
  "total": "Total",
  "errors": "Errors",
  "noFile": "No file selected",
  "invalidFile": "Invalid file type. Please upload a .csv or .json file.",
  "parseError": "Failed to parse file",
  "emptyFile": "File contains no wrestler data",
  "assignToCompany": "Assign to Company (optional)",
  "noCompany": "No company (global pool)",
  "clear": "Clear",
  "csvFormat": "CSV Format",
  "jsonFormat": "JSON Format"
}
```

**7. Add German translations to `frontend/src/i18n/locales/de.json`:**

Same structure with German text.

**8. Create `frontend/src/components/admin/__tests__/ImportWrestlers.test.tsx`:**

Test cases:
- Renders file upload input and template download link.
- Parses CSV file and shows preview table.
- Parses JSON file and shows preview table.
- Shows validation errors for missing name.
- Calls API with parsed wrestlers on import button click.
- Shows import results after successful import.
- Shows error details for failed imports.
- Company selector appears and works.

### Step 3: Verification

1. Run `cd backend && npx tsc --project tsconfig.json --noEmit`
2. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`
3. Run backend tests: `cd backend && npx vitest run`
4. Run frontend tests: `cd frontend && npx vitest run`
5. Fix any failures.

## Dependencies and order

- Steps 1 and 2 have no file overlap and can run in parallel.
- Step 3 depends on Steps 1+2.

**Suggested order:** Steps 1+2 → Step 3

## Testing and verification

- TypeScript compilation passes (both frontend and backend)
- All existing tests pass
- New import endpoint returns correct responses for valid/invalid input
- CSV and JSON parsing works in frontend
- Preview table displays parsed data correctly
- Import results show success/failure summary
- BatchWriteItem handles chunking correctly

## Risks and edge cases

- **Lambda timeout**: Large imports (500 wrestlers) may approach default 6s timeout. Mitigated by setting 30s timeout on wrestlers function.
- **CSV parsing edge cases**: Quoted fields with commas, newlines in quoted fields, different line endings. Keep CSV parser simple — handle basic quoted commas.
- **Duplicate detection**: Only checking within batch, not against existing DB records (would require scanning entire table). Can add as future enhancement.
- **BatchWriteItem unprocessed items**: DynamoDB may return unprocessed items under load. Simple retry logic handles this.
