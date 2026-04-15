-- W3-4: trips.total_miles precision bump numeric(12,1) → numeric(14,1).
--
-- Audit AUD-3 L2 flagged that total_miles sums per-order distance_miles
-- across all orders in a trip, and a very large aggregate (999,999+
-- miles) would silently truncate at the 12-digit limit. Product use
-- today won't hit this, but defensively bump to numeric(14,1) so a
-- long-haul multi-week trip aggregate can't silently clip.
--
-- numeric(14,1) = up to 9,999,999,999,999.9 — 12 orders of magnitude
-- of headroom. Compute/storage cost is negligible.

BEGIN;

ALTER TABLE public.trips
  ALTER COLUMN total_miles TYPE numeric(14,1);

COMMIT;
