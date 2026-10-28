// ==============================================================================
// TRIMMY FIDELITY, LOYALTY POINTS & TREATMENT PACKAGES STORE
// Modulo Backend P3 (B7): Tessere a Punti, Carnet Trattamenti & Sconti Fedeltà
// ==============================================================================

import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc 
} from "firebase/firestore";
import { getSalonTenantId } from "./tenant-helper";

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

export interface LoyaltySettings {
  pointsPerEuro: number; // default: 0.1 (1 punto ogni 10€ spesi)
  euroValuePerPoint: number; // default: 0.10 (10 punti = 1€, 50 punti = 5€ sconto)
  minPointsToRedeem: number; // default: 50 punti minimi per applicare lo sconto
  enabled: boolean;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  pointsPerEuro: 0.1,
  euroValuePerPoint: 0.10,
  minPointsToRedeem: 50,
  enabled: true,
};

export interface CustomerLoyalty {
  customerId: string;
  salonId: string;
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsSpent: number;
  tier: LoyaltyTier;
  updatedAt: string;
}

export interface LoyaltyPointMovement {
  id: string;
  customerId: string;
  salonId: string;
  type: "EARNED" | "REDEEMED" | "ADJUSTED";
  points: number;
  transactionId?: string;
  note: string;
  createdAt: string;
}

export interface TreatmentPackage {
  id: string;
  salonId: string;
  name: string;
  serviceId: string;
  serviceName: string;
  totalSessions: number;
  price: number;
  validityDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerPackage {
  id: string;
  salonId: string;
  customerId: string;
  customerName: string;
  packageId: string;
  packageName: string;
  serviceId: string;
  serviceName: string;
  totalSessions: number;
  remainingSessions: number;
  purchaseDate: string;
  expiryDate: string;
  status: "ACTIVE" | "EXHAUSTED" | "EXPIRED";
}

// Pacchetti catalogo predefiniti per saloni
export const DEFAULT_TREATMENT_PACKAGES: Omit<TreatmentPackage, "salonId" | "createdAt">[] = [
  {
    id: "pkg-piega-6",
    name: "Carnet Piega 5 + 1 Omaggio",
    serviceId: "srv-piega",
    serviceName: "Piega & Styling Glamour",
    totalSessions: 6,
    price: 110.0,
    validityDays: 180,
    isActive: true,
  },
  {
    id: "pkg-barba-4",
    name: "Pacchetto Barba Ritual 3 + 1",
    serviceId: "srv-barba",
    serviceName: "Rasatura Tradizionale & Panno Caldo",
    totalSessions: 4,
    price: 65.0,
    validityDays: 120,
    isActive: true,
  },
  {
    id: "pkg-taglio-5",
    name: "Carnet Uomo Executive (5 Tagli)",
    serviceId: "srv-taglio-u",
    serviceName: "Taglio Sartoriale & Shampoo",
    totalSessions: 5,
    price: 100.0,
    validityDays: 180,
    isActive: true,
  },
];

/**
 * Calcola il livello (Tier) in base ai punti totali accumulati
 */
export function computeTier(totalPointsEarned: number): {
  tier: LoyaltyTier;
  label: string;
  badgeClass: string;
  nextThreshold: number;
  progress: number;
} {
  if (totalPointsEarned >= 600) {
    return {
      tier: "DIAMOND",
      label: "Diamond VIP",
      badgeClass: "bg-indigo-950 text-indigo-300 border-indigo-700",
      nextThreshold: 600,
      progress: 100,
    };
  }
  if (totalPointsEarned >= 300) {
    const progress = Math.min(100, Math.round(((totalPointsEarned - 300) / 300) * 100));
    return {
      tier: "GOLD",
      label: "Gold Client",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      nextThreshold: 600,
      progress,
    };
  }
  if (totalPointsEarned >= 100) {
    const progress = Math.min(100, Math.round(((totalPointsEarned - 100) / 200) * 100));
    return {
      tier: "SILVER",
      label: "Silver Club",
      badgeClass: "bg-zinc-200 text-zinc-800 border-zinc-300",
      nextThreshold: 300,
      progress,
    };
  }
  const progress = Math.min(100, Math.round((totalPointsEarned / 100) * 100));
  return {
    tier: "BRONZE",
    label: "Bronze Member",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    nextThreshold: 100,
    progress,
  };
}

const SETTINGS_KEY_PREFIX = "trimmy_loyalty_settings_";
const CUSTOMER_LOYALTY_KEY_PREFIX = "trimmy_loyalty_client_";
const PACKAGES_KEY_PREFIX = "trimmy_salon_packages_";
const CLIENT_PACKAGES_KEY_PREFIX = "trimmy_client_packages_";

// ==============================================================================
// 1. IMPOSTAZIONI FIDELITY DEL SALONE
// ==============================================================================

export async function fetchSalonLoyaltySettings(salonId: string): Promise<LoyaltySettings> {
  const tid = getSalonTenantId(salonId);
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${tid}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "settings", "fidelity");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as LoyaltySettings;
      const res = { ...DEFAULT_LOYALTY_SETTINGS, ...data };
      if (typeof window !== "undefined") {
        localStorage.setItem(`${SETTINGS_KEY_PREFIX}${tid}`, JSON.stringify(res));
      }
      return res;
    }
  } catch (e) {
    console.warn("Nota caricamento impostazioni fidelity Firestore:", e);
  }

  return DEFAULT_LOYALTY_SETTINGS;
}

export async function saveSalonLoyaltySettings(
  salonId: string,
  settings: LoyaltySettings
): Promise<void> {
  const tid = getSalonTenantId(salonId);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${SETTINGS_KEY_PREFIX}${tid}`, JSON.stringify(settings));
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "settings", "fidelity");
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error("Errore salvataggio impostazioni fidelity:", e);
  }
}

// ==============================================================================
// 2. SALDO PUNTI & ANAGRAFICA CLIENTE
// ==============================================================================

export async function fetchCustomerLoyalty(
  salonId: string,
  customerId: string
): Promise<CustomerLoyalty> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`${CUSTOMER_LOYALTY_KEY_PREFIX}${tid}_${normalizedCid}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "loyalty_customers", normalizedCid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CustomerLoyalty;
      if (typeof window !== "undefined") {
        localStorage.setItem(`${CUSTOMER_LOYALTY_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(data));
      }
      return data;
    }
  } catch (e) {
    console.warn("Nota caricamento loyalty cliente:", e);
  }

  const def: CustomerLoyalty = {
    customerId: normalizedCid,
    salonId: tid,
    pointsBalance: 0,
    totalPointsEarned: 0,
    totalPointsSpent: 0,
    tier: "BRONZE",
    updatedAt: new Date().toISOString(),
  };

  return def;
}

export async function awardLoyaltyPoints(
  salonId: string,
  customerId: string,
  totalSpent: number,
  transactionId?: string,
  note = "Punti spesa incasso"
): Promise<{ earned: number; newBalance: number }> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();
  const settings = await fetchSalonLoyaltySettings(tid);

  if (!settings.enabled || totalSpent <= 0) {
    return { earned: 0, newBalance: 0 };
  }

  const earned = Math.floor(totalSpent * settings.pointsPerEuro);
  if (earned <= 0) {
    return { earned: 0, newBalance: 0 };
  }

  const current = await fetchCustomerLoyalty(tid, normalizedCid);
  const newBalance = current.pointsBalance + earned;
  const newTotalEarned = current.totalPointsEarned + earned;
  const newTier = computeTier(newTotalEarned).tier;

  const updated: CustomerLoyalty = {
    ...current,
    pointsBalance: newBalance,
    totalPointsEarned: newTotalEarned,
    tier: newTier,
    updatedAt: new Date().toISOString(),
  };

  // 1. Cache locale
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${CUSTOMER_LOYALTY_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(updated));
    } catch {}
  }

  // 2. Firestore
  try {
    const docRef = doc(db, "saloni", tid, "loyalty_customers", normalizedCid);
    await setDoc(docRef, updated, { merge: true });

    // Salva movimento tracciabile
    const movementId = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const movRef = doc(db, "saloni", tid, "loyalty_movements", movementId);
    const mov: LoyaltyPointMovement = {
      id: movementId,
      customerId: normalizedCid,
      salonId: tid,
      type: "EARNED",
      points: earned,
      transactionId,
      note,
      createdAt: new Date().toISOString(),
    };
    await setDoc(movRef, mov);
  } catch (e) {
    console.warn("Nota salvataggio punti Firestore:", e);
  }

  return { earned, newBalance };
}

export async function redeemLoyaltyPoints(
  salonId: string,
  customerId: string,
  pointsToRedeem: number,
  transactionId?: string
): Promise<{ success: boolean; discountAmount: number; newBalance: number }> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();
  const settings = await fetchSalonLoyaltySettings(tid);
  const current = await fetchCustomerLoyalty(tid, normalizedCid);

  if (pointsToRedeem <= 0 || current.pointsBalance < pointsToRedeem) {
    return { success: false, discountAmount: 0, newBalance: current.pointsBalance };
  }

  const discountAmount = Number((pointsToRedeem * settings.euroValuePerPoint).toFixed(2));
  const newBalance = current.pointsBalance - pointsToRedeem;
  const newTotalSpent = current.totalPointsSpent + pointsToRedeem;

  const updated: CustomerLoyalty = {
    ...current,
    pointsBalance: newBalance,
    totalPointsSpent: newTotalSpent,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${CUSTOMER_LOYALTY_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(updated));
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "loyalty_customers", normalizedCid);
    await setDoc(docRef, updated, { merge: true });

    const movementId = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const movRef = doc(db, "saloni", tid, "loyalty_movements", movementId);
    const mov: LoyaltyPointMovement = {
      id: movementId,
      customerId: normalizedCid,
      salonId: tid,
      type: "REDEEMED",
      points: pointsToRedeem,
      transactionId,
      note: `Riscatto punti per sconto di €${discountAmount.toFixed(2)} in cassa`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(movRef, mov);
  } catch (e) {
    console.warn("Nota riscatto punti Firestore:", e);
  }

  return { success: true, discountAmount, newBalance };
}

export async function adjustCustomerPoints(
  salonId: string,
  customerId: string,
  newBalance: number,
  reason = "Regolazione manuale titolare"
): Promise<CustomerLoyalty> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();
  const current = await fetchCustomerLoyalty(tid, normalizedCid);
  const delta = newBalance - current.pointsBalance;

  const updated: CustomerLoyalty = {
    ...current,
    pointsBalance: Math.max(0, newBalance),
    totalPointsEarned: delta > 0 ? current.totalPointsEarned + delta : current.totalPointsEarned,
    tier: computeTier(delta > 0 ? current.totalPointsEarned + delta : current.totalPointsEarned).tier,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${CUSTOMER_LOYALTY_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(updated));
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "loyalty_customers", normalizedCid);
    await setDoc(docRef, updated, { merge: true });

    const movementId = `mov-${Date.now()}`;
    const movRef = doc(db, "saloni", tid, "loyalty_movements", movementId);
    await setDoc(movRef, {
      id: movementId,
      customerId: normalizedCid,
      salonId: tid,
      type: "ADJUSTED",
      points: delta,
      note: reason,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {}

  return updated;
}

// ==============================================================================
// 3. CATALOGO PACCHETTI TRATTAMENTI SALONE (CARNET)
// ==============================================================================

export async function fetchSalonTreatmentPackages(salonId: string): Promise<TreatmentPackage[]> {
  const tid = getSalonTenantId(salonId);

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`${PACKAGES_KEY_PREFIX}${tid}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  try {
    const colRef = collection(db, "saloni", tid, "packages");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list = snap.docs.map((d) => d.data() as TreatmentPackage);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${PACKAGES_KEY_PREFIX}${tid}`, JSON.stringify(list));
      }
      return list;
    }
  } catch (e) {
    console.warn("Nota caricamento pacchetti Firestore:", e);
  }

  // Se nessun pacchetto salvato, inizializziamo con i preset di lusso predefiniti
  const initial: TreatmentPackage[] = DEFAULT_TREATMENT_PACKAGES.map((p) => ({
    ...p,
    salonId: tid,
    createdAt: new Date().toISOString(),
  }));

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${PACKAGES_KEY_PREFIX}${tid}`, JSON.stringify(initial));
    } catch {}
  }

  return initial;
}

export async function saveSalonTreatmentPackage(
  salonId: string,
  pkg: TreatmentPackage
): Promise<void> {
  const tid = getSalonTenantId(salonId);
  const normalized: TreatmentPackage = {
    ...pkg,
    salonId: tid,
    createdAt: pkg.createdAt || new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = await fetchSalonTreatmentPackages(tid);
      const updated = [normalized, ...existing.filter((p) => p.id !== normalized.id)];
      localStorage.setItem(`${PACKAGES_KEY_PREFIX}${tid}`, JSON.stringify(updated));
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "packages", normalized.id);
    await setDoc(docRef, normalized, { merge: true });
  } catch (e) {
    console.error("Errore salvataggio pacchetto trattamenti:", e);
  }
}

export async function deleteSalonTreatmentPackage(
  salonId: string,
  packageId: string
): Promise<void> {
  const tid = getSalonTenantId(salonId);

  if (typeof window !== "undefined") {
    try {
      const existing = await fetchSalonTreatmentPackages(tid);
      const updated = existing.filter((p) => p.id !== packageId);
      localStorage.setItem(`${PACKAGES_KEY_PREFIX}${tid}`, JSON.stringify(updated));
    } catch {}
  }

  try {
    const docRef = doc(db, "saloni", tid, "packages", packageId);
    await deleteDoc(docRef);
  } catch (e) {}
}

// ==============================================================================
// 4. PACCHETTI / CARNET ACQUISTATI DAI CLIENTI
// ==============================================================================

export async function fetchCustomerPackages(
  salonId: string,
  customerId: string
): Promise<CustomerPackage[]> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`${CLIENT_PACKAGES_KEY_PREFIX}${tid}_${normalizedCid}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  try {
    const colRef = collection(db, "saloni", tid, "customer_packages");
    const q = query(colRef, where("customerId", "==", normalizedCid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => d.data() as CustomerPackage);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${CLIENT_PACKAGES_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(list));
      }
      return list;
    }
  } catch (e) {
    console.warn("Nota lettura customer packages Firestore:", e);
  }

  return [];
}

export async function assignCustomerPackage(
  salonId: string,
  customerId: string,
  customerName: string,
  pkg: TreatmentPackage,
  transactionId?: string
): Promise<CustomerPackage> {
  const tid = getSalonTenantId(salonId);
  const normalizedCid = customerId.trim();

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (pkg.validityDays || 180));

  const custPkg: CustomerPackage = {
    id: `cpkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    salonId: tid,
    customerId: normalizedCid,
    customerName,
    packageId: pkg.id,
    packageName: pkg.name,
    serviceId: pkg.serviceId,
    serviceName: pkg.serviceName,
    totalSessions: pkg.totalSessions,
    remainingSessions: pkg.totalSessions,
    purchaseDate: new Date().toISOString(),
    expiryDate: expiryDate.toISOString(),
    status: "ACTIVE",
  };

  // Cache locale
  if (typeof window !== "undefined") {
    try {
      const existing = await fetchCustomerPackages(tid, normalizedCid);
      const updated = [custPkg, ...existing];
      localStorage.setItem(`${CLIENT_PACKAGES_KEY_PREFIX}${tid}_${normalizedCid}`, JSON.stringify(updated));
    } catch {}
  }

  // Firestore
  try {
    const docRef = doc(db, "saloni", tid, "customer_packages", custPkg.id);
    await setDoc(docRef, custPkg, { merge: true });
  } catch (e) {
    console.warn("Nota assegnazione pacchetto Firestore:", e);
  }

  return custPkg;
}

export async function useCustomerPackageSession(
  salonId: string,
  customerPackageId: string,
  transactionId?: string
): Promise<{ success: boolean; remainingAfter: number; updatedPackage?: CustomerPackage }> {
  const tid = getSalonTenantId(salonId);

  try {
    const docRef = doc(db, "saloni", tid, "customer_packages", customerPackageId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, remainingAfter: 0 };
    }

    const current = snap.data() as CustomerPackage;
    if (current.remainingSessions <= 0 || current.status !== "ACTIVE") {
      return { success: false, remainingAfter: 0 };
    }

    const remainingAfter = current.remainingSessions - 1;
    const newStatus = remainingAfter === 0 ? "EXHAUSTED" : "ACTIVE";

    const updated: CustomerPackage = {
      ...current,
      remainingSessions: remainingAfter,
      status: newStatus,
    };

    await setDoc(docRef, updated, { merge: true });

    // Aggiorna cache locale
    if (typeof window !== "undefined") {
      try {
        const cachedKey = `${CLIENT_PACKAGES_KEY_PREFIX}${tid}_${current.customerId}`;
        const existingStr = localStorage.getItem(cachedKey);
        if (existingStr) {
          const list = JSON.parse(existingStr) as CustomerPackage[];
          const updatedList = list.map((p) => (p.id === customerPackageId ? updated : p));
          localStorage.setItem(cachedKey, JSON.stringify(updatedList));
        }
      } catch {}
    }

    return { success: true, remainingAfter, updatedPackage: updated };
  } catch (e) {
    console.error("Errore scalamento seduta pacchetto:", e);
    return { success: false, remainingAfter: 0 };
  }
}

