import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LanguageProvider } from "@/lib/language-context";
import { PWAProvider } from "@/lib/pwa-register";
import { NotificationsProvider } from "@/lib/notifications-context";

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "AquaSense-IoT | Precision Irrigation Scheduling",
  description:
    "A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AquaSense",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AquaSense" />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-900 antialiased text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider>
          <LanguageProvider>
            <NotificationsProvider>
              <PWAProvider>
                <AuthProvider>{children}</AuthProvider>
              </PWAProvider>
            </NotificationsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
