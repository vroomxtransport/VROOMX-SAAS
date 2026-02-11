import { type TenantRole } from '@/types'

export function getTierDisplayName(plan: string): string {
  const names: Record<string, string> = {
    trial: 'Free Trial',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return names[plan] || plan
}

export function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    past_due: 'bg-amber-100 text-amber-700',
    canceled: 'bg-red-100 text-red-700',
    unpaid: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

const ROLE_LEVEL: Record<string, number> = {
  viewer: 0,
  dispatcher: 1,
  admin: 2,
  owner: 3,
}

export function hasMinRole(userRole: string, requiredRole: TenantRole): boolean {
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[requiredRole] ?? 0)
}
