import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Autenticazione richiesta per la riconciliazione." },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedUser;
    try {
      decodedUser = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { success: false, error: "Token non valido o scaduto." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId || decodedUser.uid || "tenant-default";

    // ─── RATE LIMITING DISTRIBUITO PER CLOUD RUN (OPT-02) ───
    const rateCheck = await checkDistributedRateLimit(tenantId, {
      scope: "sync_reconcile",
      maxRequests: 20,
      windowMs: 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Troppe richieste di sincronizzazione. Attendi ${rateCheck.resetSeconds} secondi.`,
          retryAfter: rateCheck.resetSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
            "X-RateLimit-Reset": rateCheck.resetSeconds.toString(),
          },
        }
      );
    }

    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: "Firebase Admin non inizializzato sul server"
      }, { status: 500 });
    }

    // Lettura di tutti gli appuntamenti del salone da Cloud Firestore
    const snapshot = await adminDb
      .collection("saloni")
      .doc(tenantId)
      .collection("appuntamenti")
      .get();

    const appts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    let reconciledCount = 0;

    // Riconciliazione: assicuriamo che ogni appuntamento abbia i timestamp LWW corretti
    const batch = adminDb.batch();
    for (const appt of appts as any[]) {
      if (!appt.updatedAt) {
        const ref = adminDb.collection("saloni").doc(tenantId).collection("appuntamenti").doc(appt.id);
        batch.set(ref, {
          updatedAt: appt.createdAt || new Date().toISOString()
        }, { merge: true });
        reconciledCount++;
      }
    }

    if (reconciledCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      tenantId,
      totalChecked: appts.length,
      reconciledCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Errore server riconciliazione sync:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Errore interno durante la riconciliazione"
    }, { status: 500 });
  }
}
