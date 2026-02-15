'use server'

import { authorize, safeError } from '@/lib/authz'
import { taskSchema } from '@/lib/validations/task'
import { revalidatePath } from 'next/cache'

export async function createTask(data: unknown) {
  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('tasks.create', { rateLimit: { key: 'createTask', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate || null,
      assigned_to: parsed.data.assignedTo || null,
      assigned_name: parsed.data.assignedName || null,
      category: parsed.data.category || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createTask') }
  }

  revalidatePath('/tasks')
  return { data: task }
}

export async function updateTask(id: string, data: unknown) {
  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('tasks.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: task, error } = await supabase
    .from('tasks')
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate || null,
      assigned_to: parsed.data.assignedTo || null,
      assigned_name: parsed.data.assignedName || null,
      category: parsed.data.category || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTask') }
  }

  revalidatePath('/tasks')
  return { data: task }
}

export async function deleteTask(id: string) {
  const auth = await authorize('tasks.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTask') }
  }

  revalidatePath('/tasks')
  return { success: true }
}

export async function toggleTaskStatus(id: string, status: 'pending' | 'in_progress' | 'completed') {
  const auth = await authorize('tasks.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'toggleTaskStatus') }
  }

  revalidatePath('/tasks')
  return { data: task }
}
