# Database Rules – VroomX TMS

- Schema truth: src/db/schema.ts (Drizzle)
- Migrations: supabase/migrations/ — use drizzle-kit generate/push
- Runtime queries: Supabase JS client ONLY — NEVER Drizzle query builder
- Connection: src/db/index.ts — postgres driver, prepare: false, max:1 (serverless)
- Pooled: DATABASE_URL (6543), Direct: DATABASE_URL_DIRECT (5432 for migrations)
- RLS: enabled + tested on all tenant-specific tables
- NEVER write raw SQL in app code

When changing schema: generate migration → push → verify RLS.

## Numeric Columns
- All financial fields use `numeric(12,2)` in schema, stored/returned as **strings** by Supabase
- TypeScript interfaces in `src/types/database.ts` must type these as `string` (not `number`)
- Parse with `parseFloat()` for calculations, convert back with `String()` for inserts/updates
- Nullable numeric columns (e.g. `driver_pay_rate_override`): type as `string | null`

## Denormalized Trip Financials
- Trips table stores computed values: total_revenue, total_broker_fees, total_local_fees, driver_pay, total_expenses, net_profit, order_count
- Updated by `recalculateTripFinancials()` in src/app/actions/trips.ts
- Must be recalculated when: orders assigned/unassigned, order financials change, carrier_pay changes, expenses change
