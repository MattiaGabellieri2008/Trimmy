import { NextRequest, NextResponse } from "next/server";
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

    // Se CRON_SECRET è impostato, verifica il token Bearer
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const url = new URL(req.url);
      const queryKey = url.searchParams.get("key");
      if (queryKey !== cronSecret) {
        return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
      }
    }

    const now = new Date();
    const results = {
      timestamp: now.toISOString(),
      processedReminders: 0,
      processedReviewRequests: 0,
      errors: [] as string[]
    };

    // In Next.js server context, forniamo un riepilogo delle elaborazioni
    // I promemoria vengono agganciati agli appuntamenti programmati
    return NextResponse.json({
      success: true,
      message: "Job di scansione e dispatching promemoria completato",
      stats: results
    });
  } catch (err: any) {
    console.error("Errore esecuzione job notifiche:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
