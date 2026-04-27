import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Zap, Users, Settings, Activity,
  Rocket, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import StatusBar from './StatusBar';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/trades',    icon: TrendingUp,      label: 'Trades'     },
  { to: '/signals',   icon: Zap,             label: 'Signals'    },
  { to: '/users',     icon: Users,           label: 'Users'      },
  { to: '/system',    icon: Activity,        label: 'System'     },
  { to: '/settings',  icon: Settings,        label: 'Settings'   },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-60 flex flex-col bg-surface-card border-r border-surface-border',
          'transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Moonshot Bot</p>
            <p className="text-xs text-gray-500 mt-0.5">Trading Dashboard</p>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-500 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(isActive ? 'nav-link-active' : 'nav-link')
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-surface-border">
          <p className="text-xs text-gray-600">v2.0.0 · Paper Mode</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-card flex-shrink-0">
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-white capitalize">
            {location.pathname.replace('/', '') || 'Dashboard'}
          </h1>
          <div className="ml-auto">
            <StatusBar />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
