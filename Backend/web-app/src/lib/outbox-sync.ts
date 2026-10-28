import { db, dataConnect } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  deleteDoc 
} from "firebase/firestore";
import { 
  createAppointment, 
  updateAppointmentStatus, 
  deleteAppointment, 
  createCustomer 
} from "../dataconnect-generated";
import { getSalonTenantId } from "./tenant-helper";

export type OutboxEntity = "APPOINTMENT" | "CUSTOMER" | "SERVICE";
export type OutboxOperation = "CREATE" | "UPDATE" | "DELETE" | "STATUS_UPDATE";

export interface OutboxMutation {
  id: string;
  tenantId: string;
  entity: OutboxEntity;
  operation: OutboxOperation;
  payload: any;
  timestamp: string; // ISO per Last-Write-Wins (LWW)
  retries: number;
  maxRetries: number;
  lastError?: string;
  status: "PENDING" | "PROCESSING" | "FAILED" | "COMPLETED";
  createdAt: string;
}

const OUTBOX_KEY_PREFIX = "trimmy_outbox_queue_";
const LAST_SYNC_KEY_PREFIX = "trimmy_last_sync_";

/**
 * Lettura della coda outbox da cache locale
 */
export function getOutboxQueue(tenantId: string): OutboxMutation[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const tid = getSalonTenantId(tenantId);
    const raw = localStorage.getItem(`${OUTBOX_KEY_PREFIX}${tid}`);
    if (!raw) return [];
    return JSON.parse(raw) as OutboxMutation[];
  } catch (e) {
    console.warn("Errore lettura outbox queue:", e);
    return [];
  }
}

/**
 * Salvataggio della coda outbox in cache locale
 */
export function saveOutboxQueue(tenantId: string, queue: OutboxMutation[]): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    const tid = getSalonTenantId(tenantId);
    localStorage.setItem(`${OUTBOX_KEY_PREFIX}${tid}`, JSON.stringify(queue));
    notifySyncStatus(tid);
  } catch (e) {
    console.warn("Errore scrittura outbox queue:", e);
  }
}

/**
 * Aggiunge un'operazione fallita o offline nella coda outbox di retry
 */
export async function enqueueOutboxMutation(
  tenantId: string,
  mutation: {
    entity: OutboxEntity;
    operation: OutboxOperation;
    payload: any;
    timestamp?: string;
  }
): Promise<OutboxMutation> {
  const tid = getSalonTenantId(tenantId);
  const queue = getOutboxQueue(tid);
  
  const mutationItem: OutboxMutation = {
    id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    tenantId: tid,
    entity: mutation.entity,
    operation: mutation.operation,
    payload: mutation.payload,
    timestamp: mutation.timestamp || new Date().toISOString(),
    retries: 0,
    maxRetries: 5,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  // Se c'è già una mutazione pending per la stessa entità e id, aggiorna con LWW
  const entityId = mutation.payload?.id;
  const filteredQueue = queue.filter((item) => {
    if (entityId && item.payload?.id === entityId && item.entity === mutation.entity) {
      // Sostituisce solo se il nuovo è più recente (LWW)
      return new Date(item.timestamp).getTime() > new Date(mutationItem.timestamp).getTime();
    }
    return true;
  });

  const updatedQueue = [...filteredQueue, mutationItem];
  saveOutboxQueue(tid, updatedQueue);

  // Backup opzionale su Firestore outbox
  try {
    const docRef = doc(db, "saloni", tid, "sync_outbox", mutationItem.id);
    await setDoc(docRef, mutationItem, { merge: true });
  } catch (err) {
    console.warn("Nota outbox backup su Firestore:", err);
  }

  return mutationItem;
}

/**
 * Esegue l'elaborazione della coda di retry Outbox verso DataConnect (PostgreSQL) e Cloud Firestore
 */
export async function processOutboxQueue(tenantId: string): Promise<{
  processed: number;
  remaining: number;
  errors: number;
}> {
  const tid = getSalonTenantId(tenantId);
  const queue = getOutboxQueue(tid);

  if (queue.length === 0) {
    return { processed: 0, remaining: 0, errors: 0 };
  }

  // Verifica connettività
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, remaining: queue.length, errors: 0 };
  }

  let processed = 0;
  let errors = 0;
  const remainingQueue: OutboxMutation[] = [];

  for (const item of queue) {
    try {
      if (item.entity === "APPOINTMENT") {
        if (item.operation === "CREATE" || item.operation === "UPDATE") {
          const appt = item.payload;
          // Invia a Cloud SQL DataConnect
          try {
            await createAppointment(dataConnect, {
              tenantId: tid,
              customerId: appt.customerId,
              serviceId: appt.serviceId,
              staffId: appt.staffId,
              startTime: appt.startTime,
              endTime: appt.endTime,
              status: appt.status || "CONFIRMED"
            });
          } catch (dcErr) {
            console.warn("Outbox retry DataConnect appt create:", dcErr);
          }

          // Invia a Cloud Firestore con timestamp LWW
          const docRef = doc(db, "saloni", tid, "appuntamenti", appt.id);
          await setDoc(docRef, { ...appt, updatedAt: item.timestamp }, { merge: true });

        } else if (item.operation === "STATUS_UPDATE") {
          const { id, status } = item.payload;
          try {
            await updateAppointmentStatus(dataConnect, { id, status });
          } catch (dcErr) {
            console.warn("Outbox retry DataConnect appt status:", dcErr);
          }

          const docRef = doc(db, "saloni", tid, "appuntamenti", id);
          await setDoc(docRef, { status, updatedAt: item.timestamp }, { merge: true });

        } else if (item.operation === "DELETE") {
          const { id } = item.payload;
          // Soft delete con flag isDeleted e deletedAt
          const docRef = doc(db, "saloni", tid, "appuntamenti", id);
          await setDoc(docRef, { 
            isDeleted: true, 
            deletedAt: item.timestamp,
            status: "CANCELLED" 
          }, { merge: true });

          try {
            await deleteAppointment(dataConnect, { id });
          } catch (dcErr) {
            console.warn("Outbox retry DataConnect appt delete:", dcErr);
          }
        }
      } else if (item.entity === "CUSTOMER") {
        if (item.operation === "CREATE" || item.operation === "UPDATE") {
          const customer = item.payload;
          try {
            await createCustomer(dataConnect, {
              tenantId: tid,
              firstName: customer.firstName,
              lastName: customer.lastName,
              phone: customer.phone,
              email: customer.email || undefined,
              birthday: customer.birthday || undefined,
              technicalNotes: customer.technicalNotes || undefined
            });
          } catch (dcErr) {
            console.warn("Outbox retry DataConnect customer create:", dcErr);
          }

          const docRef = doc(db, "saloni", tid, "clienti", customer.id);
          await setDoc(docRef, { ...customer, updatedAt: item.timestamp }, { merge: true });

        } else if (item.operation === "DELETE") {
          const { id } = item.payload;
          // Soft delete cliente
          const docRef = doc(db, "saloni", tid, "clienti", id);
          await setDoc(docRef, { isDeleted: true, deletedAt: item.timestamp }, { merge: true });
        }
      }

      // Rimuovi da Firestore outbox se presente
      try {
        await deleteDoc(doc(db, "saloni", tid, "sync_outbox", item.id));
      } catch {}

      processed++;
    } catch (err: any) {
      errors++;
      item.retries += 1;
      item.lastError = err?.message || "Errore sconosciuto";
      
      // Se non ha superato il limite di tentativi, conserva nella coda
      if (item.retries < item.maxRetries) {
        remainingQueue.push(item);
      } else {
        item.status = "FAILED";
        console.error(`Outbox mutation ${item.id} fallita definitivamente dopo ${item.retries} tentativi.`);
      }
    }
  }

  saveOutboxQueue(tid, remainingQueue);

  if (typeof window !== "undefined") {
    localStorage.setItem(`${LAST_SYNC_KEY_PREFIX}${tid}`, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }

  return {
    processed,
    remaining: remainingQueue.length,
    errors
  };
}

/**
 * Notifica ai componenti l'aggiornamento dello stato di sincronizzazione
 */
function notifySyncStatus(tenantId: string): void {
  if (typeof window === "undefined") return;
  const tid = getSalonTenantId(tenantId);
  const queue = getOutboxQueue(tid);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const lastSyncTime = localStorage.getItem(`${LAST_SYNC_KEY_PREFIX}${tid}`) || undefined;

  window.dispatchEvent(
    new CustomEvent("trimmy-sync-status-changed", {
      detail: {
        isOnline,
        pendingCount: queue.length,
        lastSyncTime
      }
    })
  );
}

/**
 * Restituisce lo stato corrente della sincronizzazione
 */
export function getSyncStatus(tenantId: string): {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime?: string;
} {
  const tid = getSalonTenantId(tenantId);
  const queue = getOutboxQueue(tid);
  const isOnline = typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.onLine : true;
  const lastSyncTime = typeof window !== "undefined" 
    ? localStorage.getItem(`${LAST_SYNC_KEY_PREFIX}${tid}`) || undefined 
    : undefined;

  return {
    isOnline,
    pendingCount: queue.length,
    lastSyncTime
  };
}

/**
 * Inizializza i listener per gestire la transizione online/offline e svuotare la coda outbox
 */
export function initOnlineSyncListener(tenantId: string): () => void {
  if (typeof window === "undefined") return () => {};

  const tid = getSalonTenantId(tenantId);

  const handleOnline = () => {
    notifySyncStatus(tid);
    // Avvia svuotamento coda con un piccolo ritardo per consentire la stabilizzazione della rete
    setTimeout(() => {
      processOutboxQueue(tid);
    }, 1500);
  };

  const handleOffline = () => {
    notifySyncStatus(tid);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Esegui un controllo iniziale
  notifySyncStatus(tid);
  if (navigator.onLine && getOutboxQueue(tid).length > 0) {
    processOutboxQueue(tid);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Riconciliazione Tri-Source (PostgreSQL ↔ Firestore ↔ LocalStorage) con Last-Write-Wins
 */
export async function reconcileTriSourceData(tenantId: string): Promise<{
  syncedCount: number;
  fixedDrift: number;
}> {
  const tid = getSalonTenantId(tenantId);
  let fixedDrift = 0;
  let syncedCount = 0;

  try {
    // 1. Svuota prima la coda outbox
    const outboxRes = await processOutboxQueue(tid);
    fixedDrift += outboxRes.processed;

    // 2. Lettura Appuntamenti da Cloud Firestore
    const fsApptsSnap = await getDocs(collection(db, "saloni", tid, "appuntamenti"));
    const fsAppts = fsApptsSnap.docs.map((d) => d.data());

    // 3. Lettura LocalStorage
    const localRaw = typeof window !== "undefined" ? localStorage.getItem(`trimmy_salon_appointments_${tid}`) : null;
    const localAppts: any[] = localRaw ? JSON.parse(localRaw) : [];

    // 4. Mappa LWW
    const mergedMap = new Map<string, any>();

    localAppts.forEach((la) => {
      if (la && la.id) mergedMap.set(la.id, la);
    });

    fsAppts.forEach((fa: any) => {
      if (!fa || !fa.id) return;
      const existing = mergedMap.get(fa.id);
      if (!existing) {
        mergedMap.set(fa.id, fa);
        fixedDrift++;
      } else {
        // Applica Last-Write-Wins
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const firestoreTime = new Date(fa.updatedAt || fa.createdAt || 0).getTime();
        if (firestoreTime > existingTime) {
          mergedMap.set(fa.id, fa);
          fixedDrift++;
        }
      }
    });

    const reconciledList = Array.from(mergedMap.values()).filter((item) => !item.isDeleted);

    // 5. Salva in LocalStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(`trimmy_salon_appointments_${tid}`, JSON.stringify(reconciledList));
      localStorage.setItem(`${LAST_SYNC_KEY_PREFIX}${tid}`, new Date().toISOString());
      window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
    }

    syncedCount = reconciledList.length;
    notifySyncStatus(tid);

  } catch (err) {
    console.error("Errore riconciliazione Tri-Source:", err);
  }

  return { syncedCount, fixedDrift };
}
