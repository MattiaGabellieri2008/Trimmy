import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, SAAS_PLANS, getAppBaseUrl } from "@/lib/stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planType, billingCycle = "monthly", userId: bodyUserId, salonName, userEmail } = body;

    if (!planType || (planType !== "MEDIUM" && planType !== "PRO")) {
      return NextResponse.json({ error: "Piano non valido. Scegli tra MEDIUM o PRO." }, { status: 400 });
    }

    // Identificazione utente tramite Bearer token o fallback da body
    let userId = bodyUserId;
    let email = userEmail;
    const authHeader = req.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userId = decoded.uid;
        if (decoded.email) email = decoded.email;
      } catch (e) {
        console.warn("[stripe/checkout-session] Token Firebase non valido, fallback su userId fornito:", e);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Utente non autenticato. Effettua il login per proseguire." }, { status: 401 });
    }

    const planConfig = SAAS_PLANS[planType as "MEDIUM" | "PRO"];
    const baseUrl = getAppBaseUrl();
    const stripe = getStripe();

    // Modalità Sviluppatore / Sandbox se STRIPE_SECRET_KEY non è configurata
    if (!stripe || !isStripeConfigured()) {
      console.info("[stripe/checkout-session] STRIPE_SECRET_KEY non configurata: fallback demo controllato");
      return NextResponse.json({
        url: `${baseUrl}/abbonamento-pro?status=success&session_id=demo_sess_${Date.now()}&plan=${planType}&cycle=${billingCycle}&demo=true`,
        sessionId: `demo_sess_${Date.now()}`,
        isDemo: true
      });
    }

    // 1. Recupero o creazione del Customer Stripe associato al salone
    let stripeCustomerId: string | undefined;
    try {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        stripeCustomerId = userData?.stripeCustomerId;
      }
    } catch (e) {
      console.warn("[stripe/checkout-session] Impossibile recuperare utente da Firestore Admin:", e);
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: salonName || `Salone ${userId}`,
        metadata: {
          userId,
          environment: process.env.NODE_ENV || "development"
        }
      });
      stripeCustomerId = customer.id;

      try {
        await adminDb.collection("users").doc(userId).set({
          stripeCustomerId: customer.id
        }, { merge: true });
      } catch (e) {
        console.warn("[stripe/checkout-session] Errore salvataggio stripeCustomerId su Firestore:", e);
      }
    }

    // 2. Creazione della Checkout Session Hosted per Abbonamento Ricorrente
    const unitAmount = billingCycle === "yearly" ? planConfig.yearlyPriceCents : planConfig.monthlyPriceCents;
    const interval = billingCycle === "yearly" ? "year" : "month";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      billing_address_collection: "required",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
              metadata: {
                planType
              }
            },
            unit_amount: unitAmount,
            recurring: {
              interval: interval
            }
          },
          quantity: 1
        }
      ],
      mode: "subscription",
      metadata: {
        userId,
        planType,
        billingCycle
      },
      subscription_data: {
        metadata: {
          userId,
          planType,
          billingCycle
        }
      },
      success_url: `${baseUrl}/abbonamento-pro?status=success&session_id={CHECKOUT_SESSION_ID}&plan=${planType}&cycle=${billingCycle}`,
      cancel_url: `${baseUrl}/abbonamento-pro?status=cancelled`
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error("[stripe/checkout-session] Errore creazione sessione Stripe:", error);
    return NextResponse.json(
      { error: error?.message || "Errore interno durante la creazione della sessione di pagamento Stripe." },
      { status: 500 }
    );
  }
}
