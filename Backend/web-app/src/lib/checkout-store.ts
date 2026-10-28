import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { getSalonTenantId } from "./tenant-helper";
import { updateSalonAppointmentStatus } from "./appointments-service";
import { addSalonNotification } from "./salon-notifications";
import { decrementStockForCheckout } from "./inventory-store";

export type PaymentMethod = "CASH" | "CARD" | "MIXED" | "SATISPAY" | "VOUCHER";

export interface CheckoutItem {
  id: string;
  type: "SERVICE" | "PRODUCT";
  name: string;
  price: number;
  quantity: number;
  operatorId?: string;
  operatorName?: string;
}

export interface CheckoutTransaction {
  id: string;
  tenantId: string;
  salonRawId?: string;
  appointmentId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: CheckoutItem[];
  totalAmount: number;
  discountAmount?: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  paymentDetails?: {
    cashGiven?: number;
    changeGiven?: number;
    cashAmount?: number; // per pagamento misto
    cardAmount?: number; // per pagamento misto
    voucherCode?: string;
    notes?: string;
  };
  receiptNumber: string;
  taxRate?: number; // es. 22%
  operatorName?: string;
  issuedAt: string; // ISO
}

export interface DailyCashClosing {
  dateStr: string; // YYYY-MM-DD
  tenantId: string;
  closedAt: string; // ISO
  totalRevenue: number;
  cashTotal: number;
  cardTotal: number;
  satispayTotal: number;
  voucherTotal: number;
  transactionsCount: number;
  averageTicket: number;
  topTreatments: { name: string; count: number; revenue: number }[];
  closedBy?: string;
  notes?: string;
}

// Catalogo prodotti da banco predefiniti per vendita diretta rapida
export const DEFAULT_RETAIL_PRODUCTS: CheckoutItem[] = [
  { id: "prod-1", type: "PRODUCT", name: "Shampoo Ristrutturante Bio 250ml", price: 18.0, quantity: 1 },
  { id: "prod-2", type: "PRODUCT", name: "Cera Opaca Forte Barber 100ml", price: 16.5, quantity: 1 },
  { id: "prod-3", type: "PRODUCT", name: "Olio da Barba Lenitivo Eucalipto 50ml", price: 22.0, quantity: 1 },
  { id: "prod-4", type: "PRODUCT", name: "Maschera Nutriente Keratina 200ml", price: 24.0, quantity: 1 },
  { id: "prod-5", type: "PRODUCT", name: "Lacca Fissante Professionale 300ml", price: 14.0, quantity: 1 },
  { id: "prod-6", type: "PRODUCT", name: "Lozione Energizzante Cute 100ml", price: 26.0, quantity: 1 }
];

const TRANSACTIONS_KEY_PREFIX = "trimmy_transactions_";
const CLOSINGS_KEY_PREFIX = "trimmy_closings_";

/**
 * Salva una transazione di cassa sia su Cloud Firestore che nella cache locale
 */
export async function saveCheckoutTransaction(
  tenantId: string,
  transaction: CheckoutTransaction
): Promise<void> {
  const tid = getSalonTenantId(tenantId);
  const normalized: CheckoutTransaction = {
    ...transaction,
    tenantId: tid,
    issuedAt: transaction.issuedAt || new Date().toISOString()
  };

  // 1. Salva in cache locale sincrona
  if (typeof window !== "undefined") {
    try {
      const existing = getLocalTransactions(tid);
      const updated = [normalized, ...existing.filter((t) => t.id !== normalized.id)];
      localStorage.setItem(`${TRANSACTIONS_KEY_PREFIX}${tid}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("Errore cache transazione locale:", e);
    }
  }

  // 2. Salva su Cloud Firestore nella sotto-collezione del salone
  try {
    const docRef = doc(db, "saloni", tid, "transactions", normalized.id);
    await setDoc(docRef, normalized, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio transazione Firestore:", err);
  }

  // 3. Se associata a un appuntamento, imposta lo stato a COMPLETED
  if (normalized.appointmentId) {
    try {
      await updateSalonAppointmentStatus(tid, normalized.salonRawId, normalized.appointmentId, "COMPLETED");
      const apptDocRef = doc(db, "saloni", tid, "appuntamenti", normalized.appointmentId);
      await setDoc(apptDocRef, {
        status: "COMPLETED",
        paid: true,
        transactionId: normalized.id,
        paidAt: normalized.issuedAt
      }, { merge: true });
    } catch (e) {
      console.warn("Nota aggiornamento appuntamento saldato:", e);
    }
  }

  // 3.5 Scarico automatico immediato delle scorte di magazzino per i prodotti venduti
  try {
    await decrementStockForCheckout(tid, normalized.items, normalized.operatorName || "Staff Cassa");
  } catch (e) {
    console.warn("Nota scarico magazzino per transazione:", e);
  }

  // 4. Invia notifica di sistema per il salone
  addSalonNotification(tid, {
    id: `notif-cassa-${normalized.id}`,
    title: `Incasso Registrato: €${normalized.finalAmount.toFixed(2)} 🧾`,
    description: `Incasso #${normalized.receiptNumber} da ${normalized.customerName} via ${normalized.paymentMethod}.`,
    time: "Adesso",
    type: "system",
    link: "/"
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

/**
 * Lettura transazioni dalla cache locale
 */
export function getLocalTransactions(tenantId: string): CheckoutTransaction[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const raw = localStorage.getItem(`${TRANSACTIONS_KEY_PREFIX}${getSalonTenantId(tenantId)}`);
    return raw ? (JSON.parse(raw) as CheckoutTransaction[]) : [];
  } catch {
    return [];
  }
}

/**
 * Recupera le transazioni per una data specifica (YYYY-MM-DD)
 */
export async function fetchCheckoutTransactions(
  tenantId: string,
  dateStr: string
): Promise<CheckoutTransaction[]> {
  const tid = getSalonTenantId(tenantId);
  const localList = getLocalTransactions(tid);

  // Prova da Cloud Firestore
  try {
    const startIso = `${dateStr}T00:00:00.000Z`;
    const endIso = `${dateStr}T23:59:59.999Z`;

    const colRef = collection(db, "saloni", tid, "transactions");
    const q = query(
      colRef,
      where("issuedAt", ">=", startIso),
      where("issuedAt", "<=", endIso),
      orderBy("issuedAt", "desc")
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const cloudList = snap.docs.map((d) => d.data() as CheckoutTransaction);
      // Aggiorna cache
      if (typeof window !== "undefined") {
        const other = localList.filter((t) => !t.issuedAt.startsWith(dateStr));
        localStorage.setItem(`${TRANSACTIONS_KEY_PREFIX}${tid}`, JSON.stringify([...cloudList, ...other]));
      }
      return cloudList;
    }
  } catch (err) {
    console.warn("Nota lettura transazioni Firestore:", err);
  }

  // Fallback locale filtrato per data
  return localList.filter((t) => t.issuedAt.startsWith(dateStr));
}

/**
 * Calcola l'aggregato di Chiusura Cassa per una data (Z di cassa)
 */
export function calculateDailyCashClosing(
  tenantId: string,
  dateStr: string,
  transactions: CheckoutTransaction[]
): DailyCashClosing {
  const tid = getSalonTenantId(tenantId);
  let totalRevenue = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let satispayTotal = 0;
  let voucherTotal = 0;

  const treatmentMap = new Map<string, { count: number; revenue: number }>();

  transactions.forEach((tr) => {
    totalRevenue += tr.finalAmount;

    if (tr.paymentMethod === "CASH") {
      cashTotal += tr.finalAmount;
    } else if (tr.paymentMethod === "CARD") {
      cardTotal += tr.finalAmount;
    } else if (tr.paymentMethod === "SATISPAY") {
      satispayTotal += tr.finalAmount;
    } else if (tr.paymentMethod === "VOUCHER") {
      voucherTotal += tr.finalAmount;
    } else if (tr.paymentMethod === "MIXED") {
      cashTotal += tr.paymentDetails?.cashAmount || 0;
      cardTotal += tr.paymentDetails?.cardAmount || 0;
    }

    // Aggregazione trattamenti e prodotti
    tr.items.forEach((item) => {
      const existing = treatmentMap.get(item.name) || { count: 0, revenue: 0 };
      existing.count += item.quantity;
      existing.revenue += item.price * item.quantity;
      treatmentMap.set(item.name, existing);
    });
  });

  const topTreatments = Array.from(treatmentMap.entries())
    .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const averageTicket = transactions.length > 0 ? totalRevenue / transactions.length : 0;

  return {
    dateStr,
    tenantId: tid,
    closedAt: new Date().toISOString(),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    cashTotal: Number(cashTotal.toFixed(2)),
    cardTotal: Number(cardTotal.toFixed(2)),
    satispayTotal: Number(satispayTotal.toFixed(2)),
    voucherTotal: Number(voucherTotal.toFixed(2)),
    transactionsCount: transactions.length,
    averageTicket: Number(averageTicket.toFixed(2)),
    topTreatments
  };
}

/**
 * Salva la chiusura giornaliera (Z-Report)
 */
export async function saveDailyCashClosing(
  tenantId: string,
  closing: DailyCashClosing
): Promise<void> {
  const tid = getSalonTenantId(tenantId);

  // Cache locale
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${CLOSINGS_KEY_PREFIX}${tid}_${closing.dateStr}`, JSON.stringify(closing));
    } catch (e) {}
  }

  // Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tid, "daily_closings", closing.dateStr);
    await setDoc(docRef, closing, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio chiusura cassa Firestore:", err);
  }

  addSalonNotification(tid, {
    id: `notif-chiusura-${closing.dateStr}`,
    title: `Chiusura Cassa Registrata (${closing.dateStr}) 🔒`,
    description: `Totale Incassato: €${closing.totalRevenue.toFixed(2)} (${closing.transactionsCount} scontrini). Cassa chiusa e sigillata.`,
    time: "Adesso",
    type: "system",
    link: "/"
  });
}

/**
 * Recupera la chiusura giornaliera registrata per una specifica data
 */
export async function getDailyCashClosing(
  tenantId: string,
  dateStr: string
): Promise<DailyCashClosing | null> {
  const tid = getSalonTenantId(tenantId);
  // 1. Prova da cache locale
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${CLOSINGS_KEY_PREFIX}${tid}_${dateStr}`);
      if (raw) return JSON.parse(raw);
    } catch {}
  }

  // 2. Prova da Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tid, "daily_closings", dateStr);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DailyCashClosing;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`${CLOSINGS_KEY_PREFIX}${tid}_${dateStr}`, JSON.stringify(data));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.warn("Nota lettura chiusura cassa Firestore:", err);
  }

  return null;
}
