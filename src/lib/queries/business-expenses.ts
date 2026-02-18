import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessExpense } from '@/types/database'
import type { BusinessExpenseCategory, BusinessExpenseRecurrence } from '@/types'

export interface BusinessExpenseFilters {
  category?: BusinessExpenseCategory
  recurrence?: BusinessExpenseRecurrence
}

export interface BusinessExpensesResult {
  expenses: BusinessExpense[]
}

export async function fetchBusinessExpenses(
  supabase: SupabaseClient,
  filters: BusinessExpenseFilters = {}
): Promise<BusinessExpensesResult> {
  let query = supabase
    .from('business_expenses')
    .select('*, truck:trucks(id, unit_number)')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.recurrence) {
    query = query.eq('recurrence', filters.recurrence)
  }

  const { data, error } = await query

  if (error) throw error

  return {
    expenses: (data ?? []) as BusinessExpense[],
  }
}

// ============================================================================
// Period-based aggregation for P&L
// ============================================================================

export interface FixedExpenseBreakdown {
  byCategory: Record<string, number>
  total: number
  truckSpecific: number
  companyWide: number
}

/**
 * Fetch and prorate recurring business expenses for a given period.
 *
 * Proration logic:
 * - monthly: amount × months overlapping with period
 * - quarterly: (amount / 3) × months overlapping
 * - annual: (amount / 12) × months overlapping
 * - one_time: full amount if effective_from falls within period
 */
export async function fetchFixedExpensesForPeriod(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<FixedExpenseBreakdown> {
  // Fetch all expenses that overlap with the period
  // An expense overlaps if: effective_from <= endDate AND (effective_to IS NULL OR effective_to >= startDate)
  const { data, error } = await supabase
    .from('business_expenses')
    .select('category, recurrence, amount, truck_id, effective_from, effective_to')
    .lte('effective_from', endDate)
    .or(`effective_to.is.null,effective_to.gte.${startDate}`)

  if (error) throw error

  const periodStart = new Date(startDate)
  const periodEnd = new Date(endDate)
  const periodMonths = monthsBetween(periodStart, periodEnd)

  const byCategory: Record<string, number> = {}
  let total = 0
  let truckSpecific = 0
  let companyWide = 0

  for (const row of data ?? []) {
    const amount = parseFloat(row.amount || '0')
    const expenseStart = new Date(row.effective_from)
    const expenseEnd = row.effective_to ? new Date(row.effective_to) : null

    // Calculate overlapping months
    const overlapStart = expenseStart > periodStart ? expenseStart : periodStart
    const overlapEnd = expenseEnd && expenseEnd < periodEnd ? expenseEnd : periodEnd
    const overlapMonths = monthsBetween(overlapStart, overlapEnd)

    if (overlapMonths <= 0) continue

    let prorated: number
    switch (row.recurrence) {
      case 'monthly':
        prorated = amount * overlapMonths
        break
      case 'quarterly':
        prorated = (amount / 3) * overlapMonths
        break
      case 'annual':
        prorated = (amount / 12) * overlapMonths
        break
      case 'one_time':
        // Include full amount if effective_from is within period
        if (expenseStart >= periodStart && expenseStart <= periodEnd) {
          prorated = amount
        } else {
          prorated = 0
        }
        break
      default:
        prorated = 0
    }

    prorated = Math.round(prorated * 100) / 100

    byCategory[row.category] = (byCategory[row.category] || 0) + prorated
    total += prorated

    if (row.truck_id) {
      truckSpecific += prorated
    } else {
      companyWide += prorated
    }
  }

  return {
    byCategory,
    total: Math.round(total * 100) / 100,
    truckSpecific: Math.round(truckSpecific * 100) / 100,
    companyWide: Math.round(companyWide * 100) / 100,
  }
}

/**
 * Calculate approximate months between two dates (inclusive of partial months).
 * Returns at minimum 1 if the dates are in the same month.
 */
function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0
  const startYear = start.getFullYear()
  const startMonth = start.getMonth()
  const endYear = end.getFullYear()
  const endMonth = end.getMonth()
  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1
  return Math.max(months, 0)
}
