-- Add optional email addresses for pickup and delivery contacts.
-- Used by the Send Payment Receipt feature for non-BILL orders so
-- dispatchers can prefill the recipient email from order data.
-- Nullable (legacy orders lack the data); no RLS change required —
-- columns inherit the existing orders RLS policies.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_contact_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_contact_email text;
