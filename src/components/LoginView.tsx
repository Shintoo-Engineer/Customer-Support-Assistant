import React, { useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  UserCheck,
  BrainCircuit,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { UserRole, UserAccount } from '../types';
import { loginApi } from '../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void;
  initialRoleHint?: UserRole;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, initialRoleHint = 'employee' }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRoleHint);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick seed credential pre-fills
  const handleQuickSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    if (role === 'admin') {
      setEmail('admin@example.com');
      setPassword('Admin123!');
    } else if (role === 'trainer') {
      setEmail('trainer@example.com');
      setPassword('Trainer123!');
    } else {
      setEmail('employee@example.com');
      setPassword('Employee123!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await loginApi(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-1 ring-white/20 mb-4">
          <BrainCircuit className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Customer Support <span className="text-indigo-400">Assistant</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Role-Based Access & Policy Knowledge System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl">

          {/* Role Selection Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Select Access Role Entry Point
            </label>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleQuickSelectRole('admin')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-medium ${
                  selectedRole === 'admin'
                    ? 'bg-rose-600/20 border border-rose-500/50 text-rose-300 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <ShieldCheck className="w-5 h-5 mb-1" />
                <span>Admin Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickSelectRole('trainer')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-medium ${
                  selectedRole === 'trainer'
                    ? 'bg-amber-600/20 border border-amber-500/50 text-amber-300 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <GraduationCap className="w-5 h-5 mb-1" />
                <span>Trainer Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickSelectRole('employee')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-medium ${
                  selectedRole === 'employee'
                    ? 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <UserCheck className="w-5 h-5 mb-1" />
                <span>Employee Login</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Pre-fill Banner */}
          <div className="mb-6 p-3.5 bg-indigo-950/40 border border-indigo-800/50 rounded-2xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Click role tab to pre-fill <b>Demo Credentials</b></span>
            </div>
            <span className="font-mono bg-indigo-900/60 px-2 py-1 rounded text-[11px] text-indigo-200 border border-indigo-700/50">
              {selectedRole.toUpperCase()}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex items-start gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 hover:from-indigo-500 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Seed Account Quick Hints */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300 text-center mb-2">Available Test Accounts:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-300">
                <span className="text-rose-400 font-bold">Admin:</span><br />
                admin@example.com<br />
                <span className="text-slate-500">Admin123!</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-300">
                <span className="text-amber-400 font-bold">Trainer:</span><br />
                trainer@example.com<br />
                <span className="text-slate-500">Trainer123!</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-300">
                <span className="text-indigo-400 font-bold">Employee:</span><br />
                employee@example.com<br />
                <span className="text-slate-500">Employee123!</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
