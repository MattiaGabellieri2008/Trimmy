import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminMessaging } from "@/lib/firebase-admin";

// ─── RATE LIMITER IN-MEMORY (per istanza) ───
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30; // max 30 notifiche al minuto

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

// Pulizia periodica della mappa per evitare memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS * 5);

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

    // ─── 2. RATE LIMITING ───
    if (isRateLimited(callerUid)) {
      return NextResponse.json(
        { success: false, error: "Troppe notifiche richieste. Attendi un momento prima di riprovare." },
        { status: 429 }
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

    // ─── 4. AUTORIZZAZIONE: Il titolare del salone può inviare qualsiasi notifica/comunicazione;
    // un cliente autenticato può inviare SOLO la notifica di conferma del proprio appuntamento ("CONFIRMATION").
    const isSalonOwner = callerUid === tenantId;
    const isBookingConfirmation = type === "CONFIRMATION";

    if (!isSalonOwner && !isBookingConfirmation) {
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
