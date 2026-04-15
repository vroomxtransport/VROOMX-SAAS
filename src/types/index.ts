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
export type SubscriptionPlan = 'owner_operator' | 'starter_x' | 'pro_x'

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  'owner_operator',
  'starter_x',
  'pro_x',
] as const

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

// Tier limits — must match the SQL CASE in enforce_truck_limit / enforce_user_limit
export const TIER_LIMITS: Record<SubscriptionPlan, { trucks: number; users: number }> = {
  owner_operator: { trucks: 1,  users: 1 },
  starter_x:      { trucks: 5,  users: 3 },
  pro_x:          { trucks: 20, users: 10 },
}

// Pricing (monthly, in dollars)
export const TIER_PRICING: Record<SubscriptionPlan, number> = {
  owner_operator: 29,
  starter_x:      49,
  pro_x:          149,
}

// Free trial length (days) — applied on all tiers via Stripe trial_period_days
export const TIER_TRIAL_DAYS = 14

// ============================================================================
// Phase 2: Entity Type Unions
// ============================================================================

export type OrderStatus = 'new' | 'assigned' | 'picked_up' | 'delivered' | 'invoiced' | 'paid' | 'cancelled'

export type PaymentType = 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT'

export type DriverType = 'company' | 'owner_operator' | 'local_driver'

export type DriverStatus = 'active' | 'inactive'

export type TruckType = '7_car' | '8_car' | '9_car' | 'flatbed' | 'enclosed' | '2_car' | '3_car'

export type TruckStatus = 'active' | 'inactive' | 'maintenance'

export type DriverPayType = 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_mile' | 'per_car' | 'daily_salary'

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
  '7_car', '8_car', '9_car', 'flatbed', 'enclosed', '2_car', '3_car',
] as const

export const TRUCK_STATUSES: readonly TruckStatus[] = [
  'active', 'inactive', 'maintenance',
] as const

export const DRIVER_PAY_TYPES: readonly DriverPayType[] = [
  'percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile', 'per_car', 'daily_salary',
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
  '2_car': '2-Car Hauler',
  '3_car': '3-Car Hauler',
  '7_car': '7-Car Hauler',
  '8_car': '8-Car Hauler',
  '9_car': '9-Car Hauler',
  flatbed: 'Flatbed',
  enclosed: 'Enclosed',
}

export type CustomerType = 'private' | 'dealer' | 'business' | 'auction'

export const CUSTOMER_TYPES: CustomerType[] = ['private', 'dealer', 'business', 'auction']

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  private: 'Private',
  dealer: 'Dealer',
  business: 'Business',
  auction: 'Auction',
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
  daily_salary: 'Daily Salary',
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
  '2_car': 2,
  '3_car': 3,
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
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
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
// Dispatcher Payroll Types
// ============================================================================

export type DispatcherPayType = 'fixed_salary' | 'performance_revenue'
export type PayFrequency = 'weekly' | 'biweekly' | 'monthly'
export type PayrollPeriodStatus = 'draft' | 'approved' | 'paid'

export const DISPATCHER_PAY_TYPES: readonly DispatcherPayType[] = ['fixed_salary', 'performance_revenue'] as const
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly', 'biweekly', 'monthly'] as const
export const PAYROLL_PERIOD_STATUSES: readonly PayrollPeriodStatus[] = ['draft', 'approved', 'paid'] as const

export const DISPATCHER_PAY_TYPE_LABELS: Record<DispatcherPayType, string> = {
  fixed_salary: 'Fixed Salary',
  performance_revenue: 'Performance Revenue',
}

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
}

export const PAYROLL_PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  paid: 'Paid',
}

export const PAYROLL_PERIOD_STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-gray-50 text-gray-700 border-gray-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

// ============================================================================
// Order Activity Log Types
// ============================================================================

export type OrderActivityAction =
  | 'order_created' | 'order_updated' | 'order_deleted'
  | 'status_changed' | 'status_rolled_back'
  | 'assigned_to_trip' | 'unassigned_from_trip'
  | 'payment_recorded' | 'batch_marked_paid'
  | 'invoice_sent' | 'order_factored'
  | 'receipt_sent'
  | 'distance_recalculated'

// ============================================================================
// Phase 4: Billing & Invoicing Types
// ============================================================================

export type PaymentStatus = 'unpaid' | 'invoiced' | 'partially_paid' | 'paid' | 'factored'

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'unpaid', 'invoiced', 'partially_paid', 'paid', 'factored',
] as const

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  invoiced: 'Invoiced',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  factored: 'Factored',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-gray-50 text-gray-700 border-gray-200',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  factored: 'bg-purple-50 text-purple-700 border-purple-200',
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
  pending: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-50 text-gray-700 border-gray-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
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
  pending: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

// Local Drive Type (direction)
export type LocalDriveType = 'pickup_to_terminal' | 'delivery_from_terminal' | 'standalone'

export const LOCAL_DRIVE_TYPES: readonly LocalDriveType[] = ['pickup_to_terminal', 'delivery_from_terminal', 'standalone'] as const

export const LOCAL_DRIVE_TYPE_LABELS: Record<LocalDriveType, string> = {
  pickup_to_terminal: 'Pickup → Terminal',
  delivery_from_terminal: 'Terminal → Delivery',
  standalone: 'Standalone',
}

export const LOCAL_DRIVE_TYPE_COLORS: Record<LocalDriveType, string> = {
  pickup_to_terminal: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivery_from_terminal: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  standalone: 'bg-gray-50 text-gray-700 border-gray-200',
}

// Local Run Status
export type LocalRunStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export const LOCAL_RUN_STATUSES: readonly LocalRunStatus[] = ['planned', 'in_progress', 'completed', 'cancelled'] as const

export const LOCAL_RUN_STATUS_LABELS: Record<LocalRunStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const LOCAL_RUN_STATUS_COLORS: Record<LocalRunStatus, string> = {
  planned: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

// Maintenance types
export type MaintenanceType = 'preventive' | 'repair' | 'inspection' | 'tire' | 'oil_change' | 'other'
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'new' | 'closed'

export const MAINTENANCE_TYPES: readonly MaintenanceType[] = ['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other'] as const
export const MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed', 'new', 'closed'] as const

export type ShopKind = 'internal' | 'external'
export const SHOP_KINDS: readonly ShopKind[] = ['internal', 'external'] as const
export const SHOP_KIND_LABELS: Record<ShopKind, string> = {
  internal: 'Internal',
  external: 'External',
}

export type WorkOrderItemKind = 'labor' | 'part'
export const WORK_ORDER_ITEM_KINDS: readonly WorkOrderItemKind[] = ['labor', 'part'] as const
export const WORK_ORDER_ITEM_KIND_LABELS: Record<WorkOrderItemKind, string> = {
  labor: 'Labor',
  part: 'Part',
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventive: 'Preventive',
  repair: 'Repair',
  inspection: 'Inspection',
  tire: 'Tire',
  oil_change: 'Oil Change',
  other: 'Other',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
}

export const MAINTENANCE_STATUS_COLORS: Record<MaintenanceStatus, string> = {
  new: 'bg-slate-50 text-slate-700 border-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

// Compliance types
export type ComplianceDocType = 'dqf' | 'vehicle_qualification' | 'company_document'
export type ComplianceEntityType = 'driver' | 'truck' | 'company' | 'driver_application'
export type ComplianceDocStatus = 'valid' | 'expiring_soon' | 'expired'

export const COMPLIANCE_DOC_TYPES: readonly ComplianceDocType[] = ['dqf', 'vehicle_qualification', 'company_document'] as const
export const COMPLIANCE_ENTITY_TYPES: readonly ComplianceEntityType[] = ['driver', 'truck', 'company', 'driver_application'] as const
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
  driver_application: 'Driver Application',
}

export const COMPLIANCE_DOC_STATUS_LABELS: Record<ComplianceDocStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
}

export const COMPLIANCE_DOC_STATUS_COLORS: Record<ComplianceDocStatus, string> = {
  valid: 'bg-green-50 text-green-700 border-green-200',
  expiring_soon: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
}

// ============================================================================
// Compliance Sub-Categories (FMCSA)
// ============================================================================

// DQF sub-categories (49 CFR Part 391)
export type DqfSubCategory =
  | 'cdl_endorsements' | 'medical_certificate' | 'mvr'
  | 'drug_alcohol_testing' | 'road_test_cert' | 'employment_application'
  | 'employer_verification' | 'annual_review' | 'violations_incidents'

// Vehicle sub-categories (49 CFR Part 396)
export type VehicleSubCategory =
  | 'registration_title' | 'annual_dot_inspection' | 'insurance'
  | 'dvir' | 'maintenance_records' | 'permits'

// Company sub-categories
export type CompanySubCategory =
  | 'operating_authority' | 'boc3' | 'ucr'
  | 'insurance_certificates' | 'drug_alcohol_policy' | 'safety_rating'

export type ComplianceSubCategory = DqfSubCategory | VehicleSubCategory | CompanySubCategory | 'other'

export const DQF_SUB_CATEGORIES: readonly DqfSubCategory[] = [
  'cdl_endorsements', 'medical_certificate', 'mvr', 'drug_alcohol_testing',
  'road_test_cert', 'employment_application', 'employer_verification',
  'annual_review', 'violations_incidents',
] as const

export const VEHICLE_SUB_CATEGORIES: readonly VehicleSubCategory[] = [
  'registration_title', 'annual_dot_inspection', 'insurance',
  'dvir', 'maintenance_records', 'permits',
] as const

export const COMPANY_SUB_CATEGORIES: readonly CompanySubCategory[] = [
  'operating_authority', 'boc3', 'ucr',
  'insurance_certificates', 'drug_alcohol_policy', 'safety_rating',
] as const

export const COMPLIANCE_SUB_CATEGORY_LABELS: Record<ComplianceSubCategory, string> = {
  // DQF
  cdl_endorsements: 'CDL & Endorsements',
  medical_certificate: 'Medical Certificate (DOT Physical)',
  mvr: 'Motor Vehicle Record (MVR)',
  drug_alcohol_testing: 'Drug & Alcohol Testing',
  road_test_cert: 'Road Test Certificate',
  employment_application: 'Employment Application',
  employer_verification: 'Previous Employer Verification',
  annual_review: 'Annual Review of Driving Record',
  violations_incidents: 'Violations & Incidents',
  // Vehicle
  registration_title: 'Registration & Title',
  annual_dot_inspection: 'Annual DOT Inspection',
  insurance: 'Insurance (Liability/Cargo)',
  dvir: 'DVIR (Pre/Post Trip)',
  maintenance_records: 'Maintenance Records',
  permits: 'Permits (IRP/IFTA/OS&OW)',
  // Company
  operating_authority: 'Operating Authority (MC/DOT)',
  boc3: 'BOC-3 Process Agent',
  ucr: 'UCR Registration',
  insurance_certificates: 'Insurance Certificates',
  drug_alcohol_policy: 'Drug & Alcohol Policy',
  safety_rating: 'FMCSA Safety Rating',
  // Other
  other: 'Other',
}

// ============================================================================
// Safety Event Types
// ============================================================================

export type SafetyEventType = 'incident' | 'claim' | 'dot_inspection'
export type SafetyEventSeverity = 'minor' | 'moderate' | 'severe' | 'critical'
export type SafetyEventStatus = 'open' | 'under_review' | 'resolved' | 'closed'
export type DotInspectionLevel = 'I' | 'II' | 'III' | 'IV' | 'V'

export const SAFETY_EVENT_TYPES: readonly SafetyEventType[] = ['incident', 'claim', 'dot_inspection'] as const
export const SAFETY_EVENT_SEVERITIES: readonly SafetyEventSeverity[] = ['minor', 'moderate', 'severe', 'critical'] as const
export const SAFETY_EVENT_STATUSES: readonly SafetyEventStatus[] = ['open', 'under_review', 'resolved', 'closed'] as const
export const DOT_INSPECTION_LEVELS: readonly DotInspectionLevel[] = ['I', 'II', 'III', 'IV', 'V'] as const

export const SAFETY_EVENT_TYPE_LABELS: Record<SafetyEventType, string> = {
  incident: 'Incident / Accident',
  claim: 'Cargo Damage Claim',
  dot_inspection: 'DOT Inspection',
}

export const SAFETY_EVENT_SEVERITY_LABELS: Record<SafetyEventSeverity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  severe: 'Severe',
  critical: 'Critical',
}

export const SAFETY_EVENT_STATUS_LABELS: Record<SafetyEventStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const SAFETY_EVENT_SEVERITY_COLORS: Record<SafetyEventSeverity, string> = {
  minor: 'bg-blue-50 text-blue-700 border-blue-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  severe: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
}

export const SAFETY_EVENT_STATUS_COLORS: Record<SafetyEventStatus, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-50 text-gray-700 border-gray-200',
}

export const DOT_INSPECTION_LEVEL_LABELS: Record<DotInspectionLevel, string> = {
  I: 'Level I - Full Inspection',
  II: 'Level II - Walk-Around',
  III: 'Level III - Driver Only',
  IV: 'Level IV - Special',
  V: 'Level V - Vehicle Only',
}

// ============================================================================
// Phase 9: Driver Onboarding Pipeline Types
// ============================================================================

// --- DriverApplicationStatus ---

export type DriverApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'pending_adverse_action'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export const DRIVER_APPLICATION_STATUSES: readonly DriverApplicationStatus[] = [
  'draft',
  'submitted',
  'in_review',
  'pending_adverse_action',
  'approved',
  'rejected',
  'withdrawn',
] as const

export const DRIVER_APPLICATION_STATUS_LABELS: Record<DriverApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  pending_adverse_action: 'Pending Adverse Action',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export const DRIVER_APPLICATION_STATUS_COLORS: Record<DriverApplicationStatus, string> = {
  draft: 'bg-gray-50 text-gray-700 border-gray-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_adverse_action: 'bg-orange-50 text-orange-700 border-orange-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  withdrawn: 'bg-gray-50 text-gray-500 border-gray-200',
}

// --- OnboardingStepKey ---

export type OnboardingStepKey =
  | 'application_review'
  | 'mvr_pull'
  | 'prior_employer_verification'
  | 'clearinghouse_query'
  | 'drug_test'
  | 'medical_verification'
  | 'road_test'
  | 'psp_query'
  | 'dq_file_assembly'
  | 'final_approval'

export const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] = [
  'application_review',
  'mvr_pull',
  'prior_employer_verification',
  'clearinghouse_query',
  'drug_test',
  'medical_verification',
  'road_test',
  'psp_query',
  'dq_file_assembly',
  'final_approval',
] as const

export const ONBOARDING_STEP_KEY_LABELS: Record<OnboardingStepKey, string> = {
  application_review: 'Application Review',
  mvr_pull: 'Motor Vehicle Record (MVR)',
  prior_employer_verification: 'Prior Employer Verification',
  clearinghouse_query: 'FMCSA Clearinghouse Query',
  drug_test: 'Pre-Employment Drug Test',
  medical_verification: 'Medical Certificate Verification',
  road_test: 'Road Test / CDL Equivalent',
  psp_query: 'PSP Query (Optional)',
  dq_file_assembly: 'DQ File Assembly',
  final_approval: 'Final Approval',
}

export const ONBOARDING_STEP_ORDER: Record<OnboardingStepKey, number> = {
  application_review: 1,
  mvr_pull: 2,
  prior_employer_verification: 3,
  clearinghouse_query: 4,
  drug_test: 5,
  medical_verification: 6,
  road_test: 7,
  psp_query: 8,
  dq_file_assembly: 9,
  final_approval: 10,
}

export const ONBOARDING_STEP_KEY_REG_CITES: Record<OnboardingStepKey, string> = {
  application_review: '§ 391.21(b)',
  mvr_pull: '§ 391.23(a)(1)',
  prior_employer_verification: '§ 391.23(a)(2)',
  clearinghouse_query: '§ 382.701',
  drug_test: '§ 382.301',
  medical_verification: '§ 391.43 / § 391.45',
  road_test: '§ 391.31 / § 391.33',
  psp_query: 'FMCSA PSP',
  dq_file_assembly: '§ 391.51',
  final_approval: 'Internal',
}

// --- OnboardingStepStatus ---

export type OnboardingStepStatus =
  | 'pending'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'waived'
  | 'not_applicable'

export const ONBOARDING_STEP_STATUSES: readonly OnboardingStepStatus[] = [
  'pending',
  'in_progress',
  'passed',
  'failed',
  'waived',
  'not_applicable',
] as const

export const ONBOARDING_STEP_STATUS_LABELS: Record<OnboardingStepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  passed: 'Passed',
  failed: 'Failed',
  waived: 'Waived',
  not_applicable: 'Not Applicable',
}

export const ONBOARDING_STEP_STATUS_COLORS: Record<OnboardingStepStatus, string> = {
  pending: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  passed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  waived: 'bg-purple-50 text-purple-700 border-purple-200',
  not_applicable: 'bg-gray-50 text-gray-500 border-gray-100',
}

// --- ConsentType ---

export type ConsentType =
  | 'application_certification'
  | 'fcra_disclosure'
  | 'driver_license_requirements_certification'
  | 'drug_alcohol_testing_consent'
  | 'safety_performance_history_investigation'
  | 'psp_authorization'
  | 'clearinghouse_limited_query'
  | 'mvr_release'

export const CONSENT_TYPES: readonly ConsentType[] = [
  'application_certification',
  'fcra_disclosure',
  'driver_license_requirements_certification',
  'drug_alcohol_testing_consent',
  'safety_performance_history_investigation',
  'psp_authorization',
  'clearinghouse_limited_query',
  'mvr_release',
] as const

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  application_certification: 'Application Certification (§ 391.21(b)(12))',
  fcra_disclosure: 'FCRA Disclosure (§ 604(b)(2)(A))',
  driver_license_requirements_certification: 'Driver License Requirements Certification (Parts 383/391)',
  drug_alcohol_testing_consent: 'Drug & Alcohol Testing Consent (49 CFR Part 40.25(j))',
  safety_performance_history_investigation: 'Safety Performance History Investigation (§ 391.23)',
  psp_authorization: 'PSP Driver Disclosure & Authorization',
  clearinghouse_limited_query: 'Clearinghouse Limited Query Consent (Ongoing)',
  mvr_release: 'MVR Release (18 USC 2721)',
}

// Wizard page number for each consent (1-indexed, matches the 8-page form)
export const CONSENT_TYPE_PAGE: Record<ConsentType, number> = {
  application_certification: 1,
  fcra_disclosure: 2,
  driver_license_requirements_certification: 3,
  drug_alcohol_testing_consent: 4,
  safety_performance_history_investigation: 5,
  psp_authorization: 6,
  clearinghouse_limited_query: 7,
  mvr_release: 8,
}

// --- ApplicantDocumentType ---

export type ApplicantDocumentType = 'license_front' | 'license_back' | 'medical_card' | 'other'

export const APPLICANT_DOCUMENT_TYPES: readonly ApplicantDocumentType[] = [
  'license_front',
  'license_back',
  'medical_card',
  'other',
] as const

export const APPLICANT_DOCUMENT_TYPE_LABELS: Record<ApplicantDocumentType, string> = {
  license_front: "Driver's License (Front)",
  license_back: "Driver's License (Back)",
  medical_card: 'Medical Certificate (DOT Card)',
  other: 'Other Document',
}

// --- PipelineOverallStatus (text column, not an enum) ---

export type PipelineOverallStatus = 'pending' | 'in_progress' | 'on_hold' | 'cleared' | 'rejected'

export const PIPELINE_OVERALL_STATUSES: readonly PipelineOverallStatus[] = [
  'pending',
  'in_progress',
  'on_hold',
  'cleared',
  'rejected',
] as const

export const PIPELINE_OVERALL_STATUS_LABELS: Record<PipelineOverallStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  cleared: 'Cleared to Drive',
  rejected: 'Rejected',
}

export const PIPELINE_OVERALL_STATUS_COLORS: Record<PipelineOverallStatus, string> = {
  pending: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  on_hold: 'bg-amber-50 text-amber-700 border-amber-200',
  cleared: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

// Note: ComplianceEntityType, COMPLIANCE_ENTITY_TYPES, and COMPLIANCE_ENTITY_TYPE_LABELS
// are defined above (extended to include 'driver_application' in Phase 9).
