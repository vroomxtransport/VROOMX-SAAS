'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchPnLData,
  fetchMonthlyPnLTrend,
  type MonthlyPnLItem,
  type PnLBasis,
} from '@/lib/queries/financials'
import { calculatePnL, calculateUnitMetrics, type PnLOutput, type UnitMetrics, type PnLInput } from '@/lib/financial/pnl-calculations'
import type { DateRange } from '@/types/filters'

export type { PnLBasis } from '@/lib/queries/financials'

/**
 * Session-long lookup of the current user's tenant_id from Supabase
 * `app_metadata`. Mirrors the pattern in `use-current-user-permissions.ts`
 * which reads `app_metadata.role` the same way — the server is the real
 * security boundary, this is just for scoping realtime subscriptions so
 * we don't fan out cross-tenant events to the client.
 *
 * Returns `null` while loading or if unauthenticated; callers that use
 * this to build a realtime filter MUST gate their `useEffect` on a
 * non-null value and re-subscribe when it resolves.
 */
function useCurrentTenantId(): string | null {
  const supabase = createClient()
  const query = useQuery({
    queryKey: ['current-user-tenant-id'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return null
      const tenantId = data.user.app_metadata?.tenant_id
      return typeof tenantId === 'string' ? tenantId : null
    },
    // Tenant rarely changes mid-session; keep it cached for the life
    // of the session like the permissions hook does.
    staleTime: 5 * 60_000,
    retry: false,
  })
  return query.data ?? null
}

/**
 * Coalesces a burst of realtime invalidations into a single refetch.
 * Returns a stable scheduler keyed on the given queryKey prefix — any
 * call within `DEBOUNCE_MS` of a pending schedule is a no-op, so a
 * server action that mutates 10 rows only causes one refetch.
 */
const INVALIDATION_DEBOUNCE_MS = 1_000

/**
 * Wave 6: `basis` toggles between 'accrual' (default, revenue by order
 * created_at) and 'cash' (revenue by payment date, deductions scaled
 * proportionally). The query key includes basis so both modes are cached
 * independently and switching is instant after first fetch.
 */
export function usePnLData(dateRange?: DateRange, basis: PnLBasis = 'accrual') {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['pnl', dateRange?.from, dateRange?.to, basis],
    // With tenant-filtered realtime the cache only needs to be force
    // refreshed when an actual row event fires, so a generous staleTime
    // is a safe backstop against chatter.
    queryFn: () => fetchPnLData(supabase, dateRange, basis),
    staleTime: 5 * 60_000,
  })

  // Compute P&L and unit metrics client-side from raw input
  const computed = useMemo(() => {
    if (!query.data) return null
    const pnl = calculatePnL(query.data)
    const metrics = calculateUnitMetrics(query.data, pnl)
    return { pnl, metrics, input: query.data }
  }, [query.data])

  // Debounced invalidation — a burst of postgres_changes events (e.g. a
  // trip recalc that writes many rows in one transaction) collapses
  // into a single refetch.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['pnl'] })
      debounceRef.current = null
    }, INVALIDATION_DEBOUNCE_MS)
  }, [queryClient])

  // Realtime invalidation on relevant tables. The `payments` subscription
  // is specifically for cash-basis mode — a new payment shifts the cash
  // waterfall without changing any order or trip row.
  //
  // Every subscription is scoped server-side by `filter: 'tenant_id=eq.'`
  // so we do NOT receive other tenants' row events. This is both a perf
  // win (no cross-tenant fan-out) and a defense-in-depth layer against
  // timing-channel leakage on the realtime bus.
  //
  // DELETE events are kept because removing an order, trip, expense, or
  // payment changes the P&L totals just as much as creating one.
  useEffect(() => {
    if (!tenantId) return
    const filter = `tenant_id=eq.${tenantId}`
    const channel = supabase
      .channel(`pnl-changes:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses', filter }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_expenses', filter }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter }, scheduleInvalidate)
      .subscribe()

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [supabase, tenantId, scheduleInvalidate])

  return {
    ...query,
    pnl: computed?.pnl ?? null,
    metrics: computed?.metrics ?? null,
    input: computed?.input ?? null,
  }
}

export interface MonthlyPnLComputed {
  month: string
  monthKey: string
  input: PnLInput
  pnl: PnLOutput
  metrics: UnitMetrics
}

export function useMonthlyPnLTrend(months: number = 12) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['pnl-trend', months],
    queryFn: () => fetchMonthlyPnLTrend(supabase, months),
    staleTime: 5 * 60_000,
  })

  // Compute P&L for each month client-side
  const computed = useMemo(() => {
    if (!query.data) return null
    return query.data.map((item: MonthlyPnLItem) => {
      const pnl = calculatePnL(item.data)
      const metrics = calculateUnitMetrics(item.data, pnl)
      return { month: item.month, monthKey: item.monthKey, input: item.data, pnl, metrics }
    })
  }, [query.data])

  // Debounced invalidation — same rationale as usePnLData above.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['pnl-trend'] })
      debounceRef.current = null
    }, INVALIDATION_DEBOUNCE_MS)
  }, [queryClient])

  // Realtime invalidation — tenant-scoped.
  useEffect(() => {
    if (!tenantId) return
    const filter = `tenant_id=eq.${tenantId}`
    const channel = supabase
      .channel(`pnl-trend-changes:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, scheduleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_expenses', filter }, scheduleInvalidate)
      .subscribe()

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [supabase, tenantId, scheduleInvalidate])

  return {
    ...query,
    monthlyData: computed,
  }
}
