import React, { useState } from 'react';
import {
  BrainCircuit,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  loginApi,
  fetchCurrentUserApi,
} from '../services/api';
import { RegisterView } from './RegisterView';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRegister, setShowRegister] =
    useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError(
        'Please enter your email address and password.'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: authenticate
      await loginApi(
        normalizedEmail,
        password
      );

      // Step 2: get authenticated user and role
      const user = await fetchCurrentUserApi();

      if (!user) {
        throw new Error(
          'Authenticated user information was not returned by the backend.'
        );
      }

      // Step 3: send user to App.tsx
      onLoginSuccess(user);
    } catch (err: unknown) {
      console.error('Login error:', err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please check your credentials and try again.';

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showRegister) {
    return (
      <RegisterView
        onBackToLogin={() => {
          setShowRegister(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/20">
            <BrainCircuit className="h-7 w-7 text-white" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Customer Support Assistant
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Support knowledge and agent assistance workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">

          <div className="mb-7">
            <h2 className="text-xl font-semibold text-white">
              Sign in
            </h2>

            <p className="mt-1.5 text-sm text-slate-400">
              Sign in with your organization account to continue.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />

              <div>
                <p className="font-medium text-red-300">
                  Sign-in failed
                </p>

                <p className="mt-0.5 text-red-400/90">
                  {error}
                </p>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="you@company.com"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>

              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            {/* Login */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Register */}
          <div className="mt-6 border-t border-slate-800 pt-5 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?
            </p>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowRegister(true);
              }}
              className="mt-1 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              Create an account
            </button>
          </div>

          {/* Security */}
          <div className="mt-5 border-t border-slate-800 pt-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-slate-800 p-2">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300">
                  Secure workspace access
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your access level and available features are determined
                  by your authenticated account.
                </p>
              </div>
            </div>
          </div>

        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Customer Support Assistant
        </p>
      </div>
    </div>
  );
};