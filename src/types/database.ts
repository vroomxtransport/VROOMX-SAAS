export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  dot_number: string | null
  mc_number: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  grace_period_ends_at: string | null
  is_suspended: boolean
  factoring_fee_rate: string
  onboarding_completed_at: string | null
  logo_storage_path: string | null
  brand_color_primary: string | null
  brand_color_secondary: string | null
  invoice_header_text: string | null
  invoice_footer_text: string | null
  created_at: string
  updated_at: string
}

export interface TenantMembership {
  id: string
  tenant_id: string
  user_id: string
  role: string
  full_name: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface StripeEvent {
  id: string
  event_id: string
  event_type: string
  processed_at: string
}

export interface Broker {
  id: string
  tenant_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  payment_terms: 'NET15' | 'NET30' | 'NET45' | 'NET60' | null
  factoring_company: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Driver {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  license_number: string | null
  driver_type: 'company' | 'owner_operator' | 'local_driver'
  driver_status: 'active' | 'inactive'
  pay_type: 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_mile' | 'per_car' | 'daily_salary'
  pay_rate: string
  auth_user_id: string | null
  pin_hash: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Truck {
  id: string
  tenant_id: string
  unit_number: string
  truck_type: '7_car' | '8_car' | '9_car' | 'flatbed' | 'enclosed' | '2_car' | '3_car'
  truck_status: 'active' | 'inactive' | 'maintenance'
  year: number | null
  make: string | null
  model: string | null
  vin: string | null
  ownership: string | null
  trailer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RouteStop {
  orderId: string
  stopType: 'pickup' | 'delivery'
}

export interface OrderVehicle {
  vin: string | null
  year: number
  make: string
  model: string
  type: string | null
  color: string | null
  lotNumber: string | null
  buyerNumber: string | null
  auctionPin: string | null
}

export interface Order {
  id: string
  tenant_id: string
  order_number: string | null
  broker_id: string | null
  driver_id: string | null
  vehicle_vin: string | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_type: string | null
  vehicle_color: string | null
  vehicles: OrderVehicle[] | null
  trip_id: string | null
  status: 'new' | 'assigned' | 'picked_up' | 'delivered' | 'invoiced' | 'paid' | 'cancelled'
  cancelled_reason: string | null
  pickup_location: string | null
  pickup_city: string | null
  pickup_state: string | null
  pickup_zip: string | null
  pickup_contact_name: string | null
  pickup_contact_phone: string | null
  pickup_date: string | null
  pickup_customer_type: string | null
  delivery_location: string | null
  delivery_city: string | null
  delivery_state: string | null
  delivery_zip: string | null
  delivery_contact_name: string | null
  delivery_contact_phone: string | null
  delivery_date: string | null
  delivery_customer_type: string | null
  actual_pickup_date: string | null
  actual_delivery_date: string | null
  distance_miles: string | null
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_latitude: number | null
  delivery_longitude: number | null
  revenue: string
  carrier_pay: string
  broker_fee: string
  local_fee: string
  driver_pay_rate_override: string | null
  cod_amount: string | null
  billing_amount: string | null
  payment_type: 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT' | null
  payment_status: 'unpaid' | 'invoiced' | 'partially_paid' | 'paid'
  invoice_date: string | null
  dispatched_by: string | null
  amount_paid: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  tenant_id: string
  trip_number: string | null
  driver_id: string
  truck_id: string
  status: 'planned' | 'in_progress' | 'at_terminal' | 'completed'
  start_date: string
  end_date: string
  carrier_pay: string
  total_revenue: string
  total_broker_fees: string
  total_local_fees: string
  driver_pay: string
  total_expenses: string
  local_operations_expense: string
  net_profit: string
  order_count: number
  total_miles: string
  origin_summary: string | null
  destination_summary: string | null
  route_sequence: RouteStop[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TripExpense {
  id: string
  tenant_id: string
  trip_id: string
  category: 'fuel' | 'tolls' | 'repairs' | 'lodging' | 'misc'
  custom_label: string | null
  amount: string
  notes: string | null
  expense_date: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  tenant_id: string
  order_id: string
  amount: string
  payment_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrderAttachment {
  id: string
  tenant_id: string
  order_id: string
  file_name: string
  file_type: string
  storage_path: string
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

export interface Trailer {
  id: string
  tenant_id: string
  trailer_number: string
  trailer_type: 'open' | 'enclosed' | 'flatbed'
  status: 'active' | 'inactive' | 'maintenance'
  year: number | null
  make: string | null
  model: string | null
  vin: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DriverDocument {
  id: string
  tenant_id: string
  driver_id: string
  document_type: 'cdl' | 'medical_card' | 'mvr' | 'other'
  file_name: string
  storage_path: string
  file_size: number | null
  expires_at: string | null
  uploaded_by: string | null
  created_at: string
}

export interface TruckDocument {
  id: string
  tenant_id: string
  truck_id: string
  document_type: 'registration' | 'insurance' | 'inspection_cert' | 'other'
  file_name: string
  storage_path: string
  file_size: number | null
  expires_at: string | null
  uploaded_by: string | null
  created_at: string
}

// ============================================================================
// Phase 8: New Module Interfaces
// ============================================================================

export interface Task {
  id: string
  tenant_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  assigned_to: string | null
  assigned_name: string | null
  category: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChatChannel {
  id: string
  tenant_id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChatAttachment {
  fileName: string
  storagePath: string
  fileSize: number
  mimeType: string
}

export interface ChatMention {
  userId: string
  displayName: string
}

export interface ChatMessage {
  id: string
  tenant_id: string
  channel_id: string
  user_id: string
  user_name: string | null
  content: string | null
  attachments: ChatAttachment[] | null
  mentions: ChatMention[] | null
  created_at: string
}

export interface ChatChannelRead {
  id: string
  tenant_id: string
  user_id: string
  channel_id: string
  last_read_at: string
}

export interface Terminal {
  id: string
  tenant_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  latitude: number | null
  longitude: number | null
  service_radius_miles: number
  is_active: boolean
  auto_create_local_drives: boolean
  auto_create_states: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LocalRun {
  id: string
  tenant_id: string
  terminal_id: string | null
  driver_id: string | null
  truck_id: string | null
  type: 'pickup_to_terminal' | 'delivery_from_terminal' | 'standalone'
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_date: string | null
  completed_date: string | null
  total_expense: string
  notes: string | null
  created_at: string
  updated_at: string
  // Optional joins
  terminal?: Terminal
  driver?: Driver
  truck?: Truck
  local_drives?: LocalDrive[]
}

export interface LocalDrive {
  id: string
  tenant_id: string
  order_id: string | null
  driver_id: string | null
  truck_id: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  type: 'pickup_to_terminal' | 'delivery_from_terminal' | 'standalone'
  terminal_id: string | null
  local_run_id: string | null
  trip_id: string | null
  pickup_location: string | null
  pickup_city: string | null
  pickup_state: string | null
  delivery_location: string | null
  delivery_city: string | null
  delivery_state: string | null
  scheduled_date: string | null
  completed_date: string | null
  revenue: string
  expense_amount: string
  inspection_visibility: string
  notes: string | null
  driver?: Driver
  truck?: Truck
  order?: Order
  terminal?: Terminal
  created_at: string
  updated_at: string
}

export interface FuelEntry {
  id: string
  tenant_id: string
  truck_id: string | null
  driver_id: string | null
  date: string
  gallons: string
  cost_per_gallon: string
  total_cost: string
  odometer: number | null
  location: string | null
  state: string | null
  notes: string | null
  driver?: Driver
  truck?: Truck
  created_at: string
  updated_at: string
}

export interface MaintenanceRecord {
  id: string
  tenant_id: string
  truck_id: string | null
  maintenance_type: 'preventive' | 'repair' | 'inspection' | 'tire' | 'oil_change' | 'other'
  status: 'scheduled' | 'in_progress' | 'completed'
  description: string | null
  vendor: string | null
  cost: string
  scheduled_date: string | null
  completed_date: string | null
  odometer: number | null
  notes: string | null
  truck?: Truck
  created_at: string
  updated_at: string
}

export interface ComplianceDocument {
  id: string
  tenant_id: string
  document_type: 'dqf' | 'vehicle_qualification' | 'company_document'
  entity_type: 'driver' | 'truck' | 'company'
  entity_id: string | null
  name: string
  file_name: string | null
  storage_path: string | null
  file_size: number | null
  expires_at: string | null
  issue_date: string | null
  uploaded_by: string | null
  notes: string | null
  sub_category: string
  status: string
  is_required: boolean
  regulation_reference: string | null
  created_at: string
  updated_at: string
}

export interface SafetyEvent {
  id: string
  tenant_id: string
  event_type: 'incident' | 'claim' | 'dot_inspection'
  severity: 'minor' | 'moderate' | 'severe' | 'critical'
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  event_date: string
  driver_id: string | null
  truck_id: string | null
  order_id: string | null
  vehicle_vin: string | null
  title: string
  description: string | null
  location: string | null
  location_state: string | null
  photos: Array<{ storagePath: string; fileName: string; fileSize: number }> | null
  financial_amount: string | null  // numeric from DB = string
  insurance_claim_number: string | null
  deduction_amount: string | null  // numeric from DB = string
  inspection_level: string | null
  violations_count: number
  out_of_service: boolean
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  // Optional joins
  driver?: { id: string; first_name: string; last_name: string }
  truck?: { id: string; unit_number: string; make: string; model: string }
}

export interface ComplianceRequirement {
  id: string
  tenant_id: string
  document_type: string
  sub_category: string
  display_name: string
  description: string | null
  regulation_reference: string | null
  renewal_period_months: number | null
  retention_months: number | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface BusinessExpense {
  id: string
  tenant_id: string
  name: string
  category: 'insurance' | 'tolls_fixed' | 'dispatch' | 'parking' | 'rent' | 'telematics' | 'registration' | 'salary' | 'truck_lease' | 'office_supplies' | 'software' | 'professional_services' | 'other'
  recurrence: 'monthly' | 'quarterly' | 'annual' | 'one_time'
  amount: string
  truck_id: string | null
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
  truck?: Truck
}

export interface DriverLocation {
  id: string
  tenant_id: string
  driver_id: string
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  updated_at: string
  driver?: Driver
}

export interface SamsaraVehicleLocation {
  id: string
  tenant_id: string
  samsara_vehicle_id: string
  samsara_name: string | null
  truck_id: string | null
  last_latitude: number | null
  last_longitude: number | null
  last_speed: number | null
  last_heading: number | null
  last_location_time: string | null
  truck?: { id: string; unit_number: string } | null
}

export interface OrderActivityLog {
  id: string
  tenant_id: string
  order_id: string
  action: string
  description: string
  actor_id: string | null
  actor_email: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ============================================================================
// Dispatcher Payroll Interfaces
// ============================================================================

export interface DispatcherPayConfig {
  id: string
  tenant_id: string
  user_id: string
  pay_type: 'fixed_salary' | 'performance_revenue'
  pay_rate: string
  pay_frequency: 'weekly' | 'biweekly' | 'monthly'
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DispatcherPayrollPeriod {
  id: string
  tenant_id: string
  user_id: string
  period_start: string
  period_end: string
  pay_type: 'fixed_salary' | 'performance_revenue'
  pay_rate: string
  base_amount: string
  performance_amount: string
  total_amount: string
  order_count: number
  total_order_revenue: string
  status: 'draft' | 'approved' | 'paid'
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  dispatcher?: { full_name: string; email: string }
}

export interface WebNotification {
  id: string
  tenant_id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

// ============================================================================
// QuickBooks Online Integration Interfaces
// ============================================================================

export interface QuickBooksIntegration {
  id: string
  tenant_id: string
  realm_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
  refresh_token_expires_at: string
  company_name: string | null
  sync_status: 'active' | 'paused' | 'error' | 'disconnected'
  last_sync_at: string | null
  last_error: string | null
  webhook_verifier_token: string | null
  created_at: string
  updated_at: string
}

export interface QuickBooksEntityMap {
  id: string
  tenant_id: string
  entity_type: 'broker_customer' | 'driver_vendor' | 'order_invoice' | 'payment' | 'expense'
  vroomx_id: string
  qb_id: string
  qb_sync_token: string | null
  last_synced_at: string
  sync_error: string | null
  created_at: string
  updated_at: string
}

export interface QuickBooksWebhookEvent {
  id: string
  tenant_id: string
  event_id: string
  realm_id: string
  entity_type: string
  entity_id: string
  operation: string
  payload: Record<string, unknown>
  processed_at: string
}

// ============================================================================
// Samsara ELD/Telematics Integration Interfaces
// ============================================================================

export interface SamsaraIntegration {
  id: string
  tenant_id: string
  samsara_org_id: string | null
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
  webhook_secret: string | null
  sync_status: 'active' | 'paused' | 'error' | 'disconnected'
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SamsaraVehicleMapping {
  id: string
  tenant_id: string
  samsara_vehicle_id: string
  truck_id: string | null
  samsara_name: string | null
  samsara_vin: string | null
  last_latitude: number | null
  last_longitude: number | null
  last_speed: number | null
  last_heading: number | null
  last_location_time: string | null
  last_odometer_meters: number | null
  created_at: string
  updated_at: string
  truck?: Truck
}

export interface SamsaraDriverMapping {
  id: string
  tenant_id: string
  samsara_driver_id: string
  driver_id: string | null
  samsara_name: string | null
  samsara_email: string | null
  samsara_phone: string | null
  samsara_license_number: string | null
  samsara_license_state: string | null
  samsara_status: string | null
  created_at: string
  updated_at: string
  driver?: Driver
}

export interface EldLog {
  id: string
  tenant_id: string
  driver_id: string | null
  samsara_driver_id: string
  duty_status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving'
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  vehicle_id: string | null
  vehicle_name: string | null
  driving_time_remaining_ms: number | null
  shift_time_remaining_ms: number | null
  cycle_time_remaining_ms: number | null
  time_until_break_ms: number | null
  location_latitude: number | null
  location_longitude: number | null
  location_description: string | null
  created_at: string
  driver?: Driver
}

// ============================================================================
// Fuel Card Integration Interfaces
// ============================================================================

export interface FuelCardIntegration {
  id: string
  tenant_id: string
  provider: string
  api_key_encrypted: string
  account_number: string | null
  company_name: string | null
  sync_status: 'active' | 'paused' | 'error' | 'disconnected'
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface FuelCardTransaction {
  id: string
  tenant_id: string
  provider: string
  external_transaction_id: string
  transaction_date: string
  card_number: string
  driver_name_on_card: string | null
  vehicle_unit_on_card: string | null
  product_type: string
  gallons: string          // numeric from DB = string
  price_per_gallon: string // numeric from DB = string
  total_amount: string     // numeric from DB = string
  odometer: number | null
  location_name: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  matched_truck_id: string | null
  matched_driver_id: string | null
  match_status: 'matched' | 'unmatched' | 'manual'
  anomaly_flagged: boolean
  anomaly_reason: string | null
  fuel_entry_id: string | null
  created_at: string
  updated_at: string
  // Optional joins
  truck?: { id: string; unit_number: string }
  driver?: { id: string; first_name: string; last_name: string }
}
