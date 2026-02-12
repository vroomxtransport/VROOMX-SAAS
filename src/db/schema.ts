import { pgTable, uuid, text, timestamp, unique, index, numeric, integer, date, pgEnum, boolean } from 'drizzle-orm/pg-core'

// ============================================================================
// Enums
// ============================================================================

export const orderStatusEnum = pgEnum('order_status', [
  'new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled',
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'COD', 'COP', 'CHECK', 'BILL', 'SPLIT',
])

export const driverTypeEnum = pgEnum('driver_type', ['company', 'owner_operator'])

export const driverStatusEnum = pgEnum('driver_status', ['active', 'inactive'])

export const truckTypeEnum = pgEnum('truck_type', ['7_car', '8_car', '9_car', 'flatbed', 'enclosed'])

export const truckStatusEnum = pgEnum('truck_status', ['active', 'inactive', 'maintenance'])

export const driverPayTypeEnum = pgEnum('driver_pay_type', [
  'percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile', 'per_car',
])

export const paymentTermsEnum = pgEnum('payment_terms', ['NET15', 'NET30', 'NET45', 'NET60'])

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid', 'invoiced', 'partially_paid', 'paid',
])

// ============================================================================
// Phase 1 Tables
// ============================================================================

/**
 * Tenants Table
 * Root of multi-tenancy. Each tenant is a separate company/organization.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('trial'),
  subscriptionStatus: text('subscription_status').notNull().default('trialing'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  // Company info (Phase 4 - for invoice headers)
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  phone: text('phone'),
  // Phase 5 - Dunning and onboarding
  gracePeriodEndsAt: timestamp('grace_period_ends_at', { withTimezone: true }),
  isSuspended: boolean('is_suspended').notNull().default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Tenant Memberships Table
 * Links users to tenants with role-based access control.
 */
export const tenantMemberships = pgTable('tenant_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // References auth.users (not defined in this schema)
  role: text('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('tenant_memberships_tenant_user_unique').on(table.tenantId, table.userId),
  index('idx_tenant_memberships_user_id').on(table.userId),
  index('idx_tenant_memberships_tenant_id').on(table.tenantId),
])

/**
 * Stripe Events Table
 * Ensures webhook idempotency - prevents duplicate processing.
 */
export const stripeEvents = pgTable('stripe_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: text('event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_stripe_events_event_id').on(table.eventId),
])

// ============================================================================
// Phase 2 Tables: Core Entities
// ============================================================================

/**
 * Brokers Table
 * Broker companies that provide loads to the carrier.
 */
export const brokers = pgTable('brokers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  paymentTerms: paymentTermsEnum('payment_terms'),
  factoringCompany: text('factoring_company'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_brokers_tenant_id').on(table.tenantId),
])

/**
 * Drivers Table
 * Company drivers and owner-operators with pay configuration.
 */
export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  licenseNumber: text('license_number'),
  driverType: driverTypeEnum('driver_type').notNull().default('company'),
  driverStatus: driverStatusEnum('driver_status').notNull().default('active'),
  payType: driverPayTypeEnum('pay_type').notNull().default('percentage_of_carrier_pay'),
  payRate: numeric('pay_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_drivers_tenant_id').on(table.tenantId),
  index('idx_drivers_tenant_status').on(table.tenantId, table.driverStatus),
])

/**
 * Trucks Table
 * Fleet vehicles with type, status, and ownership tracking.
 */
export const trucks = pgTable('trucks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  unitNumber: text('unit_number').notNull(),
  truckType: truckTypeEnum('truck_type').notNull().default('7_car'),
  truckStatus: truckStatusEnum('truck_status').notNull().default('active'),
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  vin: text('vin'),
  ownership: text('ownership').default('company'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_trucks_tenant_id').on(table.tenantId),
  index('idx_trucks_tenant_status').on(table.tenantId, table.truckStatus),
])

/**
 * Orders Table
 * Vehicle transport orders with full lifecycle tracking.
 */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  orderNumber: text('order_number'),
  brokerId: uuid('broker_id').references(() => brokers.id),
  driverId: uuid('driver_id').references(() => drivers.id),
  // Vehicle
  vehicleVin: text('vehicle_vin'),
  vehicleYear: integer('vehicle_year'),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleType: text('vehicle_type'),
  vehicleColor: text('vehicle_color'),
  // Status
  status: orderStatusEnum('status').notNull().default('new'),
  cancelledReason: text('cancelled_reason'),
  // Pickup
  pickupLocation: text('pickup_location'),
  pickupCity: text('pickup_city'),
  pickupState: text('pickup_state'),
  pickupZip: text('pickup_zip'),
  pickupContactName: text('pickup_contact_name'),
  pickupContactPhone: text('pickup_contact_phone'),
  pickupDate: date('pickup_date'),
  // Delivery
  deliveryLocation: text('delivery_location'),
  deliveryCity: text('delivery_city'),
  deliveryState: text('delivery_state'),
  deliveryZip: text('delivery_zip'),
  deliveryContactName: text('delivery_contact_name'),
  deliveryContactPhone: text('delivery_contact_phone'),
  deliveryDate: date('delivery_date'),
  // Actual dates
  actualPickupDate: timestamp('actual_pickup_date', { withTimezone: true }),
  actualDeliveryDate: timestamp('actual_delivery_date', { withTimezone: true }),
  // Financial
  revenue: numeric('revenue', { precision: 12, scale: 2 }).default('0'),
  carrierPay: numeric('carrier_pay', { precision: 12, scale: 2 }).default('0'),
  brokerFee: numeric('broker_fee', { precision: 12, scale: 2 }).default('0'),
  paymentType: paymentTypeEnum('payment_type').default('COP'),
  // Trip assignment
  tripId: uuid('trip_id'),
  // Billing (Phase 4)
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_orders_tenant_id').on(table.tenantId),
  index('idx_orders_tenant_status').on(table.tenantId, table.status),
  index('idx_orders_tenant_broker').on(table.tenantId, table.brokerId),
  index('idx_orders_tenant_driver').on(table.tenantId, table.driverId),
  index('idx_orders_tenant_trip').on(table.tenantId, table.tripId),
  index('idx_orders_tenant_payment_status').on(table.tenantId, table.paymentStatus),
  index('idx_orders_tenant_invoice_date').on(table.tenantId, table.invoiceDate),
])

// ============================================================================
// Phase 3 Enums
// ============================================================================

export const tripStatusEnum = pgEnum('trip_status', [
  'planned', 'in_progress', 'at_terminal', 'completed',
])

export const expenseCategoryEnum = pgEnum('expense_category', [
  'fuel', 'tolls', 'repairs', 'lodging', 'misc',
])

// ============================================================================
// Phase 3 Tables: Dispatch Workflow
// ============================================================================

/**
 * Trips Table
 * Groups orders into a single dispatch run with driver/truck assignment.
 */
export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tripNumber: text('trip_number'),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  truckId: uuid('truck_id').notNull().references(() => trucks.id),
  status: tripStatusEnum('status').notNull().default('planned'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  // Manually entered financials
  carrierPay: numeric('carrier_pay', { precision: 12, scale: 2 }).default('0'),
  // Denormalized financial summary (computed by app code)
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }).default('0'),
  totalBrokerFees: numeric('total_broker_fees', { precision: 12, scale: 2 }).default('0'),
  driverPay: numeric('driver_pay', { precision: 12, scale: 2 }).default('0'),
  totalExpenses: numeric('total_expenses', { precision: 12, scale: 2 }).default('0'),
  netProfit: numeric('net_profit', { precision: 12, scale: 2 }).default('0'),
  orderCount: integer('order_count').default(0),
  // Denormalized route summary (computed by app code from assigned orders)
  originSummary: text('origin_summary'),
  destinationSummary: text('destination_summary'),
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_trips_tenant_id').on(table.tenantId),
  index('idx_trips_tenant_status').on(table.tenantId, table.status),
  index('idx_trips_tenant_driver').on(table.tenantId, table.driverId),
  index('idx_trips_tenant_truck').on(table.tenantId, table.truckId),
  index('idx_trips_tenant_dates').on(table.tenantId, table.startDate, table.endDate),
])

/**
 * Trip Expenses Table
 * Individual expense line items for a trip.
 */
export const tripExpenses = pgTable('trip_expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: expenseCategoryEnum('category').notNull().default('misc'),
  customLabel: text('custom_label'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  expenseDate: date('expense_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_trip_expenses_tenant_id').on(table.tenantId),
  index('idx_trip_expenses_trip_id').on(table.tripId),
])

// ============================================================================
// Phase 4 Tables: Billing & Invoicing
// ============================================================================

/**
 * Payments Table
 * Individual payment records against orders.
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payments_tenant_id').on(table.tenantId),
  index('idx_payments_order_id').on(table.orderId),
])

// ============================================================================
// Phase 5 Tables: Onboarding + Stripe Polish
// ============================================================================

/**
 * Invites Table
 * Team member invitations with token-based acceptance.
 */
export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('dispatcher'),
  token: uuid('token').notNull().defaultRandom(),
  invitedBy: uuid('invited_by').notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('invites_token_unique').on(table.token),
  index('idx_invites_tenant_id').on(table.tenantId),
  index('idx_invites_token').on(table.token),
  index('idx_invites_email_tenant').on(table.tenantId, table.email),
])

// ============================================================================
// Type Exports
// ============================================================================

// Phase 1
export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type TenantMembership = typeof tenantMemberships.$inferSelect
export type NewTenantMembership = typeof tenantMemberships.$inferInsert
export type StripeEvent = typeof stripeEvents.$inferSelect
export type NewStripeEvent = typeof stripeEvents.$inferInsert

// Phase 2
export type Broker = typeof brokers.$inferSelect
export type NewBroker = typeof brokers.$inferInsert
export type Driver = typeof drivers.$inferSelect
export type NewDriver = typeof drivers.$inferInsert
export type Truck = typeof trucks.$inferSelect
export type NewTruck = typeof trucks.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

// Phase 3
export type DrizzleTrip = typeof trips.$inferSelect
export type NewTrip = typeof trips.$inferInsert
export type DrizzleTripExpense = typeof tripExpenses.$inferSelect
export type NewTripExpense = typeof tripExpenses.$inferInsert

// Phase 4
export type DrizzlePayment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

// Phase 5
export type Invite = typeof invites.$inferSelect
export type NewInvite = typeof invites.$inferInsert
