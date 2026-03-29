-- ============================================================================
-- Samsara ELD/Telematics Integration Tables
-- Wave 1: Core schema for OAuth tokens, vehicle/driver mappings, webhooks, ELD logs
-- ============================================================================

-- 1. Samsara Integrations (one per tenant — OAuth tokens + sync config)
CREATE TABLE IF NOT EXISTS samsara_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  samsara_org_id text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  webhook_secret text,
  sync_status text NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_samsara_integrations_tenant UNIQUE (tenant_id)
);

ALTER TABLE samsara_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samsara_integrations_select" ON samsara_integrations
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_integrations_insert" ON samsara_integrations
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "samsara_integrations_update" ON samsara_integrations
  FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_integrations_delete" ON samsara_integrations
  FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_samsara_integrations_tenant
  ON samsara_integrations(tenant_id);

-- 2. Samsara Vehicle Mappings (links Samsara vehicles to VroomX trucks)
CREATE TABLE IF NOT EXISTS samsara_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  samsara_vehicle_id text NOT NULL,
  truck_id uuid REFERENCES trucks(id) ON DELETE SET NULL,
  samsara_name text,
  samsara_vin text,
  last_latitude double precision,
  last_longitude double precision,
  last_speed double precision,
  last_heading double precision,
  last_location_time timestamptz,
  last_odometer_meters double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_samsara_vehicles_tenant_samsara UNIQUE (tenant_id, samsara_vehicle_id)
);

ALTER TABLE samsara_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samsara_vehicles_select" ON samsara_vehicles
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_vehicles_insert" ON samsara_vehicles
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "samsara_vehicles_update" ON samsara_vehicles
  FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_vehicles_delete" ON samsara_vehicles
  FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_samsara_vehicles_tenant
  ON samsara_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_samsara_vehicles_truck
  ON samsara_vehicles(tenant_id, truck_id);

-- 3. Samsara Driver Mappings (links Samsara drivers to VroomX drivers)
CREATE TABLE IF NOT EXISTS samsara_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  samsara_driver_id text NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  samsara_name text,
  samsara_email text,
  samsara_phone text,
  samsara_license_number text,
  samsara_license_state text,
  samsara_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_samsara_drivers_tenant_samsara UNIQUE (tenant_id, samsara_driver_id)
);

ALTER TABLE samsara_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samsara_drivers_select" ON samsara_drivers
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_drivers_insert" ON samsara_drivers
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "samsara_drivers_update" ON samsara_drivers
  FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_drivers_delete" ON samsara_drivers
  FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_samsara_drivers_tenant
  ON samsara_drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_samsara_drivers_driver
  ON samsara_drivers(tenant_id, driver_id);

-- 4. Samsara Webhook Events (idempotency + audit trail)
CREATE TABLE IF NOT EXISTS samsara_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_samsara_webhook_events_event UNIQUE (event_id)
);

ALTER TABLE samsara_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samsara_webhook_events_select" ON samsara_webhook_events
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "samsara_webhook_events_insert" ON samsara_webhook_events
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

-- Webhook events are append-only — no UPDATE or DELETE policies

CREATE INDEX IF NOT EXISTS idx_samsara_webhook_events_tenant
  ON samsara_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_samsara_webhook_events_type
  ON samsara_webhook_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_samsara_webhook_events_event_id
  ON samsara_webhook_events(event_id);

-- 5. ELD Logs (HOS duty status snapshots from Samsara)
CREATE TABLE IF NOT EXISTS eld_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  samsara_driver_id text NOT NULL,
  duty_status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_ms integer,
  vehicle_id text,
  vehicle_name text,
  driving_time_remaining_ms integer,
  shift_time_remaining_ms integer,
  cycle_time_remaining_ms integer,
  time_until_break_ms integer,
  location_latitude double precision,
  location_longitude double precision,
  location_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eld_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eld_logs_select" ON eld_logs
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "eld_logs_insert" ON eld_logs
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

-- ELD logs are append-only — no UPDATE or DELETE policies

CREATE INDEX IF NOT EXISTS idx_eld_logs_tenant
  ON eld_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_driver
  ON eld_logs(tenant_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_samsara_driver
  ON eld_logs(tenant_id, samsara_driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_started
  ON eld_logs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_eld_logs_duty_status
  ON eld_logs(tenant_id, duty_status, started_at DESC);
