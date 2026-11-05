import { Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import ApplicationStatus from '../painter/ApplicationStatus.tsx';

/** The signed-in pages (painter and customer): just the page, full width. The header's three links are the only navigation; there is no sidebar or menu. */
export default function DashboardLayout() {
  const { profile } = useAuth();

  return (
    <main className="min-w-0 w-full max-w-5xl mx-auto px-3 py-4 sm:px-5 lg:px-8">
      {profile?.role === 'painter' && <ApplicationStatus />}
      <Outlet />
    </main>
  );
}
