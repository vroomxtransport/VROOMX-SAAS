'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchComplianceDocs,
  fetchComplianceDoc,
  fetchExpirationAlerts,
  type ComplianceDocFilters,
} from '@/lib/queries/compliance'
import { useEffect } from 'react'

export function useComplianceDocs(filters: ComplianceDocFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['compliance-docs', filters],
    queryFn: () => fetchComplianceDocs(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('compliance-documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useComplianceDoc(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['compliance-doc', id],
    queryFn: () => fetchComplianceDoc(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useExpirationAlerts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['compliance-expiration-alerts'],
    queryFn: () => fetchExpirationAlerts(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('compliance-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
