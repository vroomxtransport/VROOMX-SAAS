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
  created_at: string
  updated_at: string
}

export interface TenantMembership {
  id: string
  tenant_id: string
  user_id: string
  role: string
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
  pay_type: 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_mile' | 'per_car'
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
  truck_type: '7_car' | '8_car' | '9_car' | 'flatbed' | 'enclosed'
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
  delivery_location: string | null
  delivery_city: string | null
  delivery_state: string | null
  delivery_zip: string | null
  delivery_contact_name: string | null
  delivery_contact_phone: string | null
  delivery_date: string | null
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
  payment_type: 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT' | null
  payment_status: 'unpaid' | 'invoiced' | 'partially_paid' | 'paid'
  invoice_date: string | null
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

export interface ChatMessage {
  id: string
  tenant_id: string
  channel_id: string
  user_id: string
  user_name: string | null
  content: string
  created_at: string
}

export interface LocalDrive {
  id: string
  tenant_id: string
  order_id: string | null
  driver_id: string | null
  truck_id: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  pickup_location: string | null
  pickup_city: string | null
  pickup_state: string | null
  delivery_location: string | null
  delivery_city: string | null
  delivery_state: string | null
  scheduled_date: string | null
  completed_date: string | null
  revenue: string
  notes: string | null
  driver?: Driver
  truck?: Truck
  order?: Order
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
  uploaded_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
