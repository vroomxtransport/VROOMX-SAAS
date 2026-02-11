export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
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
  driver_type: 'company' | 'owner_operator'
  driver_status: 'active' | 'inactive'
  pay_type: 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_mile'
  pay_rate: number
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
  notes: string | null
  created_at: string
  updated_at: string
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
  revenue: string
  carrier_pay: string
  broker_fee: string
  payment_type: 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT' | null
  notes: string | null
  created_at: string
  updated_at: string
}
