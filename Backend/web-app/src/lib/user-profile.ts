import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getSalonTenantId } from "./tenant-helper";

export type UserRole = "cliente" | "salone";
export type PlanType = "FREE" | "MEDIUM" | "PRO";
export type PlanStatus = "ACTIVE" | "PAYMENT_REQUIRED";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  salonName?: string;
  partitaIva?: string;
  staffCount?: number;
  planType: PlanType;
  planStatus: PlanStatus;
  billingPeriod?: "monthly" | "yearly";
  createdAt: string;
  updatedAt?: string;

  // Dati Salone (per Marketplace e Mappa)
  address?: string;
  city?: string;
  zone?: string;
  phone?: string;
  category?: "Barber Shop" | "Hair Stylist Donna" | "Unisex" | "Centro Estetico";
  lat?: number;
  lng?: number;
  openingHours?: string;

  // Dati Cliente (Area Personale)
  phoneNumber?: string;
  preferredCity?: string;
  beautyNotes?: string;
}

const STORAGE_PREFIX = "trimmy_profile_";

/**
 * Pulisce la cache locale del profilo (es. al logout o per forzare refresh)
 */
export function clearUserProfileCache(uid?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (uid) {
      localStorage.removeItem(`${STORAGE_PREFIX}${uid}`);
    }
    localStorage.removeItem("trimmy_current_profile");
  } catch (e) {
    console.error("Errore pulizia cache profilo:", e);
  }
}

/**
 * Sottoscrive in tempo reale ai cambiamenti del profilo utente su Cloud Firestore.
 * Notifica immediatamente la callback (con fallback veloce da localStorage) e
 * mantiene la cache e lo stato dell'app sincronizzati in real-time.
 */
export function subscribeUserProfile(uid: string, callback: (profile: UserProfile | null) => void): () => void {
  if (!uid) return () => {};

  // 1. Lettura sincrona immediata per evitare sfarfallii nella UI
  const cached = getUserProfile(uid);
  if (cached) {
    callback(cached);
  }

  // 2. Ascolto real-time da Cloud Firestore
  try {
    const docRef = doc(db, "users", uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as UserProfile;
        if (typeof window !== "undefined") {
          localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(cloudData));
          localStorage.setItem("trimmy_current_profile", JSON.stringify(cloudData));
        }
        callback(cloudData);
      } else {
        callback(null);
      }
    }, (err) => {
      console.warn("Avviso listener real-time profilo Firestore:", err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn("Errore attivazione listener profilo Firestore:", err);
    return () => {};
  }
}

/**
 * Lettura sincrona da LocalStorage (cache immediata per UI veloce)
 */
export function getUserProfile(uid: string): UserProfile | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    console.error("Errore lettura profilo utente da localStorage:", e);
    return null;
  }
}

/**
 * Recupero del profilo direttamente da Cloud Firestore (con fallback su cache locale
 * e recupero automatico per email se pre-registrato dal salone)
 */
export async function fetchUserProfile(uid: string, userEmail?: string | null): Promise<UserProfile | null> {
  if (!uid) return null;

  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cloudData = docSnap.data() as UserProfile;
      // Aggiorna la cache locale per successive letture veloci
      if (typeof window !== "undefined") {
        localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(cloudData));
        localStorage.setItem("trimmy_current_profile", JSON.stringify(cloudData));
      }
      return cloudData;
    }

    // Se non esiste ancora un profilo sotto questo uid ma abbiamo l'email,
    // verifichiamo se il cliente era stato pre-registrato da un salone
    const cleanEmail = userEmail?.trim().toLowerCase();
    if (cleanEmail) {
      const emailDocId = getSalonTenantId(cleanEmail);
      if (emailDocId !== uid) {
        try {
          const emailSnap = await getDoc(doc(db, "users", emailDocId));
          if (emailSnap.exists()) {
            const preExisting = emailSnap.data() as UserProfile;
            const migratedProfile: UserProfile = {
              ...preExisting,
              uid,
              email: cleanEmail,
              role: preExisting.role || "cliente",
              displayName: preExisting.displayName || cleanEmail.split("@")[0],
              planType: "FREE",
              planStatus: "ACTIVE",
              updatedAt: new Date().toISOString()
            };

            // Salva il profilo migrato sotto il vero UID di Firebase Auth
            await setDoc(doc(db, "users", uid), migratedProfile, { merge: true });

            if (typeof window !== "undefined") {
              localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(migratedProfile));
              localStorage.setItem("trimmy_current_profile", JSON.stringify(migratedProfile));
            }
            return migratedProfile;
          }
        } catch (emailErr) {
          console.warn("Nota verifica pre-registrazione cliente per email:", emailErr);
        }
      }
    }
  } catch (err) {
    console.warn("Attenzione: Impossibile leggere da Firestore, uso cache locale:", err);
  }

  // Fallback cache locale
  return getUserProfile(uid);
}

/**
 * Salva il profilo sia nella cache locale sia nella tabella Cloud Firestore
 */
export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined" || !profile.uid) return;
  
  const cleanProfile: UserProfile = {
    ...profile,
    updatedAt: new Date().toISOString()
  };

  // 1. Salva in LocalStorage per reattività immediata
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cleanProfile.uid}`, JSON.stringify(cleanProfile));
    localStorage.setItem("trimmy_current_profile", JSON.stringify(cleanProfile));
  } catch (e) {
    console.error("Errore salvataggio profilo locale:", e);
  }

  // 2. Salva permanentemente nella tabella Cloud Firestore (asincrono in background)
  try {
    const docRef = doc(db, "users", cleanProfile.uid);
    setDoc(docRef, cleanProfile, { merge: true }).catch((err) => {
      console.error("Errore salvataggio profilo in Cloud Firestore:", err);
    });
  } catch (e) {
    console.error("Errore inizializzazione salvataggio Firestore:", e);
  }
}

/**
 * Aggiorna il profilo sia in locale sia su Cloud Firestore
 */
export function updateUserProfile(uid: string, updates: Partial<UserProfile>): UserProfile | null {
  const current = getUserProfile(uid);
  const updated: UserProfile = current 
    ? { ...current, ...updates, updatedAt: new Date().toISOString() }
    : {
        uid,
        email: "",
        displayName: "",
        role: "salone",
        planType: "FREE",
        planStatus: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates
      };

  saveUserProfile(updated);
  return updated;
}

/**
 * Elimina definitivamente il profilo sia da LocalStorage sia da Cloud Firestore
 */
export async function deleteUserProfile(uid: string): Promise<void> {
  if (!uid) return;

  // 1. Rimuovi dalla cache locale
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${uid}`);
      localStorage.removeItem("trimmy_current_profile");
    } catch (e) {
      console.error("Errore rimozione cache locale:", e);
    }
  }

  // 2. Rimuovi definitivamente dal database Cloud Firestore
  try {
    const docRef = doc(db, "users", uid);
    await deleteDoc(docRef);
  } catch (e) {
    console.error("Errore eliminazione profilo da Cloud Firestore:", e);
  }
}

export function calculatePlan(role: UserRole, staffCount: number = 1): {
  planType: PlanType;
  planName: string;
  planStatus: PlanStatus;
  monthlyPrice: number;
  yearlyPrice: number;
  isFree: boolean;
  maxStaffText: string;
} {
  if (role === "cliente") {
    return {
      planType: "FREE",
      planName: "Cliente",
      planStatus: "ACTIVE",
      monthlyPrice: 0,
      yearlyPrice: 0,
      isFree: true,
      maxStaffText: "N/A",
    };
  }

  // Regola Saloni / Barber:
  // 1 persona = Gratuito (Starter)
  // Da 2 a 3 persone = Medium (11,99 €/mese o 115,99 €/anno con sconto 20%)
  // Da 4 persone in su = Pro (39,00 €/mese o 374,40 €/anno con sconto 20%)
  if (staffCount <= 1) {
    return {
      planType: "FREE",
      planName: "Starter",
      planStatus: "ACTIVE",
      monthlyPrice: 0,
      yearlyPrice: 0,
      isFree: true,
      maxStaffText: "1 persona",
    };
  } else if (staffCount <= 3) {
    return {
      planType: "MEDIUM",
      planName: "Medium",
      planStatus: "PAYMENT_REQUIRED",
      monthlyPrice: 11.99,
      yearlyPrice: 115.99,
      isFree: false,
      maxStaffText: "Fino a 3 persone",
    };
  } else {
    return {
      planType: "PRO",
      planName: "Pro",
      planStatus: "PAYMENT_REQUIRED",
      monthlyPrice: 39.0,
      yearlyPrice: 374.4,
      isFree: false,
      maxStaffText: "Collaboratori illimitati",
    };
  }
}
