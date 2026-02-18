'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchBusinessExpenses, type BusinessExpenseFilters } from '@/lib/queries/business-expenses'
import { useEffect } from 'react'

export function useBusinessExpenses(filters: BusinessExpenseFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['business-expenses', filters],
    queryFn: () => fetchBusinessExpenses(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation for business expenses
  useEffect(() => {
    const channel = supabase
      .channel('business-expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_expenses',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['business-expenses'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
