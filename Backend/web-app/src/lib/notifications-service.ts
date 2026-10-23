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
 * Pulisce e normalizza il recapito telefonico (standard internazionale)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  if (/^3\d{8,9}$/.test(cleaned)) {
    cleaned = "+39" + cleaned;
  }

  return cleaned;
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
  customerPhone?: string;
  type: NotificationType;
  channel?: NotificationChannel;
  title?: string;
  customMessage?: string;
  targetToken?: string;
  targetTopic?: string;
  imageUrl?: string;
  templateParams?: {
    servizio?: string;
    operatore?: string;
    data?: string;
    ora?: string;
    link?: string;
  };
}

/**
 * Invia una notifica Push tramite Firebase Cloud Messaging (/api/notifications/send)
 * Traccia lo storico sia su Cloud Firestore che in cache locale.
 */
export async function sendNotification(
  payload: SendNotificationPayload
): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
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

  const normalizedPhone = payload.customerPhone ? normalizePhoneNumber(payload.customerPhone) : undefined;

  try {
    // 0. Recupera il token di autenticazione dell'utente corrente
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: "Utente non autenticato. Effettua il login." };
    }
    const idToken = await currentUser.getIdToken();

    // 1. Chiamata all'endpoint API Next.js Server-Side (Firebase Cloud Messaging)
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
        channel: payload.channel || "PUSH_FCM",
        title: payload.title,
        message: messageText,
        targetToken: payload.targetToken,
        targetTopic: payload.targetTopic,
        imageUrl: payload.imageUrl
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
      channel: payload.channel || "PUSH_FCM",
      title: payload.title,
      message: messageText,
      status: resData.simulated ? "SIMULATED" : resData.success ? "SENT" : "FAILED",
      costCredits: 0, // Notifiche Push Firebase Cloud Messaging gratuite e illimitate
      sentAt: new Date().toISOString(),
      fcmMessageId: resData.messageId,
      error: resData.error
    };

    saveNotificationLogLocal(payload.tenantId, logItem);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trimmy-notifications-updated"));
    }

    return resData;
  } catch (err: any) {
    console.warn("[FCM] Nota invio notifica:", err);
    // Fallback salvataggio locale del tentativo
    const fallbackItem: NotificationLogItem = {
      id: `log_${Date.now()}`,
      tenantId: payload.tenantId,
      salonName: payload.salonName || "Salone",
      appointmentId: payload.appointmentId,
      customerName: payload.customerName,
      customerPhone: normalizedPhone,
      type: payload.type,
      channel: payload.channel || "PUSH_FCM",
      title: payload.title,
      message: messageText,
      status: "SIMULATED",
      costCredits: 0,
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

  // 1. Salva in LocalStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_SETTINGS_PREFIX}${tenantId}`, JSON.stringify(settings));
    } catch (e) {}
  }

  // 2. Salva su Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tenantId, "settings", "notifications");
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio impostazioni notifiche Firestore:", err);
  }
}

/**
 * Recupera le impostazioni notifiche del salone
 */
export async function fetchSalonNotificationSettings(tenantId: string): Promise<NotificationSettings> {
  if (!tenantId) return DEFAULT_NOTIFICATION_SETTINGS;

  // 1. Da LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_SETTINGS_PREFIX}${tenantId}`);
      if (raw) {
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
  }

  // 2. Da Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tenantId, "settings", "notifications");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(snap.data() as NotificationSettings) };
    }
  } catch (err) {
    console.warn("Nota lettura impostazioni notifiche Firestore:", err);
  }

  return DEFAULT_NOTIFICATION_SETTINGS;
}
