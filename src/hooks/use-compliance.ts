'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchComplianceDocs,
  fetchComplianceDoc,
  fetchExpirationAlerts,
  fetchComplianceOverview,
  fetchComplianceChecklist,
  fetchDriverComplianceScore,
  fetchTruckComplianceScore,
  fetchComplianceRequirements,
  type ComplianceDocFilters,
} from '@/lib/queries/compliance'
import { useEffect } from 'react'
import { useCurrentTenantId } from '@/hooks/use-current-tenant-id'

export function useComplianceDocs(filters: ComplianceDocFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['compliance-docs', filters],
    queryFn: () => fetchComplianceDocs(supabase, filters),
    staleTime: 30_000,
  })

  // N7: scope realtime subscription by tenant_id to prevent cross-tenant
  // event fan-out on the Supabase Realtime bus.
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`compliance-documents-changes:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tenantId])

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
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['compliance-expiration-alerts'],
    queryFn: () => fetchExpirationAlerts(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`compliance-alerts-changes:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tenantId])

  return query
}

export function useComplianceOverview() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['compliance-overview'],
    queryFn: () => fetchComplianceOverview(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`compliance-overview-changes:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-overview'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tenantId])

  return query
}

export function useComplianceChecklist(
  documentType: string,
  entityType: string,
  entityId?: string
) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['compliance-checklist', documentType, entityType, entityId],
    queryFn: () => fetchComplianceChecklist(supabase, documentType, entityType, entityId),
    enabled: !!documentType && !!entityType,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`compliance-checklist-changes-${documentType}-${entityType}-${entityId ?? 'all'}:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['compliance-checklist', documentType, entityType, entityId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, documentType, entityType, entityId, tenantId])

  return query
}

export function useDriverComplianceScore(driverId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['driver-compliance-score', driverId],
    queryFn: () => fetchDriverComplianceScore(supabase, driverId!),
    enabled: !!driverId,
    staleTime: 30_000,
  })
}

export function useTruckComplianceScore(truckId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['truck-compliance-score', truckId],
    queryFn: () => fetchTruckComplianceScore(supabase, truckId!),
    enabled: !!truckId,
    staleTime: 30_000,
  })
}

export function useComplianceRequirements(documentType?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['compliance-requirements', documentType],
    queryFn: () => fetchComplianceRequirements(supabase, documentType),
    staleTime: 30_000,
  })
}
