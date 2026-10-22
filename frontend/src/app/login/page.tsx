"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Droplets,
  Globe,
  HelpCircle,
  Key,
  Lock,
  Mail,
  PhoneCall,
  ShieldCheck,
  Sprout,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired") === "true";

  const { login } = useAuth();
  const { t, language, setLanguage, availableLanguages } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password Reset Modal States
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify" | "success">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [generatedPin, setGeneratedPin] = useState("");
  const [detectedRole, setDetectedRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(
        err.message ||
          "Sign-in failed. Please verify your credentials or tap One-Click Farmer Login below."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFarmerLogin = async () => {
    setEmail("researcher@aquasense.org");
    setPassword("SecurePassword123!");
    setError(null);
    setLoading(true);
    try {
      await login("researcher@aquasense.org", "SecurePassword123!");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setEmail("admin@aquasense.org");
    setPassword("AdminPassword123!");
    setError(null);
    setLoading(true);
    try {
      await login("admin@aquasense.org", "AdminPassword123!");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetPIN = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError("Please enter your registered account email.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await api.generateResetPIN(resetEmail.trim().toLowerCase());
      setGeneratedPin(res.pin);
      setResetPin(res.pin);
      setDetectedRole(res.role);
      setResetStep("verify");
    } catch (err: any) {
      setResetError(err.message || "Failed to generate security verification PIN.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPin.trim()) {
      setResetError("Please enter the 6-digit security PIN.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match. Please re-enter.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await api.resetPasswordWithPIN({
        email: resetEmail.trim().toLowerCase(),
        pin: resetPin.trim(),
        new_password: newPassword,
      });
      setResetSuccessMsg(res.message);
      setResetStep("success");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password. Please check your PIN.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleFinishResetAndLogin = () => {
    setEmail(resetEmail);
    setPassword(newPassword);
    setIsResetOpen(false);
    setResetStep("request");
    setResetPin("");
    setGeneratedPin("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleCopyPin = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 via-teal-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6 bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-3xl border-2 border-emerald-500/20 dark:border-slate-800 shadow-xl">
        {/* Language Quick Switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
            <Globe className="h-4 w-4" />
            <span>Select Language / భాష / भाषा:</span>
          </div>
          <div className="flex items-center space-x-1">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                  language === lang.code
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {lang.flag} {lang.name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Big Farmer Friendly Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold text-3xl shadow-lg shadow-emerald-600/30">
            🌱
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            AquaSense-IoT
          </h1>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Smart Precision Irrigation & Crop Water Advisory
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Know exactly when and how much water your fields need.
          </p>
        </div>

        {/* Alerts */}
        {sessionExpired && (
          <div className="flex items-center space-x-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Session expired. Please sign in again.</span>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-900 border border-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Standard Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
            >
              Email Address / ఈమెయిల్ / ईमेल
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-5 w-5" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@aquasense.org"
                className="block w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
              >
                Password / రహస్య సంకేతం / पासवर्ड
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsResetOpen(true);
                  setResetStep("request");
                  setResetError(null);
                  setResetSuccessMsg(null);
                  if (email) setResetEmail(email);
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center space-x-1"
              >
                <Key className="h-3 w-3" />
                <span>Reset Password</span>
              </button>
            </div>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-5 w-5" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
          >
            <span>{loading ? "Signing in..." : "👉 Enter Farm Dashboard"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Register Link */}
          <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:underline"
            >
              🌱 Create Account
            </Link>
          </div>
        </form>

        {/* Reset Password Action Row for Users & Admin */}
        <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Forgot credentials?</span>
          <button
            type="button"
            onClick={() => {
              setIsResetOpen(true);
              setResetStep("request");
              setResetError(null);
              setResetSuccessMsg(null);
              if (email) setResetEmail(email);
            }}
            className="font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>🔑 Reset Password (User & Admin)</span>
          </button>
        </div>

        {/* Farmer Helpline & Assistance Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 flex items-center space-x-3 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Kisan Helpline & Agronomy Support
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Toll-Free Helpline: <strong>1800-180-1551</strong> (Kisan Call Centre) • Local Extension Office Kurnool
            </p>
          </div>
        </div>
      </div>

      {/* Password Reset Modal (User & Admin) */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200 relative my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Reset Account Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Works for Farmers, Users & Administrators
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {resetError && (
              <div className="flex items-start space-x-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-900 dark:text-red-300 border border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span className="font-medium">{resetError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email & Generate PIN */}
            {resetStep === "request" && (
              <form onSubmit={handleRequestResetPIN} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Registered Account Email
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-1.5">
                    Enter the email of the User or Admin account you want to reset.
                  </p>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. admin@aquasense.org or farmer@..."
                      className="block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Select Account:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setResetEmail("admin@aquasense.org")}
                      className="px-2.5 py-2 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-left font-semibold hover:border-purple-400 transition"
                    >
                      👑 Admin Account
                      <span className="block text-[10px] text-purple-600/70 dark:text-purple-400 truncate">
                        admin@aquasense.org
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetEmail("researcher@aquasense.org")}
                      className="px-2.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-left font-semibold hover:border-emerald-400 transition"
                    >
                      🌱 Farmer / User
                      <span className="block text-[10px] text-emerald-600/70 dark:text-emerald-400 truncate">
                        researcher@aquasense.org
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    {resetLoading ? "Generating Security PIN..." : "Generate Security Verification PIN"}
                  </span>
                </button>
              </form>
            )}

            {/* STEP 2: Verify PIN & Set New Password */}
            {resetStep === "verify" && (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                {/* Account & Role Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          detectedRole === "Administrator"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        {detectedRole === "Administrator" ? "👑 Administrator" : "🌱 Farmer / Operator"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {resetEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResetStep("request")}
                    className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 underline"
                  >
                    Change
                  </button>
                </div>

                {/* Instant Security Verification PIN Display */}
                <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 space-y-2 text-center">
                  <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Instant Security Verification PIN
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="font-mono text-3xl font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 shadow-inner">
                      {generatedPin}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      className="p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-slate-700 transition"
                      title="Copy PIN"
                    >
                      {copiedPin ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Auto-generated cryptographic PIN. Valid for 15 minutes.
                  </p>
                </div>

                {/* PIN Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Enter Verification PIN
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value)}
                    placeholder="6-digit PIN"
                    className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setResetStep("request")}
                    className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-2/3 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition disabled:opacity-50"
                  >
                    {resetLoading ? "Updating Password..." : "Confirm & Update Password"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Screen */}
            {resetStep === "success" && (
              <div className="space-y-4 text-center py-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Password Successfully Reset!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {resetSuccessMsg || `Your password for ${resetEmail} has been securely updated.`}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1">
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    ✅ Ready for Immediate Login:
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your new credentials have been populated into the sign-in form. Click below to sign in now!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFinishResetAndLogin}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md transition"
                >
                  <span>Sign In With New Password</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
