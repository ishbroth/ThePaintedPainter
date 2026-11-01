import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** The customer's side of the site (the price estimator and what comes after it): someone signed in as a painter goes to their dashboard instead. */
export default function NotForPainters({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role === 'painter') return <Navigate to="/painter/dashboard" replace />;
  return <>{children}</>;
}
