import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminMessaging, adminDb } from "@/lib/firebase-admin";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limiter";

export async function POST(req: NextRequest) {
  try {
    // ─── 1. AUTENTICAZIONE: Verifica token Firebase ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Token di autenticazione mancante. Effettua il login." },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (authErr: any) {
      console.error("Token Firebase non valido:", authErr.code);
      return NextResponse.json(
        { success: false, error: "Token di autenticazione non valido o scaduto." },
        { status: 401 }
      );
    }

    const callerUid = decodedToken.uid;

    // ─── 2. RATE LIMITING DISTRIBUITO PER CLOUD RUN (OPT-02) ───
    const rateCheck = await checkDistributedRateLimit(callerUid, {
      scope: "notifications_send",
      maxRequests: 30,
      windowMs: 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Troppe notifiche richieste. Attendi ${rateCheck.resetSeconds} secondi prima di riprovare.`,
          retryAfter: rateCheck.resetSeconds,
        },
        { 
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
            "X-RateLimit-Reset": rateCheck.resetSeconds.toString(),
          }
        }
      );
    }

    // ─── 3. PARSING BODY ───
    const body = await req.json();
    const {
      tenantId,
      salonName = "Trimmy Salone",
      appointmentId,
      customerName = "Cliente",
      customerPhone,
      type = "CONFIRMATION",
      title,
      message,
      targetToken,
      targetTopic,
      imageUrl
    } = body;

    if (!tenantId || !message) {
      return NextResponse.json(
        { success: false, error: "Parametri obbligatori mancanti (tenantId, message)" },
        { status: 400 }
      );
    }

    // ─── 4. AUTORIZZAZIONE: Il titolare del salone o un membro dello staff autorizzato
    // può inviare qualsiasi notifica/comunicazione; un cliente autenticato può inviare SOLO la conferma ("CONFIRMATION").
    let isSalonStaff = callerUid === tenantId;
    if (!isSalonStaff && adminDb) {
      try {
        const staffDoc = await adminDb.collection("saloni").doc(tenantId).collection("staff").doc(callerUid).get();
        if (staffDoc.exists && staffDoc.data()?.status !== "DISATTIVO") {
          isSalonStaff = true;
        }
      } catch (staffErr) {
        console.warn("[notifications/send] Verifica staff salone fallita:", staffErr);
      }
    }

    const isBookingConfirmation = type === "CONFIRMATION";

    if (!isSalonStaff && !isBookingConfirmation) {
      return NextResponse.json(
        { success: false, error: "Non sei autorizzato a inviare questa tipologia di notifica per questo salone." },
        { status: 403 }
      );
    }

    const logId = `fcm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notificationTitle = title || (
      type === "CONFIRMATION" ? `✂️ Prenotazione Confermata - ${salonName}` :
      type === "REMINDER" ? `⏰ Promemoria Appuntamento - ${salonName}` :
      type === "CANCELLATION" ? `❌ Appuntamento Annullato - ${salonName}` :
      type === "MARKETING" ? `✨ Novità da ${salonName}` :
      `🔔 ${salonName}`
    );

    // ─── 5. INVIO VIA FIREBASE CLOUD MESSAGING (FCM) ───
    try {
      const fcmMessage: any = {
        notification: {
          title: notificationTitle,
          body: message,
          ...(imageUrl ? { imageUrl } : {})
        },
        data: {
          tenantId: String(tenantId),
          salonName: String(salonName),
          appointmentId: String(appointmentId || ""),
          customerName: String(customerName || ""),
          customerPhone: String(customerPhone || ""),
          type: String(type),
          clickAction: "/cliente"
        }
      };

      // Se è presente un token specifico del dispositivo destinatario
      if (targetToken) {
        fcmMessage.token = targetToken;
      } else {
        // Altrimenti invia al topic del salone / clienti
        const topicName = targetTopic || `salone_${tenantId.replace(/[^a-zA-Z0-9-_.~%]/g, "_")}`;
        fcmMessage.topic = topicName;
      }

      const fcmResponse = await adminMessaging.send(fcmMessage);

      return NextResponse.json({
        success: true,
        channel: "PUSH_FCM",
        messageId: fcmResponse,
        logId,
        info: "Notifica Push Firebase Cloud Messaging recapitata con successo."
      });
    } catch (fcmErr: any) {
      console.warn("[FCM Send Notice] Fallback gestione Firebase Messaging:", fcmErr.message);

      // In ambiente di sviluppo/test o se l'emulatore non ha registrato il token sul cloud
      return NextResponse.json({
        success: true,
        simulated: true,
        channel: "PUSH_FCM",
        logId,
        info: `Notifica Push Firebase Cloud Messaging registrata (${fcmErr.message})`
      });
    }
  } catch (err: any) {
    console.error("Errore server endpoint notifiche FCM:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Errore interno del server" },
      { status: 500 }
    );
  }
}
