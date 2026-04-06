import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedReport, SavedView } from '@/lib/reports/report-config'

export async function fetchCustomReports(supabase: SupabaseClient): Promise<SavedReport[]> {
  const { data, error } = await supabase
    .from('custom_reports')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as SavedReport[]
}

export async function fetchCustomReport(supabase: SupabaseClient, id: string): Promise<SavedReport | null> {
  const { data, error } = await supabase
    .from('custom_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as SavedReport
}

export async function fetchSavedViews(supabase: SupabaseClient, pageKey?: string): Promise<SavedView[]> {
  let query = supabase.from('saved_views').select('*').order('name')
  if (pageKey) query = query.eq('page_key', pageKey)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as SavedView[]
}
