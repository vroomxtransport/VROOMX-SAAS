/**
 * Permission-based authorization system for VroomX.
 *
 * Permissions follow the format: "resource.action"
 * Built-in roles map to predefined permission sets.
 * Custom roles store permissions as arrays in the custom_roles table.
 */

// All available permissions grouped by resource
export const PERMISSION_CATEGORIES = {
  orders: ['orders.view', 'orders.create', 'orders.update', 'orders.delete'],
  trips: ['trips.view', 'trips.create', 'trips.update', 'trips.delete'],
  drivers: ['drivers.view', 'drivers.create', 'drivers.update', 'drivers.delete'],
  trucks: ['trucks.view', 'trucks.create', 'trucks.update', 'trucks.delete'],
  trailers: ['trailers.view', 'trailers.create', 'trailers.update', 'trailers.delete'],
  brokers: ['brokers.view', 'brokers.create', 'brokers.update', 'brokers.delete'],
  local_drives: ['local_drives.view', 'local_drives.create', 'local_drives.update', 'local_drives.delete'],
  fuel: ['fuel.view', 'fuel.create', 'fuel.update', 'fuel.delete'],
  maintenance: ['maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.delete'],
  compliance: ['compliance.view', 'compliance.create', 'compliance.update', 'compliance.delete'],
  billing: ['billing.view', 'billing.manage'],
  payments: ['payments.view', 'payments.create'],
  invoices: ['invoices.view', 'invoices.send'],
  tasks: ['tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete'],
  chat: ['chat.view', 'chat.create'],
  documents: ['documents.view', 'documents.create', 'documents.update', 'documents.delete'],
  trip_expenses: ['trip_expenses.view', 'trip_expenses.create', 'trip_expenses.update', 'trip_expenses.delete'],
  business_expenses: ['business_expenses.view', 'business_expenses.create', 'business_expenses.update', 'business_expenses.delete'],
  settings: ['settings.view', 'settings.manage'],
} as const

// Flat list of all permissions
export const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES).flat()

// Category display names for the permission picker UI
export const CATEGORY_LABELS: Record<string, string> = {
  orders: 'Orders',
  trips: 'Trips',
  drivers: 'Drivers',
  trucks: 'Trucks',
  trailers: 'Trailers',
  brokers: 'Brokers',
  local_drives: 'Local Drives',
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  compliance: 'Compliance',
  billing: 'Billing',
  payments: 'Payments',
  invoices: 'Invoices',
  tasks: 'Tasks',
  chat: 'Chat',
  documents: 'Documents',
  trip_expenses: 'Trip Expenses',
  business_expenses: 'Business Expenses',
  settings: 'Settings',
}

// Built-in roles and their permission sets
export const BUILT_IN_ROLES: Record<string, string[]> = {
  admin: ['*'],
  // Legacy: treat 'owner' the same as admin
  owner: ['*'],
  dispatcher: [
    'orders.*', 'trips.*', 'drivers.*', 'trucks.*', 'trailers.*',
    'brokers.*', 'local_drives.*', 'fuel.*', 'maintenance.*',
    'tasks.*', 'chat.*', 'documents.*', 'trip_expenses.*',
    'business_expenses.*',
  ],
  billing: [
    'orders.view', 'orders.update',
    'trips.view',
    'billing.*', 'payments.*', 'invoices.*',
  ],
  safety: [
    'compliance.*',
    'drivers.view', 'trucks.view', 'trailers.view', 'documents.view',
  ],
}

export const BUILT_IN_ROLE_NAMES = ['admin', 'dispatcher', 'billing', 'safety'] as const
export type BuiltInRole = (typeof BUILT_IN_ROLE_NAMES)[number]

export const BUILT_IN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  billing: 'Billing',
  safety: 'Safety',
}

/**
 * Check if a set of permissions grants a specific required permission.
 *
 * Supports:
 * - Exact match: 'orders.create' matches 'orders.create'
 * - Wildcard all: '*' matches everything
 * - Category wildcard: 'orders.*' matches 'orders.create', 'orders.delete', etc.
 */
export function hasPermission(userPermissions: string[], required: string): boolean {
  for (const perm of userPermissions) {
    // Global wildcard
    if (perm === '*') return true

    // Exact match
    if (perm === required) return true

    // Category wildcard: 'orders.*' matches 'orders.create'
    if (perm.endsWith('.*')) {
      const category = perm.slice(0, -2) // 'orders'
      if (required.startsWith(category + '.')) return true
    }
  }
  return false
}

/**
 * Resolve a role string to its permission array.
 *
 * For built-in roles: returns from BUILT_IN_ROLES map.
 * For custom roles: returns null (caller must fetch from DB).
 */
export function getBuiltInRolePermissions(role: string): string[] | null {
  if (role in BUILT_IN_ROLES) {
    return BUILT_IN_ROLES[role]
  }
  // Custom role: role format is 'custom:{uuid}'
  if (role.startsWith('custom:')) {
    return null // Caller must fetch from DB
  }
  return [] // Unknown role = no permissions
}
