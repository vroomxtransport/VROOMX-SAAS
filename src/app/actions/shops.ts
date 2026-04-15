'use server'

import { revalidatePath } from 'next/cache'
import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { shopSchema } from '@/lib/validations/shop'
import type { Shop } from '@/types/database'

type ActionErr = { error: string | Record<string, string[]> }
type ActionOk<T> = { success: true } & T

function revalidateShopRoutes() {
  revalidatePath('/maintenance')
  revalidatePath('/maintenance/shops')
}

/** Normalize optional string form fields — empty strings → null for DB. */
function blankToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj }
  for (const [k, v] of Object.entries(out)) {
    if (v === '') out[k] = null
  }
  return out as T
}

export async function createShop(
  data: unknown,
): Promise<ActionOk<{ shop: Shop }> | ActionErr> {
  const parsed = shopSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    const auth = await authorize('shops.create', {
      rateLimit: { key: 'createShop', limit: 20, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const admin = createServiceRoleClient()
    const row = blankToNull({
      tenant_id: tenantId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      contact_name: parsed.data.contactName || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      notes: parsed.data.notes || null,
      is_active: parsed.data.isActive,
    })

    const { data: inserted, error } = await admin
      .from('shops')
      .insert(row)
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'createShop') }

    revalidateShopRoutes()
    return { success: true, shop: inserted as Shop }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'createShop.throw') }
  }
}

export async function updateShop(
  id: string,
  data: unknown,
): Promise<ActionOk<{ shop: Shop }> | ActionErr> {
  if (!id || typeof id !== 'string') return { error: 'Shop id is required.' }
  const parsed = shopSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    const auth = await authorize('shops.update', {
      rateLimit: { key: 'updateShop', limit: 40, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const admin = createServiceRoleClient()
    const { data: updated, error } = await admin
      .from('shops')
      .update({
        name: parsed.data.name,
        kind: parsed.data.kind,
        contact_name: parsed.data.contactName || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        zip: parsed.data.zip || null,
        notes: parsed.data.notes || null,
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'updateShop') }
    if (!updated) return { error: 'Shop not found.' }

    revalidateShopRoutes()
    return { success: true, shop: updated as Shop }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'updateShop.throw') }
  }
}

/** Soft-archive a shop (is_active = false). Keeps WO history intact. */
export async function archiveShop(
  id: string,
): Promise<{ success: true } | ActionErr> {
  if (!id || typeof id !== 'string') return { error: 'Shop id is required.' }

  try {
    const auth = await authorize('shops.delete', {
      rateLimit: { key: 'archiveShop', limit: 20, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const admin = createServiceRoleClient()
    const { error } = await admin
      .from('shops')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return { error: safeError(error, 'archiveShop') }

    revalidateShopRoutes()
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'archiveShop.throw') }
  }
}

export async function reactivateShop(
  id: string,
): Promise<{ success: true } | ActionErr> {
  if (!id || typeof id !== 'string') return { error: 'Shop id is required.' }

  try {
    const auth = await authorize('shops.update', {
      rateLimit: { key: 'reactivateShop', limit: 20, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const admin = createServiceRoleClient()
    const { error } = await admin
      .from('shops')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return { error: safeError(error, 'reactivateShop') }

    revalidateShopRoutes()
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'reactivateShop.throw') }
  }
}
