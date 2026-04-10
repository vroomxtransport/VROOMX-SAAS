'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getTruckExpenses,
  summarizeTruckExpenses,
  type LedgerDateRange,
  type TruckExpenseEntry,
  type ExpenseSummary,
} from '@/lib/queries/truck-expense-ledger'

const TRUCK_EXPENSES_QUERY_KEY = 'truck-expenses'

/**
 * TanStack Query hook for a single truck's expense ledger across all source
 * tables. Runs `getTruckExpenses` against the browser Supabase client and
 * memoizes the summary. Subscribes to postgres_changes on the four underlying
 * tables so the ledger auto-refreshes when a cell is added, edited, or deleted
 * anywhere else in the app.
 */
export function useTruckExpenses(truckId: string | undefined, range: LedgerDateRange) {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const query = useQuery<TruckExpenseEntry[]>({
    queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId, range.from, range.to],
    queryFn: () => {
      if (!truckId) return Promise.resolve<TruckExpenseEntry[]>([])
      return getTruckExpenses(supabase, truckId, range)
    },
    enabled: Boolean(truckId),
    staleTime: 30_000,
  })

  // Realtime invalidation — any change on any of the source tables or the
  // trips table (since trip_expenses is joined through it) invalidates the
  // ledger so the UI picks up the new state.
  //
  // Where possible we filter by truck_id so a busy fleet doesn't trigger an
  // invalidation on this truck's ledger every time some other truck is
  // updated. trip_expenses has no truck_id column — its row events always
  // invalidate, but we narrow the write path via the trips listener below.
  useEffect(() => {
    if (!truckId) return

    const channel = supabase
      .channel(`truck-expenses-${truckId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId] })
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_expenses', filter: `truck_id=eq.${truckId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuel_entries', filter: `truck_id=eq.${truckId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_records', filter: `truck_id=eq.${truckId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `truck_id=eq.${truckId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [TRUCK_EXPENSES_QUERY_KEY, truckId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, truckId])

  const summary: ExpenseSummary | null = useMemo(
    () => (query.data ? summarizeTruckExpenses(query.data) : null),
    [query.data],
  )

  return {
    entries: query.data ?? [],
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
