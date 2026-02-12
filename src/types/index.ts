// ============================================================================
// Phase 1: Auth & Multi-Tenancy Types
// ============================================================================

// Tenant roles
export type TenantRole = 'owner' | 'admin' | 'dispatcher' | 'viewer'

// Subscription plans
export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise'

// Subscription status
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

// Tier limits
export const TIER_LIMITS: Record<SubscriptionPlan, { trucks: number; users: number }> = {
  starter: { trucks: 5, users: 3 },
  pro: { trucks: 20, users: 10 },
  enterprise: { trucks: Infinity, users: Infinity },
}

// Pricing (monthly, in dollars)
export const TIER_PRICING: Record<SubscriptionPlan, number> = {
  starter: 49,
  pro: 149,
  enterprise: 299,
}

// ============================================================================
// Phase 2: Entity Type Unions
// ============================================================================

export type OrderStatus = 'new' | 'assigned' | 'picked_up' | 'delivered' | 'invoiced' | 'paid' | 'cancelled'

export type PaymentType = 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT'

export type DriverType = 'company' | 'owner_operator'

export type DriverStatus = 'active' | 'inactive'

export type TruckType = '7_car' | '8_car' | '9_car' | 'flatbed' | 'enclosed'

export type TruckStatus = 'active' | 'inactive' | 'maintenance'

export type DriverPayType = 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_mile' | 'per_car'

export type PaymentTerms = 'NET15' | 'NET30' | 'NET45' | 'NET60'

// ============================================================================
// Const Arrays (for iteration / select options)
// ============================================================================

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled',
] as const

export const PAYMENT_TYPES: readonly PaymentType[] = [
  'COD', 'COP', 'CHECK', 'BILL', 'SPLIT',
] as const

export const DRIVER_TYPES: readonly DriverType[] = [
  'company', 'owner_operator',
] as const

export const DRIVER_STATUSES: readonly DriverStatus[] = [
  'active', 'inactive',
] as const

export const TRUCK_TYPES: readonly TruckType[] = [
  '7_car', '8_car', '9_car', 'flatbed', 'enclosed',
] as const

export const TRUCK_STATUSES: readonly TruckStatus[] = [
  'active', 'inactive', 'maintenance',
] as const

export const DRIVER_PAY_TYPES: readonly DriverPayType[] = [
  'percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile', 'per_car',
] as const

export const PAYMENT_TERMS_OPTIONS: readonly PaymentTerms[] = [
  'NET15', 'NET30', 'NET45', 'NET60',
] as const

// ============================================================================
// Display Label Maps
// ============================================================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  COD: 'COD',
  COP: 'COP',
  CHECK: 'Check',
  BILL: 'Bill',
  SPLIT: 'Split',
}

export const DRIVER_TYPE_LABELS: Record<DriverType, string> = {
  company: 'Company',
  owner_operator: 'Owner Operator',
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}

export const TRUCK_TYPE_LABELS: Record<TruckType, string> = {
  '7_car': '7-Car Hauler',
  '8_car': '8-Car Hauler',
  '9_car': '9-Car Hauler',
  flatbed: 'Flatbed',
  enclosed: 'Enclosed',
}

export const TRUCK_STATUS_LABELS: Record<TruckStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
}

export const DRIVER_PAY_TYPE_LABELS: Record<DriverPayType, string> = {
  percentage_of_carrier_pay: '% of Carrier Pay',
  dispatch_fee_percent: 'Dispatch Fee %',
  per_mile: 'Per Mile',
  per_car: 'Per Car',
}

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  NET15: 'Net 15',
  NET30: 'Net 30',
  NET45: 'Net 45',
  NET60: 'Net 60',
}

// ============================================================================
// Status Color Maps (Tailwind classes for badge styling)
// ============================================================================

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-amber-50 text-amber-700 border-amber-200',
  picked_up: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200',
}

export const TRUCK_STATUS_COLORS: Record<TruckStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
}

// ============================================================================
// Phase 3: Dispatch Workflow Types
// ============================================================================

export type TripStatus = 'planned' | 'in_progress' | 'at_terminal' | 'completed'
export type ExpenseCategory = 'fuel' | 'tolls' | 'repairs' | 'lodging' | 'misc'

// Const arrays
export const TRIP_STATUSES: readonly TripStatus[] = ['planned', 'in_progress', 'at_terminal', 'completed'] as const
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['fuel', 'tolls', 'repairs', 'lodging', 'misc'] as const

// Labels
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  at_terminal: 'At Terminal',
  completed: 'Completed',
}
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  tolls: 'Tolls',
  repairs: 'Repairs',
  lodging: 'Lodging',
  misc: 'Miscellaneous',
}

// Colors (trip status)
export const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  at_terminal: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
}

// Truck capacity lookup (derived from truck_type)
export const TRUCK_CAPACITY: Record<TruckType, number> = {
  '7_car': 7,
  '8_car': 8,
  '9_car': 9,
  'flatbed': 4,
  'enclosed': 6,
}
