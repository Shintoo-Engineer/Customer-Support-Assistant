import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Search,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  RefreshCw,
  UserRound,
  Activity,
  ChevronDown,
} from "lucide-react";

import {
  fetchUsersApi,
  createUserApi,
  type AdminUser,
  type CreateUserRequest,
} from "../services/api";

// ============================================================
// USER MANAGEMENT
// ============================================================

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  // ==========================================================
  // ADD USER MODAL
  // ==========================================================

  const [isAddModalOpen, setIsAddModalOpen] =
    useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [role, setRole] =
    useState<"admin" | "employee">(
      "employee"
    );

  const [submitting, setSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const loadUsers = async (
    showRefresh = false
  ) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchUsersApi();

      setUsers(
        Array.isArray(data?.users)
          ? data.users
          : []
      );
    } catch (err: any) {
      console.error(
        "[UserManagement] Load users failed:",
        err
      );

      setError(
        err?.message ||
          "Unable to load users."
      );

      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const statistics = useMemo(() => {
    const total = users.length;

    const active = users.filter(
      (user) => user.is_active
    ).length;

    const admins = users.filter(
      (user) => user.role === "admin"
    ).length;

    const employees = users.filter(
      (user) => user.role === "employee"
    ).length;

    const customers = users.filter(
      (user) => user.role === "customer"
    ).length;

    return {
      total,
      active,
      admins,
      employees,
      customers,
    };
  }, [users]);

  // ==========================================================
  // FILTER USERS
  // ==========================================================

  const filteredUsers = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const name =
        user.name?.toLowerCase() || "";

      const email =
        user.email?.toLowerCase() || "";

      const userRole =
        user.role?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        name.includes(query) ||
        email.includes(query);

      const matchesRole =
        roleFilter === "all" ||
        userRole === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          user.is_active) ||
        (statusFilter === "inactive" &&
          !user.is_active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    searchQuery,
    roleFilter,
    statusFilter,
  ]);

  // ==========================================================
  // ADD USER
  // ==========================================================

  const openAddModal = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (submitting) return;

    setIsAddModalOpen(false);
    setFormError(null);
  };

  const handleCreateUser = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setFormError(
        "Please enter the user's full name."
      );
      return;
    }

    if (!cleanEmail) {
      setFormError(
        "Please enter an email address."
      );
      return;
    }

    if (!password) {
      setFormError(
        "Please enter a password."
      );
      return;
    }

    if (password.length < 6) {
      setFormError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const request: CreateUserRequest = {
        name: cleanName,
        email: cleanEmail,
        password,
        role,
      };

      await createUserApi(request);

      setIsAddModalOpen(false);

      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");

      await loadUsers();
    } catch (err: any) {
      console.error(
        "[UserManagement] Create user failed:",
        err
      );

      setFormError(
        err?.message ||
          "Unable to create user."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================
  // ROLE STYLE
  // ==========================================================

  const roleStyle = (
    userRole: string
  ) => {
    switch (
      userRole.toLowerCase()
    ) {
      case "admin":
        return {
          icon: (
            <ShieldCheck className="w-3.5 h-3.5" />
          ),
          className:
            "bg-rose-500/10 text-rose-300 border-rose-500/20",
        };

      case "employee":
        return {
          icon: (
            <UserCheck className="w-3.5 h-3.5" />
          ),
          className:
            "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
        };

      case "customer":
        return {
          icon: (
            <UserRound className="w-3.5 h-3.5" />
          ),
          className:
            "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
        };

      default:
        return {
          icon: (
            <Users className="w-3.5 h-3.5" />
          ),
          className:
            "bg-slate-500/10 text-slate-300 border-slate-500/20",
        };
    }
  };

  // ==========================================================
  // DATE
  // ==========================================================

  const formatDate = (
    value?: string
  ) => {
    if (!value) return "—";

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6 pb-8">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 shadow-2xl">

        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div>

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h1 className="text-2xl font-bold text-white">
                    User Management
                  </h1>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Admin
                  </span>

                </div>

                <p className="text-sm text-slate-400 mt-1">
                  Manage platform users and
                  access roles.
                </p>

              </div>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={() =>
                loadUsers(true)
              }
              disabled={
                loading ||
                refreshing
              }
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
            >
              <UserPlus className="w-4 h-4" />
              Add New User
            </button>

          </div>

        </div>

      </section>

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* TOTAL */}

        <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/30 transition">

          <div className="flex items-center justify-between">

            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>

            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Accounts
            </span>

          </div>

          <div className="mt-4">

            <div className="text-3xl font-bold text-white">
              {statistics.total}
            </div>

            <div className="text-xs text-slate-500 mt-1">
              Total registered users
            </div>

          </div>

        </div>

        {/* ACTIVE */}

        <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/30 transition">

          <div className="flex items-center justify-between">

            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>

            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Status
            </span>

          </div>

          <div className="mt-4">

            <div className="text-3xl font-bold text-white">
              {statistics.active}
            </div>

            <div className="text-xs text-emerald-400 mt-1">
              Active accounts
            </div>

          </div>

        </div>

        {/* ADMINS */}

        <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-rose-500/30 transition">

          <div className="flex items-center justify-between">

            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
            </div>

            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Access
            </span>

          </div>

          <div className="mt-4">

            <div className="text-3xl font-bold text-white">
              {statistics.admins}
            </div>

            <div className="text-xs text-rose-300 mt-1">
              Administrator accounts
            </div>

          </div>

        </div>

        {/* EMPLOYEES */}

        <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/30 transition">

          <div className="flex items-center justify-between">

            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-cyan-400" />
            </div>

            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Support
            </span>

          </div>

          <div className="mt-4">

            <div className="text-3xl font-bold text-white">
              {statistics.employees}
            </div>

            <div className="text-xs text-cyan-300 mt-1">
              Employee accounts
            </div>

          </div>

        </div>

      </section>

      {/* ======================================================
          FILTER BAR
      ====================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">

        <div className="flex flex-col lg:flex-row gap-3">

          {/* SEARCH */}

          <div className="relative flex-1">

            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition"
            />

          </div>

          {/* ROLE */}

          <div className="relative">

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value
                )
              }
              className="appearance-none min-w-[150px] w-full lg:w-auto pl-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 outline-none focus:border-indigo-500/60"
            >
              <option value="all">
                All Roles
              </option>

              <option value="admin">
                Admin
              </option>

              <option value="employee">
                Employee
              </option>

              <option value="customer">
                Customer
              </option>
            </select>

            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />

          </div>

          {/* STATUS */}

          <div className="relative">

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="appearance-none min-w-[150px] w-full lg:w-auto pl-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 outline-none focus:border-indigo-500/60"
            >

              <option value="all">
                All Status
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>

            </select>

            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />

          </div>

        </div>

        <div className="flex items-center justify-between mt-3 px-1">

          <span className="text-[11px] text-slate-500">
            Showing{" "}
            <span className="text-slate-300 font-semibold">
              {filteredUsers.length}
            </span>{" "}
            of{" "}
            <span className="text-slate-300 font-semibold">
              {users.length}
            </span>{" "}
            users
          </span>

          {(searchQuery ||
            roleFilter !== "all" ||
            statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300"
            >
              Clear filters
            </button>
          )}

        </div>

      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4 flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>

          <div className="flex-1">

            <div className="text-sm font-semibold text-rose-200">
              Unable to load users
            </div>

            <div className="text-xs text-rose-300/70 mt-0.5">
              {error}
            </div>

          </div>

          <button
            onClick={() =>
              loadUsers(true)
            }
            className="px-3 py-2 rounded-lg bg-rose-900/40 text-rose-200 text-xs font-semibold hover:bg-rose-900/60"
          >
            Retry
          </button>

        </div>
      )}

      {/* ======================================================
          TABLE
      ====================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">

        {/* TABLE HEADER */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">

          <div>

            <h2 className="text-sm font-bold text-white">
              System Users
            </h2>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Current platform accounts and access levels
            </p>

          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-400">

            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

            Backend Connected

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead>

              <tr className="border-b border-slate-800 bg-slate-950/50">

                <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  User
                </th>

                <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Role
                </th>

                <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Status
                </th>

                <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Created
                </th>

                <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Account ID
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800/70">

              {/* LOADING */}

              {loading ? (

                <tr>

                  <td
                    colSpan={5}
                    className="py-16 text-center"
                  >

                    <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />

                    <div className="text-sm text-slate-400 mt-3">
                      Loading user directory...
                    </div>

                  </td>

                </tr>

              ) : filteredUsers.length === 0 ? (

                /* EMPTY */

                <tr>

                  <td
                    colSpan={5}
                    className="py-16 text-center"
                  >

                    <div className="w-12 h-12 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6 text-slate-500" />
                    </div>

                    <div className="text-sm text-slate-300 font-semibold mt-4">
                      No users found
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      Try changing your search or filters.
                    </div>

                  </td>

                </tr>

              ) : (

                /* USERS */

                filteredUsers.map(
                  (user) => {
                    const style =
                      roleStyle(
                        user.role
                      );

                    return (
                      <tr
                        key={user.user_id}
                        className="group hover:bg-slate-800/30 transition"
                      >

                        {/* USER */}

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div className="relative">

                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-200">

                                {user.name
                                  ?.charAt(
                                    0
                                  )
                                  ?.toUpperCase() ||
                                  "U"}

                              </div>

                              {user.is_active && (
                                <span className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center">

                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />

                                </span>
                              )}

                            </div>

                            <div className="min-w-0">

                              <div className="text-sm font-semibold text-white truncate">
                                {user.name}
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">

                                <Mail className="w-3 h-3" />

                                <span className="truncate">
                                  {user.email}
                                </span>

                              </div>

                            </div>

                          </div>

                        </td>

                        {/* ROLE */}

                        <td className="px-6 py-4">

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide ${style.className}`}
                          >

                            {style.icon}

                            {user.role?.toUpperCase()}

                          </span>

                        </td>

                        {/* STATUS */}

                        <td className="px-6 py-4">

                          {user.is_active ? (

                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">

                              <CheckCircle2 className="w-3.5 h-3.5" />

                              Active

                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">

                              <XCircle className="w-3.5 h-3.5" />

                              Inactive

                            </span>

                          )}

                        </td>

                        {/* CREATED */}

                        <td className="px-6 py-4 text-xs text-slate-400">

                          {formatDate(
                            user.created_at
                          )}

                        </td>

                        {/* ID */}

                        <td className="px-6 py-4">

                          <span className="font-mono text-[11px] text-slate-600 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                            #{user.user_id}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </section>

      {/* ======================================================
          ADD USER MODAL
      ====================================================== */}

      {isAddModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">

          <div className="absolute inset-0" />

          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">

            {/* MODAL HEADER */}

            <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/30">

              <button
                onClick={
                  closeAddModal
                }
                disabled={submitting}
                className="absolute right-5 top-5 w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                </div>

                <div>

                  <h3 className="text-base font-bold text-white">
                    Create User
                  </h3>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Add a new system account
                  </p>

                </div>

              </div>

            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleCreateUser
              }
              className="p-6 space-y-5"
            >

              {formError && (

                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-900/60 bg-rose-950/30">

                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />

                  <span className="text-xs text-rose-300">
                    {formError}
                  </span>

                </div>

              )}

              {/* NAME */}

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Enter full name"
                  disabled={submitting}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10 transition disabled:opacity-50"
                />

              </div>

              {/* EMAIL */}

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="user@company.com"
                  disabled={submitting}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10 transition disabled:opacity-50"
                />

              </div>

              {/* PASSWORD */}

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  disabled={submitting}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10 transition disabled:opacity-50"
                />

              </div>

              {/* ROLE */}

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  System Role
                </label>

                <div className="grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setRole(
                        "employee"
                      )
                    }
                    disabled={submitting}
                    className={`p-3 rounded-xl border text-left transition ${
                      role === "employee"
                        ? "border-indigo-500/60 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    }`}
                  >

                    <UserCheck
                      className={`w-4 h-4 ${
                        role === "employee"
                          ? "text-indigo-400"
                          : "text-slate-500"
                      }`}
                    />

                    <div className="text-xs font-semibold text-white mt-2">
                      Employee
                    </div>

                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Support access
                    </div>

                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRole(
                        "admin"
                      )
                    }
                    disabled={submitting}
                    className={`p-3 rounded-xl border text-left transition ${
                      role === "admin"
                        ? "border-rose-500/60 bg-rose-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    }`}
                  >

                    <ShieldCheck
                      className={`w-4 h-4 ${
                        role === "admin"
                          ? "text-rose-400"
                          : "text-slate-500"
                      }`}
                    />

                    <div className="text-xs font-semibold text-white mt-2">
                      Admin
                    </div>

                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Full system access
                    </div>

                  </button>

                </div>

              </div>

              {/* ACTIONS */}

              <div className="flex items-center justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={
                    closeAddModal
                  }
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >

                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Create User
                    </>
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};