import React, { useState } from 'react';
import { authApi } from '../api/authApi';
import type { LoginResponse } from '../types';

interface Props {
  onLoginSuccess: (data: LoginResponse) => void;
}

export const Login: React.FC<Props> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || (isRegister && !name.trim())) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isRegister) {
        await authApi.register(name.trim(), email.trim(), password);
        setSuccessMsg('Registration successful! Logging you in...');
        const res = await authApi.login(email.trim(), password);
        onLoginSuccess(res);
      } else {
        const res = await authApi.login(email.trim(), password);
        onLoginSuccess(res);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customer Support Assistant
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            {isRegister ? 'Create a new account.' : 'Sign in with your email and password.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-xs">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:border-slate-500"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:border-slate-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:border-slate-500"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 transition text-xs sm:text-sm cursor-pointer disabled:bg-slate-400"
            >
              {loading ? (isRegister ? 'Registering...' : 'Signing in...') : (isRegister ? 'Register' : 'Sign In')}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button 
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(null); setSuccessMsg(null); }}
            className="text-blue-600 hover:underline focus:outline-none cursor-pointer"
          >
            {isRegister ? 'Sign In' : 'Register / Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
