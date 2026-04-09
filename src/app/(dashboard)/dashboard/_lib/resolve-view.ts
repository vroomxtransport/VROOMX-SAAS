import type { TenantRole } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardView = 'dispatcher' | 'accounting' | 'owner'

// ---------------------------------------------------------------------------
// Role → View mappings
// ---------------------------------------------------------------------------

const ROLE_TO_DEFAULT_VIEW: Record<TenantRole, DashboardView> = {
  admin: 'owner',
  owner: 'owner',
  dispatcher: 'dispatcher',
  billing: 'accounting',
  safety: 'dispatcher',
}

const ROLE_VIEW_ACCESS: Record<TenantRole, DashboardView[]> = {
  admin: ['owner', 'dispatcher', 'accounting'],
  owner: ['owner', 'dispatcher', 'accounting'],
  dispatcher: ['dispatcher'],
  billing: ['accounting'],
  safety: ['dispatcher'],
}

// ---------------------------------------------------------------------------
// Custom role inference from permissions
// ---------------------------------------------------------------------------

function inferCustomRoleView(permissions: string[]): {
  defaultView: DashboardView
  accessibleViews: DashboardView[]
} {
  const hasWildcard = permissions.includes('*')
  const hasBilling =
    permissions.some((p) => p.startsWith('billing.')) ||
    permissions.some((p) => p.startsWith('invoices.')) ||
    permissions.some((p) => p.startsWith('payments.'))
  const hasOperations =
    permissions.some((p) => p.startsWith('orders.')) ||
    permissions.some((p) => p.startsWith('trips.'))

  if (hasWildcard) {
    return { defaultView: 'owner', accessibleViews: ['owner', 'dispatcher', 'accounting'] }
  }

  const views: DashboardView[] = []
  if (hasBilling) views.push('accounting')
  if (hasOperations) views.push('dispatcher')

  // Default to dispatcher if no clear match
  if (views.length === 0) views.push('dispatcher')

  return { defaultView: views[0], accessibleViews: views }
}

// ---------------------------------------------------------------------------
// View resolution
// ---------------------------------------------------------------------------

/**
 * Resolves which dashboard view to render based on the user's role and an
 * optional `?view=` search param override.
 *
 * - Built-in roles use static mapping.
 * - Custom roles (`custom:{uuid}`) infer views from their permission set.
 * - Unauthorized `?view=` overrides are silently ignored.
 */
export function resolveView(
  role: string,
  requestedView?: string | null,
  customRolePermissions?: string[]
): { view: DashboardView; accessibleViews: DashboardView[] } {
  let defaultView: DashboardView
  let accessibleViews: DashboardView[]

  if (role.startsWith('custom:') && customRolePermissions) {
    const inferred = inferCustomRoleView(customRolePermissions)
    defaultView = inferred.defaultView
    accessibleViews = inferred.accessibleViews
  } else {
    const builtInRole = role as TenantRole
    defaultView = ROLE_TO_DEFAULT_VIEW[builtInRole] ?? 'dispatcher'
    accessibleViews = ROLE_VIEW_ACCESS[builtInRole] ?? ['dispatcher']
  }

  // Validate requested view against allowed views
  if (
    requestedView &&
    ['dispatcher', 'accounting', 'owner'].includes(requestedView) &&
    accessibleViews.includes(requestedView as DashboardView)
  ) {
    return { view: requestedView as DashboardView, accessibleViews }
  }

  return { view: defaultView, accessibleViews }
}

// ---------------------------------------------------------------------------
// Widget registry — maps widgets to their valid views
// ---------------------------------------------------------------------------

export type WidgetId =
  | 'statCards'
  | 'loadsPipeline'
  | 'revenueChart'
  | 'fleetPulse'
  | 'upcomingPickups'
  | 'activityFeed'
  | 'openInvoices'
  | 'topDrivers'
  | 'quickLinks'
  // Dispatcher-specific
  | 'dispatchEfficiency'
  // Accounting-specific
  | 'arAgingChart'
  | 'recentPayments'
  | 'paymentStatusBreakdown'
  // Owner-specific
  | 'pnlSummary'
  | 'brokerScorecardMini'
  | 'revenueForecast'

export interface WidgetMeta {
  id: WidgetId
  label: string
  views: DashboardView[]
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  // Shared
  { id: 'statCards', label: 'Stats Overview', views: ['dispatcher', 'accounting', 'owner'] },
  { id: 'quickLinks', label: 'Quick Links', views: ['dispatcher', 'accounting', 'owner'] },

  // Dispatcher + Owner shared
  { id: 'loadsPipeline', label: 'Loads Pipeline', views: ['dispatcher', 'owner'] },
  { id: 'fleetPulse', label: 'Fleet Pulse', views: ['dispatcher', 'owner'] },
  { id: 'upcomingPickups', label: 'Upcoming Pickups', views: ['dispatcher', 'owner'] },
  { id: 'activityFeed', label: 'Activity Feed', views: ['dispatcher', 'owner'] },
  { id: 'topDrivers', label: 'Top Drivers', views: ['dispatcher', 'owner'] },

  // Accounting + Owner shared
  { id: 'revenueChart', label: 'Revenue Chart', views: ['accounting', 'owner'] },
  { id: 'openInvoices', label: 'Open Invoices', views: ['accounting', 'owner'] },

  // Dispatcher only
  { id: 'dispatchEfficiency', label: 'Dispatch Efficiency', views: ['dispatcher'] },

  // Accounting only
  { id: 'arAgingChart', label: 'AR Aging', views: ['accounting'] },
  { id: 'recentPayments', label: 'Recent Payments', views: ['accounting'] },
  { id: 'paymentStatusBreakdown', label: 'Payment Status', views: ['accounting'] },

  // Owner only
  { id: 'pnlSummary', label: 'P&L Summary', views: ['owner'] },
  { id: 'brokerScorecardMini', label: 'Broker Scorecard', views: ['owner'] },
  { id: 'revenueForecast', label: 'Revenue Forecast', views: ['owner'] },
]

/** Get widget metadata filtered to a specific view. */
export function getWidgetsForView(view: DashboardView): WidgetMeta[] {
  return WIDGET_REGISTRY.filter((w) => w.views.includes(view))
}
