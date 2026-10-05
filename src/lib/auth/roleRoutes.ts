import type { UserProfile } from './AuthContext.tsx';

/** Where an account lands after signing in, based on the role it was created with. */
export function dashboardPathForRole(role: UserProfile['role']): string {
  switch (role) {
    case 'painter':
      return '/painter/dashboard';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/';
  }
}
