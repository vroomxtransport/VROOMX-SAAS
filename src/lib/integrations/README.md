# VroomX Integration Pattern Template

This document describes the canonical pattern for adding a new
integration to VroomX. It was extracted from the MSFuelCard (Multi
Service Fuel Card), Samsara, and QuickBooks integrations during the
Waves 1–7 financial reporting plan and is the template future
integrations (Fleet One, Comdata, EFS, WEX, etc.) MUST follow unless
there's a specific reason to diverge.

## Why this document exists

Every new integration needs the same six layers. Without a template,
each one accumulates slightly different conventions and the security
review + debugger review passes have to rediscover the same issues
each time. Following this template means:

- The security-auditor agent only has to verify you matched the
  pattern, not re-derive the tenant-isolation model from scratch
- The Wave 2 per-truck P&L ledger picks up new source badges for free
- The Wave 3 `source` / `source_external_id` dedup on `fuel_entries`
  automatically prevents duplicate writes when your cron re-runs
- The Wave 5 QuickBooks expense sync automatically covers any
  fuel_entries you insert

## The six layers

### 1. DB schema — `src/db/schema.ts` + `supabase/migrations/*`

Every integration needs exactly two tables:

```ts
// <provider>_integrations — one row per tenant
export const <provider>Integrations = pgTable('<provider>_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull()
    .references(() => tenants.id, { onDelete: 'cascade' })
    .unique(),  // one integration per tenant
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  accountNumber: text('account_number'),
  syncStatus: text('sync_status').notNull().default('active'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_<provider>_integrations_tenant').on(table.tenantId),
])

// <provider>_transactions — one row per remote transaction, deduped
export const <provider>Transactions = pgTable('<provider>_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('<provider>'),
  externalTransactionId: text('external_transaction_id').notNull(),
  // ... provider-specific fields ...
  matchedTruckId: uuid('matched_truck_id').references(() => trucks.id, { onDelete: 'set null' }),
  matchStatus: text('match_status').notNull().default('unmatched'),
  fuelEntryId: uuid('fuel_entry_id').references(() => fuelEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_<provider>_txn_tenant_date').on(table.tenantId, table.transactionDate),
  unique('uq_<provider>_txn_dedup').on(table.tenantId, table.provider, table.externalTransactionId),
])
```

**Non-negotiable rules for the migration**:

- RLS enabled on BOTH tables. Use the `public.get_tenant_id()` helper
  and split CRUD into 4 separate policies (SELECT / INSERT / UPDATE
  with `WITH CHECK` / DELETE). See `00003_trips_and_dispatch.sql` for
  the trip_expenses template. **Do NOT** use
  `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` — it's an older
  pattern that was migrated away from in Wave 6 CFG-007.
- WITH CHECK on UPDATE is mandatory — a missing WITH CHECK is the
  exact bug pattern of SCAN-005 / CFG-002.
- UNIQUE on `(tenant_id, provider, external_transaction_id)` — this
  is the dedup key the sync loop relies on.
- After shipping the migration, apply it via
  `node --env-file=.env.local scripts/apply-migration-via-api.mjs
  supabase/migrations/<file>.sql` (Management API path — bypasses the
  legacy IPv6-only direct host).

### 2. Types — `src/lib/integrations/<provider>/types.ts`

Pure TypeScript types mirroring the provider's API response shape.
No runtime code. Keep it tight — don't declare every field the
provider returns, only the ones your sync consumes.

### 3. HTTP Client — `src/lib/integrations/<provider>/client.ts`

Class-based client with:

- Bearer token or API-key auth
- Exponential backoff retry on 429 (respect `Retry-After` header) and 5xx
- Automatic pagination for list endpoints
- Typed response unwrapping
- A custom error class that preserves HTTP status

**Template**: `src/lib/samsara/client.ts` or `src/lib/fuelcard/client.ts`.
Both follow the exact same shape; pick whichever is closest to the
new provider's auth model.

### 4. Sync orchestration — `src/lib/integrations/<provider>/sync.ts`

The function every caller invokes to pull new data. Signature:

```ts
export async function sync<Provider>Transactions(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<<Provider>SyncResult>
```

**Non-negotiable rules**:

1. **Top-of-file JSDoc banner** warning that every query MUST include
   `.eq('tenant_id', tenantId)` — this module may be called with a
   service-role client (from the cron route) that bypasses RLS, so
   the explicit filter is the ONLY line of defense. See
   `src/lib/fuelcard/sync.ts:6-28` for the canonical banner.

2. **Dedup check BEFORE insert** via the
   `(tenant_id, provider, external_transaction_id)` unique index:

   ```ts
   const { data: existing } = await supabase
     .from('<provider>_transactions')
     .select('id')
     .eq('tenant_id', tenantId)
     .eq('provider', '<provider>')
     .eq('external_transaction_id', txn.externalId)
     .maybeSingle()
   if (existing) { result.skipped++; continue }
   ```

3. **Auto-match to truck** via unit number (case-insensitive ilike
   against `trucks.unit_number`) and **auto-match to driver** via the
   truck's active trip. See `src/lib/fuelcard/sync.ts::matchToTruck`
   and `matchToDriver` for the canonical helpers.

4. **When a fuel-card-like transaction matches a truck, ALSO insert
   into `fuel_entries`** with `source='<provider>'` and
   `source_external_id=<external_id>`. This is how the Wave 2 per-truck
   P&L ledger picks up the row with the right source badge AND how the
   Wave 5 QuickBooks sync auto-pushes it.

   The Wave 3 partial unique index on
   `(tenant_id, source, source_external_id) WHERE source_external_id IS NOT NULL`
   makes re-syncs idempotent — swallow Postgres error code `23505` on
   the `fuel_entries` insert:

   ```ts
   if (fuelInsertError && fuelInsertError.code !== '23505') {
     result.errors.push(`Transaction ${txn.externalId}: fuel_entries insert failed`)
   }
   ```

5. **Record errors durably** in the integration's own state column
   (`last_error` + `sync_status='error'`), NOT just `console.error`.

### 5. Server actions — `src/app/actions/<provider>.ts`

Minimum set of exports:

- `connect<Provider>(data)` — Zod schema, `authorize('integrations.manage')`,
  test the connection, upsert the integrations row, audit log, return
  `{ success: true }`
- `disconnect<Provider>()` — flip `sync_status='disconnected'`, audit log
- `get<Provider>Status()` — read-only, returns status + last sync time
  + transaction counts for the UI
- `sync<Provider>Transactions()` — user-facing sync trigger, rate
  limited (6/hour typical), dispatches to the lib function
- Per-transaction actions: `match<Provider>Transaction`, `flag...`,
  `unflag...`

Every action follows the mandatory sequence:
**Zod parse → authorize → tenant_id filter → safeError on failure**.
See `.claude/rules/server-actions.md`.

### 6. UI — `src/app/(dashboard)/settings/integrations/<provider>/page.tsx`

Client component with:

- Status query via `get<Provider>Status` server action
- Conditional render: Connect form if disconnected, Dashboard if connected
- Realtime subscription on `<provider>_integrations` and
  `<provider>_transactions` — MUST use `useId()` for the channel name
  to avoid cross-tab / cross-tenant channel-name collisions
- Widget-card layout: `widget-card`, `widget-header`, `widget-title`,
  `widget-accent-dot bg-brand`
- Toast feedback via `sonner` for all action results
- Type-checking via strict duck-typing on the discriminated-union
  result:
  ```ts
  const result = await action(...)
  if ('error' in result && result.error) {
    const msg = typeof result.error === 'string' ? result.error : 'Action failed'
    toast.error(msg)
    return
  }
  toast.success('Done')
  ```

## 7. Cron endpoint — `src/app/api/cron/<provider>-sync/route.ts`

Automate the sync via a POST route:

- `verifyCronSecret(req.headers.get('x-cron-secret'))` — timing-safe
  HMAC comparison, never a query param
- `createServiceRoleClient()` to iterate all tenants
- `.limit(MAX_TENANTS)` where `MAX_TENANTS = 500` — safety cap
- Per-tenant try/catch, continue on individual failure
- Sanitized error logging (`err.message` only, never the full object)
- Aggregate result returned as JSON; NEVER throw

Template: `src/app/api/cron/fuelcard-sync/route.ts`.

## 8. Integration registry — `src/lib/integrations/registry.ts`

Add a row for the new provider so the UI surfaces it in the
Integrations page. Follow the existing entries.

## Pre-existing systemic debt to be aware of

- **Plaintext "encrypted" columns**: `access_token_encrypted`,
  `refresh_token_encrypted`, and `api_key_encrypted` are all stored in
  plaintext across Samsara, QuickBooks, and MSFuelCard. The column
  name is aspirational. A dedicated secrets-encryption wave is
  scoped to migrate them to real AES-256-GCM with a master key from
  env. Until that wave lands, treat the existing behavior as
  compliance debt, NOT as something your new integration should
  "fix" in isolation.
- **Cron concurrency**: no row-level lock or advisory lock guards the
  cron route. The existing dedup (unique constraint on
  `(tenant_id, provider, external_transaction_id)`) makes parallel
  runs correctness-safe, worst case is wasted provider API calls.
  If your provider has a strict rate limit, revisit this.

## Review gates — every new integration MUST pass

1. **debugger agent** — cross-wave correctness sweep
2. **security-auditor agent** — MANDATORY per
   `.claude/rules/security-auditor-usage.md`. Brief it with the
   closed findings list (SCAN-*, CFG-*, AUTH-*, SEC-LEAK-*) so it
   focuses on new exposure.
3. **feature-dev:code-reviewer** — convention compliance

## Success criteria for a new integration

- `tsc --noEmit` clean
- `eslint` 0 errors on new files
- Migration applied via
  `scripts/apply-migration-via-api.mjs` + verified with a follow-up
  `SELECT` against the prod DB
- security-auditor: 0 CRITICAL/HIGH findings on the new surface
- RLS policies confirmed via
  `SELECT * FROM pg_policies WHERE tablename = '<provider>_...'`
- Wave 2 per-truck P&L ledger shows the new source badge for auto-synced
  rows
- Wave 5 QuickBooks expense sync auto-pushes the new fuel_entries (if
  the integration is fuel-card-like)
