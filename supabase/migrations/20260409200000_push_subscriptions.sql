-- Push notification subscriptions for web push (PWA)
-- Each row stores a single browser/device subscription for a user.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(tenant_id, user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id')::uuid)
  );

-- Users can insert their own subscriptions
CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id')::uuid)
  );

-- Users can update their own subscriptions
CREATE POLICY push_subscriptions_update ON push_subscriptions
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id')::uuid)
  ) WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id')::uuid)
  );

-- Users can delete their own subscriptions
CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT ((SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id')::uuid)
  );
