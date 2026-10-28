// ==============================================================================
// TRIMMY THEME & SALON BRANDING STORE
// Supporto Dark Mode (light, dark, system) & Personalizzazione Palette Salone
// ==============================================================================

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type ThemeMode = "light" | "dark" | "system";

export interface BrandPalette {
  id: string;
  name: string;
  description: string;
  primaryHex: string;
  hoverHex: string;
  ringHex: string;
  subtleHex: string;
  badgeClass: string;
  dotColor: string;
}

export const BRAND_PALETTES: BrandPalette[] = [
  {
    id: "obsidian",
    name: "Obsidian Black",
    description: "Eleganza senza tempo, stile minimale e raffinato",
    primaryHex: "#18181b",
    hoverHex: "#27272a",
    ringHex: "rgba(24, 24, 27, 0.25)",
    subtleHex: "#f4f4f5",
    badgeClass: "bg-zinc-900 text-white",
    dotColor: "#18181b",
  },
  {
    id: "gold",
    name: "Warm Gold",
    description: "Dorato caldo di lusso, allure esclusiva da atelier d'élite",
    primaryHex: "#d97706",
    hoverHex: "#b45309",
    ringHex: "rgba(217, 119, 6, 0.25)",
    subtleHex: "#fef3c7",
    badgeClass: "bg-amber-600 text-white",
    dotColor: "#d97706",
  },
  {
    id: "rose",
    name: "Rose Gold",
    description: "Oro rosa contemporaneo, femminile ed elegante",
    primaryHex: "#e11d48",
    hoverHex: "#be123c",
    ringHex: "rgba(225, 29, 72, 0.25)",
    subtleHex: "#ffe4e6",
    badgeClass: "bg-rose-600 text-white",
    dotColor: "#e11d48",
  },
  {
    id: "emerald",
    name: "Emerald Botanic",
    description: "Verde salvia e smeraldo, eco-chic e benessere naturale",
    primaryHex: "#059669",
    hoverHex: "#047857",
    ringHex: "rgba(5, 150, 105, 0.25)",
    subtleHex: "#d1fae5",
    badgeClass: "bg-emerald-600 text-white",
    dotColor: "#059669",
  },
  {
    id: "indigo",
    name: "Royal Indigo",
    description: "Indaco e viola vibrante, per saloni e barber shop dal look moderno",
    primaryHex: "#4f46e5",
    hoverHex: "#4338ca",
    ringHex: "rgba(79, 70, 229, 0.25)",
    subtleHex: "#e0e7ff",
    badgeClass: "bg-indigo-600 text-white",
    dotColor: "#4f46e5",
  },
];

export interface SalonThemeSettings {
  themeMode: ThemeMode;
  paletteId: string;
  customPrimaryHex?: string;
  updatedAt?: string;
}

export const DEFAULT_THEME_SETTINGS: SalonThemeSettings = {
  themeMode: "light",
  paletteId: "obsidian",
  customPrimaryHex: "#18181b",
};

/**
 * Funzione helper per calcolare hover e ring a partire da un colore HEX arbitrario
 */
export function adjustHexBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return hex;
  const num = parseInt(
    cleanHex.length === 3 
      ? cleanHex.split("").map((c) => c + c).join("") 
      : cleanHex, 
    16
  );
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return `rgba(24, 24, 27, ${alpha})`;
  const fullHex = cleanHex.length === 3 
    ? cleanHex.split("").map((c) => c + c).join("") 
    : cleanHex;
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Risolve la palette effettiva (compreso custom hex)
 */
export function getResolvedPalette(settings: SalonThemeSettings): {
  primary: string;
  hover: string;
  ring: string;
  subtle: string;
  name: string;
} {
  if (settings.paletteId === "custom" && settings.customPrimaryHex) {
    const primary = settings.customPrimaryHex;
    return {
      primary,
      hover: adjustHexBrightness(primary, -15),
      ring: hexToRgba(primary, 0.25),
      subtle: hexToRgba(primary, 0.12),
      name: "Personalizzato",
    };
  }

  const found = BRAND_PALETTES.find((p) => p.id === settings.paletteId);
  if (found) {
    return {
      primary: found.primaryHex,
      hover: found.hoverHex,
      ring: found.ringHex,
      subtle: found.subtleHex,
      name: found.name,
    };
  }

  const def = BRAND_PALETTES[0];
  return {
    primary: def.primaryHex,
    hover: def.hoverHex,
    ring: def.ringHex,
    subtle: def.subtleHex,
    name: def.name,
  };
}

/**
 * Legge i settings salvati da localStorage (sincrono, no flash)
 */
export function getSavedThemeSettings(): SalonThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME_SETTINGS;
  try {
    const mode = (localStorage.getItem("trimmy_theme_mode") as ThemeMode) || "light";
    const palette = localStorage.getItem("trimmy_palette_id") || "obsidian";
    const customHex = localStorage.getItem("trimmy_custom_brand_hex") || undefined;
    return {
      themeMode: ["light", "dark", "system"].includes(mode) ? mode : "light",
      paletteId: palette,
      customPrimaryHex: customHex,
    };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

/**
 * Applica tema Dark Mode e CSS variables per il brand sul documento HTML
 */
export function applyThemeToDocument(settings: SalonThemeSettings): boolean {
  if (typeof document === "undefined") return false;

  const root = document.documentElement;
  
  // Calcolo Dark Mode
  let isDark = false;
  if (settings.themeMode === "dark") {
    isDark = true;
  } else if (settings.themeMode === "system") {
    isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Risolvi Palette e setta CSS Custom Properties
  const palette = getResolvedPalette(settings);
  root.style.setProperty("--brand-primary", palette.primary);
  root.style.setProperty("--brand-primary-hover", palette.hover);
  root.style.setProperty("--brand-ring", palette.ring);
  root.style.setProperty("--brand-subtle", palette.subtle);

  return isDark;
}

/**
 * Salva le impostazioni in LocalStorage e su Firestore se tenantId è fornito
 */
export async function saveThemeSettings(
  tenantId: string | null | undefined,
  settings: SalonThemeSettings
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("trimmy_theme_mode", settings.themeMode);
      localStorage.setItem("trimmy_palette_id", settings.paletteId);
      if (settings.customPrimaryHex) {
        localStorage.setItem("trimmy_custom_brand_hex", settings.customPrimaryHex);
      } else {
        localStorage.removeItem("trimmy_custom_brand_hex");
      }
      // Applica immediatamente sul DOM
      applyThemeToDocument(settings);
      // Notifica tutti i componenti e le altre finestre
      window.dispatchEvent(new CustomEvent("trimmy-theme-updated", { detail: settings }));
    } catch (e) {
      console.warn("Impossibile salvare theme in localStorage:", e);
    }
  }

  // Se loggato come salone tenant, salviamo su Firestore per sincronizzazione multi-dispositivo
  if (tenantId) {
    try {
      const docRef = doc(db, "saloni", tenantId, "settings", "branding");
      await setDoc(
        docRef,
        {
          ...settings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Errore salvataggio branding su Firestore:", err);
    }
  }
}

/**
 * Recupera le impostazioni di branding dal salone Firestore
 */
export async function fetchSalonThemeSettings(tenantId: string): Promise<SalonThemeSettings | null> {
  try {
    const docRef = doc(db, "saloni", tenantId, "settings", "branding");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SalonThemeSettings;
      return {
        themeMode: data.themeMode || "light",
        paletteId: data.paletteId || "obsidian",
        customPrimaryHex: data.customPrimaryHex || undefined,
        updatedAt: data.updatedAt,
      };
    }
  } catch (err) {
    console.warn("Impossibile caricare branding Firestore:", err);
  }
  return null;
}
