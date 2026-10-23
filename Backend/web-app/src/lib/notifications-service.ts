import { 
  NotificationType, 
  NotificationChannel, 
  NotificationLogItem, 
  NotificationSettings,
  DEFAULT_NOTIFICATION_TEMPLATES,
  DEFAULT_NOTIFICATION_SETTINGS
} from "./notifications-types";
import { db } from "./firebase";
import { getAuth } from "firebase/auth";
import { collection, doc, getDocs, setDoc, query, orderBy, limit, getDoc } from "firebase/firestore";

const STORAGE_LOGS_PREFIX = "trimmy_notif_logs_";
const STORAGE_SETTINGS_PREFIX = "trimmy_notif_settings_";

/**
 * Pulisce e normalizza il recapito telefonico (standard internazionale per Italia +39)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Se è un cellulare italiano che inizia con 3 (9 o 10 cifre) senza prefisso internazionale
  if (/^3\d{8,9}$/.test(cleaned)) {
    cleaned = "+39" + cleaned;
  }

  return cleaned;
}

/**
 * Genera il link universale Click-to-Chat di WhatsApp (wa.me)
 * Funziona su qualsiasi dispositivo senza costi API
 */
export function buildWhatsAppClickToChatUrl(phone: string, text: string): string {
  const norm = normalizePhoneNumber(phone);
  // Per wa.me il numero deve essere solo cifre senza il simbolo '+'
  const digitsOnly = norm.replace(/\D/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(text)}`;
}

/**
 * Compila il testo del template sostituendo i segnaposto dinamici
 */
export function compileNotificationText(
  type: NotificationType,
  params: {
    cliente?: string;
    salone?: string;
    servizio?: string;
    operatore?: string;
    data?: string;
    ora?: string;
    link?: string;
    customTemplate?: string;
  }
): string {
  const baseTemplate = params.customTemplate || DEFAULT_NOTIFICATION_TEMPLATES[type] || DEFAULT_NOTIFICATION_TEMPLATES.CONFIRMATION;

  return baseTemplate
    .replace(/\{cliente\}/gi, params.cliente || "Gentile Cliente")
    .replace(/\{salone\}/gi, params.salone || "il nostro Salone")
    .replace(/\{servizio\}/gi, params.servizio || "Trattamento")
    .replace(/\{operatore\}/gi, params.operatore || "Staff")
    .replace(/\{data\}/gi, params.data || "prossimamente")
    .replace(/\{ora\}/gi, params.ora || "")
    .replace(/\{link\}/gi, params.link || (typeof window !== "undefined" ? window.location.origin : "https://trimmy--gestionale-saloni.europe-west4.hosted.app"));
}

export interface SendNotificationPayload {
  tenantId: string;
  salonName?: string;
  appointmentId?: string;
  customerName: string;
  customerPhone: string;
  type: NotificationType;
  channel?: NotificationChannel;
  customMessage?: string;
  templateParams?: {
    servizio?: string;
    operatore?: string;
    data?: string;
    ora?: string;
    link?: string;
  };
}

/**
 * Invia una notifica tramite l'endpoint server-side Next.js (/api/notifications/send)
 * Traccia crediti e salva il log sia su Cloud Firestore che in cache locale.
 */
export async function sendNotification(
  payload: SendNotificationPayload
): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const normalizedPhone = normalizePhoneNumber(payload.customerPhone);

  if (!normalizedPhone) {
    return { success: false, error: "Numero di telefono non valido o mancante" };
  }

  // Risolvi il messaggio finale
  const messageText = payload.customMessage || compileNotificationText(payload.type, {
    cliente: payload.customerName,
    salone: payload.salonName,
    servizio: payload.templateParams?.servizio,
    operatore: payload.templateParams?.operatore,
    data: payload.templateParams?.data,
    ora: payload.templateParams?.ora,
    link: payload.templateParams?.link
  });

  try {
    // 0. Recupera il token di autenticazione dell'utente corrente
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: "Utente non autenticato. Effettua il login." };
    }
    const idToken = await currentUser.getIdToken();

    // 1. Chiamata all'endpoint API Next.js Server-Side (con autenticazione)
    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        tenantId: payload.tenantId,
        salonName: payload.salonName || "Salone",
        appointmentId: payload.appointmentId,
        customerName: payload.customerName,
        customerPhone: normalizedPhone,
        type: payload.type,
        channel: payload.channel || "WHATSAPP",
        message: messageText
      })
    });

    const resData = await response.json();

    // 2. Registra in cache locale per rendering istantaneo del log
    const logItem: NotificationLogItem = {
      id: resData.logId || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: payload.tenantId,
      salonName: payload.salonName || "Salone",
      appointmentId: payload.appointmentId,
      customerName: payload.customerName,
      customerPhone: normalizedPhone,
      type: payload.type,
      channel: payload.channel || "WHATSAPP",
      message: messageText,
      status: resData.simulated ? "SIMULATED" : resData.success ? "SENT" : "FAILED",
      costCredits: resData.success || resData.simulated ? 1 : 0,
      sentAt: new Date().toISOString(),
      error: resData.error
    };

    saveNotificationLogLocal(payload.tenantId, logItem);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trimmy-notifications-updated"));
    }

    return resData;
  } catch (err: any) {
    console.warn("Nota invio notifica:", err);
    // Fallback salvataggio locale del tentativo
    const fallbackItem: NotificationLogItem = {
      id: `log_${Date.now()}`,
      tenantId: payload.tenantId,
      salonName: payload.salonName || "Salone",
      appointmentId: payload.appointmentId,
      customerName: payload.customerName,
      customerPhone: normalizedPhone,
      type: payload.type,
      channel: payload.channel || "WHATSAPP",
      message: messageText,
      status: "SIMULATED",
      costCredits: 1,
      sentAt: new Date().toISOString(),
    };
    saveNotificationLogLocal(payload.tenantId, fallbackItem);
    return { success: true, simulated: true, messageId: fallbackItem.id };
  }
}

/**
 * Salva un log in cache locale
 */
export function saveNotificationLogLocal(tenantId: string, item: NotificationLogItem): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    const key = `${STORAGE_LOGS_PREFIX}${tenantId}`;
    const raw = localStorage.getItem(key);
    const existing: NotificationLogItem[] = raw ? JSON.parse(raw) : [];
    const updated = [item, ...existing.filter((x) => x.id !== item.id)].slice(0, 100);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn("Errore salvataggio log notifiche locale:", e);
  }
}

/**
 * Recupera i log delle notifiche inviate (unendo Firestore e LocalStorage)
 */
export async function fetchNotificationLogs(tenantId: string): Promise<NotificationLogItem[]> {
  if (!tenantId) return [];

  const logsMap = new Map<string, NotificationLogItem>();

  // 1. Da LocalStorage (istantaneo a 0ms)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_LOGS_PREFIX}${tenantId}`);
      if (raw) {
        const arr = JSON.parse(raw) as NotificationLogItem[];
        arr.forEach((item) => logsMap.set(item.id, item));
      }
    } catch (e) {}
  }

  // 2. Da Cloud Firestore (/saloni/{tenantId}/notification_logs)
  try {
    const colRef = collection(db, "saloni", tenantId, "notification_logs");
    const q = query(colRef, orderBy("sentAt", "desc"), limit(50));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const item = d.data() as NotificationLogItem;
      if (item && item.id) {
        logsMap.set(item.id, item);
      }
    });
  } catch (err) {
    console.warn("Nota lettura log Firestore:", err);
  }

  return Array.from(logsMap.values()).sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
}

/**
 * Salva le impostazioni delle notifiche del salone
 */
export async function saveSalonNotificationSettings(
  tenantId: string,
  settings: NotificationSettings
): Promise<void> {
  if (!tenantId) return;

  // 1. Cache Locale
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_SETTINGS_PREFIX}${tenantId}`, JSON.stringify(settings));
    } catch (e) {}
  }

  // 2. Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tenantId, "config", "notifications");
    await setDoc(docRef, settings, { merge: true });
    // Aggiorna anche nel profilo utente principale se esiste
    const userDocRef = doc(db, "users", tenantId);
    await setDoc(userDocRef, { notificationSettings: settings }, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio impostazioni notifiche Firestore:", err);
  }
}

/**
 * Recupera le impostazioni delle notifiche del salone
 */
export async function getSalonNotificationSettings(tenantId: string): Promise<NotificationSettings> {
  if (!tenantId) return DEFAULT_NOTIFICATION_SETTINGS;

  // 1. Da cache locale
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_SETTINGS_PREFIX}${tenantId}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }

  // 2. Da Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tenantId, "config", "notifications");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as NotificationSettings;
    }
  } catch (e) {}

  return DEFAULT_NOTIFICATION_SETTINGS;
}
