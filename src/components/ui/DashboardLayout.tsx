import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import DashboardSidebar from './DashboardSidebar.tsx';
import ApplicationStatus from '../painter/ApplicationStatus.tsx';
import type { SidebarItem } from './DashboardSidebar.tsx';

interface DashboardLayoutProps {
  items: SidebarItem[];
  title: string;
}

export default function DashboardLayout({ items, title }: DashboardLayoutProps) {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar items={items} title={title} onLogout={handleLogout} />
      <main className="flex-1 min-w-0 p-4 lg:p-8">
        {profile?.role === 'painter' && <ApplicationStatus />}
        <Outlet />
      </main>
    </div>
  );
}
