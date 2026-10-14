"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AdminEvent, AdminField, AdminOverviewStats, AdminUser } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Droplets,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";

export default function AdminPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <AdminContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "fields" | "events">("users");

  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fields, setFields] = useState<AdminField[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createIsSuperuser, setCreateIsSuperuser] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, usersData, fieldsData, eventsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminFields(),
        api.getAdminEvents(100),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setFields(fieldsData);
      setEvents(eventsData);
    } catch (err: any) {
      setError(err.message || "Failed to load administrative console data.");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.email === "admin@aquasense.org" && Boolean(user?.is_superuser);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else if (!authLoading && user && !isAdmin) {
      setLoading(false);
      const timer = setTimeout(() => {
        router.replace("/");
      }, 1200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, router]);

  // Non-Admin Access Restriction
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm max-w-xl mx-auto my-12">
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-200">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Administrator Access Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The governance and fleet administration console is strictly restricted to designated administrator credentials (
          <code className="text-slate-800 font-bold">admin@aquasense.org</code>). Your account (
          <code className="text-slate-800 font-bold">{user?.email}</code>) does not possess administrator privileges.
        </p>
        <p className="text-xs text-slate-500 font-medium">Redirecting you to the Overview page...</p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
        >
          Return to Overview
        </Link>
      </div>
    );
  }

  const handleToggleUserActive = async (targetUser: AdminUser) => {
    try {
      const updated = await api.updateAdminUserStatus(targetUser.id, {
        is_active: !targetUser.is_active,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      alert(err.message || "Failed to toggle user status.");
    }
  };

  const handleToggleUserSuperuser = async (targetUser: AdminUser) => {
    try {
      const updated = await api.updateAdminUserStatus(targetUser.id, {
        is_superuser: !targetUser.is_superuser,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      alert(err.message || "Failed to toggle administrator role.");
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const newUser = await api.createAdminUser({
        email: createEmail,
        password: createPassword,
        full_name: createFullName || undefined,
        is_active: true,
        is_superuser: createIsSuperuser,
      });
      setUsers((prev) => [newUser, ...prev]);
      setIsCreateModalOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateFullName("");
      setCreateIsSuperuser(false);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user account.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFields = fields.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.owner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.crop_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform Administration & Governance
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Superuser Console
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global fleet monitoring, role provisioning, user access control, and platform audit records
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadAdminData}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Provision User</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Statistical KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Platform Users</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900">{stats.total_users}</p>
            <p className="text-[11px] text-slate-500">Active accounts & researchers</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Registered Fields</span>
              <Sprout className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{stats.total_fields}</p>
            <p className="text-[11px] text-slate-500">Across all configured plots</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Sensor Telemetry</span>
              <Droplets className="h-4 w-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">
              {stats.total_sensor_observations.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500">Calibrated ground probe readings</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Executed Events</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{stats.total_irrigation_events}</p>
            <p className="text-[11px] text-slate-500">Logged irrigation applications</p>
          </div>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "users"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Users & Roles ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fields")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "fields"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Global Fields ({fields.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "events"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Execution Audit Log ({events.length})
          </button>
        </div>

        {activeTab !== "events" && (
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>
        )}
      </div>

      {/* TAB 1: USERS */}
      {activeTab === "users" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Operator / Email</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Fields Owned</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.email}</td>
                    <td className="py-3 px-4 text-slate-700">{u.full_name || "—"}</td>
                    <td className="py-3 px-4">
                      {u.is_superuser ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Shield className="h-3 w-3 mr-1" />
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          Operator
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-700 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{u.fields_count}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleUserSuperuser(u)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 border border-purple-200 hover:bg-purple-50 rounded-lg px-2 py-1 transition"
                        title={u.is_superuser ? "Demote to standard operator" : "Promote to superuser administrator"}
                      >
                        {u.is_superuser ? "Demote" : "Make Admin"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleUserActive(u)}
                        disabled={u.id === user?.id}
                        className={`text-[11px] font-bold rounded-lg px-2 py-1 transition border disabled:opacity-40 ${
                          u.is_active
                            ? "text-red-700 hover:bg-red-50 border-red-200"
                            : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                        }`}
                        title={u.is_active ? "Deactivate user account" : "Reactivate user account"}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FIELDS */}
      {activeTab === "fields" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Field Name</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Crop & Stage</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">Coordinates</th>
                  <th className="py-3 px-4">Soil Texture</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Latest Moisture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{f.name}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{f.owner_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{f.owner_email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold capitalize text-slate-800">{f.crop_name}</span>
                      <span className="text-slate-400 block text-[10px] capitalize">{f.growth_stage}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {f.area_value} {f.area_unit}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {f.latitude?.toFixed(2)}°N, {f.longitude?.toFixed(2)}°E
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-700">{f.soil_texture}</td>
                    <td className="py-3 px-4 capitalize text-slate-700">{f.irrigation_method}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                      {f.latest_moisture !== null && f.latest_moisture !== undefined
                        ? `${f.latest_moisture.toFixed(3)} m³/m³`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EVENTS */}
      {activeTab === "events" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Execution Time (UTC)</th>
                  <th className="py-3 px-4">Field</th>
                  <th className="py-3 px-4">Volume (m³)</th>
                  <th className="py-3 px-4">Depth (mm)</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Pre / Post Moisture</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No executed irrigation events recorded in the system yet.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(ev.event_timestamp_utc).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{ev.field_name}</span>
                        <span className="text-[10px] text-slate-400 block capitalize">{ev.crop_name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {ev.actual_volume_m3.toLocaleString()} m³
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">{ev.actual_depth_mm} mm</td>
                      <td className="py-3 px-4 capitalize text-slate-700">{ev.irrigation_method}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {ev.pre_irrigation_sm ? `${ev.pre_irrigation_sm.toFixed(3)}` : "—"} →{" "}
                        {ev.post_irrigation_sm ? `${ev.post_irrigation_sm.toFixed(3)}` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ev.execution_status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {ev.execution_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {ev.operator_notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* PROVISION USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-base">Provision New Operator / Admin</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="operator@aquasense.org"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Dr. Researcher or Field Operator"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="is_superuser"
                  checked={createIsSuperuser}
                  onChange={(e) => setCreateIsSuperuser(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="is_superuser" className="font-semibold text-slate-800">
                  Grant Administrator Privileges (Superuser)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {createSubmitting ? "Provisioning..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
