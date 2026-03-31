-- =============================================
-- Marketplace tables: profiles, portfolio, deals,
-- reviews, notifications, customer_projects
-- =============================================

-- ===== Profiles =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('painter', 'customer', 'admin')) DEFAULT 'customer',
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow inserts during sign-up (user inserts their own row)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Public read for painter profiles (marketplace listing)
CREATE POLICY "Public can read painter profiles" ON profiles
  FOR SELECT TO anon USING (role = 'painter');

-- ===== Link painters table to auth users =====
ALTER TABLE painters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_painters_user_id ON painters(user_id);

-- ===== Portfolio Images =====
CREATE TABLE portfolio_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;

-- Painters can manage their own portfolio images
CREATE POLICY "Painters can manage own portfolio" ON portfolio_images
  FOR ALL USING (auth.uid() = painter_id)
  WITH CHECK (auth.uid() = painter_id);

-- Public can view portfolio images
CREATE POLICY "Public can view portfolio images" ON portfolio_images
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_portfolio_painter ON portfolio_images(painter_id);
CREATE INDEX idx_portfolio_sort ON portfolio_images(painter_id, sort_order);

-- ===== Deals =====
CREATE TABLE deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Painters can manage their own deals
CREATE POLICY "Painters can manage own deals" ON deals
  FOR ALL USING (auth.uid() = painter_id)
  WITH CHECK (auth.uid() = painter_id);

-- Public can view active deals
CREATE POLICY "Public can view active deals" ON deals
  FOR SELECT TO anon USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

CREATE INDEX idx_deals_painter ON deals(painter_id);
CREATE INDEX idx_deals_active ON deals(is_active, valid_until);

-- ===== Reviews =====
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  customer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Customers can create reviews
CREATE POLICY "Customers can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own reviews
CREATE POLICY "Customers can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Everyone can read reviews
CREATE POLICY "Anyone can read reviews" ON reviews
  FOR SELECT USING (true);

CREATE INDEX idx_reviews_painter ON reviews(painter_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);

-- ===== Notifications =====
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ===== Customer Projects =====
CREATE TABLE customer_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quote_selections(id) ON DELETE SET NULL,
  painter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount NUMERIC,
  total_amount NUMERIC,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE customer_projects ENABLE ROW LEVEL SECURITY;

-- Customers can read their own projects
CREATE POLICY "Customers can read own projects" ON customer_projects
  FOR SELECT USING (auth.uid() = customer_id);

-- Painters can read projects assigned to them
CREATE POLICY "Painters can read assigned projects" ON customer_projects
  FOR SELECT USING (auth.uid() = painter_id);

-- Customers can create projects
CREATE POLICY "Customers can create projects" ON customer_projects
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Both customer and painter can update their projects
CREATE POLICY "Project participants can update" ON customer_projects
  FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = painter_id)
  WITH CHECK (auth.uid() = customer_id OR auth.uid() = painter_id);

CREATE INDEX idx_projects_customer ON customer_projects(customer_id);
CREATE INDEX idx_projects_painter ON customer_projects(painter_id);
CREATE INDEX idx_projects_status ON customer_projects(status);

-- ===== Link reviews.project_id FK now that customer_projects exists =====
ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_project
  FOREIGN KEY (project_id) REFERENCES customer_projects(id) ON DELETE SET NULL;

-- ===== Auto-create profile on auth.users insert (trigger) =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ===== Auto-update updated_at on profiles =====
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
