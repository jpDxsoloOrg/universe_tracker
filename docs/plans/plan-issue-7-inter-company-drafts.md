# Plan: Inter-company drafts - draft from other companies' rosters

**GitHub issue:** #7 — [Inter-company drafts - draft from other companies' rosters](https://github.com/jpDxsoloOrg/universe_tracker/issues/7)

## Context

Extends the draft system from #6 to allow companies to draft wrestlers from other companies' rosters. This enables expansion drafts, roster shakeups, and trades. Companies can protect a configurable number of wrestlers from being drafted. The global pool can optionally be included.

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| During implementation | test-engineer | Generate tests for protection logic and inter-company validation |
| After implementation | code-reviewer | Review draft state changes and edge cases |
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Step 1 → Step 2 → Step 3
- **Agent types**:
  - Step 1: `generalPurpose` (backend: inter-company draft type, protections)
  - Step 2: `generalPurpose` (frontend: protection phase UI, updated draft board)
  - Step 3: `generalPurpose` (testing, edge cases, verification)

## Files to create

| File | Purpose |
|------|---------|
| `backend/functions/drafts/protectWrestler.ts` | POST /drafts/{draftId}/protect |
| `backend/functions/drafts/getProtections.ts` | GET /drafts/{draftId}/protections |

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/serverless.yml` | Modify | Add DraftProtections table, new HTTP events |
| `backend/functions/drafts/handler.ts` | Modify | Add protection routes |
| `backend/functions/drafts/createDraft.ts` | Modify | Support `type: "inter-company"`, `protectedPicksPerCompany`, `includeGlobalPool` |
| `backend/functions/drafts/startDraft.ts` | Modify | Validate protections are set before starting inter-company draft |
| `backend/functions/drafts/makePick.ts` | Modify | Inter-company pool logic: available = other companies' unprotected wrestlers (+ global pool if enabled) |
| `backend/functions/drafts/getDraft.ts` | Modify | Include protection data in response |
| `frontend/src/types/index.ts` | Modify | Update Draft interface with inter-company fields; add DraftProtection type |
| `frontend/src/services/api/drafts.api.ts` | Modify | Add protect/getProtections methods |
| `frontend/src/components/admin/ManageDrafts.tsx` | Modify | Add inter-company draft creation option |
| `frontend/src/components/admin/DraftBoard.tsx` | Modify | Protection phase, source company display, inter-company pool |
| `frontend/src/i18n/locales/en.json` | Modify | Add inter-company draft translation keys |
| `frontend/src/i18n/locales/de.json` | Modify | Add German translations |

## Implementation steps

### Step 1: Backend inter-company draft support

1. Add `DraftProtectionsTable` to `serverless.yml`:
   - PK: `draftId`, SK: `wrestlerId`.
   - Attributes: `companyId`, `protectedAt`.
2. Update `createDraft.ts`:
   - Accept `type: "global" | "inter-company"` (default "global").
   - For inter-company: accept `protectedPicksPerCompany` (number, default 0) and `includeGlobalPool` (boolean, default false).
3. Create `protectWrestler.ts`:
   - Validate draft is in `setup` status and type is `inter-company`.
   - Accept body: `{ companyId: string, wrestlerId: string }`.
   - Validate wrestler belongs to that company.
   - Validate company hasn't exceeded `protectedPicksPerCompany` limit.
   - Create DraftProtection record.
4. Create `getProtections.ts`:
   - Query all protections for a draft, grouped by company.
5. Update `startDraft.ts`:
   - For inter-company drafts: optionally validate that all companies have set their protections (or allow starting with fewer).
6. Update `makePick.ts`:
   - For inter-company drafts:
     - Available pool = wrestlers from other participating companies who are NOT protected.
     - If `includeGlobalPool` is true, also include unassigned wrestlers.
     - Exclude wrestlers from the picking company's own roster.
     - When picked: update wrestler's `companyId` to the new company.
7. Update `getDraft.ts`:
   - Include protections in the response.
   - For each pick, include source company info (where the wrestler came from).

### Step 2: Frontend inter-company UI

1. Update `ManageDrafts.tsx`:
   - Add draft type selector: "Global Pool Draft" vs "Inter-Company Draft".
   - For inter-company: show `protectedPicksPerCompany` input and `includeGlobalPool` toggle.
2. Update `DraftBoard.tsx` to handle protection phase:
   - **Protection phase** (before draft starts):
     - Each company sees their roster and can select wrestlers to protect (up to the limit).
     - Protected wrestlers shown with a shield/lock icon.
     - "Ready" button per company, "Start Draft" only available when all companies have confirmed protections.
   - **Drafting phase**:
     - Available wrestlers panel grouped by source company.
     - Each wrestler card shows their current company badge.
     - Protected wrestlers are visually excluded (grayed out or hidden).
     - After a pick, show "Drafted from [Company]" label on the pick cell.
   - **Completed view**:
     - Show all picks with source → destination company for each wrestler.
     - Summary per company: wrestlers gained, wrestlers lost.
3. Add i18n keys for inter-company draft labels.
4. Update `drafts.api.ts` with `protect` and `getProtections` methods.

### Step 3: Testing and verification

1. Test creating an inter-company draft with 3 companies.
2. Test protection phase: each company protects 2 wrestlers, verify protected wrestlers can't be picked.
3. Test picking: company A picks from company B's unprotected roster, verify `companyId` changes.
4. Test `includeGlobalPool`: verify global pool wrestlers appear when enabled, hidden when disabled.
5. Test edge case: company tries to pick their own wrestler (should fail).
6. Test edge case: all of a company's unprotected wrestlers are drafted.
7. Verify global drafts from #6 still work unchanged.
8. Run TypeScript validation: `cd frontend && npx tsc --project tsconfig.app.json --noEmit` and `cd backend && npx tsc --project tsconfig.json --noEmit`.
9. Run all tests.
