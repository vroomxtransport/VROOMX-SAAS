-- CFG-007: five tables added in the 20260406 batch used an RLS pattern
-- that reads tenant_id from `auth.users.raw_app_meta_data` via a
-- subquery, instead of the `public.get_tenant_id()` helper that every
-- other table uses. The two patterns produce the same answer in steady
-- state (raw_app_meta_data is what the JWT hook serializes into
-- app_metadata.tenant_id, so the same value is visible both ways), and
-- `auth.users.raw_app_meta_data` is NOT user-writable — this is not a
-- security bug, it's a consistency/auditability concern.
--
-- However the `raw_app_meta_data` subquery costs an extra join against
-- `auth.users` on every RLS check and makes the schema harder to audit
-- (reviewers have to remember two patterns). Standardizing on
-- `get_tenant_id()` is a pure cleanup.
--
-- Also: the original policies were `FOR ALL USING (...)` with no
-- explicit `WITH CHECK`. Postgres falls back to using the USING clause
-- for write checks in that case, so functionally they're equivalent to
-- having both USING and WITH CHECK set to the same expression. The
-- replacements below spell both out for clarity and to match the
-- pattern audit tooling expects (Wave 5a SCAN-001 flagged the missing
-- WITH CHECK and Wave 6a CFG-002 flagged 7 more — this migration
-- forecloses that class of finding for these 5 tables too).

-- 1. custom_reports
DROP POLICY IF EXISTS "custom_reports_tenant_isolation" ON public.custom_reports;
CREATE POLICY "custom_reports_tenant_isolation" ON public.custom_reports
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- 2. saved_views
DROP POLICY IF EXISTS "saved_views_tenant_isolation" ON public.saved_views;
CREATE POLICY "saved_views_tenant_isolation" ON public.saved_views
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- 3. scheduled_reports
DROP POLICY IF EXISTS "scheduled_reports_tenant_isolation" ON public.scheduled_reports;
CREATE POLICY "scheduled_reports_tenant_isolation" ON public.scheduled_reports
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- 4. alert_rules
DROP POLICY IF EXISTS "alert_rules_tenant_isolation" ON public.alert_rules;
CREATE POLICY "alert_rules_tenant_isolation" ON public.alert_rules
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- 5. alert_history
DROP POLICY IF EXISTS "alert_history_tenant_isolation" ON public.alert_history;
CREATE POLICY "alert_history_tenant_isolation" ON public.alert_history
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- Self-verify: none of the 5 policies should still reference
-- raw_app_meta_data in their qual/with_check expressions.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(c.relname || '.' || p.polname, ', ')
  INTO bad
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('custom_reports', 'saved_views', 'scheduled_reports', 'alert_rules', 'alert_history')
    AND (
      pg_get_expr(p.polqual, p.polrelid) LIKE '%raw_app_meta_data%'
      OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%raw_app_meta_data%'
    );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Policy still references raw_app_meta_data after migration: %', bad;
  END IF;
END $$;
