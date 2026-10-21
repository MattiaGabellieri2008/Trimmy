import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      tenantId, 
      salonName = "Trimmy Salone", 
      appointmentId, 
      customerName = "Cliente", 
      customerPhone, 
      type = "CONFIRMATION", 
      channel = "WHATSAPP", 
      message 
    } = body;

    if (!tenantId || !customerPhone || !message) {
      return NextResponse.json(
        { success: false, error: "Parametri obbligatori mancanti (tenantId, customerPhone, message)" },
        { status: 400 }
      );
    }

    const logId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSmsFrom = process.env.TWILIO_PHONE_NUMBER;
    const twilioWaFrom = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

    // Verifica se sono configurate credenziali live per Twilio o se siamo in modalità simulatore
    const hasLiveGateway = Boolean(twilioSid && twilioToken);

    if (hasLiveGateway) {
      try {
        const isWhatsApp = channel === "WHATSAPP" || channel === "BOTH";
        const fromNumber = isWhatsApp ? twilioWaFrom : twilioSmsFrom;
        const toNumber = isWhatsApp ? (customerPhone.startsWith("whatsapp:") ? customerPhone : `whatsapp:${customerPhone}`) : customerPhone;

        const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

        const formBody = new URLSearchParams();
        formBody.append("To", toNumber);
        formBody.append("From", fromNumber || "");
        formBody.append("Body", message);

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formBody.toString()
        });

        const twilioData = await twilioRes.json();

        if (!twilioRes.ok) {
          console.error("Errore risposta gateway Twilio:", twilioData);
          return NextResponse.json({
            success: false,
            simulated: false,
            error: twilioData.message || "Errore gateway SMS/WhatsApp",
            logId
          }, { status: 502 });
        }

        return NextResponse.json({
          success: true,
          simulated: false,
          providerSid: twilioData.sid,
          logId
        });
      } catch (gatewayErr: any) {
        console.error("Eccezione durante l'invio via gateway:", gatewayErr);
        return NextResponse.json({
          success: false,
          simulated: false,
          error: gatewayErr.message || "Impossibile contattare il gateway esterno",
          logId
        }, { status: 500 });
      }
    }

    // Modalità Sandbox / Simulatore Firebase Blaze:
    // Utile in sviluppo e staging prima dell'inserimento delle credenziali Twilio
    console.log(`[TRIMMY NOTIFICATION SIMULATOR]`);
    console.log(`To: ${customerPhone} (${customerName}) | Channel: ${channel} | Type: ${type}`);
    console.log(`Message: "${message}"`);
    console.log(`----------------------------------------------------------------`);

    return NextResponse.json({
      success: true,
      simulated: true,
      logId,
      info: "Notifica simulata con successo (credenziali Twilio non configurate in .env.local). Operazione registrata."
    });
  } catch (err: any) {
    console.error("Errore server endpoint notifiche:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Errore interno del server" },
      { status: 500 }
    );
  }
}
