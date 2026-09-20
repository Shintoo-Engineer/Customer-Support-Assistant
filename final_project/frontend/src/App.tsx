import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import type { ActiveTab } from './components/Navbar';
import { Home } from './components/Home';
import { NewSimulation } from './components/NewSimulation';
import { SupportConsole } from './components/SupportConsole';
import { Conversations } from './components/Conversations';
import { SessionSummaryView } from './components/SessionSummaryView';
import { IntegrationTest } from './components/IntegrationTest';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import type { IntegratedTurnResponse, SimulatorStartRequest, AuthUser, LoginResponse } from './types';
import { apiClient } from './api/client';
import { simulatorApi } from './api/simulatorApi';
import { authApi } from './api/authApi';

const STORAGE_ACTIVE_SESSION = 'csa_active_session';
const STORAGE_SAVED_SESSIONS = 'csa_saved_sessions';
const STORAGE_ACCESS_TOKEN = 'csa_access_token';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSession, setActiveSession] = useState<IntegratedTurnResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [viewingSummarySessionId, setViewingSummarySessionId] = useState<number | null>(null);
  const [quickStarting, setQuickStarting] = useState<boolean>(false);

  // Re-verify session from backend on page load via GET /auth/me
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
      if (!token) {
        if (isMounted) setAuthLoading(false);
        return;
      }

      try {
        const user = await authApi.getMe();
        if (isMounted) {
          setCurrentUser(user);
          if (user.role === 'admin') {
            setActiveTab('admin-panel');
          }
        }
      } catch {
        // Invalid or expired token
        localStorage.removeItem(STORAGE_ACCESS_TOKEN);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Restore active session from sessionStorage on load
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_ACTIVE_SESSION);
      if (saved) {
        setActiveSession(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Health check against backend
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        await apiClient.get<{ message: string }>('/');
        if (isMounted) setBackendOnline(true);
      } catch {
        if (isMounted) setBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLoginSuccess = (data: LoginResponse) => {
    localStorage.setItem(STORAGE_ACCESS_TOKEN, data.access_token);
    const user: AuthUser = {
      user_id: data.user_id,
      name: data.name,
      email: data.email,
      role: data.role,
    };
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('admin-panel');
    } else {
      setActiveTab('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_ACTIVE_SESSION);
    setCurrentUser(null);
    setActiveSession(null);
    setViewingSummarySessionId(null);
    setActiveTab('home');
  };

  const handleSessionStarted = (data: IntegratedTurnResponse, config: SimulatorStartRequest) => {
    setActiveSession(data);
    setViewingSummarySessionId(null);
    try {
      sessionStorage.setItem(STORAGE_ACTIVE_SESSION, JSON.stringify(data));

      // Append to saved sessions list for Conversations page
      const stored = localStorage.getItem(STORAGE_SAVED_SESSIONS);
      const list = stored ? JSON.parse(stored) : [];
      const updated = [
        {
          sessionId: data.session_id,
          scenario: config.scenario,
          persona: config.persona,
          createdAt: new Date().toISOString(),
        },
        ...list.filter((s: any) => s.sessionId !== data.session_id),
      ];
      localStorage.setItem(STORAGE_SAVED_SESSIONS, JSON.stringify(updated.slice(0, 30)));
    } catch {
      // Ignore
    }
    setActiveTab('support-console');
  };

  const handleQuickStart = async () => {
    setQuickStarting(true);
    try {
      const defaultPayload: SimulatorStartRequest = {
        session_label: 'Quick Demo Session',
        persona: 'frustrated',
        scenario: 'refund',
        initial_emotion: 'frustrated',
        issue_severity: 4,
        patience_level: 3,
        expected_resolution: 'Full refund to original payment card',
      };
      const res = await simulatorApi.startSession(defaultPayload);
      handleSessionStarted(res, defaultPayload);
    } catch (e: any) {
      alert(e.message || 'Failed to start quick demo session. Make sure backend is running.');
    } finally {
      setQuickStarting(false);
    }
  };

  const handleTurnUpdate = (updatedData: IntegratedTurnResponse) => {
    setActiveSession(updatedData);
    try {
      sessionStorage.setItem(STORAGE_ACTIVE_SESSION, JSON.stringify(updatedData));
    } catch {
      // Ignore
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          <span>Verifying authentication session...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, force Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
        <header className="bg-white border-b border-slate-200">
          <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm sm:text-base">
              Customer Support Assistant
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              <span className="hidden sm:inline">{backendOnline ? 'Connected' : 'Offline'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col w-full">
          <Login onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans antialiased">
      {/* Top Navbar with User Badge, Logout & RBAC Tabs */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          // Prevent non-admin users from accessing Admin Panel
          if (tab === 'admin-panel' && currentUser.role !== 'admin') {
            return;
          }
          setViewingSummarySessionId(null);
          setActiveTab(tab);
        }}
        activeSessionId={activeSession?.session_id ?? null}
        backendOnline={backendOnline}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full">
        {/* If viewing a specific session summary */}
        {viewingSummarySessionId !== null ? (
          <SessionSummaryView
            sessionId={viewingSummarySessionId}
            onBackToConsole={() => setViewingSummarySessionId(null)}
            onNewSimulation={() => {
              setViewingSummarySessionId(null);
              setActiveTab('new-simulation');
            }}
          />
        ) : (
          <>
            {activeTab === 'admin-panel' && currentUser.role === 'admin' && (
              <AdminPanel
                currentUser={currentUser}
                onLogout={handleLogout}
                onSwitchToSimulation={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'home' && (
              <Home
                onStartSimulation={() => setActiveTab('new-simulation')}
                activeSessionId={activeSession?.session_id ?? null}
                onResumeSession={() => setActiveTab('support-console')}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'new-simulation' && (
              <NewSimulation onSessionStarted={handleSessionStarted} />
            )}

            {activeTab === 'support-console' && (
              activeSession ? (
                <SupportConsole
                  initialTurnData={activeSession}
                  onNavigateToSummary={() => setViewingSummarySessionId(activeSession.session_id)}
                  onTurnUpdate={handleTurnUpdate}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center py-20 px-4 text-center w-full">
                  <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-xs max-w-md w-full">
                    <h2 className="text-lg font-bold text-slate-900 mb-2">No Active Simulation</h2>
                    <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                      You do not have an active customer session open in the Support Console. Start a new simulation or launch a quick demo session.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        onClick={() => setActiveTab('new-simulation')}
                        className="w-full sm:w-auto px-5 py-2 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
                      >
                        Configure New Simulation
                      </button>
                      <button
                        onClick={handleQuickStart}
                        disabled={quickStarting}
                        className="w-full sm:w-auto px-4 py-2 rounded border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                      >
                        {quickStarting ? 'Starting...' : 'Quick Launch Demo'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}

            {activeTab === 'conversations' && (
              <Conversations
                onOpenSession={(sid) => {
                  setViewingSummarySessionId(sid);
                }}
              />
            )}

            {activeTab === 'integration-test' && <IntegrationTest />}
          </>
        )}
      </main>

      {/* Clean Footer with test link */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 sm:px-6 lg:px-8 w-full shrink-0">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Customer Support Assistant • Backend on <span className="font-mono text-slate-700">localhost:8000</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewingSummarySessionId(null);
                setActiveTab('integration-test');
              }}
              className="text-slate-400 hover:text-slate-700 transition cursor-pointer underline text-2xs"
            >
              System Integration Tests (15 Tests)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
