import Stripe from "stripe";

// Configurazione prezzi piani SaaS Trimmy
export const SAAS_PLANS = {
  MEDIUM: {
    name: "Trimmy Salone Medium",
    description: "Fino a 3 collaboratori, sincronizzazione Cloud Firestore & WhatsApp",
    monthlyPriceCents: 2900, // 29,00 € / mese
    yearlyPriceCents: 29000, // 290,00 € / anno (~24,16 €/mese, 2 mesi gratis)
    staffLimit: 3
  },
  PRO: {
    name: "Trimmy Salone Pro VIP",
    description: "Collaboratori illimitati, notifiche push avanzate e reportistica completa",
    monthlyPriceCents: 5900, // 59,00 € / mese
    yearlyPriceCents: 59000, // 590,00 € / anno (~49,16 €/mese, 2 mesi gratis)
    staffLimit: 99
  }
} as const;

/**
 * Inizializza l'istanza Stripe SDK lato server in modo sicuro.
 * Se la chiave segreta non è definita nell'ambiente, viene restituito null
 * consentendo alle API di passare in modalità sviluppatore controllata.
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia" as any
    });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_"));
}

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
