import { adminDb } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface RateLimitOptions {
  windowMs?: number;      // Finestra temporale in millisecondi (default 60_000 = 1 min)
  maxRequests?: number;   // Max richieste consentite nella finestra (default 30)
  scope?: string;         // Categoria o nome dell'endpoint (es. "notifications_send")
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

// Fallback in-memory per resilienza fail-open se Firestore non è momentaneamente raggiungibile
const fallbackMemoryMap = new Map<string, { count: number; windowStart: number }>();

/**
 * Rate Limiter Distribuito Multi-Tenant per Google Cloud Run e Next.js App Router (OPT-02).
 * 
 * 1. Utilizza una transazione atomica ACID su Cloud Firestore (`system_rate_limits`)
 *    garantendo che il conteggio sia rigorosamente condiviso tra tutte le istanze parallele
 *    di Cloud Run, prevenendo bypass tramite round-robin.
 * 2. Non utilizza timer in background (`setInterval`), eliminando memory leak e problemi di
 *    CPU throttling nei runtime serverless.
 * 3. In caso di errore o assenza di connettività database (es. sviluppo locale offline),
 *    esegue un fallback graceful in-memory senza interrompere il servizio (Fail-Open).
 */
export async function checkDistributedRateLimit(
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const windowMs = options.windowMs || 60 * 1000;
  const maxRequests = options.maxRequests || 30;
  const scope = options.scope || "api";
  const docId = `${scope}_${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const now = Date.now();

  // ─── 1. TENTATIVO TRAMITE FIRESTORE DISTRIBUITO ───
  try {
    const docRef = adminDb.collection("system_rate_limits").doc(docId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          expiresAt: Timestamp.fromMillis(now + windowMs),
          scope,
          key,
        });
        return {
          allowed: true,
          limit: maxRequests,
          remaining: maxRequests - 1,
          resetSeconds: Math.ceil(windowMs / 1000),
        };
      }

      const data = snap.data();
      const windowStart = data?.windowStart || now;
      const count = data?.count || 0;

      // Se la finestra temporale è scaduta: reset del contatore
      if (now - windowStart > windowMs) {
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          expiresAt: Timestamp.fromMillis(now + windowMs),
          scope,
          key,
        });
        return {
          allowed: true,
          limit: maxRequests,
          remaining: maxRequests - 1,
          resetSeconds: Math.ceil(windowMs / 1000),
        };
      }

      const elapsed = now - windowStart;
      const resetSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));

      // Limite superato per questa finestra
      if (count >= maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetSeconds,
        };
      }

      // Incremento del conteggio
      transaction.update(docRef, {
        count: count + 1,
        expiresAt: Timestamp.fromMillis(now + windowMs),
      });

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - (count + 1)),
        resetSeconds,
      };
    });

    return result;
  } catch (err) {
    // ─── 2. FALLBACK IN-MEMORY (Fail-Open) ───
    console.warn("[RateLimiter] Fallback in-memory:", (err as any)?.message || err);

    const memKey = `${scope}:${key}`;
    const entry = fallbackMemoryMap.get(memKey);

    if (!entry || now - entry.windowStart > windowMs) {
      fallbackMemoryMap.set(memKey, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetSeconds: Math.ceil(windowMs / 1000),
      };
    }

    const elapsed = now - entry.windowStart;
    const resetSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetSeconds,
      };
    }

    entry.count++;
    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      resetSeconds,
    };
  }
}
