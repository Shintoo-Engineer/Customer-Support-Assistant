import React from 'react';
import {
  LayoutDashboard,
  Bot,
  PlayCircle,
  BookOpen,
  Sparkles,
  BarChart3,
  Trophy,
  History,
  GraduationCap,
  ShieldAlert,
  Users2,
  FileSearch,
  X,
  BrainCircuit,
  UserCheck
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
  onCloseMobile
}) => {
  const mainNavItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Role Dashboard',
      icon: LayoutDashboard,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'user_management' as ActiveTab,
      label: 'User Directory & Roles',
      icon: Users2,
      roles: ['admin']
    },
    {
      id: 'policy_management' as ActiveTab,
      label: 'Policy Uploads (RAG)',
      icon: BookOpen,
      roles: ['admin']
    },
    {
      id: 'ai_assistant' as ActiveTab,
      label: 'Policy AI Assistant',
      icon: Bot,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'live_console' as ActiveTab,
      label: 'Live Practice Console',
      icon: Bot,
      badge: hasActiveSession ? 'Active' : undefined,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'scenarios' as ActiveTab,
      label: 'Scenarios & Generator',
      icon: Sparkles,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'replay' as ActiveTab,
      label: 'Replay Training Mode',
      icon: PlayCircle,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Reports & History',
      icon: History,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'training_plans' as ActiveTab,
      label: 'Personalized Coaching',
      icon: GraduationCap,
      roles: ['employee', 'trainer', 'admin']
    },
    {
      id: 'team_analytics' as ActiveTab,
      label: 'Team Analytics',
      icon: BarChart3,
      roles: ['trainer', 'admin']
    },
    {
      id: 'admin_audit' as ActiveTab,
      label: 'Admin Audit Logs',
      icon: ShieldAlert,
      roles: ['admin']
    }
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      {/* Navigation List */}
      <div className="p-3 space-y-5 overflow-y-auto">
        
        {/* Mobile Header with close button (shown only in mobile drawer) */}
        <div className="lg:hidden flex items-center justify-between px-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Navigation Menu</span>
              <span className="text-[10px] text-slate-400 block capitalize">Role: {userRole}</span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Practice & Live Coaching
          </div>
          <nav className="space-y-1">
            {mainNavItems
              .filter(item => item.roles.includes(userRole))
              .slice(0, 6)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-tab-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[42px] ${
                      isActive
                        ? 'bg-indigo-600/90 text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Analytics & Performance Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Analytics & Improvement
          </div>
          <nav className="space-y-1">
            {mainNavItems
              .filter(item => item.roles.includes(userRole))
              .slice(6)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-tab-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[42px] ${
                      isActive
                        ? 'bg-indigo-600/90 text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

      </div>

      {/* Bottom Status Card */}
      <div className="p-3 m-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-200">AI Support Coach</span>
          <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
            Online
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Gemini multi-agent pipeline monitoring live turns, RAG knowledge, & risk.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (lg+ screens) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 select-none min-h-[calc(100vh-4rem)]">
        {navContent}
      </aside>

      {/* Mobile Drawer (Visible on < lg screens when toggled) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Slide-out Drawer */}
          <div className="relative w-4/5 max-w-xs bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-slideRight">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};

