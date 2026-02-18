// ============================================================================
// Unified Action Result Types
// ============================================================================
export {
  type ActionResult,
  type ActionSuccessWithData,
  type ActionSuccessVoid,
  type ActionFieldErrors,
  type ActionError,
  isActionError,
  isFieldError,
  isStringError,
} from './action'

// ============================================================================
// Phase 1: Auth & Multi-Tenancy Types
// ============================================================================

// Tenant roles (built-in). 'owner' is legacy alias for 'admin'.
export type TenantRole = 'admin' | 'dispatcher' | 'billing' | 'safety' | 'owner'

// Subscription plans
export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise'

// Subscription status
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

// Invite status
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export const INVITE_STATUSES: readonly InviteStatus[] = [
  'pending', 'accepted', 'expired', 'revoked',
] as const

// Invitable roles (all built-in roles can be invited)
export type InvitableRole = 'admin' | 'dispatcher' | 'billing' | 'safety'

export const INVITABLE_ROLES: readonly InvitableRole[] = [
  'admin', 'dispatcher', 'billing', 'safety',
] as const

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

export type DriverType = 'company' | 'owner_operator' | 'local_driver'

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
  'company', 'owner_operator', 'local_driver',
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
  local_driver: 'Local Driver',
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
  new: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  assigned: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  picked_up: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  delivered: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
}

export const TRUCK_STATUS_COLORS: Record<TruckStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
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
  planned: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  at_terminal: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  completed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
}

// Truck capacity lookup (derived from truck_type)
export const TRUCK_CAPACITY: Record<TruckType, number> = {
  '7_car': 7,
  '8_car': 8,
  '9_car': 9,
  'flatbed': 4,
  'enclosed': 6,
}

// ============================================================================
// Phase 7: Trailer & Document Types
// ============================================================================

export type TrailerType = 'open' | 'enclosed' | 'flatbed'
export type TrailerStatus = 'active' | 'inactive' | 'maintenance'
export type DriverDocumentType = 'cdl' | 'medical_card' | 'mvr' | 'other'
export type TruckDocumentType = 'registration' | 'insurance' | 'inspection_cert' | 'other'

export const TRAILER_TYPES: readonly TrailerType[] = ['open', 'enclosed', 'flatbed'] as const
export const TRAILER_STATUSES: readonly TrailerStatus[] = ['active', 'inactive', 'maintenance'] as const
export const DRIVER_DOCUMENT_TYPES: readonly DriverDocumentType[] = ['cdl', 'medical_card', 'mvr', 'other'] as const
export const TRUCK_DOCUMENT_TYPES: readonly TruckDocumentType[] = ['registration', 'insurance', 'inspection_cert', 'other'] as const

export const TRAILER_TYPE_LABELS: Record<TrailerType, string> = {
  open: 'Open',
  enclosed: 'Enclosed',
  flatbed: 'Flatbed',
}

export const TRAILER_STATUS_LABELS: Record<TrailerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
}

export const TRAILER_STATUS_COLORS: Record<TrailerStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
}

export const DRIVER_DOCUMENT_TYPE_LABELS: Record<DriverDocumentType, string> = {
  cdl: 'CDL',
  medical_card: 'Medical Card',
  mvr: 'MVR',
  other: 'Other',
}

export const TRUCK_DOCUMENT_TYPE_LABELS: Record<TruckDocumentType, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  inspection_cert: 'Inspection Certificate',
  other: 'Other',
}

// ============================================================================
// Business Expenses Types
// ============================================================================

export type BusinessExpenseCategory = 'insurance' | 'tolls_fixed' | 'dispatch' | 'parking' | 'rent' | 'telematics' | 'registration' | 'salary' | 'truck_lease' | 'office_supplies' | 'software' | 'professional_services' | 'other'

export type BusinessExpenseRecurrence = 'monthly' | 'quarterly' | 'annual' | 'one_time'

export const BUSINESS_EXPENSE_CATEGORIES: readonly BusinessExpenseCategory[] = [
  'insurance', 'tolls_fixed', 'dispatch', 'parking', 'rent', 'telematics',
  'registration', 'salary', 'truck_lease', 'office_supplies', 'software',
  'professional_services', 'other',
] as const

export const BUSINESS_EXPENSE_RECURRENCES: readonly BusinessExpenseRecurrence[] = [
  'monthly', 'quarterly', 'annual', 'one_time',
] as const

export const BUSINESS_EXPENSE_CATEGORY_LABELS: Record<BusinessExpenseCategory, string> = {
  insurance: 'Insurance',
  tolls_fixed: 'Tolls (Fixed)',
  dispatch: 'Dispatch Service',
  parking: 'Parking',
  rent: 'Rent',
  telematics: 'Telematics (Samsara)',
  registration: 'Registration',
  salary: 'Salary',
  truck_lease: 'Truck Lease',
  office_supplies: 'Office Supplies',
  software: 'Software',
  professional_services: 'Professional Services',
  other: 'Other',
}

export const BUSINESS_EXPENSE_RECURRENCE_LABELS: Record<BusinessExpenseRecurrence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  one_time: 'One-Time',
}

// ============================================================================
// Phase 4: Billing & Invoicing Types
// ============================================================================

export type PaymentStatus = 'unpaid' | 'invoiced' | 'partially_paid' | 'paid'

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'unpaid', 'invoiced', 'partially_paid', 'paid',
] as const

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  invoiced: 'Invoiced',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
}

// ============================================================================
// Phase 8: New Module Types
// ============================================================================

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed'] as const
export const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent'] as const

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  completed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

// Local Drive types
export type LocalDriveStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export const LOCAL_DRIVE_STATUSES: readonly LocalDriveStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'] as const

export const LOCAL_DRIVE_STATUS_LABELS: Record<LocalDriveStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const LOCAL_DRIVE_STATUS_COLORS: Record<LocalDriveStatus, string> = {
  pending: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  completed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

// Maintenance types
export type MaintenanceType = 'preventive' | 'repair' | 'inspection' | 'tire' | 'oil_change' | 'other'
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed'

export const MAINTENANCE_TYPES: readonly MaintenanceType[] = ['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other'] as const
export const MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed'] as const

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventive: 'Preventive',
  repair: 'Repair',
  inspection: 'Inspection',
  tire: 'Tire',
  oil_change: 'Oil Change',
  other: 'Other',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export const MAINTENANCE_STATUS_COLORS: Record<MaintenanceStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  completed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
}

// Compliance types
export type ComplianceDocType = 'dqf' | 'vehicle_qualification' | 'company_document'
export type ComplianceEntityType = 'driver' | 'truck' | 'company'
export type ComplianceDocStatus = 'valid' | 'expiring_soon' | 'expired'

export const COMPLIANCE_DOC_TYPES: readonly ComplianceDocType[] = ['dqf', 'vehicle_qualification', 'company_document'] as const
export const COMPLIANCE_ENTITY_TYPES: readonly ComplianceEntityType[] = ['driver', 'truck', 'company'] as const
export const COMPLIANCE_DOC_STATUSES: readonly ComplianceDocStatus[] = ['valid', 'expiring_soon', 'expired'] as const

export const COMPLIANCE_DOC_TYPE_LABELS: Record<ComplianceDocType, string> = {
  dqf: 'Driver Qualification',
  vehicle_qualification: 'Vehicle Qualification',
  company_document: 'Company Document',
}

export const COMPLIANCE_ENTITY_TYPE_LABELS: Record<ComplianceEntityType, string> = {
  driver: 'Driver',
  truck: 'Truck',
  company: 'Company',
}

export const COMPLIANCE_DOC_STATUS_LABELS: Record<ComplianceDocStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
}

export const COMPLIANCE_DOC_STATUS_COLORS: Record<ComplianceDocStatus, string> = {
  valid: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  expiring_soon: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  expired: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}
