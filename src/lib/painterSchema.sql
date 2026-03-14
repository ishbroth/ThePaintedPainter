-- Painters / Service Providers table
CREATE TABLE painters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Company Info
  company_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  website TEXT,
  years_in_business INTEGER,
  crew_size INTEGER,

  -- Licensing
  has_license BOOLEAN DEFAULT FALSE,
  license_number TEXT,
  license_state TEXT,
  license_expiration DATE,
  is_bonded BOOLEAN DEFAULT FALSE,
  bonding_company TEXT,
  bond_amount TEXT,
  is_insured BOOLEAN DEFAULT FALSE,
  insurance_company TEXT,
  policy_number TEXT,
  coverage_amount TEXT,
  has_workers_comp BOOLEAN DEFAULT FALSE,
  workers_comp_carrier TEXT,
  certifications TEXT[] DEFAULT '{}',
  other_certification TEXT,

  -- Services
  service_types TEXT[] DEFAULT '{}',
  service_area_zips TEXT,
  max_project_size TEXT,
  projects_per_month INTEGER,
  offers_estimates BOOLEAN DEFAULT TRUE,
  offers_warranty BOOLEAN DEFAULT FALSE,
  warranty_length TEXT,

  -- Pricing Baseline
  price_1br_rental NUMERIC,
  price_3br_walls NUMERIC,
  price_kitchen_cabinets NUMERIC,
  price_exterior_1500 NUMERIC,
  price_exterior_3500 NUMERIC,

  -- Status
  status TEXT DEFAULT 'pending',
  verified BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE painters ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts
CREATE POLICY "Allow anonymous inserts on painters" ON painters
  FOR INSERT TO anon WITH CHECK (true);

-- Allow reading verified painters (for marketplace)
CREATE POLICY "Allow reading verified painters" ON painters
  FOR SELECT TO anon USING (verified = true AND status = 'approved');

-- Indexes
CREATE INDEX idx_painters_status ON painters(status);
CREATE INDEX idx_painters_zip ON painters(zip_code);
CREATE INDEX idx_painters_verified ON painters(verified);
CREATE INDEX idx_painters_service_area ON painters(service_area_zips);

-- ===== Quote Selections (customer choices from marketplace) =====

CREATE TABLE quote_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Customer info
  quote_zip TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  -- Selection
  selection_type TEXT NOT NULL, -- 'guaranteed' or 'specific_painter'
  guaranteed_price NUMERIC,
  selected_painter_id UUID REFERENCES painters(id),
  selected_painter_price NUMERIC,

  -- Project details (full job summary JSON)
  project_summary JSONB,

  -- For guaranteed: list of painter IDs who were notified
  notified_painters UUID[] DEFAULT '{}',

  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, accepted, completed, cancelled
  accepted_by UUID REFERENCES painters(id),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE quote_selections ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts
CREATE POLICY "Allow anonymous inserts on quote_selections" ON quote_selections
  FOR INSERT TO anon WITH CHECK (true);

-- Indexes
CREATE INDEX idx_selections_status ON quote_selections(status);
CREATE INDEX idx_selections_painter ON quote_selections(selected_painter_id);
CREATE INDEX idx_selections_created ON quote_selections(created_at DESC);
