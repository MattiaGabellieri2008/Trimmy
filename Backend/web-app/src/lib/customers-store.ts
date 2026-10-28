import { db, dataConnect } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, deleteDoc } from "firebase/firestore";
import { listCustomers, createCustomer, ListCustomersData } from "../dataconnect-generated";
import { getSalonTenantId } from "./tenant-helper";
import { enqueueOutboxMutation } from "./outbox-sync";

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
 * Normalizza il recapito telefonico per il confronto univoco (rimuove spazi, trattini, +39 o 0039)
 */
export function normalizeCustomerPhone(phone?: string | null): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("0039")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("+39")) cleaned = cleaned.slice(3);
  return cleaned;
}

/**
 * Normalizza l'indirizzo email per il confronto univoco (lowercase e trim)
 */
export function normalizeCustomerEmail(email?: string | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Verifica se due record anagrafici rappresentano lo stesso cliente
 * (stesso ID, oppure stesso numero di telefono normalizzato, oppure stessa email, oppure stesso Nome + Cognome)
 */
export function isSameCustomer(a: Partial<CustomerItem>, b: Partial<CustomerItem>): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  const phoneA = normalizeCustomerPhone(a.phone);
  const phoneB = normalizeCustomerPhone(b.phone);
  if (phoneA && phoneB && phoneA.length >= 7 && phoneA === phoneB) {
    return true;
  }

  const emailA = normalizeCustomerEmail(a.email);
  const emailB = normalizeCustomerEmail(b.email);
  if (emailA && emailB && emailA.includes("@") && emailA === emailB) {
    return true;
  }

  const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
  const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
  if (nameA && nameA === nameB && nameA.length > 2) {
    // Se hanno lo stesso nome e cognome completo:
    // Se entrambi hanno telefoni validi e differiscono, considerali distinti
    if (phoneA && phoneB && phoneA.length >= 7 && phoneB.length >= 7 && phoneA !== phoneB) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Deduplica una lista di clienti unificando le informazioni più complete ed eliminando cloni/ripetizioni
 */
export function deduplicateCustomersList(customers: CustomerItem[]): CustomerItem[] {
  const uniqueList: CustomerItem[] = [];

  for (const item of customers) {
    if (!item || (!item.firstName && !item.lastName)) continue;

    const existingIdx = uniqueList.findIndex((u) => isSameCustomer(u, item));
    if (existingIdx === -1) {
      uniqueList.push({ ...item });
    } else {
      // Unisci i record mantenendo i dati più completi
      const existing = uniqueList[existingIdx];

      const mergedNotes = [existing.technicalNotes, item.technicalNotes]
        .filter((n): n is string => Boolean(n && n.trim()))
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .join("\n");

      uniqueList[existingIdx] = {
        ...existing,
        firstName: existing.firstName || item.firstName,
        lastName: existing.lastName || item.lastName,
        phone: existing.phone || item.phone,
        email: existing.email || item.email || null,
        birthday: existing.birthday || item.birthday || null,
        technicalNotes: mergedNotes || null,
        createdAt: existing.createdAt || item.createdAt
      };
    }
  }

  return uniqueList.sort((a, b) => a.lastName.localeCompare(b.lastName, "it-IT"));
}

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
    return Array.isArray(parsed) ? deduplicateCustomersList(parsed as CustomerItem[]) : [];
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
    const cleanList = deduplicateCustomersList(customers);
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(cleanList));
  } catch (e) {
    console.error("Errore scrittura clienti locale:", e);
  }
}

/**
 * Recupero asincrono di tutti i clienti di un salone:
 * 1. Da Cloud SQL PostgreSQL (DataConnect) filtrato per tenantId
 * 2. Da Cloud Firestore (/saloni/{tenantId}/clienti)
 * 3. Fallback sulla cache locale isolata
 *
 * Applica automaticamente la DEDUPLICAZIONE per evitare clienti ripetuti
 * e ripulisce in background eventuali documenti duplicati su Firestore e LocalStorage.
 */
export async function fetchSalonCustomers(tenantId: string, alternateId?: string): Promise<CustomerItem[]> {
  if (!tenantId && !alternateId) return [];

  const tid = getSalonTenantId(tenantId || alternateId);
  const altId = alternateId && alternateId !== tid ? alternateId : tenantId !== tid ? tenantId : null;

  const rawCandidates: CustomerItem[] = [];
  const firestoreDocIdMap: Map<string, string> = new Map(); // docId -> key

  // 1. Prova da Cloud SQL DataConnect
  try {
    const res = await listCustomers(dataConnect, { tenantId: tid });
    if (res.data?.customers && res.data.customers.length > 0) {
      res.data.customers.forEach((c) => {
        rawCandidates.push({
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
      const data = d.data() as CustomerItem & { isDeleted?: boolean };
      if (data && (data.firstName || data.lastName) && !data.isDeleted) {
        const item: CustomerItem = {
          ...data,
          id: data.id || d.id,
          tenantId: tid
        };
        rawCandidates.push(item);
        firestoreDocIdMap.set(d.id, d.id);
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
        const data = d.data() as CustomerItem & { isDeleted?: boolean };
        if (data && (data.firstName || data.lastName) && !data.isDeleted) {
          const item: CustomerItem = {
            ...data,
            id: data.id || d.id,
            tenantId: tid
          };
          rawCandidates.push(item);
          firestoreDocIdMap.set(d.id, d.id);
        }
      });
    } catch (fsErr) {
      console.warn("Nota lettura clienti Firestore altId:", fsErr);
    }
  }

  // 3. Fallback cache locale (controlla sia tid che altId)
  const localList = [...getSalonCustomersSync(tid), ...(altId ? getSalonCustomersSync(altId) : [])];
  localList.forEach((c) => rawCandidates.push(c));

  // 4. Deduplica rigorosa di tutti i clienti trovati
  const deduplicated = deduplicateCustomersList(rawCandidates);

  // 5. Pulizia attiva in background di eventuali duplicati Firestore
  try {
    for (const uniqueCust of deduplicated) {
      // Trova tutti i documenti con lo stesso cliente
      const duplicatesOfThis = rawCandidates.filter(
        (cand) => cand.id !== uniqueCust.id && isSameCustomer(cand, uniqueCust)
      );

      for (const dup of duplicatesOfThis) {
        // Se il duplicato aveva un docId Firestore diverso, eliminalo per sanare il database
        if (dup.id && firestoreDocIdMap.has(dup.id)) {
          try {
            await deleteDoc(doc(db, "saloni", tid, "clienti", dup.id));
            if (altId) {
              await deleteDoc(doc(db, "saloni", altId, "clienti", dup.id));
            }
          } catch (e) {
            // Silenzioso: eliminazione facoltativa di pulizia
          }
        }
      }
    }
  } catch (cleanErr) {
    console.warn("Nota pulizia duplicati Firestore:", cleanErr);
  }

  // Aggiorna la cache locale per il singolo salone con i soli record univoci
  setSalonCustomersSync(tid, deduplicated);
  if (altId) {
    setSalonCustomersSync(altId, deduplicated);
  }
  return deduplicated;
}

/**
 * Salva o crea un nuovo cliente assicurando che sia visibile ESCLUSIVAMENTE al salone specificato.
 * PREVIENE I DUPLICATI: se un cliente con lo stesso telefono o email esiste già, ne aggiorna i dati in-place.
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

  // 0. Verifica se un cliente con gli stessi recapiti (telefono o email o nome completo) esiste già
  const existingList = getSalonCustomersSync(tid);
  const match = existingList.find((c) =>
    isSameCustomer(c, {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      email: customerData.email
    })
  );

  const customerId = customerData.id || match?.id || generateCustomerUuid();

  // Se esisteva già, unisci le note tecniche invece di sovrascriverle
  let mergedNotes = customerData.technicalNotes || null;
  if (match && match.technicalNotes && customerData.technicalNotes && match.technicalNotes !== customerData.technicalNotes) {
    mergedNotes = `${match.technicalNotes}\n${customerData.technicalNotes}`;
  } else if (match && !customerData.technicalNotes && match.technicalNotes) {
    mergedNotes = match.technicalNotes;
  }

  const customerItem: CustomerItem = {
    id: customerId,
    tenantId: tid,
    firstName: customerData.firstName.trim(),
    lastName: customerData.lastName.trim(),
    phone: customerData.phone.trim(),
    email: customerData.email ? customerData.email.trim() : match?.email || null,
    birthday: customerData.birthday || match?.birthday || null,
    technicalNotes: mergedNotes,
    createdAt: match?.createdAt || new Date().toISOString()
  };

  // 1. Salva in LocalStorage (sia sotto tid che altId)
  const current = getSalonCustomersSync(tid);
  const updated = deduplicateCustomersList([customerItem, ...current.filter((c) => c.id !== customerId && !isSameCustomer(c, customerItem))]);
  setSalonCustomersSync(tid, updated);
  if (altId) {
    setSalonCustomersSync(altId, updated);
  }

  // 2. Salva in Cloud SQL PostgreSQL DataConnect (con fallback automatico a Outbox)
  if (!match) {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Client Offline");
      }
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
      console.warn("DataConnect non raggiungibile, accodamento Outbox cliente:", dcErr);
      await enqueueOutboxMutation(tid, {
        entity: "CUSTOMER",
        operation: "CREATE",
        payload: customerItem,
        timestamp: customerItem.createdAt
      });
    }
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
 * Elimina un cliente dal database locale e Firestore
 */
export async function deleteSalonCustomer(
  tenantId: string,
  customerId: string,
  alternateId?: string
): Promise<boolean> {
  if (!tenantId && !alternateId) return false;
  const tid = getSalonTenantId(tenantId || alternateId);
  const altId = alternateId && alternateId !== tid ? alternateId : tenantId !== tid ? tenantId : null;

  // 1. Rimuovi da LocalStorage
  const current = getSalonCustomersSync(tid).filter((c) => c.id !== customerId);
  setSalonCustomersSync(tid, current);
  if (altId) {
    const currentAlt = getSalonCustomersSync(altId).filter((c) => c.id !== customerId);
    setSalonCustomersSync(altId, currentAlt);
  }

  // 2. Soft delete su Cloud Firestore (marcatura isDeleted e deletedAt con Outbox)
  const delIso = new Date().toISOString();
  try {
    const docRef = doc(db, "saloni", tid, "clienti", customerId);
    await setDoc(docRef, { isDeleted: true, deletedAt: delIso }, { merge: true });
    if (altId) {
      const altDocRef = doc(db, "saloni", altId, "clienti", customerId);
      await setDoc(altDocRef, { isDeleted: true, deletedAt: delIso }, { merge: true });
    }
  } catch (fsErr) {
    console.warn("Nota eliminazione cliente Firestore (accodamento Outbox):", fsErr);
    await enqueueOutboxMutation(tid, {
      entity: "CUSTOMER",
      operation: "DELETE",
      payload: { id: customerId },
      timestamp: delIso
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }

  return true;
}

/**
 * Assicura l'esistenza di un'anagrafica cliente legata specificamente a questo salone
 * per le prenotazioni online (evita ID demo hardcoded e garantisce isolamento tenant e zero duplicati)
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

  // Cerca prima tra i clienti già presenti per questo salone usando isSameCustomer
  const existing = await fetchSalonCustomers(tid, altId || undefined);

  const match = existing.find((c) =>
    isSameCustomer(c, {
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      phone: clientData.phone,
      email: clientData.email
    })
  );

  if (match) {
    return match;
  }

  // Se non esiste ancora per questo salone, crealo associandolo sia al tenantId che ad alternateId
  return await saveSalonCustomer(
    tid,
    {
      id: clientData.uid || generateCustomerUuid(),
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      phone: clientData.phone,
      email: clientData.email || null,
      technicalNotes: "Cliente registrato tramite prenotazione online Trimmy"
    },
    altId || undefined
  );
}

