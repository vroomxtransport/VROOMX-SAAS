'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchShops, fetchShop, type ShopFilters } from '@/lib/queries/shops'

export function useShops(filters: ShopFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['shops', filters],
    queryFn: () => fetchShops(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('shops-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shops' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shops'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useShop(id: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['shop', id],
    queryFn: () => (id ? fetchShop(supabase, id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30_000,
  })
}
