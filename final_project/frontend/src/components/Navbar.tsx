import React from 'react';
import type { AuthUser } from '../types';

export type ActiveTab =
  | 'home'
  | 'new-simulation'
  | 'support-console'
  | 'conversations'
  | 'admin-panel'
  | 'integration-test';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeSessionId: number | null;
  backendOnline: boolean;
  currentUser: AuthUser | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  activeSessionId,
  backendOnline,
  currentUser,
  onLogout,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'new-simulation', label: 'New Simulation' },
    { id: 'support-console', label: 'Support Console' },
    { id: 'conversations', label: 'Conversations' },
  ];

  // Only admins can see Admin Panel in navigation
  if (currentUser?.role === 'admin') {
    navItems.push({ id: 'admin-panel', label: 'Admin Panel' });
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* App Title - Never wraps */}
        <div
          className="font-bold text-slate-900 text-sm sm:text-base whitespace-nowrap shrink-0 cursor-pointer hover:text-slate-700 transition"
          onClick={() => onSelectTab(currentUser?.role === 'admin' ? 'admin-panel' : 'home')}
        >
          Customer Support Assistant
        </div>

        {/* Primary Navigation - Uniform button heights & alignment */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`h-8 px-3 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'support-console' && activeSessionId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Status, Logout & Backend Indicator - Uniform height & alignment */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentUser && (
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden md:inline text-slate-700 font-medium truncate max-w-[120px]">
                {currentUser.name}
              </span>
              <span
                className={`text-2xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {currentUser.role}
              </span>
              <button
                onClick={onLogout}
                className="h-7 px-2.5 inline-flex items-center justify-center text-xs font-medium text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 rounded transition cursor-pointer"
                title="Sign out of your account"
              >
                Logout
              </button>
            </div>
          )}

          {/* Backend Connection Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 border-l border-slate-200 pl-2.5 py-1">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="hidden lg:inline text-2xs">{backendOnline ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
