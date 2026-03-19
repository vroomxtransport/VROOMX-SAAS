'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchDispatcherPayConfigs,
  fetchPayrollPeriods,
  fetchDispatchersWithPayConfig,
  type PayConfigFilters,
  type PayrollPeriodFilters,
} from '@/lib/queries/dispatcher-payroll'
import { useEffect } from 'react'

export function useDispatcherPayConfigs(filters: PayConfigFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['dispatcher-pay-configs', filters],
    queryFn: () => fetchDispatcherPayConfigs(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('dispatcher-pay-configs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispatcher_pay_configs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dispatcher-pay-configs'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function usePayrollPeriods(filters: PayrollPeriodFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['payroll-periods', filters],
    queryFn: () => fetchPayrollPeriods(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('payroll-periods-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispatcher_payroll_periods',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useDispatchersWithPayConfig() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['dispatchers-with-pay-config'],
    queryFn: () => fetchDispatchersWithPayConfig(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('dispatchers-pay-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispatcher_pay_configs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dispatchers-with-pay-config'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
