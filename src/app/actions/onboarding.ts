'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateSampleData } from '@/lib/seed-data'

export async function dismissOnboarding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  const { error } = await supabase
    .from('tenants')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    console.error('Failed to dismiss onboarding:', error)
    return { error: 'Failed to dismiss onboarding' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

const SAMPLE_TAG = '[SAMPLE DATA]'

export async function seedSampleData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const role = user.app_metadata?.role
  if (role !== 'owner') return { error: 'Only the account owner can load sample data' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  // Check if sample data already exists
  const { count: existingCount } = await supabase
    .from('brokers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .like('notes', `%${SAMPLE_TAG}%`)

  if (existingCount && existingCount > 0) {
    return { error: 'Sample data already loaded. Clear it first before reloading.' }
  }

  const data = generateSampleData()

  try {
    // 1. Insert brokers
    const { data: brokers, error: brokerErr } = await supabase
      .from('brokers')
      .insert(data.brokers.map(b => ({ ...b, tenant_id: tenantId })))
      .select('id')

    if (brokerErr) throw new Error(`Brokers: ${brokerErr.message}`)

    // 2. Insert drivers
    const { data: drivers, error: driverErr } = await supabase
      .from('drivers')
      .insert(data.drivers.map(d => ({ ...d, tenant_id: tenantId })))
      .select('id')

    if (driverErr) throw new Error(`Drivers: ${driverErr.message}`)

    // 3. Insert trucks
    const { data: trucks, error: truckErr } = await supabase
      .from('trucks')
      .insert(data.trucks.map(t => ({ ...t, tenant_id: tenantId })))
      .select('id')

    if (truckErr) throw new Error(`Trucks: ${truckErr.message}`)

    // 4. Insert orders - distribute across brokers and drivers
    const brokerIds = brokers?.map(b => b.id) ?? []
    const driverIds = drivers?.map(d => d.id) ?? []

    const ordersToInsert = data.orders.map((o, i) => ({
      ...o,
      tenant_id: tenantId,
      broker_id: brokerIds[i % brokerIds.length] ?? null,
      driver_id: i < 6 ? (driverIds[i % driverIds.length] ?? null) : null,
    }))

    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .insert(ordersToInsert)
      .select('id')

    if (orderErr) throw new Error(`Orders: ${orderErr.message}`)

    // 5. Create 2 sample trips and assign first 4 orders
    const truckIds = trucks?.map(t => t.id) ?? []
    const orderIds = orders?.map(o => o.id) ?? []

    if (driverIds.length >= 2 && truckIds.length >= 2 && orderIds.length >= 4) {
      // Trip 1: planned, driver 1, truck 1
      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const { data: trip1, error: trip1Err } = await supabase
        .from('trips')
        .insert({
          tenant_id: tenantId,
          driver_id: driverIds[0],
          truck_id: truckIds[0],
          start_date: today,
          end_date: nextWeek,
          carrier_pay: '1500',
          notes: SAMPLE_TAG,
          origin_summary: 'Fort Lauderdale, FL',
          destination_summary: 'Baltimore, MD',
        })
        .select('id')
        .single()

      if (!trip1Err && trip1) {
        // Assign first 2 orders to trip 1
        await supabase.from('orders').update({ trip_id: trip1.id }).eq('id', orderIds[0])
        await supabase.from('orders').update({ trip_id: trip1.id }).eq('id', orderIds[1])
      }

      // Trip 2: in_progress, driver 2, truck 2
      const { data: trip2, error: trip2Err } = await supabase
        .from('trips')
        .insert({
          tenant_id: tenantId,
          driver_id: driverIds[1],
          truck_id: truckIds[1],
          start_date: today,
          end_date: nextWeek,
          carrier_pay: '1800',
          trip_status: 'in_progress',
          notes: SAMPLE_TAG,
          origin_summary: 'Los Angeles, CA',
          destination_summary: 'San Francisco, CA',
        })
        .select('id')
        .single()

      if (!trip2Err && trip2) {
        // Assign orders 3-4 to trip 2
        await supabase.from('orders').update({ trip_id: trip2.id }).eq('id', orderIds[2])
        await supabase.from('orders').update({ trip_id: trip2.id }).eq('id', orderIds[3])
      }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Failed to seed sample data:', err)
    return { error: err instanceof Error ? err.message : 'Failed to load sample data' }
  }
}

export async function clearSampleData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const role = user.app_metadata?.role
  if (role !== 'owner') return { error: 'Only the account owner can clear sample data' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  try {
    // Delete in reverse dependency order:

    // 1. Get sample trip IDs to clean up order assignments
    const { data: sampleTrips } = await supabase
      .from('trips')
      .select('id')
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    if (sampleTrips && sampleTrips.length > 0) {
      const tripIds = sampleTrips.map(t => t.id)

      // Unassign orders from sample trips
      for (const tripId of tripIds) {
        await supabase
          .from('orders')
          .update({ trip_id: null })
          .eq('trip_id', tripId)
      }

      // Delete trip expenses for sample trips
      for (const tripId of tripIds) {
        await supabase
          .from('trip_expenses')
          .delete()
          .eq('trip_id', tripId)
      }
    }

    // 2. Delete sample trips
    await supabase
      .from('trips')
      .delete()
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    // 3. Delete sample orders (must be before brokers/drivers due to FK)
    await supabase
      .from('orders')
      .delete()
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    // 4. Delete sample trucks
    await supabase
      .from('trucks')
      .delete()
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    // 5. Delete sample drivers
    await supabase
      .from('drivers')
      .delete()
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    // 6. Delete sample brokers
    await supabase
      .from('brokers')
      .delete()
      .eq('tenant_id', tenantId)
      .like('notes', `%${SAMPLE_TAG}%`)

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Failed to clear sample data:', err)
    return { error: err instanceof Error ? err.message : 'Failed to clear sample data' }
  }
}
