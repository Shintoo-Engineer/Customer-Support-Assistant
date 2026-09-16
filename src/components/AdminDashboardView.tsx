import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ShieldCheck,
  Users,
  FileText,
  Activity,
  Bot,
  CheckCircle2,
  Server,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Database,
  UserCheck,
  ChevronRight,
  Clock3,
  Terminal,
  Layers3,
} from "lucide-react";

import { UserManagementView } from "./UserManagementView";
import { PolicyManagementView } from "./PolicyManagementView";
import { AiAssistantView } from "./AiAssistantView";

import {
  UserAccount,
  AuditLogEntry,
} from "../types";

import {
  fetchAuditLogsApi,
  fetchUsersApi,
} from "../services/api";

// ============================================================
// TYPES
// ============================================================

type AdminTab =
  | "overview"
  | "users"
  | "policies"
  | "assistant"
  | "audit";

interface AdminDashboardViewProps {
  user: UserAccount;
}

// ============================================================
// COMPONENT
// ============================================================

export const AdminDashboardView: React.FC<
  AdminDashboardViewProps
> = ({ user }) => {
  const [activeAdminTab, setActiveAdminTab] =
    useState<AdminTab>("overview");

  const [auditLogs, setAuditLogs] =
    useState<AuditLogEntry[]>([]);

  const [loadingAudit, setLoadingAudit] =
    useState(false);

  const [usersCount, setUsersCount] =
    useState(0);

  const [activeUsersCount, setActiveUsersCount] =
    useState(0);

  const [adminCount, setAdminCount] =
    useState(0);

  const [employeeCount, setEmployeeCount] =
    useState(0);

  const [loadingStats, setLoadingStats] =
    useState(false);

  // ==========================================================
  // LOAD USER STATISTICS
  // ==========================================================

  const loadUserStats = async () => {
    setLoadingStats(true);

    try {
      const data = await fetchUsersApi();

      const users = Array.isArray(data?.users)
        ? data.users
        : [];

      setUsersCount(users.length);

      setActiveUsersCount(
        users.filter(
          (item) => item.is_active
        ).length
      );

      setAdminCount(
        users.filter(
          (item) =>
            item.role === "admin"
        ).length
      );

      setEmployeeCount(
        users.filter(
          (item) =>
            item.role === "employee"
        ).length
      );
    } catch (error) {
      console.warn(
        "[AdminDashboard] Unable to load user statistics",
        error
      );
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadUserStats();
  }, []);

  // ==========================================================
  // AUDIT LOGS
  // ==========================================================

  const loadAuditLogs = async () => {
    setLoadingAudit(true);

    try {
      const logs =
        await fetchAuditLogsApi();

      setAuditLogs(
        Array.isArray(logs)
          ? logs
          : []
      );
    } catch (error) {
      console.warn(
        "[AdminDashboard] Failed to load audit logs",
        error
      );

      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // ==========================================================
  // TAB SELECTION
  // ==========================================================

  const handleSelectTab = (
    tab: AdminTab
  ) => {
    setActiveAdminTab(tab);

    if (tab === "audit") {
      loadAuditLogs();
    }

    if (tab === "users") {
      loadUserStats();
    }
  };

  // ==========================================================
  // KPI DATA
  // ==========================================================

  const statistics = useMemo(
    () => [
      {
        label: "Total Users",
        value: usersCount,
        description:
          "Registered platform accounts",
        icon: Users,
        iconClass:
          "text-indigo-300",
        iconBg:
          "bg-indigo-500/10 border-indigo-500/20",
        glow:
          "hover:border-indigo-500/30",
      },
      {
        label: "Active Users",
        value: activeUsersCount,
        description:
          "Currently active accounts",
        icon: Activity,
        iconClass:
          "text-emerald-300",
        iconBg:
          "bg-emerald-500/10 border-emerald-500/20",
        glow:
          "hover:border-emerald-500/30",
      },
      {
        label: "Administrators",
        value: adminCount,
        description:
          "Full system access",
        icon: ShieldCheck,
        iconClass:
          "text-rose-300",
        iconBg:
          "bg-rose-500/10 border-rose-500/20",
        glow:
          "hover:border-rose-500/30",
      },
      {
        label: "Employees",
        value: employeeCount,
        description:
          "Customer support staff",
        icon: UserCheck,
        iconClass:
          "text-cyan-300",
        iconBg:
          "bg-cyan-500/10 border-cyan-500/20",
        glow:
          "hover:border-cyan-500/30",
      },
    ],
    [
      usersCount,
      activeUsersCount,
      adminCount,
      employeeCount,
    ]
  );

  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  const quickActions = [
    {
      title: "Manage Users",
      description:
        "Create and manage system accounts",
      icon: Users,
      tab: "users" as AdminTab,
      iconClass:
        "text-indigo-300",
      bg:
        "bg-indigo-500/10 border-indigo-500/20",
      hover:
        "hover:border-indigo-400/40 hover:bg-indigo-500/[0.07]",
    },
    {
      title: "Policy Uploads",
      description:
        "Manage company policy documents",
      icon: FileText,
      tab: "policies" as AdminTab,
      iconClass:
        "text-sky-300",
      bg:
        "bg-sky-500/10 border-sky-500/20",
      hover:
        "hover:border-sky-400/40 hover:bg-sky-500/[0.07]",
    },
    {
      title: "AI Policy Assistant",
      description:
        "Query the policy RAG knowledge base",
      icon: Bot,
      tab: "assistant" as AdminTab,
      iconClass:
        "text-emerald-300",
      bg:
        "bg-emerald-500/10 border-emerald-500/20",
      hover:
        "hover:border-emerald-400/40 hover:bg-emerald-500/[0.07]",
    },
    {
      title: "Audit Logs",
      description:
        "Review system activity",
      icon: Activity,
      tab: "audit" as AdminTab,
      iconClass:
        "text-amber-300",
      bg:
        "bg-amber-500/10 border-amber-500/20",
      hover:
        "hover:border-amber-400/40 hover:bg-amber-500/[0.07]",
    },
  ];

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6 pb-10">

      {/* ======================================================
          HERO
      ====================================================== */}

      {activeAdminTab === "overview" && (
        <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-900 shadow-2xl">

          {/* Background decoration */}

          <div className="absolute -right-24 -top-32 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl" />

          <div className="absolute right-32 bottom-[-100px] w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.12),transparent_35%)]" />

          <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8 p-7 lg:p-8">

            {/* LEFT */}

            <div className="max-w-2xl">

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold tracking-widest">

                <ShieldCheck className="w-3.5 h-3.5" />

                SYSTEM ADMIN CONTROL CENTER

              </div>

              <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight mt-4">
                Welcome back,{" "}
                <span className="text-indigo-300">
                  {user.name}
                </span>
              </h1>

              <p className="text-sm lg:text-base text-slate-400 leading-relaxed mt-3 max-w-xl">
                Manage users, company policies,
                AI-powered knowledge retrieval,
                and system activity from one
                centralized workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-6">

                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">

                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />

                  Backend Connected

                </div>

                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">

                  <Lock className="w-3.5 h-3.5 text-indigo-400" />

                  JWT Protected

                </div>

              </div>

            </div>

            {/* RIGHT VISUAL */}

            <div className="hidden xl:flex items-center justify-center min-w-[280px]">

              <div className="relative w-56 h-44">

                <div className="absolute inset-5 rounded-3xl border border-indigo-400/20 bg-indigo-500/5 rotate-6" />

                <div className="absolute inset-5 rounded-3xl border border-cyan-400/20 bg-cyan-500/5 -rotate-6" />

                <div className="absolute inset-8 rounded-3xl border border-indigo-400/30 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center shadow-2xl">

                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">

                    <Bot className="w-7 h-7 text-white" />

                  </div>

                  <div className="text-sm font-bold text-white mt-3">
                    SupportCoach AI
                  </div>

                  <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1.5">

                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

                    System Operational

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>
      )}

      {/* ======================================================
          ADMIN NAVIGATION
      ====================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">

        <div className="grid grid-cols-2 md:grid-cols-5 gap-1">

          {[
            {
              id: "overview" as AdminTab,
              label: "Overview",
              icon: Layers3,
            },
            {
              id: "users" as AdminTab,
              label: "Users",
              icon: Users,
            },
            {
              id: "policies" as AdminTab,
              label: "Policies",
              icon: FileText,
            },
            {
              id: "assistant" as AdminTab,
              label: "AI Assistant",
              icon: Bot,
            },
            {
              id: "audit" as AdminTab,
              label: "Audit Logs",
              icon: Activity,
            },
          ].map((item) => {

            const Icon = item.icon;

            const active =
              activeAdminTab ===
              item.id;

            return (
              <button
                key={item.id}
                onClick={() =>
                  handleSelectTab(
                    item.id
                  )
                }
                className={`
                  flex items-center justify-center gap-2
                  px-3 py-3 rounded-xl
                  text-xs font-semibold
                  transition-all
                  ${
                    active
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }
                `}
              >

                <Icon className="w-4 h-4" />

                <span>
                  {item.label}
                </span>

              </button>
            );
          })}

        </div>

      </section>

      {/* ======================================================
          OVERVIEW
      ====================================================== */}

      {activeAdminTab === "overview" && (
        <div className="space-y-6">

          {/* KPI */}

          <section>

            <div className="flex items-end justify-between mb-3">

              <div>
                <h2 className="text-sm font-bold text-white">
                  System Overview
                </h2>

                <p className="text-[11px] text-slate-500 mt-1">
                  Current platform account statistics
                </p>
              </div>

              <button
                onClick={loadUserStats}
                disabled={loadingStats}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-indigo-300 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loadingStats
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh
              </button>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              {statistics.map(
                (stat) => {
                  const Icon =
                    stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className={`
                        group relative overflow-hidden
                        rounded-2xl
                        border border-slate-800
                        bg-slate-900
                        p-5
                        transition-all
                        ${stat.glow}
                      `}
                    >

                      <div className="flex items-center justify-between">

                        <div
                          className={`
                            w-10 h-10 rounded-xl
                            border
                            flex items-center justify-center
                            ${stat.iconBg}
                          `}
                        >
                          <Icon
                            className={`w-5 h-5 ${stat.iconClass}`}
                          />
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition" />

                      </div>

                      <div className="mt-5">

                        <div className="text-3xl font-bold text-white tracking-tight">

                          {loadingStats ? (
                            <span className="inline-block w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
                          ) : (
                            stat.value
                          )}

                        </div>

                        <div className="text-xs font-semibold text-slate-300 mt-1">
                          {stat.label}
                        </div>

                        <div className="text-[10px] text-slate-500 mt-1">
                          {stat.description}
                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>

          {/* QUICK ACTIONS */}

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">

              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">

                <Sparkles className="w-4 h-4 text-indigo-400" />

              </div>

              <div>

                <h2 className="text-sm font-bold text-white">
                  Quick Actions
                </h2>

                <p className="text-[10px] text-slate-500 mt-0.5">
                  Access key administration features
                </p>

              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4">

              {quickActions.map(
                (action) => {
                  const Icon =
                    action.icon;

                  return (
                    <button
                      key={action.title}
                      onClick={() =>
                        handleSelectTab(
                          action.tab
                        )
                      }
                      className={`
                        group text-left
                        rounded-2xl
                        border border-slate-800
                        bg-slate-950/50
                        p-4
                        transition-all
                        ${action.hover}
                      `}
                    >

                      <div className="flex items-center justify-between">

                        <div
                          className={`
                            w-10 h-10
                            rounded-xl
                            border
                            flex items-center justify-center
                            ${action.bg}
                          `}
                        >
                          <Icon
                            className={`w-5 h-5 ${action.iconClass}`}
                          />
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />

                      </div>

                      <h3 className="text-sm font-bold text-white mt-4">
                        {action.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        {action.description}
                      </p>

                    </button>
                  );
                }
              )}

            </div>

          </section>

          {/* SYSTEM STATUS + PLATFORM */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* SYSTEM STATUS */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">

                    <Activity className="w-4 h-4 text-emerald-400" />

                  </div>

                  <div>

                    <h2 className="text-sm font-bold text-white">
                      System Status
                    </h2>

                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Core services and integrations
                    </p>

                  </div>

                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">

                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

                  Operational

                </span>

              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">

                {[
                  {
                    label: "Backend API",
                    icon: Server,
                  },
                  {
                    label: "RAG Pipeline",
                    icon: Database,
                  },
                  {
                    label: "AI Assistant",
                    icon: Bot,
                  },
                  {
                    label: "Authentication",
                    icon: ShieldCheck,
                  },
                ].map(
                  (service) => {
                    const Icon =
                      service.icon;

                    return (
                      <div
                        key={service.label}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                      >

                        <div className="flex items-center gap-2">

                          <Icon className="w-4 h-4 text-indigo-400" />

                          <span className="text-[11px] font-semibold text-slate-300">
                            {service.label}
                          </span>

                        </div>

                        <div className="flex items-center gap-1.5 mt-2">

                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

                          <span className="text-[10px] text-emerald-400">
                            Operational
                          </span>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </section>

            {/* PLATFORM INFO */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="flex items-center gap-3">

                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">

                  <Terminal className="w-4 h-4 text-cyan-400" />

                </div>

                <div>

                  <h2 className="text-sm font-bold text-white">
                    Platform Information
                  </h2>

                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Current application configuration
                  </p>

                </div>

              </div>

              <div className="space-y-3 mt-5">

                <div className="flex items-center justify-between py-2.5 border-b border-slate-800">

                  <span className="text-xs text-slate-500">
                    Application
                  </span>

                  <span className="text-xs font-semibold text-slate-200">
                    SupportCoach AI
                  </span>

                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-slate-800">

                  <span className="text-xs text-slate-500">
                    Access Role
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">

                    <ShieldCheck className="w-3.5 h-3.5" />

                    Administrator

                  </span>

                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-slate-800">

                  <span className="text-xs text-slate-500">
                    Authentication
                  </span>

                  <span className="text-xs font-semibold text-emerald-400">
                    JWT / Bearer
                  </span>

                </div>

                <div className="flex items-center justify-between py-2.5">

                  <span className="text-xs text-slate-500">
                    Knowledge Retrieval
                  </span>

                  <span className="text-xs font-semibold text-cyan-300">
                    RAG Enabled
                  </span>

                </div>

              </div>

            </section>

          </div>

        </div>
      )}

      {/* ======================================================
          USERS
      ====================================================== */}

      {activeAdminTab === "users" && (
        <UserManagementView />
      )}

      {/* ======================================================
          POLICIES
      ====================================================== */}

      {activeAdminTab === "policies" && (
        <PolicyManagementView />
      )}

      {/* ======================================================
          AI ASSISTANT
      ====================================================== */}

      {activeAdminTab === "assistant" && (
        <AiAssistantView
          userRole={user.role}
          userName={user.name}
        />
      )}

      {/* ======================================================
          AUDIT LOGS
      ====================================================== */}

      {activeAdminTab === "audit" && (

        <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">

          {/* HEADER */}

          <div className="px-6 py-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">

                <Activity className="w-5 h-5 text-indigo-400" />

              </div>

              <div>

                <h2 className="text-base font-bold text-white">
                  System Activity
                </h2>

                <p className="text-[11px] text-slate-500 mt-0.5">
                  Administrative audit trail
                </p>

              </div>

            </div>

            <button
              onClick={
                loadAuditLogs
              }
              disabled={loadingAudit}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition disabled:opacity-50"
            >

              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingAudit
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh Logs

            </button>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[720px] text-left">

              <thead className="bg-slate-950/70">

                <tr className="border-b border-slate-800">

                  <th className="px-6 py-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Timestamp
                  </th>

                  <th className="px-6 py-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    User
                  </th>

                  <th className="px-6 py-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Role
                  </th>

                  <th className="px-6 py-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Action
                  </th>

                  <th className="px-6 py-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Details
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800/70">

                {loadingAudit ? (

                  <tr>

                    <td
                      colSpan={5}
                      className="py-16 text-center"
                    >

                      <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />

                      <p className="text-xs text-slate-500 mt-3">
                        Loading activity...
                      </p>

                    </td>

                  </tr>

                ) : auditLogs.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan={5}
                      className="py-16 text-center"
                    >

                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">

                        <Clock3 className="w-6 h-6 text-slate-500" />

                      </div>

                      <p className="text-sm font-semibold text-slate-300 mt-4">
                        No audit events
                      </p>

                      <p className="text-[11px] text-slate-500 mt-1">
                        System activity will appear here when available.
                      </p>

                    </td>

                  </tr>

                ) : (

                  auditLogs.map(
                    (log) => (

                      <tr
                        key={log.id}
                        className="hover:bg-slate-800/30 transition"
                      >

                        <td className="px-6 py-4 text-[11px] text-slate-500 whitespace-nowrap">

                          {new Date(
                            log.timestamp
                          ).toLocaleString()}

                        </td>

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-2.5">

                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">

                              {log.userName
                                ?.charAt(
                                  0
                                )
                                ?.toUpperCase() ||
                                "S"}

                            </div>

                            <span className="text-xs font-semibold text-white">
                              {log.userName}
                            </span>

                          </div>

                        </td>

                        <td className="px-6 py-4">

                          <span className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-300">
                            {log.userRole
                              ?.toUpperCase() ||
                              "SYSTEM"}
                          </span>

                        </td>

                        <td className="px-6 py-4">

                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-cyan-400">

                            <Terminal className="w-3 h-3" />

                            {log.action}

                          </span>

                        </td>

                        <td className="px-6 py-4 text-[11px] text-slate-400 max-w-md">
                          <div className="truncate">
                            {log.details}
                          </div>
                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </section>
      )}

    </div>
  );
};