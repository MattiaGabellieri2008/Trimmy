import { db, dataConnect } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { 
  createAppointment, 
  getDailyAppointments, 
  deleteAppointment,
  updateAppointmentStatus,
  GetDailyAppointmentsData 
} from "../dataconnect-generated";
import { getSalonTenantId } from "./tenant-helper";
import { parseDateSafe } from "./date-utils";

export interface UnifiedAppointmentItem {
  id: string;
  tenantId: string;
  salonRawId: string;
  salonName: string;
  customerId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
  };
  staffId: string;
  staff: {
    id: string;
    fullName: string;
    role?: string;
  };
  startTime: string; // ISO
  endTime: string;   // ISO
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  createdAt: string;
  notes?: string;
  price: number;
}

const STORAGE_PREFIX = "trimmy_salon_appointments_";

/**
 * Lettura sincrona dalla cache locale del salone
 */
export function getSalonAppointmentsSync(tenantId: string): UnifiedAppointmentItem[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tenantId}`);
    if (!raw) return [];
    return JSON.parse(raw) as UnifiedAppointmentItem[];
  } catch (e) {
    console.warn("Errore lettura locale appuntamenti salone:", e);
    return [];
  }
}

/**
 * Scrittura sincrona nella cache locale del salone
 */
export function setSalonAppointmentsSync(tenantId: string, appts: UnifiedAppointmentItem[]): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(appts));
  } catch (e) {
    console.warn("Errore scrittura locale appuntamenti salone:", e);
  }
}

/**
 * Salva un appuntamento sia su Cloud Firestore che su DataConnect e LocalStorage
 * garantendo la visibilità immediata nell'Agenda del salone.
 */
export async function saveSalonAppointment(appt: UnifiedAppointmentItem): Promise<void> {
  const tenantId = getSalonTenantId(appt.tenantId || appt.salonRawId);
  const rawId = appt.salonRawId || appt.tenantId;

  const normalized: UnifiedAppointmentItem = {
    ...appt,
    tenantId,
    salonRawId: rawId,
    status: appt.status || "CONFIRMED",
    createdAt: appt.createdAt || new Date().toISOString()
  };

  // 1. Salva in LocalStorage per entrambi gli ID (UUID tenant e Raw UID)
  const currentTen = getSalonAppointmentsSync(tenantId);
  setSalonAppointmentsSync(tenantId, [normalized, ...currentTen.filter((a) => a.id !== normalized.id)]);

  if (rawId && rawId !== tenantId) {
    const currentRaw = getSalonAppointmentsSync(rawId);
    setSalonAppointmentsSync(rawId, [normalized, ...currentRaw.filter((a) => a.id !== normalized.id)]);
  }

  // 2. Salva in Cloud Firestore sotto la sottocollezione del salone (/saloni/{tenantId}/appuntamenti/{id})
  try {
    const tenantDocRef = doc(db, "saloni", tenantId, "appuntamenti", normalized.id);
    await setDoc(tenantDocRef, normalized, { merge: true });

    if (rawId && rawId !== tenantId) {
      const rawDocRef = doc(db, "saloni", rawId, "appuntamenti", normalized.id);
      await setDoc(rawDocRef, normalized, { merge: true });
    }

    // Salva anche nella collezione globale /appointments per ridondanza
    const globalDocRef = doc(db, "appointments", normalized.id);
    await setDoc(globalDocRef, normalized, { merge: true });
  } catch (fsErr) {
    console.warn("Nota salvataggio appuntamento Firestore:", fsErr);
  }

  // 3. Salva in Cloud SQL DataConnect (se disponibile)
  try {
    await createAppointment(dataConnect, {
      tenantId,
      customerId: normalized.customerId,
      serviceId: normalized.serviceId,
      staffId: normalized.staffId,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      status: normalized.status
    });
  } catch (dcErr) {
    console.warn("Nota salvataggio appuntamento DataConnect:", dcErr);
  }

  // Notifica la finestra dell'aggiornamento dati
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

/**
 * Recupera tutti gli appuntamenti di un salone per l'intervallo temporale richiesto:
 * Combina Firestore (/saloni/{id}/appuntamenti), DataConnect (Postgres) e cache locale.
 */
export async function fetchSalonAppointments(
  tenantId: string,
  rawUid?: string,
  range?: { start: Date; end: Date }
): Promise<GetDailyAppointmentsData["appointments"]> {
  if (!tenantId && !rawUid) return [];

  const tid = getSalonTenantId(tenantId || rawUid);
  const rid = rawUid || tenantId;
  const foundMap = new Map<string, UnifiedAppointmentItem>();

  // Helper per eseguire query temporale su subcollection con fallback
  async function fetchSubColWithRange(colPath: string[]) {
    const colRef = collection(db, colPath[0], colPath[1], colPath[2]);
    if (range && range.start && range.end) {
      // Buffer di 2 giorni prima e dopo per sicurezza sui fusi orari
      const startIso = new Date(range.start.getTime() - 2 * 86400000).toISOString();
      const endIso = new Date(range.end.getTime() + 2 * 86400000).toISOString();
      try {
        const qRange = query(
          colRef,
          where("startTime", ">=", startIso),
          where("startTime", "<=", endIso)
        );
        return await getDocs(qRange);
      } catch (rangeErr) {
        // Se manca l'indice composito su startTime, esegue fallback su lettura ordinaria
        return await getDocs(colRef);
      }
    }
    return await getDocs(colRef);
  }

  // 1. Prova da Cloud Firestore: /saloni/{tid}/appuntamenti
  try {
    const snap = await fetchSubColWithRange(["saloni", tid, "appuntamenti"]);
    snap.forEach((d) => {
      const data = d.data() as UnifiedAppointmentItem;
      if (data && data.id && data.startTime) {
        foundMap.set(data.id, data);
      }
    });
  } catch (e) {
    console.warn("Nota lettura appuntamenti Firestore tid:", e);
  }

  // 1b. Prova da Cloud Firestore con rawUid se diverso
  if (rid && rid !== tid) {
    try {
      const snapRaw = await fetchSubColWithRange(["saloni", rid, "appuntamenti"]);
      snapRaw.forEach((d) => {
        const data = d.data() as UnifiedAppointmentItem;
        if (data && data.id && data.startTime) {
          foundMap.set(data.id, data);
        }
      });
    } catch (e) {
      console.warn("Nota lettura appuntamenti Firestore rid:", e);
    }
  }

  // 1c. Prova da collezione globale /appointments
  try {
    const qGlobal = query(collection(db, "appointments"), where("tenantId", "in", [tid, rid]));
    const snapGlobal = await getDocs(qGlobal);
    snapGlobal.forEach((d) => {
      const data = d.data() as UnifiedAppointmentItem;
      if (data && data.id && data.startTime) {
        foundMap.set(data.id, data);
      }
    });
  } catch (e) {
    // query 'in' might fail if no index, not critical
  }

  // 2. Prova da Cloud SQL DataConnect
  try {
    const dcRes = await getDailyAppointments(dataConnect, {
      tenantId: tid,
      todayStart: range ? range.start.toISOString() : new Date(2020, 0, 1).toISOString(),
      todayEnd: range ? range.end.toISOString() : new Date(2035, 11, 31).toISOString()
    });

    if (dcRes.data?.appointments && dcRes.data.appointments.length > 0) {
      dcRes.data.appointments.forEach((a) => {
        foundMap.set(a.id, {
          id: a.id,
          tenantId: tid,
          salonRawId: rid,
          salonName: "Salone",
          customerId: a.customer.id,
          customer: {
            id: a.customer.id,
            firstName: a.customer.firstName,
            lastName: a.customer.lastName,
            phone: a.customer.phone
          },
          serviceId: a.service.id,
          service: {
            id: a.service.id,
            name: a.service.name,
            durationMinutes: a.service.durationMinutes,
            price: a.service.price
          },
          staffId: a.staff.id,
          staff: {
            id: a.staff.id,
            fullName: a.staff.fullName
          },
          startTime: a.startTime,
          endTime: a.endTime,
          status: (a.status as any) || "CONFIRMED",
          createdAt: a.startTime,
          price: a.service.price
        });
      });
    }
  } catch (dcErr) {
    console.warn("Nota lettura appuntamenti DataConnect:", dcErr);
  }

  // 3. Fallback da LocalStorage del salone
  const localList = [...getSalonAppointmentsSync(tid), ...getSalonAppointmentsSync(rid)];
  localList.forEach((item) => {
    if (!foundMap.has(item.id)) {
      foundMap.set(item.id, item);
    }
  });

  // 4. Scansiona LocalStorage per appuntamenti cliente memorizzati in questo browser
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("trimmy_client_appts_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const clientAppts = JSON.parse(raw);
            if (Array.isArray(clientAppts)) {
              clientAppts.forEach((ca: any) => {
                const matchSalon = ca.salonId === rid || ca.salonId === tid || ca.tenantId === tid || ca.tenantId === rid;
                if (matchSalon && ca.id && !foundMap.has(ca.id)) {
                  foundMap.set(ca.id, {
                    id: ca.id,
                    tenantId: tid,
                    salonRawId: rid,
                    salonName: ca.salonName || "Salone",
                    customerId: ca.customerId || "client-" + (ca.customerPhone || "online"),
                    customer: {
                      id: ca.customerId || "client-" + (ca.customerPhone || "online"),
                      firstName: ca.customerName ? ca.customerName.split(" ")[0] : "Cliente",
                      lastName: ca.customerName ? ca.customerName.split(" ").slice(1).join(" ") || "Online" : "Trimmy",
                      phone: ca.customerPhone || "320 000 0000",
                      email: ca.customerEmail || null
                    },
                    serviceId: ca.serviceId || "srv-default",
                    service: {
                      id: ca.serviceId || "srv-default",
                      name: ca.serviceName || "Trattamento",
                      durationMinutes: ca.durationMinutes || 30,
                      price: ca.price || 25
                    },
                    staffId: ca.staffId || "any",
                    staff: {
                      id: ca.staffId || "any",
                      fullName: ca.staffName || "Staff Disponibile"
                    },
                    startTime: ca.startTime,
                    endTime: ca.endTime,
                    status: ca.status || "CONFIRMED",
                    createdAt: ca.createdAt || ca.startTime,
                    price: ca.price || 25
                  });
                }
              });
            }
          }
        }
      }
    } catch (scanErr) {
      console.warn("Nota scansione appuntamenti client-side:", scanErr);
    }
  }

  // Filtra per range temporale (se fornito)
  let allItems = Array.from(foundMap.values());
  if (range) {
    allItems = allItems.filter((appt) => {
      const st = parseDateSafe(appt.startTime);
      return st >= range.start && st <= range.end;
    });
  }

  // Ordina per orario di inizio crescente
  allItems.sort((a, b) => parseDateSafe(a.startTime).getTime() - parseDateSafe(b.startTime).getTime());

  // Converte nel formato esatto atteso da GetDailyAppointmentsData["appointments"]
  return allItems.map((item) => ({
    id: item.id,
    startTime: item.startTime,
    endTime: item.endTime,
    status: item.status,
    customer: {
      id: item.customer.id,
      firstName: item.customer.firstName,
      lastName: item.customer.lastName,
      phone: item.customer.phone
    },
    staff: {
      id: item.staff.id,
      fullName: item.staff.fullName
    },
    service: {
      id: item.service.id,
      name: item.service.name,
      durationMinutes: item.service.durationMinutes,
      price: item.service.price
    }
  }));
}

/**
 * Aggiorna lo stato di un appuntamento sincronizzando tutte le fonti
 */
export async function updateSalonAppointmentStatus(
  tenantId: string,
  rawUid: string | undefined,
  apptId: string,
  newStatus: "CONFIRMED" | "CANCELLED" | "COMPLETED" | string
): Promise<void> {
  const tid = getSalonTenantId(tenantId || rawUid);
  const rid = rawUid || tenantId;

  // 1. LocalStorage salone
  const tenList = getSalonAppointmentsSync(tid);
  setSalonAppointmentsSync(tid, tenList.map((a) => a.id === apptId ? { ...a, status: newStatus as any } : a));
  if (rid && rid !== tid) {
    const rawList = getSalonAppointmentsSync(rid);
    setSalonAppointmentsSync(rid, rawList.map((a) => a.id === apptId ? { ...a, status: newStatus as any } : a));
  }

  // 2. LocalStorage clienti memorizzati nel browser
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("trimmy_client_appts_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const updated = arr.map((item: any) => item.id === apptId ? { ...item, status: newStatus } : item);
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Nota aggiornamento locale client:", e);
    }
  }

  // 3. Firestore
  try {
    await updateDoc(doc(db, "saloni", tid, "appuntamenti", apptId), { status: newStatus });
  } catch (e) {}
  if (rid && rid !== tid) {
    try {
      await updateDoc(doc(db, "saloni", rid, "appuntamenti", apptId), { status: newStatus });
    } catch (e) {}
  }
  try {
    await updateDoc(doc(db, "appointments", apptId), { status: newStatus });
  } catch (e) {}

  // 4. DataConnect
  try {
    await updateAppointmentStatus(dataConnect, { id: apptId, status: newStatus });
  } catch (e) {
    console.warn("Nota aggiornamento status DataConnect:", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

/**
 * Elimina un appuntamento rimuovendolo da tutte le sorgenti
 */
export async function deleteSalonAppointment(
  tenantId: string,
  rawUid: string | undefined,
  apptId: string
): Promise<void> {
  const tid = getSalonTenantId(tenantId || rawUid);
  const rid = rawUid || tenantId;

  // 1. LocalStorage salone
  const tenList = getSalonAppointmentsSync(tid);
  setSalonAppointmentsSync(tid, tenList.filter((a) => a.id !== apptId));
  if (rid && rid !== tid) {
    const rawList = getSalonAppointmentsSync(rid);
    setSalonAppointmentsSync(rid, rawList.filter((a) => a.id !== apptId));
  }

  // 2. LocalStorage clienti
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("trimmy_client_appts_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const updated = arr.filter((item: any) => item.id !== apptId);
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Nota cancellazione locale client:", e);
    }
  }

  // 3. Firestore
  try {
    await deleteDoc(doc(db, "saloni", tid, "appuntamenti", apptId));
  } catch (e) {}
  if (rid && rid !== tid) {
    try {
      await deleteDoc(doc(db, "saloni", rid, "appuntamenti", apptId));
    } catch (e) {}
  }
  try {
    await deleteDoc(doc(db, "appointments", apptId));
  } catch (e) {}

  // 4. DataConnect
  try {
    await deleteAppointment(dataConnect, { id: apptId });
  } catch (e) {
    console.warn("Nota cancellazione DataConnect:", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

