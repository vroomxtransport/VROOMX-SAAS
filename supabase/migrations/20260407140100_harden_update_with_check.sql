-- CFG-002 (follow-up to Wave 5a SCAN-001): 7 more UPDATE policies are
-- missing their WITH CHECK clause. Same bug class as payments_update
-- that was fixed in 20260407130000_harden_payments_update.sql — the
-- USING clause gates the OLD row (the caller's) but without WITH CHECK
-- the NEW row can be rewritten to any tenant_id, enabling cross-tenant
-- row theft/plant of OAuth tokens, entity mappings, and safety events.
--
-- Affected tables (verified by direct read):
--   samsara_integrations       00029_samsara_integration.sql:29-30
--   samsara_vehicles           00029_samsara_integration.sql:62-63
--   samsara_drivers            00029_samsara_integration.sql:95-96
--   quickbooks_integrations    00030_quickbooks_integration.sql:42-45
--   quickbooks_entity_map      00030_quickbooks_integration.sql:86-89
--   safety_events              0006_safety_compliance.sql:47
--   compliance_requirements    0006_safety_compliance.sql:77

-- 1. samsara_integrations
DROP POLICY IF EXISTS "samsara_integrations_update" ON public.samsara_integrations;
CREATE POLICY "samsara_integrations_update" ON public.samsara_integrations
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 2. samsara_vehicles
DROP POLICY IF EXISTS "samsara_vehicles_update" ON public.samsara_vehicles;
CREATE POLICY "samsara_vehicles_update" ON public.samsara_vehicles
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 3. samsara_drivers
DROP POLICY IF EXISTS "samsara_drivers_update" ON public.samsara_drivers;
CREATE POLICY "samsara_drivers_update" ON public.samsara_drivers
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 4. quickbooks_integrations  (existing name uses _tenant_update suffix)
DROP POLICY IF EXISTS "quickbooks_integrations_tenant_update" ON public.quickbooks_integrations;
CREATE POLICY "quickbooks_integrations_tenant_update" ON public.quickbooks_integrations
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 5. quickbooks_entity_map  (existing name uses _tenant_update suffix)
DROP POLICY IF EXISTS "quickbooks_entity_map_tenant_update" ON public.quickbooks_entity_map;
CREATE POLICY "quickbooks_entity_map_tenant_update" ON public.quickbooks_entity_map
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 6. safety_events
DROP POLICY IF EXISTS "safety_events_update" ON public.safety_events;
CREATE POLICY "safety_events_update" ON public.safety_events
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- 7. compliance_requirements
DROP POLICY IF EXISTS "compliance_requirements_update" ON public.compliance_requirements;
CREATE POLICY "compliance_requirements_update" ON public.compliance_requirements
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- Self-verify: abort if any UPDATE policy on these tables still has a NULL
-- polwithcheck. Catches typos and dropped-but-not-recreated policies.
DO $$
DECLARE
  offender text;
BEGIN
  SELECT string_agg(polname, ', ')
  INTO offender
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'samsara_integrations', 'samsara_vehicles', 'samsara_drivers',
      'quickbooks_integrations', 'quickbooks_entity_map',
      'safety_events', 'compliance_requirements'
    )
    AND p.polcmd = 'w' -- UPDATE
    AND p.polwithcheck IS NULL;

  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'UPDATE policy missing WITH CHECK after migration: %', offender;
  END IF;
END $$;
