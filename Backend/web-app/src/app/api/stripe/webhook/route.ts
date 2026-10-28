import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !isStripeConfigured()) {
    return NextResponse.json({ received: true, note: "Stripe not configured or in demo mode" });
  }

  let event: any;

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // In sviluppo se il secret del webhook non è ancora configurato, usa il json grezzo
      event = JSON.parse(rawBody);
      console.warn("[stripe/webhook] Webhook elaborato senza verifica firma crittografica (STRIPE_WEBHOOK_SECRET mancante).");
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] Errore verifica webhook: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType as "MEDIUM" | "PRO" | undefined;
        const billingCycle = session.metadata?.billingCycle as "monthly" | "yearly" | undefined;

        if (userId && planType) {
          let periodEndIso: string | undefined;

          if (session.subscription && typeof session.subscription === "string") {
            try {
              const sub: any = await stripe.subscriptions.retrieve(session.subscription);
              if (sub && sub.current_period_end) {
                periodEndIso = new Date(sub.current_period_end * 1000).toISOString();
              }
            } catch (e) {
              console.warn("[stripe/webhook] Errore recupero subscription da Stripe:", e);
            }
          }

          const staffCount = planType === "PRO" ? 10 : 3;

          // Aggiorna profilo utente su Cloud Firestore
          await adminDb.collection("users").doc(userId).set({
            planType,
            planStatus: "ACTIVE",
            billingPeriod: billingCycle || "monthly",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            ...(periodEndIso ? { subscriptionCurrentPeriodEnd: periodEndIso } : {}),
            staffCount,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Invia notifica di sistema al salone
          await adminDb.collection("saloni").doc(userId).collection("notifications").add({
            title: `Abbonamento ${planType} Attivato! 💳`,
            description: `Il pagamento per il piano ${planType} (${billingCycle === "yearly" ? "Annuale" : "Mensile"}) è confermato. Tutte le funzionalità premium sono operative.`,
            time: "Adesso",
            type: "system",
            link: "/abbonamento-pro",
            createdAt: new Date().toISOString()
          });

          console.info(`[stripe/webhook] Abbonamento ${planType} attivato con successo per utente ${userId}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;
        if (customerId) {
          const snapshot = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).get();
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await userDoc.ref.set({
              planStatus: "ACTIVE",
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;
        if (customerId) {
          const snapshot = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).get();
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await userDoc.ref.set({
              planStatus: "PAYMENT_REQUIRED",
              updatedAt: new Date().toISOString()
            }, { merge: true });

            await adminDb.collection("saloni").doc(userDoc.id).collection("notifications").add({
              title: "Attenzione: Pagamento non riuscito ⚠️",
              description: "Non siamo riusciti a rinnovare il tuo abbonamento. Per favore aggiorna il metodo di pagamento per mantenere attive le funzioni premium.",
              time: "Adesso",
              type: "system",
              link: "/abbonamento-pro",
              createdAt: new Date().toISOString()
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        if (customerId) {
          const snapshot = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).get();
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await userDoc.ref.set({
              planType: "FREE",
              planStatus: "CANCELLED",
              staffCount: 1,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            await adminDb.collection("saloni").doc(userDoc.id).collection("notifications").add({
              title: "Abbonamento Terminato",
              description: "Il tuo abbonamento è scaduto o è stato annullato. Il salone è tornato al piano gratuito Base.",
              time: "Adesso",
              type: "system",
              link: "/abbonamento-pro",
              createdAt: new Date().toISOString()
            });
          }
        }
        break;
      }

      default:
        // Evento non gestito
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[stripe/webhook] Errore esecuzione evento webhook:", error);
    return NextResponse.json({ error: "Errore interno durante il processamento webhook" }, { status: 500 });
  }
}
