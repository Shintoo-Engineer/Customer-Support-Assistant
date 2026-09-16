import React from 'react';
import {
  LayoutDashboard,
  Headphones,
  PlayCircle,
  BookOpen,
  Users2,
  ShieldAlert,
  X,
  BrainCircuit,
} from 'lucide-react';

import { UserRole } from '../types';

export type ActiveTab =
  | 'dashboard'
  | 'user_management'
  | 'policy_management'
  | 'ai_assistant'
  | 'live_console'
  | 'scenarios'
  | 'knowledge_base'
  | 'replay'
  | 'manual_mode'
  | 'simulator_setup'
  | 'reports'
  | 'team_analytics'
  | 'training_plans'
  | 'leaderboard'
  | 'admin_audit';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  userRole: UserRole;
  activeScenarioTitle?: string;
  hasActiveSession?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  hasActiveSession,
  isMobileOpen,
  onCloseMobile,
}) => {
  const mainNavItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['employee', 'admin'],
    },
    {
      id: 'simulator_setup' as ActiveTab,
      label: 'Simulator',
      icon: Headphones,
      roles: ['employee', 'admin'],
    },
    {
      id: 'manual_mode' as ActiveTab,
      label: 'Manual Mode',
      icon: BrainCircuit,
      roles: ['employee', 'admin'],
    },
    {
      id: 'replay' as ActiveTab,
      label: 'Replay Mode',
      icon: PlayCircle,
      roles: ['employee', 'admin'],
    },
    {
      id: 'live_console' as ActiveTab,
      label: 'Live Console',
      icon: Headphones,
      badge: hasActiveSession ? 'Active' : undefined,
      roles: ['employee', 'admin'],
    },
    {
      id: 'knowledge_base' as ActiveTab,
      label: 'Knowledge Base',
      icon: BookOpen,
      roles: ['employee', 'admin'],
    },
  ];

  const adminItems = [
    {
      id: 'user_management' as ActiveTab,
      label: 'User Management',
      icon: Users2,
      roles: ['admin'],
    },
    {
      id: 'admin_audit' as ActiveTab,
      label: 'Admin Audit',
      icon: ShieldAlert,
      roles: ['admin'],
    },
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    onSelectTab(tabId);

    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavItem = (
    item: {
      id: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      roles: string[];
      badge?: string;
    }
  ) => {
    if (!item.roles.includes(String(userRole).toLowerCase())) {
      return null;
    }

    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        id={`sidebar-tab-${item.id}`}
        type="button"
        onClick={() => handleNavClick(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[42px] ${
          isActive
            ? 'bg-indigo-600/90 text-white shadow-sm font-semibold'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Icon
            className={`w-4 h-4 ${
              isActive ? 'text-white' : 'text-slate-400'
            }`}
          />

          <span>{item.label}</span>
        </div>

        {item.badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 animate-pulse">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      <div className="p-3 space-y-5 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <BrainCircuit className="w-5 h-5" />
            </div>

            <div>
              <span className="font-bold text-sm text-white">
                Navigation Menu
              </span>

              <span className="text-[10px] text-slate-400 block capitalize">
                Role: {userRole}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Support Modes */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Support Modes
          </div>

          <nav className="space-y-1">
            {mainNavItems.map(renderNavItem)}
          </nav>
        </div>

        {/* Admin */}
        {String(userRole).toLowerCase() === 'admin' && (
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Administration
            </div>

            <nav className="space-y-1">
              {adminItems.map(renderNavItem)}
            </nav>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="p-3 m-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-200">
            Customer Support Assistant
          </span>

          <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
            Online
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          AI-powered customer simulation, conversation analysis, knowledge
          assistance and live response guidance.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 select-none min-h-[calc(100vh-4rem)]">
        {navContent}
      </aside>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          <div className="relative w-4/5 max-w-xs bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};