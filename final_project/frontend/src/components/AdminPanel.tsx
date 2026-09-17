import React, { useState, useEffect } from 'react';
import { authApi } from '../api/authApi';
import type { AuthUser, UserRecord } from '../types';

interface Props {
  currentUser: AuthUser;
  onLogout: () => void;
  onSwitchToSimulation?: () => void;
}

export const AdminPanel: React.FC<Props> = ({
  currentUser,
  onLogout,
  onSwitchToSimulation,
}) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add User Form State
  const [showAddUser, setShowAddUser] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'employee'>('employee');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user management records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) return;

    setCreatingUser(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await authApi.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });

      setSuccessMsg(`User "${res.name}" (${res.email}) created successfully.`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddUser(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Top Header with Perfectly Aligned Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
            <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white tracking-wider">
              Administrator
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        {/* Header Action Buttons - Exact Matching Height h-8 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="h-8 px-3 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>{showAddUser ? 'Cancel' : '+ Add User'}</span>
          </button>
          {onSwitchToSimulation && (
            <button
              onClick={onSwitchToSimulation}
              className="h-8 px-3 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition cursor-pointer inline-flex items-center"
            >
              Go to Simulator
            </button>
          )}
          <button
            onClick={onLogout}
            className="h-8 px-3 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium transition cursor-pointer inline-flex items-center"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded">
          {successMsg}
        </div>
      )}

      {/* Add User Modal / Form (Uses backend POST /users/) */}
      {showAddUser && (
        <form onSubmit={handleCreateUser} className="mb-6 p-5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Add New User (Backend POST /users/)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="Full Name"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="user@company.com"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 chars"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'employee')}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className="h-8 px-3 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="h-8 px-4 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              {creatingUser ? 'Creating...' : 'Save User'}
            </button>
          </div>
        </form>
      )}

      {/* Admin Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
            Admin Account
          </span>
          <div className="text-sm font-bold text-slate-900 mt-1">{currentUser.name}</div>
          <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
            Security Role
          </span>
          <div className="text-sm font-bold text-slate-900 mt-1 capitalize">{currentUser.role}</div>
          <div className="text-xs text-slate-500">Database-verified RBAC</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Users
          </span>
          <div className="text-sm font-bold text-slate-900 mt-1">{users.length} Registered</div>
          <div className="text-xs text-slate-500">SQLite Database table: users</div>
        </div>
      </div>

      {/* User Management Table from GET /users/ */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Registered Users (Backend Database)
          </h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="h-7 px-2.5 inline-flex items-center justify-center text-xs font-medium rounded border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-6 text-center">Loading users from backend...</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No users registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-2xs uppercase">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-500">#{u.user_id}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{u.name}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-2xs">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded uppercase ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'employee'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-2xs font-medium ${
                          u.is_active ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-2xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
