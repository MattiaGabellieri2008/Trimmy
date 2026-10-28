import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getSalonTenantId } from "./tenant-helper";
import { parseDateSafe } from "./date-utils";

export interface DaySchedule {
  dayOfWeek: number; // 0 = Domenica, 1 = Lunedì, 2 = Martedì, 3 = Mercoledì, 4 = Giovedì, 5 = Venerdì, 6 = Sabato
  dayName: string;
  isOpen: boolean;
  openTime: string;   // es. "09:00"
  closeTime: string;  // es. "19:30"
  hasBreak?: boolean;
  breakStart?: string; // es. "13:00"
  breakEnd?: string;   // es. "14:00"
}

export interface SalonWorkingHoursSettings {
  tenantId: string;
  days: DaySchedule[];
  updatedAt: string;
}

export const DEFAULT_WORKING_HOURS: DaySchedule[] = [
  { dayOfWeek: 1, dayName: "Lunedì", isOpen: false, openTime: "09:00", closeTime: "19:30" },
  { dayOfWeek: 2, dayName: "Martedì", isOpen: true, openTime: "09:00", closeTime: "19:30", hasBreak: true, breakStart: "13:00", breakEnd: "14:00" },
  { dayOfWeek: 3, dayName: "Mercoledì", isOpen: true, openTime: "09:00", closeTime: "19:30", hasBreak: true, breakStart: "13:00", breakEnd: "14:00" },
  { dayOfWeek: 4, dayName: "Giovedì", isOpen: true, openTime: "09:00", closeTime: "20:00", hasBreak: true, breakStart: "13:00", breakEnd: "14:00" },
  { dayOfWeek: 5, dayName: "Venerdì", isOpen: true, openTime: "08:30", closeTime: "20:00" },
  { dayOfWeek: 6, dayName: "Sabato", isOpen: true, openTime: "08:30", closeTime: "19:30" },
  { dayOfWeek: 0, dayName: "Domenica", isOpen: false, openTime: "09:00", closeTime: "13:00" },
];

const STORAGE_PREFIX = "trimmy_working_hours_";

/**
 * Lettura sincrona dalla cache locale
 */
export function getSalonWorkingHoursSync(tenantId: string): DaySchedule[] {
  if (typeof window === "undefined" || !tenantId) return DEFAULT_WORKING_HOURS;
  try {
    const tid = getSalonTenantId(tenantId);
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tid}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WORKING_HOURS;
}

/**
 * Recupera gli orari di apertura del salone da Cloud Firestore con fallback su cache e valori predefiniti
 */
export async function fetchSalonWorkingHours(tenantId: string): Promise<DaySchedule[]> {
  const tid = getSalonTenantId(tenantId);
  const local = getSalonWorkingHoursSync(tid);

  try {
    const docRef = doc(db, "saloni", tid, "settings", "working_hours");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SalonWorkingHoursSettings;
      if (Array.isArray(data.days) && data.days.length === 7) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}${tid}`, JSON.stringify(data.days));
          } catch {}
        }
        return data.days;
      }
    }
  } catch (err) {
    console.warn("Nota lettura orari salone Firestore:", err);
  }

  return local;
}

/**
 * Salva gli orari di apertura del salone su Cloud Firestore e cache locale
 */
export async function saveSalonWorkingHours(tenantId: string, days: DaySchedule[]): Promise<void> {
  const tid = getSalonTenantId(tenantId);
  const payload: SalonWorkingHoursSettings = {
    tenantId: tid,
    days,
    updatedAt: new Date().toISOString()
  };

  // 1. Cache locale sincrona
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${tid}`, JSON.stringify(days));
    } catch {}
  }

  // 2. Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tid, "settings", "working_hours");
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio orari salone Firestore:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

/**
 * Verifica se il salone è aperto in una data specifica
 */
export function isSalonOpenOnDate(
  tenantId: string,
  date: Date | string,
  customSchedule?: DaySchedule[]
): boolean {
  const d = typeof date === "string" ? parseDateSafe(date) : date;
  const dayOfWeek = d.getDay();
  const schedule = customSchedule || getSalonWorkingHoursSync(tenantId);
  const dayConfig = schedule.find((s) => s.dayOfWeek === dayOfWeek);
  return dayConfig ? dayConfig.isOpen : true;
}

/**
 * Restituisce la configurazione oraria del salone per una specifica data
 */
export function getSalonScheduleForDate(
  tenantId: string,
  date: Date | string,
  customSchedule?: DaySchedule[]
): DaySchedule {
  const d = typeof date === "string" ? parseDateSafe(date) : date;
  const dayOfWeek = d.getDay();
  const schedule = customSchedule || getSalonWorkingHoursSync(tenantId);
  const found = schedule.find((s) => s.dayOfWeek === dayOfWeek);
  if (found) return found;

  const defaultDay = DEFAULT_WORKING_HOURS.find((s) => s.dayOfWeek === dayOfWeek);
  return defaultDay || {
    dayOfWeek,
    dayName: "Giorno",
    isOpen: true,
    openTime: "09:00",
    closeTime: "19:30"
  };
}

export interface BookingDayOption {
  dateStr: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  isOpen: boolean;
}

/**
 * Filtra gli slot orari di prenotazione in base agli orari di apertura e pause del salone per quella data
 */
export function filterTimeSlotsByWorkingHours(
  allSlots: string[],
  daySchedule: DaySchedule
): string[] {
  if (!daySchedule.isOpen) return [];

  return allSlots.filter((slotTime) => {
    // Escludi prima dell'apertura o dopo la chiusura
    if (daySchedule.openTime && slotTime < daySchedule.openTime) return false;
    if (daySchedule.closeTime && slotTime >= daySchedule.closeTime) return false;

    // Escludi slot che cadono nella pausa pranzo
    if (daySchedule.hasBreak && daySchedule.breakStart && daySchedule.breakEnd) {
      if (slotTime >= daySchedule.breakStart && slotTime < daySchedule.breakEnd) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Genera l'elenco dei giorni per la selezione data nel wizard, marcando i giorni aperti e chiusi
 */
export function generateAvailableBookingDays(
  startDate: Date = new Date(),
  numDays: number = 14,
  schedule?: DaySchedule[]
): BookingDayOption[] {
  const days: BookingDayOption[] = [];
  const currentSchedule = schedule || DEFAULT_WORKING_HOURS;

  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);

    const dayOfWeek = d.getDay();
    const config = currentSchedule.find((s) => s.dayOfWeek === dayOfWeek);
    const isOpen = config ? config.isOpen : true;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${dayNum}`;

    days.push({
      dateStr,
      dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
      dayNumber: d.getDate(),
      monthName: d.toLocaleDateString("it-IT", { month: "short" }),
      isToday: i === 0,
      isOpen
    });
  }

  return days;
}
