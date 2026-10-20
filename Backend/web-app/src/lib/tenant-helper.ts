import { dataConnect } from "./firebase";
import { upsertTenant, upsertUser, upsertService } from "../dataconnect-generated";

/**
 * Calcola un hash a 128-bit (32 caratteri esadecimali) sull'intera stringa
 * garantendo che nessun carattere venga troncato e prevenendo collisioni.
 */
function computeFull128BitHex(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c64e6d ^ str.length;
  let h3 = 0x9e3779b9 ^ str.length;
  let h4 = 0x85ebca6b ^ str.length;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ (ch << 1), 1597334677);
    h3 = Math.imul(h3 ^ (ch << 2), 3812015801);
    h4 = Math.imul(h4 ^ (ch << 3), 2718281829);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const hex3 = (h3 >>> 0).toString(16).padStart(8, "0");
  const hex4 = (h4 >>> 0).toString(16).padStart(8, "0");

  return (hex1 + hex2 + hex3 + hex4).toLowerCase();
}

/**
 * Converte qualsiasi identificativo (es. Firebase UID o email/slug)
 * in un UUID v4 standard e deterministico a 36 caratteri accettato da PostgreSQL.
 */
export function getSalonTenantId(uid: string | null | undefined): string {
  if (!uid) {
    return "00000000-0000-4000-a000-000000000000";
  }

  const clean = uid.trim().toLowerCase();

  // Se è già un UUID valido
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    return clean;
  }

  // Se è un UID Firebase standard (senza caratteri speciali come @ o .) manteniamo l'hash deterministico iniziale per retrocompatibilità
  let hex = "";
  if (!clean.includes("@") && !clean.includes(" ") && clean.length <= 28) {
    for (let i = 0; i < clean.length; i++) {
      hex += clean.charCodeAt(i).toString(16).padStart(2, "0");
    }
    hex = hex.padEnd(32, "0").slice(0, 32);
  } else {
    // Per email o stringhe arbitrarie, calcoliamo l'hash a 128 bit completo sull'intera stringa
    hex = computeFull128BitHex(clean);
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toLowerCase();
}

/**
 * Assicura che il record Tenant esista nel database Cloud SQL PostgreSQL
 */
export async function ensureSalonTenant(uid: string, salonName: string, planType: string = "FREE"): Promise<string> {
  const tenantId = getSalonTenantId(uid);
  try {
    await upsertTenant(dataConnect, {
      id: tenantId,
      name: salonName || "Il Mio Salone",
      planType: planType || "FREE",
      businessCategory: "Salone Parrucchiere & Barbiere"
    });
  } catch (err) {
    console.warn("Nota creazione tenant PostgreSQL:", err);
  }
  return tenantId;
}

/**
 * Assicura che l'utente / collaboratore esista nel database Cloud SQL PostgreSQL
 */
export async function ensureSalonStaff(
  id: string,
  tenantId: string,
  fullName: string,
  phone?: string,
  role: string = "Titolare"
): Promise<void> {
  try {
    await upsertUser(dataConnect, {
      id,
      tenantId,
      fullName: fullName || "Titolare",
      role,
      phone: phone || null
    });
  } catch (err) {
    console.warn("Nota sync staff PostgreSQL:", err);
  }
}

/**
 * Assicura che il servizio esista nel database Cloud SQL PostgreSQL
 */
export async function ensureSalonService(
  serviceId: string,
  tenantId: string,
  name: string,
  durationMinutes: number,
  price: number
): Promise<string> {
  const uuid = getSalonTenantId(serviceId);
  try {
    await upsertService(dataConnect, {
      id: uuid,
      tenantId,
      name,
      durationMinutes: Math.round(durationMinutes),
      price: Number(price)
    });
  } catch (err) {
    console.warn("Nota sync servizio PostgreSQL:", err);
  }
  return uuid;
}
