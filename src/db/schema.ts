import { pgTable, uuid, text, timestamp, unique, index, numeric, integer, date, pgEnum } from 'drizzle-orm/pg-core'

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
  'percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile',
])

export const paymentTermsEnum = pgEnum('payment_terms', ['NET15', 'NET30', 'NET45', 'NET60'])

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
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_orders_tenant_id').on(table.tenantId),
  index('idx_orders_tenant_status').on(table.tenantId, table.status),
  index('idx_orders_tenant_broker').on(table.tenantId, table.brokerId),
  index('idx_orders_tenant_driver').on(table.tenantId, table.driverId),
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
