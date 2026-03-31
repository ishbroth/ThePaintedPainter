import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export interface SidebarItem {
  label: string;
  icon: string;
  path: string;
}

interface DashboardSidebarProps {
  items: SidebarItem[];
  title: string;
  onLogout: () => void;
}

export default function DashboardSidebar({ items, title, onLogout }: DashboardSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-[#f5a623] text-black font-semibold'
        : 'text-gray-300 hover:bg-[#222] hover:text-white'
    }`;

  const navContent = (
    <>
      <div className="px-4 py-6 border-b border-[#333]">
        <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path.endsWith('/dashboard')}
            className={linkClasses}
            onClick={() => setDrawerOpen(false)}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#333]">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors w-full"
        >
          <span className="text-lg leading-none">{'\u{1F6AA}'}</span>
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-[#222] border border-[#444] text-white p-2 rounded-lg"
        aria-label="Open menu"
      >
        <span className="text-xl leading-none">{'\u2630'}</span>
      </button>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-[#111] z-50 flex flex-col transform transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
          aria-label="Close menu"
        >
          {'\u2715'}
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-[#111] flex-col flex-shrink-0">
        {navContent}
      </aside>
    </>
  );
}
