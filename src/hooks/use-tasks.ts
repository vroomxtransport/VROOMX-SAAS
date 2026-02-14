'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTasks, fetchTask, fetchTaskCounts, type TaskFilters } from '@/lib/queries/tasks'
import { useEffect } from 'react'

export function useTasks(filters: TaskFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] })
          queryClient.invalidateQueries({ queryKey: ['task-counts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useTask(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTask(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useTaskCounts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['task-counts'],
    queryFn: () => fetchTaskCounts(supabase),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('tasks-counts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['task-counts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
