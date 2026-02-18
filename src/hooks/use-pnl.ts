'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPnLData, fetchMonthlyPnLTrend, type FinancialPeriod, type MonthlyPnLItem } from '@/lib/queries/financials'
import { calculatePnL, calculateUnitMetrics, type PnLOutput, type UnitMetrics, type PnLInput } from '@/lib/financial/pnl-calculations'

export function usePnLData(period: FinancialPeriod) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['pnl', period],
    queryFn: () => fetchPnLData(supabase, period),
    staleTime: 60_000,
  })

  // Compute P&L and unit metrics client-side from raw input
  const computed = useMemo(() => {
    if (!query.data) return null
    const pnl = calculatePnL(query.data)
    const metrics = calculateUnitMetrics(query.data, pnl)
    return { pnl, metrics, input: query.data }
  }, [query.data])

  // Realtime invalidation on relevant tables
  useEffect(() => {
    const channel = supabase
      .channel('pnl-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

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

  const query = useQuery({
    queryKey: ['pnl-trend', months],
    queryFn: () => fetchMonthlyPnLTrend(supabase, months),
    staleTime: 60_000,
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

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('pnl-trend-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl-trend'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pnl-trend'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return {
    ...query,
    monthlyData: computed,
  }
}
