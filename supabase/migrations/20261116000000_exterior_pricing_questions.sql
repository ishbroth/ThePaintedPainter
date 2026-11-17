-- Two more painter pricing answers, for outside work: what they would charge for the entire exterior of a 1,500 sq ft house,
-- and for 25 French-pane double-hung windows (both sides). Optional (nullable); painters who haven't answered are priced as before.
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_1500_exterior NUMERIC;
ALTER TABLE painters ADD COLUMN IF NOT EXISTS price_25_french_windows NUMERIC;
