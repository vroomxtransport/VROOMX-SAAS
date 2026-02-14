'use server'

import { createClient } from '@/lib/supabase/server'
import { taskSchema } from '@/lib/validations/task'
import { revalidatePath } from 'next/cache'

export async function createTask(data: unknown) {
  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

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
    return { error: error.message }
  }

  revalidatePath('/tasks')
  return { data: task }
}

export async function updateTask(id: string, data: unknown) {
  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

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
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/tasks')
  return { data: task }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/tasks')
  return { success: true }
}

export async function toggleTaskStatus(id: string, status: 'pending' | 'in_progress' | 'completed') {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/tasks')
  return { data: task }
}
