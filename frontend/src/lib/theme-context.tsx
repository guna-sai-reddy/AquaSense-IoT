"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
export type ColorPalette = "emerald" | "ocean" | "amber";

interface ThemeContextType {
  mode: ThemeMode;
  palette: ColorPalette;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_MODE_STORAGE_KEY = "aquasense_theme_mode";
const THEME_PALETTE_STORAGE_KEY = "aquasense_theme_palette";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [palette, setPaletteState] = useState<ColorPalette>("emerald");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY) as ThemeMode;
      const savedPalette = localStorage.getItem(THEME_PALETTE_STORAGE_KEY) as ColorPalette;

      const initialMode = savedMode || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const initialPalette = savedPalette || "emerald";

      setModeState(initialMode);
      setPaletteState(initialPalette);
      applyTheme(initialMode, initialPalette);
    } catch {
      applyTheme("light", "emerald");
    }
  }, []);

  const applyTheme = (newMode: ThemeMode, newPalette: ColorPalette) => {
    const root = document.documentElement;
    if (newMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-palette", newPalette);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
    applyTheme(newMode, palette);
  };

  const toggleMode = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
  };

  const setPalette = (newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    try {
      localStorage.setItem(THEME_PALETTE_STORAGE_KEY, newPalette);
    } catch {
      // ignore
    }
    applyTheme(mode, newPalette);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        toggleMode,
        setMode,
        setPalette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
