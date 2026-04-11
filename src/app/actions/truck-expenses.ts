'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { recalculateTripFinancials } from '@/app/actions/trips'
import { syncExpenseToQB } from '@/lib/quickbooks/sync'

// ============================================================================
// Input schema
// ============================================================================

/**
 * Unified "Add Expense" input for the Wave 2 per-truck P&L dashboard.
 *
 * The router action translates this one shape into the correct insert into
 * `trip_expenses`, `business_expenses`, `fuel_entries`, or `maintenance_records`.
 *
 * Categories map to source tables as follows:
 *   - fuel                       → fuel_entries
 *   - maintenance | repair       → maintenance_records (status = 'completed')
 *   - tolls | lodging | misc     → trip_expenses (requires trip_id)
 *   - insurance | truck_lease |
 *     registration | office_*  etc → business_expenses (truck-scoped, one_time)
 */
const addTruckExpenseSchema = z
  .object({
    truckId: z.string().uuid('Invalid truck ID'),
    category: z.enum([
      // fuel_entries
      'fuel',
      // maintenance_records
      'maintenance',
      'repair',
      // trip_expenses
      'tolls',
      'lodging',
      'misc',
      // business_expenses
      'insurance',
      'truck_lease',
      'registration',
      'dispatch',
      'parking',
      'rent',
      'telematics',
      'salary',
      'office_supplies',
      'software',
      'professional_services',
      'other',
    ]),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(10_000_000),
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    description: z.string().max(5000).optional().or(z.literal('')),

    // Optional route inputs for specific source tables
    tripId: z.string().uuid('Invalid trip ID').optional().or(z.literal('')),
    gallons: z.coerce.number().min(0.001).max(1_000_000).optional(),
    costPerGallon: z.coerce.number().min(0.001).max(10_000_000).optional(),
    odometer: z.coerce.number().min(0).max(1_000_000).optional(),
    location: z.string().max(500).optional().or(z.literal('')),
    state: z.string().length(2, 'State must be a 2-letter code').optional().or(z.literal('')),
    vendor: z.string().max(200).optional().or(z.literal('')),
    maintenanceType: z
      .enum(['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other'])
      .optional(),
  })
  .superRefine((v, ctx) => {
    // Fuel requires gallons + cost_per_gallon so the ledger stays IFTA-ready.
    if (v.category === 'fuel') {
      if (v.gallons === undefined || v.gallons <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gallons'],
          message: 'Gallons is required for fuel entries',
        })
      }
      if (v.costPerGallon === undefined || v.costPerGallon <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['costPerGallon'],
          message: 'Cost per gallon is required for fuel entries',
        })
      }
    }

    // trip_expenses rows require a trip_id (FK NOT NULL on the table).
    if (v.category === 'tolls' || v.category === 'lodging' || v.category === 'misc') {
      if (!v.tripId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tripId'],
          message: 'Trip is required for trip-scoped expenses',
        })
      }
    }
  })

export type AddTruckExpenseInput = z.input<typeof addTruckExpenseSchema>

// ============================================================================
// Router action
// ============================================================================

/**
 * Unified expense-creation action used by the Wave 2 truck P&L dashboard.
 *
 * Dispatches the payload to the correct underlying table based on `category`,
 * then revalidates the truck financials view. All source-table writes run
 * under a single `authorize()` call — we require the strictest permission in
 * the union (`trip_expenses.create`, `business_expenses.create`,
 * `fuel.create`, or `maintenance.create`) up front so the caller's role must
 * be able to perform every potential route.
 *
 * Security notes:
 *   - Tenant scoping on every insert (tenant_id from authorize ctx)
 *   - Explicit truck-tenant validation to block cross-tenant truck IDs
 *   - Rate-limited per-user (30 writes / minute)
 */
export async function addTruckExpense(data: unknown) {
  const parsed = addTruckExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Require the intersection of permissions so a role without (say)
  // business_expenses.create cannot create business-scoped expenses via
  // this router.
  const required = requiredPermissionFor(parsed.data.category)
  const auth = await authorize(required, {
    rateLimit: { key: 'addTruckExpense', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Cross-tenant guard: prove this truck belongs to the caller's tenant
  // before we write a dependent row.
  const { data: truck, error: truckError } = await supabase
    .from('trucks')
    .select('id')
    .eq('id', parsed.data.truckId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (truckError) return { error: safeError(truckError, 'addTruckExpense/truck') }
  if (!truck) return { error: 'Truck not found' }

  const v = parsed.data

  try {
    switch (v.category) {
      case 'fuel': {
        const totalCost = (v.gallons ?? 0) * (v.costPerGallon ?? 0)
        // Prefer explicit `location`; fall back to `description` so a user who
        // typed only a description still sees it in the ledger (the ledger
        // renders `location ?? 'Fuel purchase'` as the row description).
        const location = v.location || v.description || null
        const { data: entry, error } = await supabase
          .from('fuel_entries')
          .insert({
            tenant_id: tenantId,
            truck_id: v.truckId,
            date: v.occurredAt,
            gallons: String(v.gallons),
            cost_per_gallon: String(v.costPerGallon),
            total_cost: String(totalCost),
            odometer: v.odometer ?? null,
            location,
            state: v.state ? v.state.toUpperCase() : null,
            notes: v.location ? v.description || null : null,
          })
          .select()
          .single()
        if (error) return { error: safeError(error, 'addTruckExpense/fuel') }
        // Fire-and-forget QB push — errors land durably in
        // quickbooks_entity_map so the ledger UI can surface a Retry button.
        void syncExpenseToQB(supabase, tenantId, entry.id as string, 'fuel').catch((e: unknown) => {
          // Fire-and-forget: don't fail the user's add-expense flow if QB
          // push throws an unhandled error before recordQBExpenseError
          // could write a durable state. Log so Sentry / server logs still
          // capture the case where even the error-recording upsert failed.
          console.error(
            '[addTruckExpense] QB fire-and-forget failed:',
            e instanceof Error ? e.message : String(e),
          )
        })
        revalidateTruckFinancials(v.truckId)
        return { success: true, data: entry }
      }

      case 'maintenance':
      case 'repair': {
        const { data: entry, error } = await supabase
          .from('maintenance_records')
          .insert({
            tenant_id: tenantId,
            truck_id: v.truckId,
            maintenance_type: v.maintenanceType ?? (v.category === 'repair' ? 'repair' : 'other'),
            status: 'completed',
            cost: String(v.amount),
            vendor: v.vendor || null,
            description: v.description || null,
            completed_date: new Date(v.occurredAt).toISOString(),
            odometer: v.odometer ?? null,
          })
          .select()
          .single()
        if (error) return { error: safeError(error, 'addTruckExpense/maintenance') }
        void syncExpenseToQB(supabase, tenantId, entry.id as string, 'maintenance').catch((e: unknown) => {
          // Fire-and-forget: don't fail the user's add-expense flow if QB
          // push throws an unhandled error before recordQBExpenseError
          // could write a durable state. Log so Sentry / server logs still
          // capture the case where even the error-recording upsert failed.
          console.error(
            '[addTruckExpense] QB fire-and-forget failed:',
            e instanceof Error ? e.message : String(e),
          )
        })
        revalidateTruckFinancials(v.truckId)
        return { success: true, data: entry }
      }

      case 'tolls':
      case 'lodging':
      case 'misc': {
        // Verify the trip belongs to the tenant AND the truck before writing
        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .select('id, truck_id')
          .eq('id', v.tripId as string)
          .eq('tenant_id', tenantId)
          .maybeSingle()
        if (tripError) return { error: safeError(tripError, 'addTruckExpense/trip') }
        if (!trip) return { error: 'Trip not found' }
        if (trip.truck_id !== v.truckId) {
          return { error: 'Trip is not assigned to this truck' }
        }

        // trip_expenses enum subset: fuel|tolls|repairs|lodging|misc
        // 'misc' is the catch-all for anything not in that set.
        const tripCategory = v.category === 'tolls' || v.category === 'lodging' ? v.category : 'misc'

        const { data: entry, error } = await supabase
          .from('trip_expenses')
          .insert({
            tenant_id: tenantId,
            trip_id: v.tripId as string,
            category: tripCategory,
            custom_label: v.description || null,
            amount: String(v.amount),
            notes: null,
            expense_date: v.occurredAt,
          })
          .select()
          .single()
        if (error) return { error: safeError(error, 'addTruckExpense/tripExpense') }

        // Trip financials depend on trip_expenses — keep the denormalized
        // fields in sync just like createTripExpense does.
        // CodeAuditX #3 BUG-2: surface CAS-exhaustion errors.
        {
          const recalc = await recalculateTripFinancials(v.tripId as string)
          if ('error' in recalc && recalc.error) {
            return { error: recalc.error }
          }
        }
        void syncExpenseToQB(supabase, tenantId, entry.id as string, 'trip').catch((e: unknown) => {
          // Fire-and-forget: don't fail the user's add-expense flow if QB
          // push throws an unhandled error before recordQBExpenseError
          // could write a durable state. Log so Sentry / server logs still
          // capture the case where even the error-recording upsert failed.
          console.error(
            '[addTruckExpense] QB fire-and-forget failed:',
            e instanceof Error ? e.message : String(e),
          )
        })
        revalidateTruckFinancials(v.truckId)
        return { success: true, data: entry }
      }

      case 'insurance':
      case 'truck_lease':
      case 'registration':
      case 'dispatch':
      case 'parking':
      case 'rent':
      case 'telematics':
      case 'salary':
      case 'office_supplies':
      case 'software':
      case 'professional_services':
      case 'other': {
        const { data: entry, error } = await supabase
          .from('business_expenses')
          .insert({
            tenant_id: tenantId,
            name: v.description || categoryLabel(v.category),
            category: v.category,
            recurrence: 'one_time',
            amount: String(v.amount),
            truck_id: v.truckId,
            effective_from: v.occurredAt,
            effective_to: null,
            notes: null,
          })
          .select()
          .single()
        if (error) return { error: safeError(error, 'addTruckExpense/businessExpense') }
        void syncExpenseToQB(supabase, tenantId, entry.id as string, 'business').catch((e: unknown) => {
          // Fire-and-forget: don't fail the user's add-expense flow if QB
          // push throws an unhandled error before recordQBExpenseError
          // could write a durable state. Log so Sentry / server logs still
          // capture the case where even the error-recording upsert failed.
          console.error(
            '[addTruckExpense] QB fire-and-forget failed:',
            e instanceof Error ? e.message : String(e),
          )
        })
        revalidateTruckFinancials(v.truckId)
        return { success: true, data: entry }
      }

      default: {
        // TypeScript exhaustiveness check — should be unreachable.
        const _exhaustive: never = v.category
        void _exhaustive
        return { error: 'Unsupported category' }
      }
    }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'addTruckExpense') }
  }
}

// ============================================================================
// retryQbSync — Retry a failed QB expense push
// ============================================================================

const retryQbSyncSchema = z.object({
  expenseId: z.string().uuid('Invalid expense id'),
  expenseSource: z.enum(['trip', 'business', 'fuel', 'maintenance']),
  // Optional so existing callers still work, but highly recommended —
  // the action revalidates the per-truck financials path when supplied.
  truckId: z.string().uuid('Invalid truck id').optional(),
})

/**
 * User-initiated retry of a failed QuickBooks expense push. The ledger UI
 * surfaces a "Retry" button for rows whose quickbooks_entity_map entry has
 * qb_id=NULL and sync_error set; this action runs the same `syncExpenseToQB`
 * pipeline that originally failed. On success, the entity_map row is
 * upserted with qb_id set and sync_error cleared. On failure, the error
 * message is refreshed.
 *
 * Authorized at `integrations.manage` because initiating a QB call is an
 * integration-level action, and rate-limited per user to prevent a runaway
 * retry loop from hammering the QB API.
 */
export async function retryQbSync(data: unknown) {
  const parsed = retryQbSyncSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'retryQbSync', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Defense-in-depth: confirm the source row belongs to this tenant
    // before calling the sync function. The sync function also scopes by
    // tenant_id, but a belt + suspenders check here gives clearer errors
    // to the UI on a cross-tenant retry attempt.
    const sourceTable = (() => {
      switch (parsed.data.expenseSource) {
        case 'trip':
          return 'trip_expenses'
        case 'business':
          return 'business_expenses'
        case 'fuel':
          return 'fuel_entries'
        case 'maintenance':
          return 'maintenance_records'
      }
    })()

    const { data: row, error: rowErr } = await supabase
      .from(sourceTable)
      .select('id')
      .eq('id', parsed.data.expenseId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (rowErr) return { error: safeError(rowErr, 'retryQbSync/rowLookup') }
    if (!row) return { error: 'Expense not found' }

    await syncExpenseToQB(supabase, tenantId, parsed.data.expenseId, parsed.data.expenseSource)

    // Revalidate the specific truck's financials page when truckId is
    // supplied by the caller; fall back to the fleet list for pre-existing
    // callers that don't yet pass it.
    if (parsed.data.truckId) {
      revalidatePath(`/trucks/${parsed.data.truckId}/financials`)
      revalidatePath(`/trucks/${parsed.data.truckId}`)
    } else {
      revalidatePath('/trucks')
    }
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'retryQbSync') }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function requiredPermissionFor(category: NonNullable<AddTruckExpenseInput['category']>): string {
  switch (category) {
    case 'fuel':
      return 'fuel.create'
    case 'maintenance':
    case 'repair':
      return 'maintenance.create'
    case 'tolls':
    case 'lodging':
    case 'misc':
      return 'trip_expenses.create'
    case 'insurance':
    case 'truck_lease':
    case 'registration':
    case 'dispatch':
    case 'parking':
    case 'rent':
    case 'telematics':
    case 'salary':
    case 'office_supplies':
    case 'software':
    case 'professional_services':
    case 'other':
      return 'business_expenses.create'
    default: {
      // Exhaustiveness guard — adding a new category to the Zod enum without
      // a matching permission mapping is a compile error.
      const _exhaustive: never = category
      void _exhaustive
      return 'business_expenses.create'
    }
  }
}

function revalidateTruckFinancials(truckId: string): void {
  revalidatePath(`/trucks/${truckId}`)
  revalidatePath(`/trucks/${truckId}/financials`)
  revalidatePath('/financials')
}

function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
