# Senior Backend Rules – Server-Side & Data

- Mutations: Zod → authorize() → tenant_id filter → tier check → safeError()
- Supabase runtime: JS client only (never Drizzle queries)
- Stripe: lazy Proxy, webhook sig + idempotency
- Rate limit sensitive actions (auth, creates, emails)
- Error handling: never leak stacks/PII to client

## Financial Calculation Engine
- Pure functions in src/lib/financial/trip-calculations.ts — no side effects, no DB calls
- `calculateTripFinancials(orders, driver, expenses, carrierPay)` → TripFinancials
- Clean Gross = revenue - brokerFee - localFee (computed per order, not aggregate)
- Driver pay calculated per-order for percentage types (supports per-order rate overrides)
- Per-mile pay: sum all order distanceMiles × driver.payRate
- KPI calculations in src/lib/financial/kpi-calculations.ts — include totalLocalFees in expenses
- `recalculateTripFinancials()` bridges DB ↔ calculation engine: fetches orders + driver + expenses, runs calculation, writes denormalized values back to trips table

## Server Action Patterns for Financial Fields
- Numeric form values: Zod `z.coerce.number()` → store with `String(value)`
- Nullable overrides (e.g. driverPayRateOverride): use truthy check — `value ? String(value) : null`
- When order financial fields change, trigger `recalculateTripFinancials()` if order is assigned to a trip
