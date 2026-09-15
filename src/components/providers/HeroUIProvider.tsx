"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { HeroUIProvider as BaseHeroUIProvider } from "@heroui/react";

export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const paramTheme = searchParams?.get("theme") as ThemeMode | null;
    const saved = (typeof window !== "undefined" ? localStorage.getItem("flowdev_theme") : null) as ThemeMode | null;
    const initialTheme: ThemeMode = paramTheme === "dark" || paramTheme === "light" ? paramTheme : (saved === "dark" ? "dark" : "light");
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("flowdev_theme", mode);
    }
    applyTheme(mode);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <BaseHeroUIProvider>
        <div className={theme === "dark" ? "dark text-foreground bg-background min-h-screen" : "light text-foreground bg-background min-h-screen"}>
          {children}
        </div>
      </BaseHeroUIProvider>
    </ThemeContext.Provider>
  );
}
