-- Financial Model Enhancements: local fee, per-order driver % override, per-mile fix
-- Adds local_fee and driver_pay_rate_override to orders, total_local_fees to trips

ALTER TABLE orders ADD COLUMN local_fee numeric(12,2) DEFAULT '0';
ALTER TABLE orders ADD COLUMN driver_pay_rate_override numeric(5,2);

ALTER TABLE trips ADD COLUMN total_local_fees numeric(12,2) DEFAULT '0';
