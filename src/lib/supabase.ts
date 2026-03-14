import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://myyfsducpmynmfqeqlox.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eWZzZHVjcG15bm1mcWVxbG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTIyMTksImV4cCI6MjA4MDk2ODIxOX0.CuCEa871CqT6ZK0DF5Y1jhuUwCHIfid1_sKPzG-8V-s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types are in src/lib/types.ts (ExpandedQuoteSubmission)

export interface ContactSubmission {
  id?: string;
  created_at?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status?: string;
}
