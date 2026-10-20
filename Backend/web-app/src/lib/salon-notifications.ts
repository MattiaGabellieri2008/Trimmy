import { auth, dataConnect } from "./firebase";
import { getDailyAppointments, listCustomers } from "../dataconnect-generated";
import { getSalonTenantId } from "./tenant-helper";
import { getSalonServices } from "./services-store";
import { getUserProfile } from "./user-profile";

export type NotificationType = "appointment" | "customer" | "system";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  timestamp?: number;
}

const READ_STORAGE_PREFIX = "trimmy_read_notifs_";
const CLEARED_STORAGE_PREFIX = "trimmy_cleared_notifs_";
const CUSTOM_STORAGE_PREFIX = "trimmy_custom_notifs_";

/**
 * Ottiene gli ID delle notifiche contrassegnate come lette
 */
export function getReadNotificationIds(userUid: string): string[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const raw = localStorage.getItem(`${READ_STORAGE_PREFIX}${userUid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Segna una specifica notifica come letta
 */
export function markNotificationAsRead(userUid: string, id: string): void {
  if (typeof window === "undefined" || !userUid || !id) return;
  try {
    const current = getReadNotificationIds(userUid);
    if (!current.includes(id)) {
      localStorage.setItem(`${READ_STORAGE_PREFIX}${userUid}`, JSON.stringify([...current, id]));
    }
  } catch (e) {
    console.error("Errore salvataggio notifica letta:", e);
  }
}

/**
 * Segna tutte le notifiche correnti come lette
 */
export function markAllNotificationsAsRead(userUid: string, ids: string[]): void {
  if (typeof window === "undefined" || !userUid || !ids.length) return;
  try {
    const current = getReadNotificationIds(userUid);
    const merged = Array.from(new Set([...current, ...ids]));
    localStorage.setItem(`${READ_STORAGE_PREFIX}${userUid}`, JSON.stringify(merged));
  } catch (e) {
    console.error("Errore salvataggio notifiche lette:", e);
  }
}

/**
 * Ottiene gli ID delle notifiche eliminate/rimosse dall'utente
 */
export function getClearedNotificationIds(userUid: string): string[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const raw = localStorage.getItem(`${CLEARED_STORAGE_PREFIX}${userUid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Rimuove definitivamente una notifica per l'utente
 */
export function clearNotification(userUid: string, id: string): void {
  if (typeof window === "undefined" || !userUid || !id) return;
  try {
    const current = getClearedNotificationIds(userUid);
    if (!current.includes(id)) {
      localStorage.setItem(`${CLEARED_STORAGE_PREFIX}${userUid}`, JSON.stringify([...current, id]));
    }
    // Rimuove anche dai custom se presente
    const custom = getCustomSalonNotifications(userUid);
    const updatedCustom = custom.filter((item) => item.id !== id);
    localStorage.setItem(`${CUSTOM_STORAGE_PREFIX}${userUid}`, JSON.stringify(updatedCustom));
  } catch (e) {
    console.error("Errore eliminazione notifica:", e);
  }
}

/**
 * Cancella tutte le notifiche correnti
 */
export function clearAllNotifications(userUid: string, ids: string[]): void {
  if (typeof window === "undefined" || !userUid) return;
  try {
    const current = getClearedNotificationIds(userUid);
    const merged = Array.from(new Set([...current, ...ids]));
    localStorage.setItem(`${CLEARED_STORAGE_PREFIX}${userUid}`, JSON.stringify(merged));
    localStorage.setItem(`${CUSTOM_STORAGE_PREFIX}${userUid}`, JSON.stringify([]));
  } catch (e) {
    console.error("Errore cancellazione notifiche:", e);
  }
}

/**
 * Legge notifiche personalizzate scatenate da eventi reali (es. nuova prenotazione dal marketplace o form)
 */
export function getCustomSalonNotifications(identifier: string): NotificationItem[] {
  if (typeof window === "undefined" || !identifier) return [];
  try {
    const raw = localStorage.getItem(`${CUSTOM_STORAGE_PREFIX}${identifier}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Aggiunge una notifica autentica per il salone (scatenata da azioni reali)
 */
export function addSalonNotification(
  salonUidOrTenantId: string,
  notification: Omit<NotificationItem, "read">
): void {
  if (typeof window === "undefined" || !salonUidOrTenantId) return;
  try {
    const existing = getCustomSalonNotifications(salonUidOrTenantId);
    const newItem: NotificationItem = {
      ...notification,
      read: false,
      timestamp: notification.timestamp || Date.now()
    };
    // Mantieni le ultime 20 notifiche reali
    const updated = [newItem, ...existing.filter((n) => n.id !== notification.id)].slice(0, 20);
    localStorage.setItem(`${CUSTOM_STORAGE_PREFIX}${salonUidOrTenantId}`, JSON.stringify(updated));

    // Notifica la finestra per aggiornamento real-time immediato
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  } catch (e) {
    console.error("Errore salvataggio notifica reale salone:", e);
  }
}

/**
 * Calcola la lista di notifiche EFFETTIVE per il salone loggato.
 * ZERO dati fittizi. Esclusivamente appuntamenti reali, compleanni reali e stato del salone.
 */
export async function fetchEffectiveSalonNotifications(userUid: string): Promise<NotificationItem[]> {
  if (!userUid) return [];

  const readIds = getReadNotificationIds(userUid);
  const clearedIds = getClearedNotificationIds(userUid);
  const tenantId = getSalonTenantId(userUid);

  const notifications: NotificationItem[] = [];

  // 1. Eventi reali salvati (es. prenotazioni effettive ricevute)
  const customEvents = [
    ...getCustomSalonNotifications(userUid),
    ...getCustomSalonNotifications(tenantId)
  ];
  for (const ev of customEvents) {
    if (!clearedIds.includes(ev.id)) {
      notifications.push({
        ...ev,
        read: readIds.includes(ev.id) || ev.read
      });
    }
  }

  // 2. Appuntamenti reali di oggi da Cloud SQL / Data Connect
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  try {
    const apptRes = await getDailyAppointments(dataConnect, {
      tenantId,
      todayStart: startOfDay.toISOString(),
      todayEnd: endOfDay.toISOString()
    });

    const realAppointments = apptRes.data?.appointments || [];
    for (const appt of realAppointments) {
      const notifId = `appt-today-${appt.id}`;
      if (!clearedIds.includes(notifId)) {
        const apptDate = new Date(appt.startTime);
        const timeStr = apptDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
        const custName = `${appt.customer?.firstName || ""} ${appt.customer?.lastName || ""}`.trim() || "Cliente";
        const serviceName = appt.service?.name || "Trattamento";
        const staffName = appt.staff?.fullName || "Staff";
        const price = appt.service?.price ?? 0;

        notifications.push({
          id: notifId,
          title: `Appuntamento oggi: ${custName}`,
          description: `${serviceName} alle ${timeStr} con ${staffName}${price > 0 ? ` (€${price})` : ""}`,
          time: `Oggi alle ${timeStr}`,
          type: "appointment",
          read: readIds.includes(notifId),
          link: "/",
          timestamp: apptDate.getTime()
        });
      }
    }
  } catch (err) {
    // Gestione silenziosa se DB offline o vuoto
  }

  // 3. Clienti reali con compleanno oggi
  try {
    const cRes = await listCustomers(dataConnect, { tenantId });
    const realCustomers = cRes.data?.customers || [];
    for (const c of realCustomers) {
      if (c.birthday) {
        const bParts = c.birthday.split("-");
        if (bParts.length >= 2) {
          const bMonth = parseInt(bParts[bParts.length - 2], 10);
          const bDay = parseInt(bParts[bParts.length - 1], 10);
          if (bMonth === now.getMonth() + 1 && bDay === now.getDate()) {
            const notifId = `bday-${c.id}-${now.getFullYear()}`;
            if (!clearedIds.includes(notifId)) {
              notifications.push({
                id: notifId,
                title: `Compleanno: ${c.firstName} ${c.lastName}`,
                description: `${c.firstName} compie gli anni oggi! Invia un augurio o riserva uno sconto fedeltà.`,
                time: "Oggi",
                type: "customer",
                read: readIds.includes(notifId),
                link: "/clienti",
                timestamp: now.getTime()
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // Gestione silenziosa
  }

  // 4. Avvisi effettivi di configurazione salone (solo se oggettivamente mancanti)
  const services = getSalonServices(userUid);
  if (services.length === 0) {
    const setupServicesId = "sys-setup-services";
    if (!clearedIds.includes(setupServicesId)) {
      notifications.push({
        id: setupServicesId,
        title: "Configura il listino servizi",
        description: "Non hai ancora inserito nessun trattamento. Vai in Trattamenti per configurare il listino e ricevere prenotazioni.",
        time: "Configurazione",
        type: "system",
        read: readIds.includes(setupServicesId),
        link: "/trattamenti",
        timestamp: 0
      });
    }
  }

  const profile = getUserProfile(userUid);
  if (profile && (!profile.address || !profile.phone)) {
    const setupProfileId = "sys-setup-profile";
    if (!clearedIds.includes(setupProfileId)) {
      notifications.push({
        id: setupProfileId,
        title: "Completa profilo Salone",
        description: "Aggiungi indirizzo e recapito telefonico nelle Impostazioni per apparire sulla mappa clienti.",
        time: "Profilo",
        type: "system",
        read: readIds.includes(setupProfileId),
        link: "/impostazioni",
        timestamp: 0
      });
    }
  }

  // De-duplicazione per ID
  const uniqueMap = new Map<string, NotificationItem>();
  for (const item of notifications) {
    if (!clearedIds.includes(item.id)) {
      uniqueMap.set(item.id, {
        ...item,
        read: readIds.includes(item.id) || item.read
      });
    }
  }

  const result = Array.from(uniqueMap.values());

  // Ordina: non lette prima, poi cronologicamente
  result.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return result;
}
