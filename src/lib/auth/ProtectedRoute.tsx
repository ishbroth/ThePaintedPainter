import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext.tsx';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'painter' | 'customer' | 'admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    // Not authenticated — redirect to the appropriate sign-in page
    const signInPath = requiredRole === 'painter'
      ? '/auth/painter-sign-in'
      : '/auth/customer-sign-in';
    return <Navigate to={signInPath} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">
            You do not have permission to view this page.
            This area is restricted to <span className="font-semibold text-amber-400">{requiredRole}</span> accounts.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
