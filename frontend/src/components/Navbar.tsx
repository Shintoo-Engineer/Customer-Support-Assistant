import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Trophy,
  ShieldCheck,
  Globe,
  Bell,
  Sliders,
  UserCheck,
  BrainCircuit,
  MessageSquareText,
  RotateCcw,
  Zap,
  Menu,
  X
} from 'lucide-react';
import {
  InteractionMode,
  UserRole,
  CoachingLevel,
  AgentProfile
} from '../types';

import { UserAccount } from '../types';

interface NavbarProps {
  currentMode: InteractionMode;
  onSelectMode: (mode: InteractionMode) => void;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  coachingLevel: CoachingLevel;
  onChangeCoachingLevel: (level: CoachingLevel) => void;
  userProfile: AgentProfile;
  piiMaskingEnabled: boolean;
  onTogglePiiMasking: () => void;
  activeLanguage: string;
  onChangeLanguage: (lang: string) => void;
  onOpenQuickManual: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  userRole,
  onChangeRole,
  coachingLevel,
  onChangeCoachingLevel,
  userProfile,
  piiMaskingEnabled,
  onTogglePiiMasking,
  activeLanguage,
  onChangeLanguage,
  onOpenQuickManual,
  isMobileMenuOpen,
  onToggleMobileMenu,
  currentUser,
  onLogout
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const languages = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Tamil', 'Japanese'];

  const notifications = [
    { id: '1', title: 'New Scenario Available', desc: 'Expert Dispute: Corporate Account Lockout', time: '10m ago' },
    { id: '2', title: 'Streak Milestone!', desc: '6-day training streak achieved (+150 XP)', time: '2h ago' },
    { id: '3', title: 'KB Document Updated', desc: 'KB-101 Refund & Credit Policy Guidelines updated', time: '1d ago' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Mobile Menu Toggle + Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Hamburger Toggle Button */}
          <button
            id="btn-mobile-menu-toggle"
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 shrink-0">
            <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold tracking-tight text-base sm:text-lg text-white">Customer Support <span className="text-indigo-400">Assistant</span></span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-400 animate-pulse" />
                Live Coach
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden md:block">AI Support Simulation & Real-Time Coaching</p>
          </div>
        </div>

        {/* Center: Mode Switcher (Visible on md+ screens) */}
        <div className="hidden md:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/70 text-xs font-medium">
          <button
            id="nav-mode-simulator"
            onClick={() => onSelectMode('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentMode === 'simulator'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Simulator
          </button>

          <button
            id="nav-mode-manual"
            onClick={onOpenQuickManual}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentMode === 'manual'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            Manual Mode
          </button>

          <button
            id="nav-mode-replay"
            onClick={() => onSelectMode('replay')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              currentMode === 'replay'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay
          </button>
        </div>

        {/* Right Controls: Role, Coaching Level, PII, Gamification & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          
          {/* Coaching Intensity Selector (lg+ screens) */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Coaching:</span>
            <select
              id="coaching-level-select"
              value={coachingLevel}
              onChange={(e) => onChangeCoachingLevel(e.target.value as CoachingLevel)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs capitalize"
            >
              <option value="beginner" className="bg-slate-800 text-white">Beginner (Full Guidance)</option>
              <option value="intermediate" className="bg-slate-800 text-white">Intermediate (Hints)</option>
              <option value="advanced" className="bg-slate-800 text-white">Advanced (Warnings Only)</option>
              <option value="assessment" className="bg-slate-800 text-amber-300">Assessment (Blind Test)</option>
            </select>
          </div>

          {/* User Role Badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white capitalize">{currentUser ? currentUser.role : userRole}</span>
          </div>

          {/* User Avatar & Logout */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-indigo-500/40">
                {currentUser ? currentUser.name.charAt(0) : 'U'}
              </div>
              <div className="hidden xl:block text-left text-xs">
                <div className="font-semibold text-slate-100">{currentUser ? currentUser.name : 'User'}</div>
                <div className="text-[10px] text-slate-400 font-mono">{currentUser ? currentUser.email : ''}</div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-medium transition"
                title="Log Out of System"
              >
                Logout
              </button>
            )}
          </div>

          {/* PII Masking Toggle */}
          <button
            id="toggle-pii-masking"
            onClick={onTogglePiiMasking}
            title={piiMaskingEnabled ? 'PII Auto-Masking Active' : 'PII Masking Disabled'}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              piiMaskingEnabled
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>PII Safe</span>
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              id="language-menu-btn"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition min-w-[38px] min-h-[38px] flex items-center justify-center"
              title="Change Language"
            >
              <Globe className="w-4 h-4" />
            </button>
            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Language</div>
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      onChangeLanguage(lang);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-700/60 ${
                      activeLanguage === lang ? 'text-indigo-400 font-semibold bg-slate-700/40' : 'text-slate-200'
                    }`}
                  >
                    {lang}
                    {activeLanguage === lang && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Streak Badge (hidden on extra small screens) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
            <span>{userProfile.streakDays}d</span>
          </div>

          {/* Level & XP */}
          <div className="hidden lg:flex items-center gap-2 pl-1">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Lvl {userProfile.level}</span>
                <span className="text-indigo-300 font-bold">{userProfile.xp} XP</span>
              </div>
              <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-sky-400 h-full rounded-full"
                  style={{ width: `${(userProfile.xp / userProfile.xpToNextLevel) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Notifications Drawer */}
          <div className="relative">
            <button
              id="notifications-toggle"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 relative transition min-w-[38px] min-h-[38px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute 1.5 top-1.5 sm:-top-1 sm:-right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full ring-2 ring-slate-900" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <span className="font-semibold text-xs text-white">Notifications</span>
                  <span className="text-[11px] text-indigo-400 cursor-pointer hover:underline">Mark all read</span>
                </div>
                <div className="divide-y divide-slate-700/60 mt-1">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-200">{n.title}</p>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/40"
            />
          </div>

        </div>

      </div>
    </header>
  );
};

