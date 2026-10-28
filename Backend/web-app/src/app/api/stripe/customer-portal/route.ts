import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, getAppBaseUrl } from "@/lib/stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let userId = body?.userId;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userId = decoded.uid;
      } catch (e) {
        console.warn("[stripe/customer-portal] Token Firebase non valido, fallback su userId:", e);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });
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
