-- The Painted Painter Database Schema
-- Run this in Supabase SQL Editor

-- Quotes table (expanded for AI Estimator Panel)
CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Location
  zip_code TEXT,
  state TEXT,

  -- Property
  year_built INTEGER,
  property_type TEXT NOT NULL,
  project_type TEXT NOT NULL,
  square_feet INTEGER,
  stories INTEGER,

  -- Detailed scope (JSONB for flexibility)
  interior_data JSONB,
  exterior_data JSONB,
  prep_data JSONB,

  -- Contact
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,

  -- Estimate
  estimated_price NUMERIC NOT NULL,
  estimate_low NUMERIC,
  estimate_high NUMERIC,
  confidence TEXT,

  -- Intelligence
  specialty_referrals JSONB DEFAULT '[]'::jsonb,
  response_style TEXT,

  -- Status
  status TEXT DEFAULT 'new'
);

-- Contacts table
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new'
);

-- Enable Row Level Security
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create policies to allow anonymous inserts (for form submissions)
CREATE POLICY "Allow anonymous inserts on quotes" ON quotes
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on contacts" ON contacts
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_zip ON quotes(zip_code);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX idx_contacts_status ON contacts(status);
