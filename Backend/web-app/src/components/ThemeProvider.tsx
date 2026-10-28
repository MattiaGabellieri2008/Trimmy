"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  ThemeMode, 
  BrandPalette, 
  BRAND_PALETTES, 
  SalonThemeSettings, 
  DEFAULT_THEME_SETTINGS, 
  getSavedThemeSettings, 
  applyThemeToDocument, 
  saveThemeSettings, 
  fetchSalonThemeSettings,
  getResolvedPalette 
} from "@/lib/theme-store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getSalonTenantId } from "@/lib/tenant-helper";
import { Sun, Moon, Laptop } from "lucide-react";

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  paletteId: string;
  setPaletteId: (id: string) => void;
  customHex: string;
  setCustomHex: (hex: string) => void;
  resolvedPalette: {
    primary: string;
    hover: string;
    ring: string;
    subtle: string;
    name: string;
  };
  isDark: boolean;
  saveCurrentSettings: (newSettings?: Partial<SalonThemeSettings>) => Promise<void>;
  brandPalettes: BrandPalette[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere utilizzato all'interno di ThemeProvider");
  }
  return context;
}

// Script inline eseguito immediatamente nel browser per prevenire flash bianco in SSR
const zeroFlickerScript = `(function() {
  try {
    var mode = localStorage.getItem('trimmy_theme_mode') || 'light';
    var isDark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    var paletteId = localStorage.getItem('trimmy_palette_id') || 'obsidian';
    var customHex = localStorage.getItem('trimmy_custom_brand_hex');
    var palettes = {
      obsidian: { primary: '#18181b', hover: '#27272a', ring: 'rgba(24, 24, 27, 0.25)', subtle: '#f4f4f5' },
      gold: { primary: '#d97706', hover: '#b45309', ring: 'rgba(217, 119, 6, 0.25)', subtle: '#fef3c7' },
      rose: { primary: '#e11d48', hover: '#be123c', ring: 'rgba(225, 29, 72, 0.25)', subtle: '#ffe4e6' },
      emerald: { primary: '#059669', hover: '#047857', ring: 'rgba(5, 150, 105, 0.25)', subtle: '#d1fae5' },
      indigo: { primary: '#4f46e5', hover: '#4338ca', ring: 'rgba(79, 70, 229, 0.25)', subtle: '#e0e7ff' }
    };
    var selected = palettes[paletteId] || palettes.obsidian;
    if (paletteId === 'custom' && customHex) {
      selected = { primary: customHex, hover: customHex, ring: 'rgba(24, 24, 27, 0.25)', subtle: '#f4f4f5' };
    }
    root.style.setProperty('--brand-primary', selected.primary);
    root.style.setProperty('--brand-primary-hover', selected.hover);
    root.style.setProperty('--brand-ring', selected.ring);
    root.style.setProperty('--brand-subtle', selected.subtle);
  } catch (e) {}
})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SalonThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Inizializzazione sincrona da localStorage lato client
  useEffect(() => {
    const initial = getSavedThemeSettings();
    setSettings(initial);
    const darkApplied = applyThemeToDocument(initial);
    setIsDark(darkApplied);

    // Ascolto cambi del tema OS se impostato su "system"
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleOsThemeChange = () => {
      const current = getSavedThemeSettings();
      if (current.themeMode === "system") {
        const dark = applyThemeToDocument(current);
        setIsDark(dark);
      }
    };
    mediaQuery.addEventListener("change", handleOsThemeChange);

    // Ascolto eventi di sincronizzazione tab locali
    const handleStorageUpdate = (e: any) => {
      const updated = e.detail || getSavedThemeSettings();
      setSettings(updated);
      const dark = applyThemeToDocument(updated);
      setIsDark(dark);
    };
    window.addEventListener("trimmy-theme-updated", handleStorageUpdate);

    return () => {
      mediaQuery.removeEventListener("change", handleOsThemeChange);
      window.removeEventListener("trimmy-theme-updated", handleStorageUpdate);
    };
  }, []);

  // Ascolto cambio Auth per caricare le preferenze di branding del salone
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tenantId = getSalonTenantId(user.uid);
        setCurrentTenantId(tenantId);
        const salonSettings = await fetchSalonThemeSettings(tenantId);
        if (salonSettings) {
          setSettings(salonSettings);
          const dark = applyThemeToDocument(salonSettings);
          setIsDark(dark);
          try {
            localStorage.setItem("trimmy_theme_mode", salonSettings.themeMode);
            localStorage.setItem("trimmy_palette_id", salonSettings.paletteId);
            if (salonSettings.customPrimaryHex) {
              localStorage.setItem("trimmy_custom_brand_hex", salonSettings.customPrimaryHex);
            }
          } catch {}
        }
      } else {
        setCurrentTenantId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setSettings((prev) => {
      const next = { ...prev, themeMode: mode };
      const dark = applyThemeToDocument(next);
      setIsDark(dark);
      saveThemeSettings(currentTenantId, next);
      return next;
    });
  }, [currentTenantId]);

  const setPaletteId = useCallback((id: string) => {
    setSettings((prev) => {
      const next = { ...prev, paletteId: id };
      applyThemeToDocument(next);
      saveThemeSettings(currentTenantId, next);
      return next;
    });
  }, [currentTenantId]);

  const setCustomHex = useCallback((hex: string) => {
    setSettings((prev) => {
      const next = { ...prev, paletteId: "custom", customPrimaryHex: hex };
      applyThemeToDocument(next);
      saveThemeSettings(currentTenantId, next);
      return next;
    });
  }, [currentTenantId]);

  const saveCurrentSettings = useCallback(async (newSettings?: Partial<SalonThemeSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    const dark = applyThemeToDocument(merged);
    setIsDark(dark);
    await saveThemeSettings(currentTenantId, merged);
  }, [settings, currentTenantId]);

  const resolvedPalette = getResolvedPalette(settings);

  return (
    <ThemeContext.Provider
      value={{
        themeMode: settings.themeMode,
        setThemeMode,
        paletteId: settings.paletteId,
        setPaletteId,
        customHex: settings.customPrimaryHex || "#18181b",
        setCustomHex,
        resolvedPalette,
        isDark,
        saveCurrentSettings,
        brandPalettes: BRAND_PALETTES,
      }}
    >
      <script
        dangerouslySetInnerHTML={{ __html: zeroFlickerScript }}
        suppressHydrationWarning
      />
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Componente rapido per cambiare la modalità Dark Mode (light, dark, system)
 */
export function ThemeToggleQuick({ compact = false }: { compact?: boolean }) {
  const { themeMode, setThemeMode, isDark } = useTheme();

  const cycleTheme = () => {
    if (themeMode === "light") setThemeMode("dark");
    else if (themeMode === "dark") setThemeMode("system");
    else setThemeMode("light");
  };

  if (compact) {
    return (
      <button
        onClick={cycleTheme}
        type="button"
        className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/80 dark:border-zinc-800"
        title={`Tema attuale: ${themeMode === "light" ? "Chiaro" : themeMode === "dark" ? "Scuro" : "Sistema"}. Clicca per cambiare.`}
        aria-label="Cambia tema chiaro/scuro"
      >
        {themeMode === "light" && <Sun className="w-4 h-4 text-amber-500" />}
        {themeMode === "dark" && <Moon className="w-4 h-4 text-indigo-400" />}
        {themeMode === "system" && <Laptop className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />}
      </button>
    );
  }

  return (
    <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
      <button
        type="button"
        onClick={() => setThemeMode("light")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          themeMode === "light"
            ? "bg-white text-zinc-900 shadow-xs"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
        }`}
        title="Tema Chiaro"
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">Chiaro</span>
      </button>

      <button
        type="button"
        onClick={() => setThemeMode("dark")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          themeMode === "dark"
            ? "bg-zinc-900 text-white shadow-xs"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
        }`}
        title="Tema Scuro"
      >
        <Moon className="w-3.5 h-3.5 text-indigo-400" />
        <span className="hidden sm:inline">Scuro</span>
      </button>

      <button
        type="button"
        onClick={() => setThemeMode("system")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          themeMode === "system"
            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
        }`}
        title="Segui impostazioni di sistema"
      >
        <Laptop className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Auto</span>
      </button>
    </div>
  );
}

