import { revalidatePath } from 'next/cache'

/**
 * Revalidate every page that displays company-level financial KPIs.
 *
 * KPI cards on /dashboard and /financials are SSR-fetched and cached at
 * the route level. After any mutation that affects revenue, expenses,
 * payments, or maintenance spend, those pages MUST be revalidated or
 * users see stale numbers for hours (audit AUD-4 KPI-FRESH-001).
 *
 * Call this from EVERY mutation in:
 *   - src/app/actions/orders.ts
 *   - src/app/actions/trips.ts
 *   - src/app/actions/payments.ts
 *   - src/app/actions/work-orders.ts
 *   - src/app/actions/work-order-attachments.ts
 *   - src/app/actions/business-expenses.ts
 *   - src/app/actions/truck-expenses.ts
 *
 * Cheap (no network) — just marks the route cache stale.
 */
export function revalidateFinancialDashboards() {
  revalidatePath('/dashboard')
  revalidatePath('/financials')
}
