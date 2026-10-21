export type NotificationType = "CONFIRMATION" | "REMINDER" | "CANCELLATION" | "REVIEW_REQUEST" | "TEST";
export type NotificationChannel = "SMS" | "WHATSAPP" | "BOTH";

export interface NotificationLogItem {
  id: string;
  tenantId: string;
  salonName: string;
  appointmentId?: string;
  customerName: string;
  customerPhone: string;
  type: NotificationType;
  channel: NotificationChannel;
  message: string;
  status: "SENT" | "DELIVERED" | "SIMULATED" | "FAILED";
  costCredits: number;
  sentAt: string; // ISO string
  error?: string;
}

export interface NotificationSettings {
  enabledChannels: {
    sms: boolean;
    whatsapp: boolean;
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
  };
}

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationType, string> = {
  CONFIRMATION: "✂️ Ciao {cliente}, il tuo appuntamento presso {salone} è CONFERMATO per {data} alle {ora} ({servizio} con {operatore}). Info o disdetta: {link}",
  REMINDER: "⏰ Ciao {cliente}, ti ricordiamo il tuo appuntamento da {salone} previsto per domani {data} alle {ora} ({servizio}). Ti aspettiamo!",
  CANCELLATION: "❌ Ciao {cliente}, il tuo appuntamento del {data} alle {ora} presso {salone} è stato ANNULLATO. Per riprenotare subito: {link}",
  REVIEW_REQUEST: "⭐ Ciao {cliente}, grazie per aver scelto {salone}! Come è andato il tuo {servizio}? Lascia una recensione in 10 secondi: {link}",
  TEST: "✅ Ciao da {salone}! Questo è un messaggio di test per verificare che le notifiche SMS/WhatsApp di Trimmy funzionino correttamente."
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabledChannels: {
    sms: true,
    whatsapp: true
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
    reviewRequest: DEFAULT_NOTIFICATION_TEMPLATES.REVIEW_REQUEST
  }
};

/**
 * Quote mensili di notifiche incluse per piano SaaS
 */
export const PLAN_NOTIFICATION_CREDITS: Record<string, number> = {
  FREE: 0,       // Solo WhatsApp Click-to-Chat manuale a costo 0
  MEDIUM: 50,    // 50 notifiche automatiche incluse/mese
  PRO: 250       // 250 notifiche automatiche incluse/mese
};
