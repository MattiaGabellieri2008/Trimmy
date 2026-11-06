import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, getAppBaseUrl } from "@/lib/stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let userId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userId = decoded.uid;
      } catch (e) {
        console.warn("[stripe/customer-portal] Token Firebase non valido:", e);
      }
    }

    // In ambiente di sviluppo è concesso il fallback sul body, in produzione l'autenticazione crittografica è obbligatoria
    if (!userId && process.env.NODE_ENV !== "production") {
      userId = body?.userId;
    }

    if (!userId) {
      return NextResponse.json({ error: "Accesso non autorizzato. Token di autenticazione Bearer valido obbligatorio." }, { status: 401 });
    }

    // Rate Limiting anti-abuso su sessioni Customer Portal (max 10 richieste al minuto per utente)
    const rateCheck = await checkDistributedRateLimit(userId, {
      scope: "stripe_portal",
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Troppe richieste al portale di fatturazione. Attendi ${rateCheck.resetSeconds} secondi.` },
        {
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
          },
        }
      );
    }

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    if (!stripe || !isStripeConfigured()) {
      return NextResponse.json({
        url: `${baseUrl}/abbonamento-pro?portal_notice=demo`,
        isDemo: true
      });
    }

    // Recupera lo stripeCustomerId salvato
    let stripeCustomerId: string | undefined;
    try {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (userDoc.exists) {
        stripeCustomerId = userDoc.data()?.stripeCustomerId;
      }
    } catch (e) {
      console.warn("[stripe/customer-portal] Errore lettura utente da Firestore:", e);
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Nessun cliente Stripe associato a questo account. Effettua prima l'attivazione di un piano." },
        { status: 404 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/abbonamento-pro`
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("[stripe/customer-portal] Errore creazione portale clienti Stripe:", error);
    return NextResponse.json(
      { error: error?.message || "Errore durante la creazione del portale di fatturazione Stripe." },
      { status: 500 }
    );
  }
}

