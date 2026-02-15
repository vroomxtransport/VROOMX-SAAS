'use server'

import { authorize, safeError } from '@/lib/authz'
import { tripExpenseSchema } from '@/lib/validations/trip-expense'
import { revalidatePath } from 'next/cache'
import { recalculateTripFinancials } from '@/app/actions/trips'

export async function createTripExpense(tripId: string, data: unknown) {
  const parsed = tripExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trip_expenses.create', { rateLimit: { key: 'createTripExpense', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: expense, error } = await supabase
    .from('trip_expenses')
    .insert({
      tenant_id: tenantId,
      trip_id: tripId,
      category: v.category,
      custom_label: v.custom_label || null,
      amount: String(v.amount),
      notes: v.notes || null,
      expense_date: v.expense_date || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createTripExpense') }
  }

  // Recalculate trip financials after adding expense
  await recalculateTripFinancials(tripId)

  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dispatch')
  return { success: true, data: expense }
}

export async function updateTripExpense(id: string, tripId: string, data: unknown) {
  const parsed = tripExpenseSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trip_expenses.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (v.category !== undefined) updateData.category = v.category
  if (v.custom_label !== undefined) updateData.custom_label = v.custom_label || null
  if (v.amount !== undefined) updateData.amount = String(v.amount)
  if (v.notes !== undefined) updateData.notes = v.notes || null
  if (v.expense_date !== undefined) updateData.expense_date = v.expense_date || null

  const { data: expense, error } = await supabase
    .from('trip_expenses')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTripExpense') }
  }

  // Recalculate trip financials after updating expense
  await recalculateTripFinancials(tripId)

  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dispatch')
  return { success: true, data: expense }
}

export async function deleteTripExpense(id: string, tripId: string) {
  const auth = await authorize('trip_expenses.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTripExpense') }
  }

  // Recalculate trip financials after removing expense
  await recalculateTripFinancials(tripId)

  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dispatch')
  return { success: true }
}
