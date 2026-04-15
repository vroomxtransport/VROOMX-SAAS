import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkOrder, WorkOrderItem, WorkOrderNote, WorkOrderAttachment, WorkOrderActivityLog, Shop, Truck, Trailer } from '@/types/database'

export type WorkOrderDetail = Omit<WorkOrder, 'truck' | 'shop' | 'items'> & {
  shop: Shop | null
  truck: Truck | null
  trailer: Trailer | null
  items: WorkOrderItem[]
  /** Renamed from `notes` to avoid collision with the header `notes: string | null` field. */
  noteEntries: WorkOrderNote[]
  attachments: WorkOrderAttachment[]
  activityLog: WorkOrderActivityLog[]
}

/** Single work order with shop, truck/trailer, items (sorted), notes, attachments, and activity log. */
export async function fetchWorkOrderDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<WorkOrderDetail | null> {
  const { data: wo, error } = await supabase
    .from('maintenance_records')
    .select(
      [
        '*',
        'shop:shops(*)',
        'truck:trucks(*)',
        'trailer:trailers(*)',
      ].join(', '),
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!wo) return null

  const [
    { data: items },
    { data: notes },
    { data: attachments },
    { data: activityLog },
  ] = await Promise.all([
    supabase
      .from('work_order_items')
      .select('*')
      .eq('work_order_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('work_order_notes')
      .select('*')
      .eq('work_order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_order_attachments')
      .select('*')
      .eq('work_order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_order_activity_logs')
      .select('*')
      .eq('work_order_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const woTyped = wo as unknown as WorkOrder & {
    shop: Shop | null
    truck: Truck | null
    trailer: Trailer | null
  }

  return {
    ...woTyped,
    items: (items ?? []) as WorkOrderItem[],
    noteEntries: (notes ?? []) as WorkOrderNote[],
    attachments: (attachments ?? []) as WorkOrderAttachment[],
    activityLog: (activityLog ?? []) as WorkOrderActivityLog[],
  }
}
