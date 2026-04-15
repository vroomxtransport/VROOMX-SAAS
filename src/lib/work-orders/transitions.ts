/**
 * Pure status-transition guard for work orders. Lives here (not in the
 * `'use server'` actions file) because Next.js requires every export from
 * a server-action module to be an async function.
 */

import type { MaintenanceStatus } from '@/types'

const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  new: ['scheduled', 'in_progress', 'closed'],
  scheduled: ['new', 'in_progress', 'closed'],
  in_progress: ['new', 'scheduled', 'completed'],
  completed: ['in_progress', 'closed'],
  closed: ['in_progress'],
}

export function isTransitionAllowed(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): boolean {
  if (from === to) return false
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
