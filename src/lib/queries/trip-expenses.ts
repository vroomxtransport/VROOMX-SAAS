import type { SupabaseClient } from '@supabase/supabase-js'
import type { TripExpense } from '@/types/database'

export interface TripExpensesResult {
  expenses: TripExpense[]
}

export async function fetchTripExpenses(
  supabase: SupabaseClient,
  tripId: string
): Promise<TripExpensesResult> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return {
    expenses: (data ?? []) as TripExpense[],
  }
}
