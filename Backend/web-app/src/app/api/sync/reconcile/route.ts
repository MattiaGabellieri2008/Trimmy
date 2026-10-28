import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

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
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { success: false, error: "Token non valido o scaduto." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId || "tenant-default";

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
      reconciled: reconciledCount,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Errore API reconcile:", err);
    return NextResponse.json({
      success: false,
      error: err?.message || "Errore interno durante la riconciliazione"
    }, { status: 500 });
  }
}

