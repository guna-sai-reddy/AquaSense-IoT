"use client";

import React from "react";
import { CheckCircle2, Key, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Account & Security Profile
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Operator authentication credentials, role authorization, and active session tokens
            </p>
          </div>

          {/* Profile Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center space-x-4 border-b border-slate-100 pb-6">
              <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl uppercase">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {user?.full_name || "Field Operator"}
                </h2>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                    Active Account
                  </span>
                  {user?.email === "admin@aquasense.org" && user?.is_superuser ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1 text-purple-700" />
                      Platform Administrator (Superuser)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      Precision Agriculture Operator
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Account Identifier (UUID)
                </span>
                <p className="font-mono text-slate-800 break-all">{user?.id || "N/A"}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Email Address
                </span>
                <p className="font-semibold text-slate-800">{user?.email}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Registered On
                </span>
                <p className="font-semibold text-slate-800">
                  {user?.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Authentication Type
                </span>
                <p className="font-semibold text-slate-800 flex items-center space-x-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>OAuth2 Signed JWT Bearer Token</span>
                </p>
              </div>
            </div>

            {/* Session Management */}
            <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Session Control
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Terminates local token storage and redirects to the sign-in portal.
                </p>
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center space-x-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
