# Railway Security Recovery Runbook — Kindcipe

Last updated: **2026-10-22 05:09 UTC / 13:09 HKT**

This file contains no passwords, API keys, tokens, or full database URLs.
Use Railway/Vercel/provider dashboards for secret values.

## 1. Status Snapshot

- Railway incident: **Railway Platform Outage — Major Outage**
- Status page: https://status.railway.com/
- Workspace plan: **Hobby**
- Builds as of 04:52 UTC:
  - Enterprise: builds available
  - Pro: paused
  - **Hobby: paused**
  - Free/Trial: paused
- Redeploy: fixed for Enterprise only; other tiers still waiting
- Railway API tokens: all invalidated by Railway on 2026-10-22
- Existing Kindcipe services: still running
- Backend health: `200`
- Database: still at schema `0040`; migrations `0041` and `0042` not applied
- User impact: no new deploys, no DB password rotation, no migration

Next Railway update: **05:30 UTC / 13:30 HKT** (or sooner).

Do not assume Hobby builds are available until the status page explicitly says so.

## 2. Current Production State

| Item | Value |
|---|---|
| Railway project | `kindcipe-backend` |
| Project ID | `aa11fc90-6927-41b6-ad2d-132f6735c8b2` |
| Environment | `production` |
| Environment ID | `3565d7f2-29ba-44bf-8930-32dd6908f491` |
| Backend service | `kindcipe-backend` / `5b32013e-2989-4f64-a73c-9fdadcb5d291` |
| Postgres service | `Postgres` / `70243829-2afa-4697-b3e4-87e4581640f3` |
| Latest backend deployment | `2b7bca47-7cee-4d81-9e5d-4291eb40c355` |
| Deployment status | `SUCCESS` / instance `RUNNING` |
| Backend Railway domain | `kindcipe-backend-production.up.railway.app` |
| Custom domain | `api.kindcipe.com` — still `NXDOMAIN` |
| Database host (rendered) | `postgres.railway.internal:5432` |
| Database name | `railway` |
| Schema version | `0040_recipe_scenario_tags` |
| `earlybird_redemptions` | Missing until `0041` |
| Postgres public TCP proxy | **Removed** |
| `DATABASE_PUBLIC_URL` | **Removed** |

### `DATABASE_URL`

Backend variable has been changed to:

```text
${{Postgres.DATABASE_URL}}
```

Railway CLI resolves references when listing variables, so it may display the
rendered internal URL instead of the raw reference. Check the Railway Variables
UI to confirm the raw value is the reference above.

Do **not** paste a full connection string back into `DATABASE_URL`.

## 3. Backup

- Path: `/Users/mavisng/kindcipe-backups/railway-pre-rotate-20261022T113844.dump`
- Size: `879K`
- Format: PostgreSQL custom dump
- TOC entries: `720`
- Database: `railway`
- SHA-256:

```text
bd1f11f160072ad5d9568521d3a1b32deb9a776f1725e2fa48da04d364c5fd84
```

Validation already performed:

```bash
pg_restore --list /Users/mavisng/kindcipe-backups/railway-pre-rotate-20261022T113844.dump
```

Keep this file until after the migration, rotation, and production verification
are complete.

## 4. Do Not Do Yet

Until the Railway status page says **Hobby builds are enabled**:

- Do not rotate the Postgres password
- Do not manually edit `POSTGRES_PASSWORD` or `PGPASSWORD`
- Do not run `ALTER USER`
- Do not deploy or press Redeploy repeatedly
- Do not apply migrations that depend on files not present in the running image
- Do not re-enable the Postgres public TCP proxy
- Do not close or delete any Railway volume
- Do not delete the backup

Why: rotating the password restarts Postgres. The backend cannot reconnect until
it is redeployed with the new variable. If Hobby builds are paused, that can leave
the backend down indefinitely.

## 5. Recovery Sequence

Start only after the status page explicitly confirms Hobby builds are enabled.

### Step 0 — Reconfirm conditions

- Railway status says Hobby builds enabled
- Backup file and checksum still match Section 3
- Backend `DATABASE_URL` is still the reference
- Latest deployment is still the known deployment from Section 2
- Backend health is `200`
- No unexpected Railway audit-log activity

### Step 1 — Apply migrations `0041` and `0042`

Apply migrations before deploying application code that expects
`earlybird_redemptions` or webhook-ordering columns.

Preferred access: Railway SSH/private network to the Postgres service.

Fallback access: a controlled, temporary migration runner. Do not re-enable the
public TCP proxy unless there is no safer option; if it is re-enabled, close it
immediately after the migration.

Do not create the table by hand. Use the checked-in SQL:

- `drizzle/migrations/0041_earlybird_billing.sql`
- `drizzle/migrations/0042_billing_webhook_ordering.sql`

Verify:

```sql
select to_regclass('public.earlybird_redemptions');
```

Expected: a non-null table name.

```sql
select count(*) from earlybird_redemptions;
```

Expected: `0` on a clean production migration.

### Step 2 — Rotate the Postgres password

Use Railway's supported flow:

```text
Postgres service
-> Database
-> Config
-> Connection
-> Regenerate
```

This changes the password inside PostgreSQL and updates the Railway variables.
Do not edit the variables manually.

Postgres will restart and all existing sessions will drop. This is expected.

### Step 3 — Deploy the backend immediately

Use **Redeploy** if it is available for Hobby by then. It is the fastest way to
restart the backend with the new variable.

Otherwise use:

```text
Backend service
-> Ctrl/Cmd+K
-> Deploy Latest Commit
```

Do not use Restart as a substitute for a redeploy. Restart does not reliably
apply new environment variables.

Before deploying, confirm which commit Railway will build. Local backend changes
are currently uncommitted, so do not assume a Railway deploy includes them.

### Step 4 — Verify rotation and deployment

Check backend logs for:

```text
Kindcipe backend running
DB warmup query completed
```

There must be no:

```text
password authentication failed
DB warmup failed
```

Check:

```bash
curl -sS https://kindcipe-backend-production.up.railway.app/health
```

Expected:

```json
{"status":"ok"}
```

Check service state:

```bash
railway status --json | jq -r '.environments.edges[0].node.serviceInstances.edges[].node | "\(.serviceName): \(.latestDeployment.status) / \(.latestDeployment.instances[0].status)"'
```

Expected:

```text
kindcipe-backend: SUCCESS / RUNNING
Postgres: SUCCESS / RUNNING
```

### Step 5 — Confirm no stale connections

Use Railway's Postgres guide and inspect sessions:

```sql
select pid, usename, client_addr, application_name, backend_start, state
from pg_stat_activity
where datname = current_database();
```

The password rotation should have dropped all pre-rotation sessions. Investigate
and terminate any session that cannot be explained.

## 6. Post-Recovery Work

### Custom API domain

`api.kindcipe.com` is configured in Railway but public DNS returns `NXDOMAIN`.
The working backend endpoint is the Railway-provided domain.

Later, add a Cloudflare DNS record:

```text
Type: CNAME
Name: api
Target: kindcipe-backend-production.up.railway.app
Proxy: DNS only
```

Verify with:

```bash
dig +short api.kindcipe.com
```

Do not change DNS during the Railway incident recovery.

### Start command and build settings

There is a mismatch to resolve before the next production deploy:

- Screenshot/config shows: `npm run start`
- Railway service override previously showed: `npx tsx server/index.ts`

Decide on one start command and verify it in the deployment details.

The current build command also uses:

```text
NODE_ENV=development npm install && npm run build
```

Review whether production builds should use a production value instead.

### C9T promo codes

The old Supabase CSV is invalid for Railway production:

```text
/Users/mavisng/kindcipe-promo/c9t-2026-10-21.csv
```

After migration and verified deploy, generate a new batch with 30-day validity:

```bash
npm run promo:codes -- gen --count 100 --valid-days 30 --commit
```

Do not distribute the old CSV.

### Known billing work

Still pending after infrastructure recovery:

- P0: pending paid checkout can be expired/released when a webhook is delayed
- P1: stale `complete`/unpaid sessions must not release founding slots
- Promo eligibility must treat `pending` Stripe subscriptions as prior paid access
- `scripts/promo-codes.ts` writes CSV during dry-run
- `scripts/db-migrate.ts` can mask duplicate-key migration errors
- Stripe is still in test mode; Live activation remains deferred

## 7. Known Errors

### `earlybird_redemptions does not exist`

Observed in Postgres logs:

```text
ERROR: relation "earlybird_redemptions" does not exist
STATEMENT: select count(*) as earlybird from earlybird_redemptions;
```

Interpretation:

- Railway production is at schema `0040`
- `earlybird_redemptions` is created by `0041`
- This exact SQL is not in the backend repository, so it was likely a manual
  Railway Data/Query-tab query
- It is a schema mismatch, not a backend crash or data loss
- Fix by applying `0041`; do not hand-create the table

### `[Auth] Missing session token`

Expected for unauthenticated/guest requests. It is not evidence of a database
outage or a successful intrusion.

### `api.kindcipe.com` NXDOMAIN

Railway has the custom domain, but Cloudflare has no `api` record yet. Use the
Railway-provided domain until DNS is fixed.

## 8. Rollback and Safety

- Preserve the backup until production is verified.
- If a deploy fails, keep the previous successful deployment available.
- Do not restore the database unless there is confirmed data corruption.
- If credentials were actively abused, identify affected provider usage first,
  preserve evidence, and then rotate.
- Never commit secrets, database URLs, tokens, or `.env` contents to this file.

## 9. References

- Railway status: https://status.railway.com/
- Railway security notice:
  https://blog.railway.com/p/security-disclosure-wednesday-october-21st
- Rotate PostgreSQL credentials:
  https://blog.railway.com/p/security-disclosure-recommendation-rotate-postgresql-database-credentials
- Railway PostgreSQL documentation:
  https://docs.railway.com/databases/postgresql
