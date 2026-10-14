"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type NotificationType = "critical" | "warning" | "info" | "success";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: NotificationType;
  read: boolean;
  link?: string;
}

interface NotificationsContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (item: Omit<NotificationItem, "id" | "read">) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const STORAGE_KEY = "aquasense_notifications_v1";

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "🚨 Irrigation Needed: Water Deficit",
    message: "Root-zone moisture in Kurnool Groundnut Plot 1 has dropped to 0.12 m³/m³ (below RAW threshold). FAO-56 engine recommends 24,500 L.",
    timestamp: "10m ago",
    type: "critical",
    read: false,
    link: "/irrigation",
  },
  {
    id: "notif-2",
    title: "🌧 Rain Window Opportunity Detected",
    message: "Open-Meteo forecast indicates 14.5 mm incoming rainfall within 36 hours. Defer scheduled irrigation to conserve pump electricity.",
    timestamp: "45m ago",
    type: "warning",
    read: false,
    link: "/weather",
  },
  {
    id: "notif-3",
    title: "⚡ 24h AI Moisture Forecast Updated",
    message: "RidgeRegression_v1 model completed automated 24h root-zone inference across all active monitoring plots.",
    timestamp: "2h ago",
    type: "info",
    read: false,
    link: "/predictions",
  },
  {
    id: "notif-4",
    title: "🔋 Probe Telemetry Health Alert",
    message: "In-situ capacitive sensor PROBE_01_03 reported 19% battery level. Solar panel angle check recommended.",
    timestamp: "5h ago",
    type: "warning",
    read: true,
    link: "/system-health",
  },
];

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }
    } catch {
      setNotifications(DEFAULT_NOTIFICATIONS);
    }
  }, []);

  const saveNotifications = (items: NotificationItem[]) => {
    setNotifications(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearAll = () => {
    saveNotifications([]);
  };

  const addNotification = (item: Omit<NotificationItem, "id" | "read">) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}`,
      read: false,
    };
    saveNotifications([newItem, ...notifications]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        addNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
