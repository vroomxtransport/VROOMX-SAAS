-- Add full_name and email to tenant_memberships for dispatcher display
ALTER TABLE tenant_memberships ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE tenant_memberships ADD COLUMN IF NOT EXISTS email TEXT;
