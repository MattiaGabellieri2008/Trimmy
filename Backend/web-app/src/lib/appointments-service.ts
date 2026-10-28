import { db, dataConnect } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  deleteDoc,
  updateDoc,
  runTransaction
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
import { sendNotification } from "./notifications-service";
import { enqueueOutboxMutation } from "./outbox-sync";

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
  confirmationSent?: boolean;
  reminderSent?: boolean;
  reviewRequestSent?: boolean;
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

// ─── CONCURRENCY CONTROL & ANTI DOUBLE-BOOKING ───

export class SlotConflictError extends Error {
  code = "SLOT_CONFLICT";
  conflictingAppointmentId?: string;
  constructor(message: string, conflictingAppointmentId?: string) {
    super(message);
    this.name = "SlotConflictError";
    this.conflictingAppointmentId = conflictingAppointmentId;
  }
}

export interface ScheduleLockSlot {
  appointmentId: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  status: string;    // "CONFIRMED" | "CANCELLED"
  staffId?: string;
  customerName?: string;
  serviceName?: string;
}

export interface DayScheduleLock {
  staffId: string;
  date: string; // YYYY-MM-DD
  slots: ScheduleLockSlot[];
  updatedAt: string;
}

/**
 * Converte un timestamp ISO o Date nella data locale formato 'YYYY-MM-DD'
 */
export function getLocalDateString(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? parseDateSafe(isoOrDate) : isoOrDate;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Verifica se due intervalli temporali si sovrappongono
 */
export function isTimeRangeOverlapping(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Recupera gli intervalli già occupati per un operatore e data specifica
 * Utilizzato dall'interfaccia (wizard e calendario) per mostrare gli slot disabilitati
 */
export async function getOccupiedSlotsForStaff(
  tenantId: string,
  staffId: string,
  dateStr: string
): Promise<{ startTime: string; endTime: string }[]> {
  const tid = getSalonTenantId(tenantId);
  const occupiedMap = new Map<string, { startTime: string; endTime: string }>();

  // 1. Prova da Cloud Firestore (schedule_locks)
  try {
    const lockRef = doc(db, "saloni", tid, "schedule_locks", `${staffId}_${dateStr}`);
    const snap = await getDoc(lockRef);
    if (snap.exists()) {
      const data = snap.data() as DayScheduleLock;
      if (Array.isArray(data.slots)) {
        data.slots
          .filter((s) => s.status !== "CANCELLED")
          .forEach((s) => occupiedMap.set(`${s.startTime}_${s.endTime}`, { startTime: s.startTime, endTime: s.endTime }));
      }
    }
  } catch (e) {
    console.warn("Nota lettura schedule_locks:", e);
  }

  // 2. Unisci gli appuntamenti presenti in cache locale del salone
  const localAppts = getSalonAppointmentsSync(tid);
  localAppts.forEach((a) => {
    if (a.status === "CANCELLED") return;
    if (staffId && staffId !== "any" && a.staffId !== staffId) return;
    const apptDateStr = getLocalDateString(a.startTime);
    if (apptDateStr === dateStr) {
      occupiedMap.set(`${a.startTime}_${a.endTime}`, { startTime: a.startTime, endTime: a.endTime });
    }
  });

  return Array.from(occupiedMap.values());
}

/**
 * Rilascia uno slot lock (in caso di cancellazione o eliminazione appuntamento)
 */
export async function releaseSlotLock(
  tenantId: string,
  staffId: string,
  dateStr: string,
  appointmentId: string
): Promise<void> {
  try {
    const tid = getSalonTenantId(tenantId);
    const lockRef = doc(db, "saloni", tid, "schedule_locks", `${staffId}_${dateStr}`);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(lockRef);
      if (snap.exists()) {
        const data = snap.data() as DayScheduleLock;
        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const updatedSlots = currentSlots.map((s) =>
          s.appointmentId === appointmentId ? { ...s, status: "CANCELLED" } : s
        );
        tx.update(lockRef, { slots: updatedSlots, updatedAt: new Date().toISOString() });
      }
    });
  } catch (e) {
    console.warn("Nota rilascio slot lock:", e);
  }
}

/**
 * Salva un appuntamento con TRANSAZIONE ATOMICA ACID (Firestore runTransaction).
 * Blocca alla radice qualsiasi tentativo di double-booking contemporaneo sullo stesso operatore.
 * Se un altro cliente ha appena confermato lo stesso orario, la transazione fallisce lanciando SlotConflictError.
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

  const staffId = normalized.staffId || "staff-general";
  const dateStr = getLocalDateString(normalized.startTime);
  const lockKey = `${staffId}_${dateStr}`;
  const lockDocRef = doc(db, "saloni", tenantId, "schedule_locks", lockKey);
  const tenantDocRef = doc(db, "saloni", tenantId, "appuntamenti", normalized.id);

  // ─── TRANSAZIONE ATOMICA DI CONCORRENZA (ACID) ───
  await runTransaction(db, async (transaction) => {
    // 1. Lettura dello stato corrente degli slot occupati per questo operatore e data
    const lockSnap = await transaction.get(lockDocRef);
    let currentSlots: ScheduleLockSlot[] = [];

    if (lockSnap.exists()) {
      const lockData = lockSnap.data() as DayScheduleLock;
      if (Array.isArray(lockData.slots)) {
        currentSlots = lockData.slots;
      }
    } else {
      // Inizializza con appuntamenti già noti in cache locale
      const localExisting = getSalonAppointmentsSync(tenantId);
      currentSlots = localExisting
        .filter((a) => {
          if (a.status === "CANCELLED") return false;
          if (a.staffId !== staffId) return false;
          return getLocalDateString(a.startTime) === dateStr;
        })
        .map((a) => ({
          appointmentId: a.id,
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status || "CONFIRMED",
          staffId: a.staffId,
          customerName: a.customer ? `${a.customer.firstName} ${a.customer.lastName}` : undefined,
          serviceName: a.service?.name
        }));
    }

    // 2. Controllo di Conflitto di Orario
    const isCancelled = normalized.status === "CANCELLED";
    if (!isCancelled) {
      const conflictingSlot = currentSlots.find((slot) => {
        // Ignora lo stesso appuntamento se stiamo aggiornando
        if (slot.appointmentId === normalized.id) return false;
        // Ignora appuntamenti annullati
        if (slot.status === "CANCELLED") return false;

        return isTimeRangeOverlapping(
          normalized.startTime,
          normalized.endTime,
          slot.startTime,
          slot.endTime
        );
      });

      if (conflictingSlot) {
        const conflictStart = new Date(conflictingSlot.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
        const conflictEnd = new Date(conflictingSlot.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
        throw new SlotConflictError(
          `L'operatore selezionato è già occupato tra le ${conflictStart} e le ${conflictEnd}. Seleziona un altro orario o un altro membro del team.`,
          conflictingSlot.appointmentId
        );
      }
    }

    // 3. Aggiorna lo slot lock atomico
    const updatedSlots: ScheduleLockSlot[] = [
      ...currentSlots.filter((s) => s.appointmentId !== normalized.id),
      {
        appointmentId: normalized.id,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        status: normalized.status,
        staffId: normalized.staffId,
        customerName: normalized.customer ? `${normalized.customer.firstName} ${normalized.customer.lastName}` : undefined,
        serviceName: normalized.service?.name
      }
    ];

    transaction.set(lockDocRef, {
      staffId,
      date: dateStr,
      slots: updatedSlots,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 4. Scrivi l'appuntamento nella sottocollezione del salone
    transaction.set(tenantDocRef, normalized, { merge: true });

    if (rawId && rawId !== tenantId) {
      const rawDocRef = doc(db, "saloni", rawId, "appuntamenti", normalized.id);
      transaction.set(rawDocRef, normalized, { merge: true });
    }

    // 5. Scrivi nella collezione globale per ridondanza
    const globalDocRef = doc(db, "appointments", normalized.id);
    transaction.set(globalDocRef, normalized, { merge: true });
  });

  // 6. Aggiorna cache locale per reattività immediata a 0ms
  const currentTen = getSalonAppointmentsSync(tenantId);
  setSalonAppointmentsSync(tenantId, [normalized, ...currentTen.filter((a) => a.id !== normalized.id)]);

  if (rawId && rawId !== tenantId) {
    const currentRaw = getSalonAppointmentsSync(rawId);
    setSalonAppointmentsSync(rawId, [normalized, ...currentRaw.filter((a) => a.id !== normalized.id)]);
  }

  // 7. Salva in Cloud SQL DataConnect (con fallback automatico a coda Outbox)
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Client Offline");
    }
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
    console.warn("Nota salvataggio appuntamento DataConnect (accodamento Outbox):", dcErr);
    await enqueueOutboxMutation(tenantId, {
      entity: "APPOINTMENT",
      operation: "CREATE",
      payload: normalized,
      timestamp: normalized.createdAt
    });
  }

  // 8. Invia notifica automatica di conferma (se il cliente ha un telefono)
  if (normalized.customer?.phone && !normalized.confirmationSent && normalized.status !== "CANCELLED") {
    const d = parseDateSafe(normalized.startTime);
    const dateStr = d ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
    const timeStr = d ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

    sendNotification({
      tenantId,
      salonName: normalized.salonName || "Salone",
      appointmentId: normalized.id,
      customerName: `${normalized.customer.firstName} ${normalized.customer.lastName}`,
      customerPhone: normalized.customer.phone,
      type: "CONFIRMATION",
      templateParams: {
        servizio: normalized.service?.name,
        operatore: normalized.staff?.fullName,
        data: dateStr,
        ora: timeStr
      }
    }).catch((e) => console.warn("Nota invio notifica automatica conferma:", e));
    normalized.confirmationSent = true;
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

  // Filtra per range temporale ed esclude soft-deleted (isDeleted)
  let allItems = Array.from(foundMap.values()).filter((appt: any) => !appt.isDeleted);
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

  // 3b. Se l'appuntamento viene annullato, rilascia lo slot lock per liberare l'orario
  const targetAppt = tenList.find((a) => a.id === apptId) || (rid ? getSalonAppointmentsSync(rid).find((a) => a.id === apptId) : undefined);
  if (newStatus === "CANCELLED" && targetAppt) {
    const dateStr = getLocalDateString(targetAppt.startTime);
    releaseSlotLock(tid, targetAppt.staffId, dateStr, apptId).catch((err) => console.warn("Nota rilascio slot lock:", err));
  }

  // 4. DataConnect & Outbox
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Client Offline");
    }
    await updateAppointmentStatus(dataConnect, { id: apptId, status: newStatus as any });
  } catch (dcErr) {
    console.warn("Nota aggiornamento status DataConnect (accodamento Outbox):", dcErr);
    await enqueueOutboxMutation(tid, {
      entity: "APPOINTMENT",
      operation: "STATUS_UPDATE",
      payload: { id: apptId, status: newStatus },
      timestamp: new Date().toISOString()
    });
  }

  // 5. Invia notifica di Cancellazione o Richiesta Recensione (se applicabile)
  try {
    const targetAppt = tenList.find((a) => a.id === apptId) || (rid ? getSalonAppointmentsSync(rid).find((a) => a.id === apptId) : undefined);
    if (targetAppt && targetAppt.customer?.phone) {
      const d = parseDateSafe(targetAppt.startTime);
      const dateStr = d ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
      const timeStr = d ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

      if (newStatus === "CANCELLED") {
        sendNotification({
          tenantId: tid,
          salonName: targetAppt.salonName || "Salone",
          appointmentId: apptId,
          customerName: `${targetAppt.customer.firstName} ${targetAppt.customer.lastName}`,
          customerPhone: targetAppt.customer.phone,
          type: "CANCELLATION",
          templateParams: {
            servizio: targetAppt.service?.name,
            data: dateStr,
            ora: timeStr
          }
        }).catch((err) => console.warn("Nota invio notifica cancellazione:", err));
      } else if (newStatus === "COMPLETED") {
        sendNotification({
          tenantId: tid,
          salonName: targetAppt.salonName || "Salone",
          appointmentId: apptId,
          customerName: `${targetAppt.customer.firstName} ${targetAppt.customer.lastName}`,
          customerPhone: targetAppt.customer.phone,
          type: "REVIEW_REQUEST",
          templateParams: {
            servizio: targetAppt.service?.name,
            data: dateStr,
            ora: timeStr
          }
        }).catch((err) => console.warn("Nota invio notifica richiesta recensione:", err));
      }
    }
  } catch (notifErr) {
    console.warn("Nota dispatch notifica status:", notifErr);
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

  // 3. Firestore Soft Delete (imposta isDeleted e deletedAt per consistenza sicura)
  const delIso = new Date().toISOString();
  try {
    await setDoc(doc(db, "saloni", tid, "appuntamenti", apptId), {
      isDeleted: true,
      deletedAt: delIso,
      status: "CANCELLED"
    }, { merge: true });
  } catch (e) {}
  if (rid && rid !== tid) {
    try {
      await setDoc(doc(db, "saloni", rid, "appuntamenti", apptId), {
        isDeleted: true,
        deletedAt: delIso,
        status: "CANCELLED"
      }, { merge: true });
    } catch (e) {}
  }
  try {
    await setDoc(doc(db, "appointments", apptId), {
      isDeleted: true,
      deletedAt: delIso,
      status: "CANCELLED"
    }, { merge: true });
  } catch (e) {}

  // 3b. Rilascia lo slot lock atomico
  const targetDelAppt = tenList.find((a) => a.id === apptId) || (rid ? getSalonAppointmentsSync(rid).find((a) => a.id === apptId) : undefined);
  if (targetDelAppt) {
    const dateStr = getLocalDateString(targetDelAppt.startTime);
    releaseSlotLock(tid, targetDelAppt.staffId, dateStr, apptId).catch((err) => console.warn("Nota rilascio slot lock:", err));
  }

  // 4. DataConnect & Outbox
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Client Offline");
    }
    await deleteAppointment(dataConnect, { id: apptId });
  } catch (e) {
    console.warn("Nota cancellazione DataConnect (accodamento Outbox):", e);
    await enqueueOutboxMutation(tid, {
      entity: "APPOINTMENT",
      operation: "DELETE",
      payload: { id: apptId },
      timestamp: delIso
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}



/**
 * Riprogramma un appuntamento spostandolo a un nuovo orario, data, operatore o modificandone la durata (resize),
 * gestendo atomicamente il rilascio del vecchio schedule_lock e l'acquisizione del nuovo.
 */
export async function rescheduleSalonAppointment(params: {
  tenantId: string;
  salonRawId?: string;
  appointmentId: string;
  newStartTime: string; // ISO
  newEndTime: string;   // ISO
  newStaffId?: string;
  newStaffName?: string;
  newStaffRole?: string;
  newDurationMinutes?: number;
}): Promise<UnifiedAppointmentItem> {
  const tid = getSalonTenantId(params.tenantId || params.salonRawId);
  const rid = params.salonRawId || params.tenantId;

  // 1. Trova l'appuntamento esistente (cache locale o Firestore)
  const localList = getSalonAppointmentsSync(tid);
  let existing = localList.find((a) => a.id === params.appointmentId);
  if (!existing && rid) {
    existing = getSalonAppointmentsSync(rid).find((a) => a.id === params.appointmentId);
  }

  if (!existing) {
    const snap = await getDoc(doc(db, "saloni", tid, "appuntamenti", params.appointmentId));
    if (snap.exists()) {
      existing = snap.data() as UnifiedAppointmentItem;
    } else {
      throw new Error("Appuntamento da riprogrammare non trovato.");
    }
  }

  const oldStaffId = existing.staffId || "staff-general";
  const oldDateStr = getLocalDateString(existing.startTime);
  const targetStaffId = params.newStaffId || oldStaffId;
  const newDateStr = getLocalDateString(params.newStartTime);

  // 2. Se l'operatore o la data sono cambiati, rilascia lo slot lock precedente
  if (oldStaffId !== targetStaffId || oldDateStr !== newDateStr) {
    await releaseSlotLock(tid, oldStaffId, oldDateStr, params.appointmentId);
  }

  // 3. Prepara l'oggetto appuntamento aggiornato
  const updatedAppt: UnifiedAppointmentItem = {
    ...existing,
    startTime: params.newStartTime,
    endTime: params.newEndTime,
    staffId: targetStaffId,
    staff: {
      id: targetStaffId,
      fullName: params.newStaffName || (targetStaffId === oldStaffId ? existing.staff.fullName : "Staff"),
      role: params.newStaffRole || (targetStaffId === oldStaffId ? existing.staff.role : "Stylist")
    },
    service: {
      ...existing.service,
      durationMinutes: params.newDurationMinutes || existing.service.durationMinutes
    }
  };

  // 4. Salva con transazione atomica anti-conflitto
  try {
    await saveSalonAppointment(updatedAppt);
  } catch (err) {
    // Se fallisce (es. SlotConflictError) e avevamo rilasciato il vecchio lock, ripristiniamo l'originale
    if (oldStaffId !== targetStaffId || oldDateStr !== newDateStr) {
      try {
        await saveSalonAppointment(existing);
      } catch (_) {}
    }
    throw err;
  }

  return updatedAppt;
}
