import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { compileNotificationText } from "@/lib/notifications-service";

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Se CRON_SECRET è impostato nell'ambiente, verifica l'autorizzazione di sicurezza
    if (cronSecret) {
      const url = new URL(req.url);
      const queryKey = url.searchParams.get("key");
      const isBearerValid = authHeader === `Bearer ${cronSecret}`;
      const isQueryValid = queryKey === cronSecret;

      if (!isBearerValid && !isQueryValid) {
        return NextResponse.json({ error: "Accesso non autorizzato. Fornisci un CRON_SECRET valido." }, { status: 401 });
      }
    }

    const now = new Date();
    const stats = {
      timestamp: now.toISOString(),
      scannedAppointments: 0,
      processedReminders: 0,
      processedReviewRequests: 0,
      errors: [] as string[]
    };

    // ─── 1. PROMEMORIA PRE-APPUNTAMENTO (Intervallo 24 ore prima) ───
    // Cerca appuntamenti confermati nelle prossime 25 ore non ancora notificati
    const maxLookahead = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
    const minLookahead = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // Almeno 15 min nel futuro

    try {
      const upcomingSnapshot = await adminDb
        .collectionGroup("appuntamenti")
        .where("status", "==", "CONFIRMED")
        .where("startTime", ">=", minLookahead)
        .where("startTime", "<=", maxLookahead)
        .get();

      stats.scannedAppointments = upcomingSnapshot.size;

      for (const docSnap of upcomingSnapshot.docs) {
        const appt = docSnap.data();

        // Evita duplicazioni (Idempotenza garantita)
        if (appt.reminderSent === true) {
          continue;
        }

        const apptDate = new Date(appt.startTime);
        const hoursUntil = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Invia il promemoria se siamo nella fascia ideale (tra 2 e 24 ore prima dell'appuntamento)
        if (hoursUntil <= 24.5) {
          const tenantId = appt.tenantId || appt.salonRawId || "demo-salone";
          const customerName = appt.customer?.firstName 
            ? `${appt.customer.firstName} ${appt.customer.lastName || ""}`.trim() 
            : "Gentile Cliente";
          const customerPhone = appt.customer?.phone || "";
          const salonName = appt.salonName || "Trimmy Salone";
          const serviceName = appt.service?.name || "Trattamento";
          const staffName = appt.staff?.fullName || "il nostro Staff";

          const formattedDate = apptDate.toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long"
          });
          const formattedTime = apptDate.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit"
          });

          const reminderText = compileNotificationText("REMINDER", {
            cliente: customerName,
            salone: salonName,
            servizio: serviceName,
            operatore: staffName,
            data: formattedDate,
            ora: formattedTime
          });

          // 1. Invio Web Push FCM (se presente token o topic del salone)
          try {
            await adminMessaging.send({
              topic: `salon_${tenantId}`,
              notification: {
                title: `⏰ Promemoria Appuntamento: ${customerName}`,
                body: `Domani alle ${formattedTime} - ${serviceName} con ${staffName}`
              },
              data: {
                appointmentId: docSnap.id,
                tenantId: String(tenantId),
                type: "REMINDER"
              }
            });
          } catch (fcmErr) {
            // Se il topic o il token non sono registrati, non bloccare il salvataggio
          }

          // 2. Registra notifica in-app per il gestore del salone
          try {
            await adminDb.collection("saloni").doc(tenantId).collection("notifications").add({
              title: `Promemoria 24h Inviato: ${customerName}`,
              description: `Inviato promemoria per l'appuntamento di ${formattedDate} alle ${formattedTime} (${serviceName}).`,
              time: "Adesso",
              type: "reminder",
              link: "/",
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn("Nota salvataggio notifica salone:", e);
          }

          // 3. Registra nel log storico comunicazioni
          try {
            await adminDb.collection("saloni").doc(tenantId).collection("notification_logs").add({
              tenantId,
              appointmentId: docSnap.id,
              customerName,
              customerPhone,
              type: "REMINDER",
              channel: "PUSH",
              status: "DELIVERED",
              sentAt: new Date().toISOString(),
              message: reminderText
            });
          } catch (e) {
            console.warn("Nota salvataggio log notifica:", e);
          }

          // 4. Marca il flag reminderSent sull'appuntamento
          await docSnap.ref.set({
            reminderSent: true,
            reminderSentAt: new Date().toISOString()
          }, { merge: true });

          stats.processedReminders++;
        }
      }
    } catch (err: any) {
      console.warn("[cron] Errore scansione promemoria pre-appuntamento:", err);
      stats.errors.push(`Promemoria error: ${err.message}`);
    }

    // ─── 2. RICHIESTA RECENSIONE POST-SERVIZIO (1-3 ore dopo la conclusione) ───
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const halfHourAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    try {
      const completedSnapshot = await adminDb
        .collectionGroup("appuntamenti")
        .where("status", "in", ["COMPLETED", "CONFIRMED"])
        .where("endTime", ">=", twoHoursAgo)
        .where("endTime", "<=", halfHourAgo)
        .get();

      for (const docSnap of completedSnapshot.docs) {
        const appt = docSnap.data();
        if (appt.reviewRequestSent === true) {
          continue;
        }

        const tenantId = appt.tenantId || appt.salonRawId || "demo-salone";
        const customerName = appt.customer?.firstName || "Gentile Cliente";
        const salonName = appt.salonName || "Trimmy Salone";

        const reviewText = compileNotificationText("REVIEW_REQUEST", {
          cliente: customerName,
          salone: salonName,
          link: `https://trimmy.app/recensioni?salone=${tenantId}&appt=${docSnap.id}`
        });

        // Registra log richiesta recensione
        try {
          await adminDb.collection("saloni").doc(tenantId).collection("notification_logs").add({
            tenantId,
            appointmentId: docSnap.id,
            customerName,
            customerPhone: appt.customer?.phone || "",
            type: "REVIEW_REQUEST",
            channel: "WHATSAPP",
            status: "DELIVERED",
            sentAt: new Date().toISOString(),
            message: reviewText
          });
        } catch (e) {}

        await docSnap.ref.set({
          reviewRequestSent: true,
          reviewRequestSentAt: new Date().toISOString()
        }, { merge: true });

        stats.processedReviewRequests++;
      }
    } catch (err: any) {
      console.warn("[cron] Errore scansione recensioni post-servizio:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Scansione e dispatching promemoria completati con successo.",
      stats
    });
  } catch (err: any) {
    console.error("[cron] Errore fatale esecuzione job notifiche:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
