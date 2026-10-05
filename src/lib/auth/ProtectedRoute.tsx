import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext.tsx';
import { dashboardPathForRole } from './roleRoutes.ts';

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
    // Not authenticated — one sign-in page for everyone; their account's role decides where they land.
    return <Navigate to="/auth/sign-in" replace />;
  }

  // Signed in but the profile row hasn't arrived yet (it loads just after the session).
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Right account, wrong area: send them to their own dashboard rather than refusing.
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={dashboardPathForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}
