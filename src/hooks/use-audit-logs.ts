'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import {
  fetchTenantAuditLogs,
  fetchAuditArchives,
  getAuditAlertConfig,
} from '@/app/actions/audit'
import type { AuditLog, AuditArchive, AuditAlertConfig } from '@/types/database'

export interface AuditLogFilters {
  entityType?: string
  action?: string
  severity?: 'info' | 'warning' | 'critical'
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AuditLogsResult {
  logs: AuditLog[]
  total: number
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const result = await fetchTenantAuditLogs({
        ...filters,
        page: (filters.page ?? 0) + 1, // server actions use 1-based paging
      })
      if ('error' in result) throw new Error(String(result.error))
      return result.data as AuditLogsResult
    },
    staleTime: 30_000,
  })

  // Realtime: invalidate on INSERT events for audit_logs
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useAuditArchives() {
  const query = useQuery({
    queryKey: ['audit-archives'],
    queryFn: async () => {
      const result = await fetchAuditArchives()
      if ('error' in result) throw new Error(String(result.error))
      return result.data as AuditArchive[]
    },
    staleTime: 30_000,
  })

  return query
}

export function useAuditAlertConfig() {
  const query = useQuery({
    queryKey: ['audit-alert-config'],
    queryFn: async () => {
      const result = await getAuditAlertConfig()
      if ('error' in result) throw new Error(String(result.error))
      return result.data as AuditAlertConfig[]
    },
    staleTime: 30_000,
  })

  return query
}
