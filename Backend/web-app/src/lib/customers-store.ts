import { db, dataConnect } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, query } from "firebase/firestore";
import { listCustomers, createCustomer, ListCustomersData } from "../dataconnect-generated";
import { getSalonTenantId } from "./tenant-helper";

export interface CustomerItem {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  birthday?: string | null;
  technicalNotes?: string | null;
  createdAt?: string;
}

const STORAGE_PREFIX = "trimmy_customers_";

/**
 * Genera un UUID v4 standard per un nuovo cliente
 */
export function generateCustomerUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Lettura sincrona da LocalStorage per un salone specifico (100% isolato per tenantId)
 */
export function getSalonCustomersSync(tenantId: string): CustomerItem[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tenantId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerItem[]) : [];
  } catch (e) {
    console.error("Errore lettura clienti locale:", e);
    return [];
  }
}

/**
 * Salva i clienti in cache locale per il singolo salone
 */
export function setSalonCustomersSync(tenantId: string, customers: CustomerItem[]): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(customers));
  } catch (e) {
    console.error("Errore scrittura clienti locale:", e);
  }
}

/**
 * Recupero asincrono di tutti i clienti di un salone:
 * 1. Da Cloud SQL PostgreSQL (DataConnect) filtrato per tenantId
 * 2. Da Cloud Firestore (/saloni/{tenantId}/clienti)
 * 3. Fallback sulla cache locale isolata
 */
export async function fetchSalonCustomers(tenantId: string, alternateId?: string): Promise<CustomerItem[]> {
  if (!tenantId && !alternateId) return [];

  const tid = getSalonTenantId(tenantId || alternateId);
  const altId = alternateId && alternateId !== tid ? alternateId : tenantId !== tid ? tenantId : null;
  const foundCustomers: Map<string, CustomerItem> = new Map();

  // 1. Prova da Cloud SQL DataConnect
  try {
    const res = await listCustomers(dataConnect, { tenantId: tid });
    if (res.data?.customers && res.data.customers.length > 0) {
      res.data.customers.forEach((c) => {
        foundCustomers.set(c.id, {
          id: c.id,
          tenantId: tid,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email || null,
          birthday: c.birthday || null,
          technicalNotes: c.technicalNotes || null
        });
      });
    }
  } catch (dcErr) {
    console.warn("Nota lettura clienti DataConnect:", dcErr);
  }

  // 2. Prova da Cloud Firestore (/saloni/{tid}/clienti)
  try {
    const subColRef = collection(db, "saloni", tid, "clienti");
    const snap = await getDocs(subColRef);
    snap.forEach((d) => {
      const data = d.data() as CustomerItem;
      if (data && data.firstName) {
        foundCustomers.set(data.id || d.id, {
          ...data,
          id: data.id || d.id,
          tenantId: tid
        });
      }
    });
  } catch (fsErr) {
    console.warn("Nota lettura clienti Firestore tid:", fsErr);
  }

  // 2b. Prova da Cloud Firestore con altId se presente
  if (altId) {
    try {
      const subColAlt = collection(db, "saloni", altId, "clienti");
      const snapAlt = await getDocs(subColAlt);
      snapAlt.forEach((d) => {
        const data = d.data() as CustomerItem;
        if (data && data.firstName) {
          foundCustomers.set(data.id || d.id, {
            ...data,
            id: data.id || d.id,
            tenantId: tid
          });
        }
      });
    } catch (fsErr) {
      console.warn("Nota lettura clienti Firestore altId:", fsErr);
    }
  }

  // 3. Fallback cache locale (controlla sia tid che altId)
  const localList = [...getSalonCustomersSync(tid), ...(altId ? getSalonCustomersSync(altId) : [])];
  localList.forEach((c) => {
    if (!foundCustomers.has(c.id)) {
      foundCustomers.set(c.id, { ...c, tenantId: tid });
    }
  });

  const merged = Array.from(foundCustomers.values()).sort((a, b) =>
    a.lastName.localeCompare(b.lastName, "it-IT")
  );

  // Aggiorna la cache locale per il singolo salone
  setSalonCustomersSync(tid, merged);
  if (altId) {
    setSalonCustomersSync(altId, merged);
  }
  return merged;
}

/**
 * Salva o crea un nuovo cliente assicurando che sia visibile ESCLUSIVAMENTE al salone specificato
 */
export async function saveSalonCustomer(
  tenantId: string,
  customerData: {
    id?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    birthday?: string | null;
    technicalNotes?: string | null;
  },
  alternateId?: string
): Promise<CustomerItem> {
  if (!tenantId && !alternateId) throw new Error("tenantId salone obbligatorio");

  const tid = getSalonTenantId(tenantId || alternateId);
  const altId = alternateId && alternateId !== tid ? alternateId : tenantId !== tid ? tenantId : null;

  const customerId = customerData.id || generateCustomerUuid();
  const customerItem: CustomerItem = {
    id: customerId,
    tenantId: tid,
    firstName: customerData.firstName.trim(),
    lastName: customerData.lastName.trim(),
    phone: customerData.phone.trim(),
    email: customerData.email ? customerData.email.trim() : null,
    birthday: customerData.birthday || null,
    technicalNotes: customerData.technicalNotes || null,
    createdAt: new Date().toISOString()
  };

  // 1. Salva in LocalStorage (sia sotto tid che altId)
  const current = getSalonCustomersSync(tid);
  const updated = [customerItem, ...current.filter((c) => c.id !== customerId)];
  setSalonCustomersSync(tid, updated);
  if (altId) {
    setSalonCustomersSync(altId, updated);
  }

  // 2. Salva in Cloud SQL PostgreSQL DataConnect
  try {
    await createCustomer(dataConnect, {
      tenantId: tid,
      firstName: customerItem.firstName,
      lastName: customerItem.lastName,
      phone: customerItem.phone,
      email: customerItem.email || undefined,
      birthday: customerItem.birthday || undefined,
      technicalNotes: customerItem.technicalNotes || undefined
    });
  } catch (dcErr) {
    console.warn("Nota inserimento cliente DataConnect:", dcErr);
  }

  // 3. Salva in Cloud Firestore (/saloni/{tid}/clienti/{customerId}) e (/saloni/{altId}/clienti)
  try {
    const docRef = doc(db, "saloni", tid, "clienti", customerId);
    await setDoc(docRef, customerItem, { merge: true });

    if (altId) {
      const altDocRef = doc(db, "saloni", altId, "clienti", customerId);
      await setDoc(altDocRef, customerItem, { merge: true });
    }
  } catch (fsErr) {
    console.warn("Nota salvataggio cliente Firestore:", fsErr);
  }

  // 4. Se il cliente ha una mail, crea/aggiorna anche il profilo utente globale in Firestore (/users)
  // con role 'cliente' e collegato all'elenco dei saloni associati
  if (customerItem.email) {
    try {
      const userDocId = getSalonTenantId(customerItem.email.toLowerCase());
      const userRef = doc(db, "users", userDocId);
      const existingUserSnap = await getDoc(userRef);
      const prevData = existingUserSnap.exists() ? existingUserSnap.data() : {};
      const associatedSalons = Array.isArray(prevData.associatedSalons)
        ? Array.from(new Set([...prevData.associatedSalons, tid, ...(altId ? [altId] : [])]))
        : [tid, ...(altId ? [altId] : [])];

      await setDoc(
        userRef,
        {
          uid: userDocId,
          email: customerItem.email,
          displayName: `${customerItem.firstName} ${customerItem.lastName}`,
          phoneNumber: customerItem.phone,
          role: "cliente",
          planType: "FREE",
          planStatus: "ACTIVE",
          associatedSalons,
          registeredBySalonId: tid,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (userErr) {
      console.warn("Nota registrazione profilo cliente Firestore:", userErr);
    }
  }

  return customerItem;
}

/**
 * Assicura l'esistenza di un'anagrafica cliente legata specificamente a questo salone
 * per le prenotazioni online (evita ID demo hardcoded e garantisce isolamento tenant)
 */
export async function ensureCustomerForBooking(
  tenantId: string,
  clientData: {
    uid?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  },
  alternateId?: string
): Promise<CustomerItem> {
  if (!tenantId && !alternateId) throw new Error("ID salone non valido per la prenotazione");

  const tid = getSalonTenantId(tenantId || alternateId);
  const altId = alternateId && alternateId !== tid ? alternateId : tenantId !== tid ? tenantId : null;

  // Cerca prima tra i clienti già presenti per questo salone
  const existing = await fetchSalonCustomers(tid, altId || undefined);
  const cleanEmail = clientData.email?.trim().toLowerCase();
  const cleanPhone = clientData.phone?.replace(/\s+/g, "");

  const match = existing.find((c) => {
    if (cleanEmail && c.email && c.email.trim().toLowerCase() === cleanEmail) return true;
    if (cleanPhone && c.phone && c.phone.replace(/\s+/g, "") === cleanPhone) return true;
    return false;
  });

  if (match) {
    return match;
  }

  // Se non esiste ancora per questo salone, crealo associandolo sia al tenantId che ad alternateId
  return await saveSalonCustomer(tid, {
    id: clientData.uid || generateCustomerUuid(),
    firstName: clientData.firstName,
    lastName: clientData.lastName,
    phone: clientData.phone,
    email: clientData.email || null,
    technicalNotes: "Cliente registrato tramite prenotazione online Trimmy"
  }, altId || undefined);
}
