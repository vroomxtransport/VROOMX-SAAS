-- ============================================================================
-- Migration: File/document scalability indexes
--
-- Adds indexes for columns that are commonly filtered but currently cause
-- full table scans. Without these, expiration alerts, compliance overview,
-- and folder grouping queries timeout at 100k+ rows.
--
-- All indexes are partial or composite with tenant_id as the leading column
-- so they align with RLS policy evaluation and benefit from tenant-scoped
-- query plans.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Expiration date indexes (partial — only rows with non-null expires_at)
--    Used by: fetchExpirationAlerts(), compliance dashboard, DQF checklist
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_compliance_docs_expires
  ON compliance_documents(tenant_id, expires_at ASC)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_docs_expires
  ON driver_documents(tenant_id, expires_at ASC)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_truck_docs_expires
  ON truck_documents(tenant_id, expires_at ASC)
  WHERE expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Status index for compliance overview (count-by-status queries)
--    Used by: fetchComplianceOverview() — counts valid/expiring/expired
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_compliance_docs_status
  ON compliance_documents(tenant_id, status);

-- ---------------------------------------------------------------------------
-- 3. Composite index for compliance folder grouping
--    Used by: fetchComplianceFolders(), fetchComplianceChecklist()
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_compliance_docs_type_entity_sub
  ON compliance_documents(tenant_id, document_type, entity_type, sub_category);

-- ---------------------------------------------------------------------------
-- 4. Order attachments listing (newest-first per order)
--    Used by: order detail page attachment list
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_order_attachments_order_created
  ON order_attachments(tenant_id, order_id, created_at DESC);

COMMIT;
