export type NotificationType = "CONFIRMATION" | "REMINDER" | "CANCELLATION" | "REVIEW_REQUEST" | "MARKETING" | "TEST";
export type NotificationChannel = "PUSH_FCM" | "IN_APP" | "SYSTEM";

export interface NotificationLogItem {
  id: string;
  tenantId: string;
  salonName: string;
  appointmentId?: string;
  customerName: string;
  customerPhone?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title?: string;
  message: string;
  status: "SENT" | "DELIVERED" | "SIMULATED" | "FAILED";
  costCredits: number;
  sentAt: string; // ISO string
  fcmMessageId?: string;
  error?: string;
}

export interface NotificationSettings {
  enabledChannels: {
    pushFcm: boolean;
    inApp: boolean;
  };
  sendConfirmation: boolean;
  sendReminder: boolean;
  reminderHoursBefore: number; // default: 24
  sendCancellation: boolean;
  sendReviewRequest: boolean;
  customTemplates: {
    confirmation?: string;
    reminder?: string;
    cancellation?: string;
    reviewRequest?: string;
    marketing?: string;
  };
}

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationType, string> = {
  CONFIRMATION: "✂️ Prenotazione Confermata da {salone} per {servizio} il {data} alle {ora} ({operatore}).",
  REMINDER: "⏰ Promemoria Salone: Ti ricordiamo il tuo appuntamento da {salone} previsto per il {data} alle {ora} ({servizio}).",
  CANCELLATION: "❌ Appuntamento Annullato: Il tuo appuntamento presso {salone} del {data} alle {ora} è stato cancellato.",
  REVIEW_REQUEST: "⭐ Com'è stato il tuo taglio da {salone}? Lascia una recensione in pochi secondi: {link}",
  MARKETING: "✨ Novità da {salone}: Scopri i nuovi trattamenti e prenota online in un click!",
  TEST: "🔔 Notifica Push di Prova: Firebase Cloud Messaging è attivo e configurato per {salone}."
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabledChannels: {
    pushFcm: true,
    inApp: true
  },
  sendConfirmation: true,
  sendReminder: true,
  reminderHoursBefore: 24,
  sendCancellation: true,
  sendReviewRequest: true,
  customTemplates: {
    confirmation: DEFAULT_NOTIFICATION_TEMPLATES.CONFIRMATION,
    reminder: DEFAULT_NOTIFICATION_TEMPLATES.REMINDER,
    cancellation: DEFAULT_NOTIFICATION_TEMPLATES.CANCELLATION,
    reviewRequest: DEFAULT_NOTIFICATION_TEMPLATES.REVIEW_REQUEST,
    marketing: DEFAULT_NOTIFICATION_TEMPLATES.MARKETING
  }
};

/**
 * Quote notifiche Push Firebase Cloud Messaging (incluse illimitate nei piani)
 */
export const PLAN_NOTIFICATION_CREDITS: Record<string, number> = {
  FREE: 1000,       // Notifiche Push Firebase Cloud Messaging
  MEDIUM: 10000,    // Notifiche Push Firebase Cloud Messaging illimitate
  PRO: 999999       // Notifiche Push Firebase Cloud Messaging illimitate
};
