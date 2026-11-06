import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type AuditAction =
  | "VIEW_TECHNICAL_NOTES"
  | "UPDATE_TECHNICAL_NOTES"
  | "DELETE_CUSTOMER"
  | "EXPORT_CUSTOMERS_PII"
  | "PRINT_FISCAL_CLOSING";

export interface AuditLogPayload {
  salonId: string;
  action: AuditAction;
  performedByUid?: string;
  performedByRole?: string;
  targetEntityId?: string;
  targetCustomerId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Registra un evento di audit immutabile per tracciamento di conformità GDPR (Art. 9, Art. 30).
 * Memorizza nel sotto-registro protetto `/saloni/{salonId}/audit_logs/{logId}`.
 */
export async function logSecurityAuditEvent(payload: AuditLogPayload): Promise<void> {
  try {
    if (!payload.salonId) return;
    const auditColl = collection(db, "saloni", payload.salonId, "audit_logs");
    await addDoc(auditColl, {
      ...payload,
      timestamp: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[AuditLogger] Impossibile registrare evento di audit di sicurezza:", err);
  }
}
