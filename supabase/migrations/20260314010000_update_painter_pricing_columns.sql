-- Update pricing baseline columns to match new scenarios
ALTER TABLE painters DROP COLUMN IF EXISTS price_1br_rental;
ALTER TABLE painters DROP COLUMN IF EXISTS price_kitchen_cabinets;
ALTER TABLE painters DROP COLUMN IF EXISTS price_exterior_1500;
ALTER TABLE painters DROP COLUMN IF EXISTS price_exterior_3500;

ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_1br_full NUMERIC;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_3br_trim_doors NUMERIC;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_3br_ceilings NUMERIC;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_5br_full NUMERIC;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_5br_cabinets NUMERIC;
