import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebNotification } from '@/types/database'

export async function fetchUnreadNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<WebNotification[]> {
  const { data, error } = await supabase
    .from('web_notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function fetchNotifications(
  supabase: SupabaseClient,
  userId: string,
  page: number = 0,
  pageSize: number = 20
): Promise<{ notifications: WebNotification[]; total: number }> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('web_notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { notifications: data ?? [], total: count ?? 0 }
}
