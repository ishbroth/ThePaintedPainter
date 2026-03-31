import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import DashboardSidebar from './DashboardSidebar.tsx';
import type { SidebarItem } from './DashboardSidebar.tsx';

interface DashboardLayoutProps {
  items: SidebarItem[];
  title: string;
}

export default function DashboardLayout({ items, title }: DashboardLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-[#1a1a1a]">
      <DashboardSidebar items={items} title={title} onLogout={handleLogout} />
      <main className="flex-1 min-w-0 p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
