'use server'

import { authorize, safeError } from '@/lib/authz'
import { businessExpenseSchema } from '@/lib/validations/business-expense'
import { revalidatePath } from 'next/cache'

export async function createBusinessExpense(data: unknown) {
  const parsed = businessExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('business_expenses.create', { rateLimit: { key: 'createBusinessExpense', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: expense, error } = await supabase
    .from('business_expenses')
    .insert({
      tenant_id: tenantId,
      name: v.name,
      category: v.category,
      recurrence: v.recurrence,
      amount: String(v.amount),
      truck_id: v.truck_id || null,
      effective_from: v.effective_from,
      effective_to: v.effective_to || null,
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createBusinessExpense') }
  }

  revalidatePath('/business-expenses')
  revalidatePath('/financials')
  return { success: true, data: expense }
}

export async function updateBusinessExpense(id: string, data: unknown) {
  const parsed = businessExpenseSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('business_expenses.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const updateData: Record<string, unknown> = {}
  if (v.name !== undefined) updateData.name = v.name
  if (v.category !== undefined) updateData.category = v.category
  if (v.recurrence !== undefined) updateData.recurrence = v.recurrence
  if (v.amount !== undefined) updateData.amount = String(v.amount)
  if (v.truck_id !== undefined) updateData.truck_id = v.truck_id || null
  if (v.effective_from !== undefined) updateData.effective_from = v.effective_from
  if (v.effective_to !== undefined) updateData.effective_to = v.effective_to || null
  if (v.notes !== undefined) updateData.notes = v.notes || null

  const { data: expense, error } = await supabase
    .from('business_expenses')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateBusinessExpense') }
  }

  revalidatePath('/business-expenses')
  revalidatePath('/financials')
  return { success: true, data: expense }
}

export async function deleteBusinessExpense(id: string) {
  const auth = await authorize('business_expenses.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('business_expenses')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteBusinessExpense') }
  }

  revalidatePath('/business-expenses')
  revalidatePath('/financials')
  return { success: true }
}
