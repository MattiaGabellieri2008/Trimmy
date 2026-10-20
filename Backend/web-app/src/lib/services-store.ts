import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface SalonServiceItem {
  id: number | string;
  name: string;
  category: string;
  price: number;
  durationMinutes: number;
  description: string;
  staffLevels?: string[];
  relatedServices?: string[];
}

export const DEFAULT_INITIAL_SERVICES: SalonServiceItem[] = [];

const STORAGE_PREFIX = "trimmy_services_";

/**
 * Lettura sincrona da LocalStorage (cache immediata per rendering)
 */
export function getSalonServices(salonId: string = "default"): SalonServiceItem[] {
  if (typeof window === "undefined") return DEFAULT_INITIAL_SERVICES;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${salonId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Se salonId specifico è vuoto, controlla anche se c'è in "default"
    if (salonId !== "default") {
      const fallbackRaw = localStorage.getItem(`${STORAGE_PREFIX}default`);
      if (fallbackRaw) {
        const parsedFallback = JSON.parse(fallbackRaw);
        if (Array.isArray(parsedFallback) && parsedFallback.length > 0) return parsedFallback;
      }
    }
  } catch (e) {
    console.error("Errore lettura servizi da localStorage:", e);
  }
  return DEFAULT_INITIAL_SERVICES;
}

/**
 * Salva i servizi del salone sia in LocalStorage sia in Firestore in modo asincrono affidabile
 */
export async function saveSalonServices(salonId: string, services: SalonServiceItem[]): Promise<void> {
  if (typeof window === "undefined" || !salonId) return;

  // 1. Salva in LocalStorage per persistenza immediata e F5 resiliente
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${salonId}`, JSON.stringify(services));
    localStorage.setItem(`${STORAGE_PREFIX}default`, JSON.stringify(services));
  } catch (e) {
    console.error("Errore salvataggio locale servizi:", e);
  }

  // 2. Salva su Cloud Firestore (sia su /saloni sia su /users)
  try {
    const docRef = doc(db, "saloni", salonId);
    await setDoc(docRef, { services, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("Avviso: salvataggio Firestore saloni:", err);
  }

  try {
    const userDocRef = doc(db, "users", salonId);
    await setDoc(userDocRef, { services, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("Avviso: salvataggio Firestore users:", err);
  }
}

/**
 * Recupero asincrono da Cloud Firestore con aggiornamento cache
 */
export async function fetchSalonServices(salonId: string): Promise<SalonServiceItem[]> {
  if (!salonId) return getSalonServices("default");

  try {
    // 1. Prova da /saloni/{salonId}
    const docRef = doc(db, "saloni", salonId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.services) && data.services.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`${STORAGE_PREFIX}${salonId}`, JSON.stringify(data.services));
          localStorage.setItem(`${STORAGE_PREFIX}default`, JSON.stringify(data.services));
        }
        return data.services as SalonServiceItem[];
      }
    }

    // 2. Fallback su /users/{salonId}
    const userDocRef = doc(db, "users", salonId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data && Array.isArray(data.services) && data.services.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`${STORAGE_PREFIX}${salonId}`, JSON.stringify(data.services));
          localStorage.setItem(`${STORAGE_PREFIX}default`, JSON.stringify(data.services));
        }
        return data.services as SalonServiceItem[];
      }
    }
  } catch (err) {
    console.warn("Lettura Firestore servizi fallita, uso cache locale:", err);
  }

  return getSalonServices(salonId);
}
