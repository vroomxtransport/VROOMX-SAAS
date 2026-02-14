import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task } from '@/types/database'

export interface TaskFilters {
  status?: string
  priority?: string
  tab?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface TasksResult {
  tasks: Task[]
  total: number
}

export interface TaskCounts {
  pending: number
  dueToday: number
  overdue: number
  urgent: number
}

export async function fetchTasks(
  supabase: SupabaseClient,
  filters: TaskFilters = {}
): Promise<TasksResult> {
  const { status, priority, tab, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  // Tab-based filters
  const today = new Date().toISOString().split('T')[0]

  if (tab === 'today') {
    query = query.eq('due_date', today).neq('status', 'completed')
  } else if (tab === 'upcoming') {
    query = query.gt('due_date', today).neq('status', 'completed')
  } else if (tab === 'overdue') {
    query = query.lt('due_date', today).neq('status', 'completed')
  } else if (tab === 'completed') {
    query = query.eq('status', 'completed')
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    tasks: (data ?? []) as Task[],
    total: count ?? 0,
  }
}

export async function fetchTask(
  supabase: SupabaseClient,
  id: string
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Task
}

export async function fetchTaskCounts(
  supabase: SupabaseClient
): Promise<TaskCounts> {
  const today = new Date().toISOString().split('T')[0]

  const [pendingRes, dueTodayRes, overdueRes, urgentRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('due_date', today)
      .neq('status', 'completed'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', today)
      .neq('status', 'completed'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .neq('status', 'completed'),
  ])

  return {
    pending: pendingRes.count ?? 0,
    dueToday: dueTodayRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    urgent: urgentRes.count ?? 0,
  }
}
