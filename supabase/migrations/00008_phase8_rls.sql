-- ============================================================================
-- VroomX SaaS TMS - Phase 8 RLS Policies
-- Migration: 00008
-- Purpose: Enable Row Level Security on all Phase 8 tables that were
--          created via drizzle-kit push without RLS policies.
-- Tables: tasks, chat_channels, chat_messages, local_drives, fuel_entries,
--         maintenance_records, compliance_documents, driver_locations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS Policies: Tasks
-- ----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 2. RLS Policies: Chat Channels
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_channels_select" ON public.chat_channels
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_channels_insert" ON public.chat_channels
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_channels_update" ON public.chat_channels
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_channels_delete" ON public.chat_channels
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 3. RLS Policies: Chat Messages
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_messages_update" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "chat_messages_delete" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 4. RLS Policies: Local Drives
-- ----------------------------------------------------------------------------
ALTER TABLE public.local_drives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_drives_select" ON public.local_drives
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "local_drives_insert" ON public.local_drives
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "local_drives_update" ON public.local_drives
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "local_drives_delete" ON public.local_drives
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 5. RLS Policies: Fuel Entries
-- ----------------------------------------------------------------------------
ALTER TABLE public.fuel_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_entries_select" ON public.fuel_entries
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "fuel_entries_insert" ON public.fuel_entries
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "fuel_entries_update" ON public.fuel_entries
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "fuel_entries_delete" ON public.fuel_entries
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 6. RLS Policies: Maintenance Records
-- ----------------------------------------------------------------------------
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_records_select" ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "maintenance_records_insert" ON public.maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "maintenance_records_update" ON public.maintenance_records
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "maintenance_records_delete" ON public.maintenance_records
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Compliance Documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_documents_select" ON public.compliance_documents
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "compliance_documents_insert" ON public.compliance_documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "compliance_documents_update" ON public.compliance_documents
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "compliance_documents_delete" ON public.compliance_documents
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 8. RLS Policies: Driver Locations
-- ----------------------------------------------------------------------------
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_locations_select" ON public.driver_locations
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_locations_insert" ON public.driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_locations_update" ON public.driver_locations
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_locations_delete" ON public.driver_locations
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));
