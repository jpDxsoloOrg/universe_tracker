# Plan: Add Image Upload and Day-of-Week to Shows

## Context
The Shows feature already exists with basic CRUD (name, companyId, schedule, description). The TODO requests two enhancements:
1. **Image support** — Shows should have an associated image (like wrestlers and championships already do).
2. **Day of week** — Weekly shows should specify which day they air (e.g., Monday for RAW, Wednesday for Dynamite).

The existing schedule field (`'weekly' | 'ppv' | 'special'`) handles show type, but there's no `dayOfWeek` field and no `imageUrl` field. Image upload infrastructure (presigned S3 URLs) already exists but only supports `wrestlers` and `championships` folders.

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/types/index.ts` | Modify | Add `imageUrl` and `dayOfWeek` to Show interface |
| `backend/functions/shows/createShow.ts` | Modify | Add `imageUrl` and `dayOfWeek` to optionalFields |
| `backend/functions/shows/updateShow.ts` | Modify | Add `imageUrl` and `dayOfWeek` to UpdateShowBody and buildUpdateExpression |
| `backend/functions/images/generateUploadUrl.ts` | Modify | Add `'shows'` to allowed folders |
| `frontend/src/services/api/images.api.ts` | Modify | Add `'shows'` to folder union type |
| `frontend/src/services/api/shows.api.ts` | Modify | Add `imageUrl` and `dayOfWeek` to create payload type |
| `frontend/src/components/admin/ManageShows.tsx` | Modify | Add image upload UI and day-of-week picker |
| `frontend/src/components/admin/ManageShows.css` | Modify | Add image preview/upload styles |
| `frontend/src/i18n/locales/en.json` | Modify | Add translation keys for image and day-of-week |
| `frontend/src/i18n/locales/de.json` | Modify | Add German translations for image and day-of-week |

## Implementation Steps

### Step 1: Add fields to Show TypeScript interface
**File:** `frontend/src/types/index.ts:215-223`
- Add `imageUrl?: string` to the Show interface
- Add `dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'` to the Show interface

### Step 2: Update backend createShow handler
**File:** `backend/functions/shows/createShow.ts:10`
- Add `'imageUrl'` and `'dayOfWeek'` to the `optionalFields` array (currently `['description', 'schedule']`)

### Step 3: Update backend updateShow handler
**File:** `backend/functions/shows/updateShow.ts:7-12`
- Add `imageUrl?: string` and `dayOfWeek?: string` to the `UpdateShowBody` interface
- **File:** `backend/functions/shows/updateShow.ts:41-46`
- Add `imageUrl: body.imageUrl` and `dayOfWeek: body.dayOfWeek` to the `buildUpdateExpression` call

### Step 4: Add 'shows' folder to image upload backend
**File:** `backend/functions/images/generateUploadUrl.ts:16`
- Change `folder: 'wrestlers' | 'championships'` to `folder: 'wrestlers' | 'championships' | 'shows'`
- **File:** `backend/functions/images/generateUploadUrl.ts:31`
- Change the `includes` check from `['wrestlers', 'championships']` to `['wrestlers', 'championships', 'shows']`

### Step 5: Add 'shows' folder to image upload frontend API
**File:** `frontend/src/services/api/images.api.ts:7`
- Change the `folder` parameter type from `'wrestlers' | 'championships'` to `'wrestlers' | 'championships' | 'shows'`

### Step 6: Update shows API create payload type
**File:** `frontend/src/services/api/shows.api.ts:16`
- Add `imageUrl?: string` and `dayOfWeek?: string` to the create method's parameter type

### Step 7: Add i18n translation keys
**File:** `frontend/src/i18n/locales/en.json` — under the existing `shows` section, add:
- `shows.dayOfWeek`: "Day of Week"
- `shows.image`: "Show Image"
- `shows.uploadImage`: "Upload Image"
- `shows.removeImage`: "Remove Image"
- `shows.monday` through `shows.sunday`: Day names
- `shows.selectDay`: "Select day of week"

**File:** `frontend/src/i18n/locales/de.json` — add German equivalents:
- `shows.dayOfWeek`: "Wochentag"
- `shows.image`: "Show-Bild"
- `shows.uploadImage`: "Bild hochladen"
- `shows.removeImage`: "Bild entfernen"
- `shows.monday`: "Montag" through `shows.sunday`: "Sonntag"
- `shows.selectDay`: "Wochentag auswählen"

### Step 8: Add image upload and day-of-week to ManageShows component
**File:** `frontend/src/components/admin/ManageShows.tsx`

**New imports needed:**
- Import `ChangeEvent` from React (line 1)
- Import `imagesApi` from services/api (line 3)
- Import `FILE_UPLOAD_LIMITS` from `../../constants` (new import)

**New state variables** (after line 17):
- `selectedFile: File | null` — for the image file to upload
- `imagePreview: string | null` — for the base64 preview
- `uploading: boolean` — loading state during S3 upload

**Update formData** (line 19-24):
- Add `imageUrl: ''` to the formData state object

**Add image handling functions** (follow ManageChampionships pattern from lines 110-183):
- `handleFileSelect(e: ChangeEvent<HTMLInputElement>)` — validate file type/size using `FILE_UPLOAD_LIMITS`, create FileReader preview, set selectedFile
- `clearImage()` — reset selectedFile, imagePreview, and formData.imageUrl
- `uploadImage(): Promise<string | null>` — call `imagesApi.generateUploadUrl(file.name, file.type, 'shows')`, then `imagesApi.uploadToS3(uploadUrl, file)`, return imageUrl

**Update handleSubmit** (line 56-92):
- Before the API call, call `uploadImage()` to get the imageUrl
- Include `imageUrl` and `dayOfWeek` in the create/update payloads

**Update handleEdit** (line 94-103):
- Set `imageUrl` and `dayOfWeek` in formData from the show being edited
- Set `imagePreview` to show's existing imageUrl if present

**Update handleCancel** (line 125-129):
- Reset `imageUrl`, `dayOfWeek`, `selectedFile`, `imagePreview`

**Update formData reset** (line 85):
- Include `imageUrl: ''` and `dayOfWeek: ''` in the reset object

**Add form fields in the JSX** (after the schedule select, around line 202):
- Day of week select: `<select>` with options for each day (monday-sunday), shown conditionally when schedule is 'weekly'
- Image upload section: file input with accept="image/*", preview thumbnail, remove button (same pattern as ManageChampionships lines 380-410)

**Update show cards** (lines 241-266):
- Display show image in the card if `show.imageUrl` exists (before the show name)
- Display day of week badge next to the schedule badge when present

### Step 9: Add image and day-of-week CSS styles
**File:** `frontend/src/components/admin/ManageShows.css`

Add styles following the ManageChampionships.css pattern:
- `.show-image-section` — container for image upload area
- `.show-image-preview` — thumbnail preview with max dimensions
- `.show-image-preview img` — object-fit cover, border-radius
- `.show-image-upload-btn` — styled file input trigger
- `.show-card-image` — image display in show cards (top of card)
- `.show-card-image img` — width 100%, border-radius top corners
- `.show-day-badge` — styling for the day-of-week badge in cards

## Dependencies & Order

1. **Types first** (Step 1) — all other steps depend on the updated Show interface
2. **Backend updates** (Steps 2-4) — can be done in parallel, no cross-dependencies
3. **Frontend API** (Steps 5-6) — depends on Step 1 types
4. **i18n** (Step 7) — independent of code changes, can be done in parallel with anything
5. **Component UI** (Step 8) — depends on Steps 1, 5, 6, 7
6. **CSS** (Step 9) — depends on Step 8 (needs to know class names)

**Parallel groups:**
- Group A (parallel): Steps 1, 7
- Group B (parallel, after Group A): Steps 2, 3, 4, 5, 6
- Group C (sequential, after Group B): Step 8, then Step 9

## Testing & Verification

### Manual Testing
1. Create a new show with an image — verify image uploads to S3 under `shows/` folder and displays in the form preview
2. Create a weekly show with day-of-week set to "Monday" — verify dayOfWeek persists and displays
3. Edit an existing show to add an image — verify image appears after save
4. Edit an existing show to change image — verify new image replaces old
5. Edit an existing show to remove image — verify imageUrl is cleared
6. Create a PPV/special show — verify day-of-week picker is hidden (only shown for weekly)
7. Verify show cards display images and day-of-week badges correctly
8. Test with large files (>5MB) — should show error from FILE_UPLOAD_LIMITS
9. Test with invalid file types (e.g., .pdf) — should show error

### TypeScript Validation
- Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`
- Run `cd backend && npx tsc --project tsconfig.json --noEmit`

### Existing Tests
- No existing test files for shows were found. No tests should break.

## Risks & Edge Cases

1. **S3 folder naming** — Using `'shows'` as the folder name. Ensure it doesn't conflict with any existing S3 prefix (currently only `wrestlers/` and `championships/` exist).
2. **Day of week only for weekly shows** — The `dayOfWeek` field is only meaningful when `schedule === 'weekly'`. The UI should conditionally show/hide the day picker. Backend should accept dayOfWeek regardless of schedule (no server-side enforcement needed — it's a UI convenience).
3. **Existing shows without imageUrl/dayOfWeek** — Since DynamoDB is schema-less, existing show records won't have these fields. The frontend already handles optional fields with `show.description &&` guards. Apply the same pattern for `show.imageUrl` and `show.dayOfWeek`.
4. **Image deletion from S3** — When a show image is replaced or removed, the old image file remains in S3. This is consistent with how wrestlers and championships handle images (no S3 deletion on update). Not a blocker but creates orphaned files over time.
