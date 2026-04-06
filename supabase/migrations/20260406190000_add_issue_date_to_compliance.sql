ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS issue_date DATE;
