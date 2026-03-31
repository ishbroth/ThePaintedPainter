export interface Profile {
  id: string;
  role: 'painter' | 'customer' | 'admin';
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioImage {
  id: string;
  painter_id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
  created_at: string;
}

export interface Deal {
  id: string;
  painter_id: string;
  title: string;
  description: string | null;
  price: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  painter_id: string;
  customer_id: string;
  project_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  customer_name: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CustomerProject {
  id: string;
  customer_id: string;
  quote_id: string | null;
  painter_id: string | null;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  deposit_paid: boolean;
  deposit_amount: number | null;
  total_amount: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
