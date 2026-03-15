# Plan: Remove production deployment + rebrand infrastructure

**GitHub issue:** #1 — [Remove production deployment - devtest only](https://github.com/jpDxsoloOrg/universe_tracker/issues/1)

## Context

This project is a fork of league_szn being transformed into Universe Tracker. It needs its own independent infrastructure (service name, stage, DynamoDB tables, S3 bucket, API Gateway, CloudFront) while **sharing** the existing devtest Cognito User Pool from league_szn (`us-east-1_5GZ9UY8V2`). Production deployment must be removed entirely.

## Infrastructure mapping

| Resource | Old (league_szn) | New (universe_tracker) |
|----------|-------------------|------------------------|
| Service name | `wwe-2k-league-api` | `universe-tracker-api` |
| Default stage | `dev` | `dev` |
| CF Stack | `universe-tracker-api-dev` | `universe-tracker-api-dev` |
| DynamoDB | `wwe-2k-league-api-*-devtest` | `universe-tracker-api-*-dev` |
| S3 frontend | `dev.leagueszn.jpdxsolo.com` | `universe.jpdxsolo.com` |
| S3 images | `wwe-2k-league-api-images-devtest` | `universe-tracker-api-images-dev` |
| CloudFront | `dev.leagueszn.jpdxsolo.com` | `universe.jpdxsolo.com` |
| Cognito | Creates own pool | Hardcoded ref to `us-east-1_5GZ9UY8V2` / `5bn99khg7knh9v0t5dqbjpgh1d` |

## Skills to use

| When | Skill | Purpose |
|------|--------|---------|
| Before commit | git-commit-helper | Generate conventional commit message |

## Agents and parallel work

- **Suggested order**: Step 1 → Steps 2+3 in parallel → Step 4
- **Agent types**:
  - Step 1: `generalPurpose` (delete prod files, rename service, update serverless.yml)
  - Step 2: `generalPurpose` (update frontend env files and deploy workflow)
  - Step 3: `generalPurpose` (update CLAUDE.md)
  - Step 4: `generalPurpose` (verify build, no stale references)

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/deploy-prod.yml` | Delete | Remove production deployment workflow |
| `frontend/.env.production` | Delete | Remove production environment config |
| `frontend/.env.devtest` | Delete | No longer used (was for league_szn devtest) |
| `frontend/.env.universe` | Create | New env file for universe_tracker |
| `backend/serverless.yml` | Modify | Rename service, update Cognito to hardcoded refs, update S3/CloudFront domains, remove prod/devtest custom entries |
| `.github/workflows/deploy-dev.yml` | Modify | Update stack name, S3 bucket, stage, Cognito extraction |
| `CLAUDE.md` | Modify | Remove prod references, update all infrastructure docs |
| `frontend/.env.example` | Modify | Update example to match new service |

## Implementation steps

### Step 1: Rename service and update serverless.yml

1. Delete `.github/workflows/deploy-prod.yml`.
2. Delete `frontend/.env.production`.
3. In `backend/serverless.yml`:
   - Change line 1: `service: wwe-2k-league-api` → `service: universe-tracker-api`.
   - Change line 9: default stage stays `dev` (it already is).
   - **Replace Cognito resources with hardcoded references**:
     - Remove the `LeagueUserPool` CloudFormation resource (lines 761-787).
     - Remove `AdminGroup`, `ModeratorGroup`, `WrestlerGroup`, `FantasyGroup` resources (lines 790-820).
     - Remove the `LeagueUserPoolClient` resource (lines 822-839).
     - Remove Cognito Outputs (`CognitoUserPoolId`, `CognitoUserPoolClientId`) from Outputs section.
     - Change environment variables:
       - `COGNITO_USER_POOL_ID: !Ref LeagueUserPool` → `COGNITO_USER_POOL_ID: 'us-east-1_5GZ9UY8V2'`
       - `COGNITO_CLIENT_ID: !Ref LeagueUserPoolClient` → `COGNITO_CLIENT_ID: '5bn99khg7knh9v0t5dqbjpgh1d'`
     - Update IAM Cognito resource ARN:
       - `!GetAtt LeagueUserPool.Arn` → `arn:aws:cognito-idp:us-east-1:435238036810:userpool/us-east-1_5GZ9UY8V2`
   - **Update custom section** — replace stage-based domain/bucket maps:
     ```yaml
     allowedOrigin:
       dev: https://universe.jpdxsolo.com
       offline: '*'
     frontendBucket:
       dev: universe.jpdxsolo.com
       offline: 'localhost'
     frontendDomain:
       dev: universe.jpdxsolo.com
       offline: 'localhost'
     certificateArn:
       dev: ${env:ACM_CERTIFICATE_ARN, ''}
       offline: ''
     ```
   - Remove `devtest` and `prod` entries from all custom maps.
   - Update `splitStacksEnabled` to only have `dev: true` and `offline: false`.
   - Update all gateway response CORS fallback defaults from `leagueszn.jpdxsolo.com` to `universe.jpdxsolo.com`.
   - Update `ALLOWED_ORIGIN` fallback default to `https://universe.jpdxsolo.com`.

### Step 2: Update frontend env and deploy workflow

1. Delete `frontend/.env.devtest`.
2. Create `frontend/.env.universe`:
   ```
   VITE_API_BASE_URL=<will be filled after first deploy>
   VITE_COGNITO_USER_POOL_ID=us-east-1_5GZ9UY8V2
   VITE_COGNITO_CLIENT_ID=5bn99khg7knh9v0t5dqbjpgh1d
   VITE_AWS_REGION=us-east-1
   VITE_GITHUB_REPO=jpDxsoloOrg/universe_tracker
   VITE_GITHUB_BRANCH=main
   ```
3. Update `frontend/.env.example` to reflect new defaults.
4. Update `.github/workflows/deploy-dev.yml`:
   - Rename workflow name: `Deploy to Dev` → `Deploy Universe Tracker`.
   - Backend deploy: `npx serverless deploy --stage dev` (no `--stage devtest`; `dev` is the default but be explicit).
   - Cognito extraction: Since Cognito is no longer in the stack, hardcode the values instead of extracting from CloudFormation:
     ```yaml
     - name: Set Cognito IDs
       id: cognito
       run: |
         echo "user_pool_id=us-east-1_5GZ9UY8V2" >> $GITHUB_OUTPUT
         echo "client_id=5bn99khg7knh9v0t5dqbjpgh1d" >> $GITHUB_OUTPUT
     ```
   - Frontend build: `npm run build -- --mode universe` (uses `.env.universe`).
   - S3 sync: `aws s3 sync dist s3://universe.jpdxsolo.com --delete --exclude "*.map"`.
   - CloudFront extraction: update stack name from `wwe-2k-league-api-devtest` → `universe-tracker-api-dev`.
   - Deployment summary: update URL to `https://universe.jpdxsolo.com`.
   - Update env var name from `DEV_ACM_CERTIFICATE_ARN` to `ACM_CERTIFICATE_ARN` (only one env now).
   - Update env var name from `DEV_API_BASE_URL` to `API_BASE_URL`.
   - Update GitHub Secrets references accordingly.

### Step 3: Update CLAUDE.md

1. Remove the entire **Prod** row from the Environment Overview table.
2. Update the **Dev** row:
   - Frontend URL: `https://universe.jpdxsolo.com`
   - S3 Bucket: `universe.jpdxsolo.com`
   - Serverless Stage: `dev`
   - Stack name: `universe-tracker-api-dev`
   - API URL: TBD after first deploy
3. Remove the entire "Deploy to PROD" section.
4. Update "Deploy to DEV" section:
   - Backend: `cd backend && npx serverless deploy --aws-profile league-szn`
   - Frontend: `cd frontend && npm run build -- --mode universe && aws s3 sync dist s3://universe.jpdxsolo.com --profile league-szn --delete`
5. Remove all references to `leagueszn.jpdxsolo.com` (prod domain).
6. Update DNS Configuration section to only reference `universe.jpdxsolo.com`.
7. Update CloudFront domain lookup command to use `universe-tracker-api-dev` stack.
8. Note that user must create CNAME `universe` → CloudFront domain in Namecheap after first deploy.
9. Update service name references throughout.
10. Note that Cognito is shared from league_szn devtest — do not recreate.

### Step 4: Verify

1. Search entire codebase for remaining `wwe-2k-league-api` references (should be none outside docs/plans).
2. Search for `leagueszn.jpdxsolo.com` references (should be none outside docs/plans).
3. Search for `devtest` stage references (should be none outside docs/plans).
4. Search for `.env.production` and `.env.devtest` references.
5. Run `cd frontend && npx tsc --project tsconfig.app.json --noEmit`.
6. Run `cd backend && npx tsc --project tsconfig.json --noEmit`.
7. Verify `frontend/.env.universe` is valid.

## Post-deploy manual step

After the first deploy, the user must:
1. Get the CloudFront domain: `aws cloudformation describe-stacks --stack-name universe-tracker-api-dev --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text --profile league-szn`
2. Get the API Gateway URL: `aws cloudformation describe-stacks --stack-name universe-tracker-api-dev --query "Stacks[0].Outputs[?OutputKey=='ServiceEndpoint'].OutputValue" --output text --profile league-szn`
3. Create CNAME record in Namecheap: `universe` → `<CloudFront-Domain>.cloudfront.net`
4. Update `VITE_API_BASE_URL` in `frontend/.env.universe` with the actual API Gateway URL.
5. Rebuild and redeploy frontend.
