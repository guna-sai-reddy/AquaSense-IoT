"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CloudSun,
  Compass,
  Download,
  Droplets,
  ExternalLink,
  Globe,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  User as UserIcon,
  WifiOff,
  Calculator,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useTheme, ColorPalette } from "@/lib/theme-context";
import { usePWA } from "@/lib/pwa-register";
import { useNotifications } from "@/lib/notifications-context";
import { Field } from "@/lib/types";

const NAV_CONFIG = [
  { href: "/", key: "navOverview", icon: LayoutDashboard },
  { href: "/fields", key: "navFields", icon: Sprout },
  { href: "/soil-moisture", key: "navSoilMoisture", icon: Droplets },
  { href: "/irrigation", key: "navIrrigation", icon: Compass },
  { href: "/predictions", key: "navPredictions", icon: CalendarClock },
  { href: "/weather", key: "navWeather", icon: CloudSun },
  { href: "/water-budget", key: "navWaterBudget", icon: Calculator },
  { href: "/evaluation", key: "navEvaluation", icon: BarChart3 },
  { href: "/admin", key: "navAdmin", icon: ShieldCheck, superuserOnly: true },
  { href: "/system-health", key: "navSystemHealth", icon: Activity },
  { href: "/account", key: "navAccount", icon: UserIcon },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const { mode, palette, toggleMode, setPalette } = useTheme();
  const { canInstall, isInstalled, installApp, isOffline } = usePWA();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, addNotification } = useNotifications();

  // Menu states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [paletteMenuOpen, setPaletteMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  // Load saved sidebar slide state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aquasense_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarSlide = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aquasense_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = Boolean(user?.is_superuser);

  // Periodic health check ping (30s) & load fields for search
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const res = await api.getHealth();
        if (isMounted) setBackendHealthy(res.status === "healthy");
      } catch {
        if (isMounted) setBackendHealthy(false);
      }
    }
    async function loadFields() {
      try {
        const fList = await api.getFields();
        if (isMounted) setFields(fList);
      } catch {
        // ignore
      }
    }
    checkHealth();
    loadFields();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Keyboard shortcut Ctrl+K or Cmd+K to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      if (e.key === "Escape") {
        setSearchFocused(false);
        setNotifMenuOpen(false);
        setLangMenuOpen(false);
        setPaletteMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Palette styling configurations
  const paletteStyles = {
    emerald: {
      bgAccent: "bg-emerald-600",
      textAccent: "text-emerald-700 dark:text-emerald-400",
      activeNav: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-l-4 border-emerald-600",
      activeIcon: "text-emerald-600 dark:text-emerald-400",
      badge: "text-emerald-700 dark:text-emerald-300",
      brandBorder: "border-emerald-500",
    },
    ocean: {
      bgAccent: "bg-sky-600",
      textAccent: "text-sky-700 dark:text-sky-400",
      activeNav: "bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-l-4 border-sky-600",
      activeIcon: "text-sky-600 dark:text-sky-400",
      badge: "text-sky-700 dark:text-sky-300",
      brandBorder: "border-sky-500",
    },
    amber: {
      bgAccent: "bg-amber-600",
      textAccent: "text-amber-700 dark:text-amber-400",
      activeNav: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-l-4 border-amber-600",
      activeIcon: "text-amber-600 dark:text-amber-400",
      badge: "text-amber-700 dark:text-amber-300",
      brandBorder: "border-amber-500",
    },
  }[palette];

  // Search filtering
  const q = searchQuery.toLowerCase().trim();
  const matchingFields = q
    ? fields.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.crop_name.toLowerCase().includes(q) ||
          f.soil_texture.toLowerCase().includes(q)
      )
    : [];

  const matchingNav = q
    ? NAV_CONFIG.filter((item) => t(item.key).toLowerCase().includes(q) || item.href.includes(q))
    : [];

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center space-x-2 shadow-md">
          <WifiOff className="h-4 w-4" />
          <span>{t("offlineMode")}</span>
        </div>
      )}

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Distinctive Modern Sticky Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen shrink-0 bg-gradient-to-b from-white via-slate-50/80 to-slate-100/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-slate-200/80 dark:border-slate-800 shadow-xl md:shadow-none transform transition-all duration-300 ease-in-out md:static md:inset-auto flex flex-col justify-between ${
          mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-20" : "md:w-72"}`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header with Distinctive Glow Tile & Collapse Slide Button */}
          <div className={`flex h-20 items-center border-b border-slate-200/60 dark:border-slate-800/80 transition-all ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-5"
          }`}>
            <Link href="/" className="flex items-center space-x-3 group min-w-0" title={t("appName")}>
              <div className={`h-11 w-11 rounded-2xl ${paletteStyles.bgAccent} flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-600/25 group-hover:scale-105 transition-transform ring-4 ring-emerald-500/10 shrink-0`}>
                <Droplets className="h-6 w-6" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 overflow-hidden transition-all duration-300">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-black text-slate-900 dark:text-white tracking-tight text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {t("appName")}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  </div>
                  <span className={`block text-[10px] uppercase font-extrabold tracking-wider truncate ${paletteStyles.badge}`}>
                    Smart Ag & IoT Hub
                  </span>
                </div>
              )}
            </Link>

            {/* Desktop Slide / Collapse Toggle Button */}
            <div className="hidden md:flex items-center">
              <button
                type="button"
                onClick={toggleSidebarSlide}
                title={sidebarCollapsed ? "Expand Sidebar (Slide Out)" : "Collapse Sidebar (Slide In)"}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition shadow-2xs"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Categorized Distinctive Navigation Links */}
          <nav className={`py-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar ${sidebarCollapsed ? "px-2" : "p-4"}`}>
            {/* Group 1: Operations */}
            <div className="space-y-1.5">
              {!sidebarCollapsed ? (
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span>Field Operations</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">CORE</span>
                </div>
              ) : (
                <div className="w-full h-px bg-slate-200 dark:border-slate-800 my-2" />
              )}
              {[
                { href: "/", key: "navOverview", icon: LayoutDashboard, tag: "Live" },
                { href: "/fields", key: "navFields", icon: Sprout },
                { href: "/soil-moisture", key: "navSoilMoisture", icon: Droplets, tag: "IoT" },
                { href: "/irrigation", key: "navIrrigation", icon: Compass, tag: "Advisory" },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={sidebarCollapsed ? t(item.key) : undefined}
                    className={`group relative flex items-center rounded-2xl text-xs font-bold transition-all ${
                      sidebarCollapsed
                        ? "justify-center p-3"
                        : "space-x-3 px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-extrabold scale-[1.02]"
                        : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white hover:shadow-xs"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-xl transition shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {!sidebarCollapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                    {!sidebarCollapsed && item.tag && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tight shrink-0 ${
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Group 2: Intelligence & Analytics */}
            <div className="space-y-1.5">
              {!sidebarCollapsed ? (
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span>AI & Weather Insights</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">DATA</span>
                </div>
              ) : (
                <div className="w-full h-px bg-slate-200 dark:border-slate-800 my-2" />
              )}
              {[
                { href: "/predictions", key: "navPredictions", icon: CalendarClock, tag: "24h" },
                { href: "/weather", key: "navWeather", icon: CloudSun, tag: "ET₀" },
                { href: "/water-budget", key: "navWaterBudget", icon: Calculator, tag: "ROI" },
                { href: "/evaluation", key: "navEvaluation", icon: BarChart3 },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={sidebarCollapsed ? t(item.key) : undefined}
                    className={`group relative flex items-center rounded-2xl text-xs font-bold transition-all ${
                      sidebarCollapsed
                        ? "justify-center p-3"
                        : "space-x-3 px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-extrabold scale-[1.02]"
                        : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white hover:shadow-xs"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-xl transition shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {!sidebarCollapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                    {!sidebarCollapsed && item.tag && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tight shrink-0 ${
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Group 3: Administration & Settings */}
            <div className="space-y-1.5">
              {!sidebarCollapsed ? (
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span>System & Account</span>
                </div>
              ) : (
                <div className="w-full h-px bg-slate-200 dark:border-slate-800 my-2" />
              )}
              {[
                ...(isAdmin ? [{ href: "/admin", key: "navAdmin", icon: ShieldCheck, tag: "Admin" }] : []),
                ...(isAdmin ? [{ href: "/system-health", key: "navSystemHealth", icon: Activity, tag: "Admin" }] : []),
                { href: "/account", key: "navAccount", icon: UserIcon },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={sidebarCollapsed ? t(item.key) : undefined}
                    className={`group relative flex items-center rounded-2xl text-xs font-bold transition-all ${
                      sidebarCollapsed
                        ? "justify-center p-3"
                        : "space-x-3 px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-extrabold scale-[1.02]"
                        : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white hover:shadow-xs"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-xl transition shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {!sidebarCollapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                    {!sidebarCollapsed && item.tag && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tight shrink-0 ${
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer: PWA Prompt + Farmer Profile Card */}
        <div className={`border-t border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 backdrop-blur-sm space-y-3 ${
          sidebarCollapsed ? "p-2" : "p-4"
        }`}>
          {/* PWA Install Button in Sidebar */}
          {canInstall && (
            <button
              onClick={installApp}
              title={t("installApp")}
              className={`w-full flex items-center justify-center space-x-2 rounded-2xl text-xs font-bold text-white ${paletteStyles.bgAccent} shadow-md shadow-emerald-600/20 hover:opacity-95 transition ${
                sidebarCollapsed ? "p-2.5" : "px-3.5 py-2.5"
              }`}
            >
              <Download className="h-4 w-4" />
              {!sidebarCollapsed && <span>{t("installApp")}</span>}
            </button>
          )}

          {/* High-Contrast User Profile Pill Card */}
          <div className={`rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center ${
            sidebarCollapsed ? "flex-col p-2 space-y-2 justify-center" : "p-2.5 justify-between"
          }`}>
            <div className={`flex items-center truncate ${sidebarCollapsed ? "justify-center" : "space-x-3"}`}>
              <div className={`h-9 w-9 rounded-xl ${paletteStyles.bgAccent} flex items-center justify-center text-white font-black text-sm uppercase shadow-sm shrink-0`}>
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {user?.full_name || t("fieldOperator")}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              title={t("logout")}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-900 transition shadow-2xs"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area: Independent Vertical Scroll while Sidebar remains Constant */}
      <div className="flex-1 h-screen flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 shrink-0 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 sm:px-8 gap-4">
          {/* Left: Mobile Trigger & Search Bar */}
          <div className="flex items-center space-x-3 flex-1 max-w-lg">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open mobile menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* GLOBAL SEARCH BAR */}
            <div className="relative w-full">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full pl-9 pr-16 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
                />
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchFocused(false);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">
                    ⌘K
                  </kbd>
                )}
              </div>

              {/* FLOATING SEARCH RESULTS DROPDOWN */}
              {searchFocused && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSearchFocused(false)}
                  />
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3 z-50 max-h-96 overflow-y-auto space-y-3">
                    {/* Matching Fields Section */}
                    {matchingFields.length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Farm Plots & Fields
                        </div>
                        {matchingFields.map((field) => (
                          <Link
                            key={field.id}
                            href={`/fields`}
                            onClick={() => setSearchFocused(false)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >
                            <div className="flex items-center space-x-2.5">
                              <Sprout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {field.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {field.crop_name} • {field.soil_texture} ({field.latitude.toFixed(2)}°, {field.longitude.toFixed(2)}°)
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              View Plot →
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Matching Navigation / Tools */}
                    {matchingNav.length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Pages & Core Modules
                        </div>
                        {matchingNav.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setSearchFocused(false)}
                              className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-800 dark:text-slate-200"
                            >
                              <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              <span className="font-semibold">{t(item.key)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* If Empty query: Show Quick Recommendations */}
                    {!searchQuery && (
                      <div className="space-y-2">
                        <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Quick Navigation
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          <Link
                            href="/irrigation"
                            onClick={() => setSearchFocused(false)}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition flex items-center space-x-2"
                          >
                            <Compass className="h-3.5 w-3.5 text-blue-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Irrigation Advisory</span>
                          </Link>
                          <Link
                            href="/weather"
                            onClick={() => setSearchFocused(false)}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition flex items-center space-x-2"
                          >
                            <CloudSun className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Weather & ET₀</span>
                          </Link>
                          <Link
                            href="/water-budget"
                            onClick={() => setSearchFocused(false)}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition flex items-center space-x-2"
                          >
                            <Calculator className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Water Savings ROI</span>
                          </Link>
                          <Link
                            href="/predictions"
                            onClick={() => setSearchFocused(false)}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition flex items-center space-x-2"
                          >
                            <Zap className="h-3.5 w-3.5 text-purple-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">24h AI Predictions</span>
                          </Link>
                        </div>
                      </div>
                    )}

                    {searchQuery && matchingFields.length === 0 && matchingNav.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No farm plots or modules matching &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* 1. NOTIFICATION BELL & CENTER */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifMenuOpen(!notifMenuOpen);
                  setLangMenuOpen(false);
                  setPaletteMenuOpen(false);
                }}
                className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title={t("notifications")}
                aria-label="Toggle notifications center"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-xs animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATIONS DROPDOWN PANEL */}
              {notifMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {t("notifications")}
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>

                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                        >
                          <CheckCheck className="h-3 w-3" />
                          <span>{t("markAllRead")}</span>
                        </button>
                      )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                          <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500 opacity-80" />
                          <p>{t("noNotifications")}</p>
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !n.read;
                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                markAsRead(n.id);
                                if (n.link) {
                                  setNotifMenuOpen(false);
                                  router.push(n.link);
                                }
                              }}
                              className={`p-3.5 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50 space-y-1 ${
                                isUnread ? "bg-emerald-50/30 dark:bg-emerald-950/20" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {isUnread && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                  )}
                                  <span>{n.title}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {n.timestamp}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              {n.link && (
                                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-0.5">
                                  Take Action →
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          addNotification({
                            title: "⚡ Live Telemetry Check Triggered",
                            message: "Field probes communicated via LoRaWAN/cellular gateway with nominal RSSI signal (-72 dBm).",
                            timestamp: "Just now",
                            type: "info",
                            link: "/system-health",
                          });
                        }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        + {t("testAlert")}
                      </button>

                      {notifications.length > 0 && (
                        <button
                          onClick={clearAll}
                          className="text-[11px] font-semibold text-red-500 hover:text-red-700 flex items-center space-x-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>{t("clearAll")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 2. Language Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setLangMenuOpen(!langMenuOpen);
                  setPaletteMenuOpen(false);
                  setNotifMenuOpen(false);
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
                title={t("selectLanguage")}
              >
                <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span className="font-semibold uppercase">{language}</span>
              </button>

              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1 z-50">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      {t("selectLanguage")}
                    </div>
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition ${
                          language === lang.code
                            ? `${paletteStyles.textAccent} font-bold bg-slate-50 dark:bg-slate-800`
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{lang.flag}</span>
                          <span>{lang.nativeName}</span>
                        </div>
                        {language === lang.code && <span className="text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 3. Color Theme Palette Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setPaletteMenuOpen(!paletteMenuOpen);
                  setLangMenuOpen(false);
                  setNotifMenuOpen(false);
                }}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
                title={t("theme")}
              >
                <Palette className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    palette === "emerald"
                      ? "bg-emerald-500"
                      : palette === "ocean"
                      ? "bg-sky-500"
                      : "bg-amber-500"
                  }`}
                />
              </button>

              {paletteMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPaletteMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1 z-50">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      {t("theme")}
                    </div>
                    <button
                      onClick={() => {
                        setPalette("emerald");
                        setPaletteMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3.5 py-2 text-xs transition ${
                        palette === "emerald"
                          ? "text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span>{t("paletteEmerald")}</span>
                    </button>
                    <button
                      onClick={() => {
                        setPalette("ocean");
                        setPaletteMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3.5 py-2 text-xs transition ${
                        palette === "ocean"
                          ? "text-sky-700 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950/40"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <span>{t("paletteOcean")}</span>
                    </button>
                    <button
                      onClick={() => {
                        setPalette("amber");
                        setPaletteMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3.5 py-2 text-xs transition ${
                        palette === "amber"
                          ? "text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>{t("paletteAmber")}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 4. Dark/Light Mode Toggle */}
            <button
              onClick={toggleMode}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={mode === "light" ? t("modeDark") : t("modeLight")}
              aria-label="Toggle theme mode"
            >
              {mode === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4 text-amber-400" />
              )}
            </button>

            {/* 5. Live System Health Indicator */}
            <Link
              href="/system-health"
              className="hidden lg:flex items-center space-x-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-3 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendHealthy === true
                    ? "bg-emerald-500"
                    : backendHealthy === false
                    ? "bg-red-500 animate-pulse"
                    : "bg-slate-400"
                }`}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {backendHealthy === true
                  ? t("backendOnline")
                  : backendHealthy === false
                  ? t("backendOffline")
                  : t("checkingStatus")}
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children}
        </main>

        {/* NATIVE MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden flex items-center justify-around px-2 py-1 safe-area-pb shadow-lg">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              pathname === "/"
                ? `${paletteStyles.textAccent} font-bold`
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t("navOverview")}</span>
          </Link>

          <Link
            href="/fields"
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              pathname.startsWith("/fields")
                ? `${paletteStyles.textAccent} font-bold`
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Sprout className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t("navFields")}</span>
          </Link>

          <Link
            href="/soil-moisture"
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              pathname.startsWith("/soil-moisture")
                ? `${paletteStyles.textAccent} font-bold`
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Droplets className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t("navSoilMoisture")}</span>
          </Link>

          <Link
            href="/irrigation"
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              pathname.startsWith("/irrigation")
                ? `${paletteStyles.textAccent} font-bold`
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Compass className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t("navIrrigation")}</span>
          </Link>

          <Link
            href="/weather"
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              pathname.startsWith("/weather")
                ? `${paletteStyles.textAccent} font-bold`
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <CloudSun className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t("navWeather")}</span>
          </Link>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
