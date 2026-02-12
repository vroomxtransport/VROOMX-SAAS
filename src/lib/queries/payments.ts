import type { SupabaseClient } from '@supabase/supabase-js'
import type { Payment } from '@/types/database'

export async function fetchPaymentsByOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('payment_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Payment[]
}
