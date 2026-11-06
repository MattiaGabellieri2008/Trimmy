import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  runTransaction 
} from "firebase/firestore";
import { getSalonTenantId } from "./tenant-helper";
import { addSalonNotification } from "./salon-notifications";
import { CheckoutItem } from "./checkout-store";

export type ProductCategory = "RIVENDITA" | "USO_INTERNO";

export interface ProductItem {
  id: string;
  tenantId: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subCategory?: string;
  barcode?: string;
  costPrice: number;     // Prezzo d'acquisto dal fornitore (es. 8.50 €)
  retailPrice: number;   // Prezzo di vendita al cliente (es. 22.00 €) - 0 per uso interno
  stockQuantity: number; // Giacenza attuale in pezzi/flaconi
  minStockThreshold: number; // Soglia minima di sicurezza per alert riordino (es. 3)
  unit: string;          // es. "pz", "ml", "flacone"
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

export type StockMovementType = 
  | "SALE_POS"            // Scarico automatico da vendita al Punto Cassa
  | "CARICO_FORNITORE"    // Nuovo ordine arrivato dal grossista/fornitore
  | "CONSUMO_INTERNO"     // Utilizzo in salone durante servizio tecnico (tinture, ecc.)
  | "RETTIFICA_MANUALE"   // Conteggio inventario periodico o correzione
  | "RESO_CLIENTE";       // Prodotto restituito dal cliente

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  delta: number;          // es. -1 (scarico) o +10 (carico)
  previousStock: number;
  newStock: number;
  reason?: string;
  operatorName?: string;
  timestamp: string;      // ISO
}

// Prodotti dimostrativi di alta gamma per saloni
export const INITIAL_PRODUCTS_SEED: Omit<ProductItem, "tenantId">[] = [];

const STORAGE_PRODUCTS_KEY = "trimmy_products_";
const STORAGE_MOVEMENTS_KEY = "trimmy_stock_movements_";

/**
 * Lettura sincrona dei prodotti dalla cache locale
 */
export function getLocalProducts(tenantId: string): ProductItem[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const tid = getSalonTenantId(tenantId);
    const raw = localStorage.getItem(`${STORAGE_PRODUCTS_KEY}${tid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ProductItem[];
      return parsed.filter((p) => !p.isDeleted);
    }
  } catch {}
  return [];
}

/**
 * Inizializza i prodotti di default per un salone se vuoto
 */
function initializeDefaultProducts(tenantId: string): ProductItem[] {
  const tid = getSalonTenantId(tenantId);
  const seeded = INITIAL_PRODUCTS_SEED.map((p) => ({
    ...p,
    tenantId: tid
  }));
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PRODUCTS_KEY}${tid}`, JSON.stringify(seeded));
    } catch {}
  }
  return seeded;
}

/**
 * Recupera l'elenco dei prodotti del salone da Cloud Firestore (o fallback su cache/seed)
 */
export async function fetchSalonProducts(tenantId: string): Promise<ProductItem[]> {
  const tid = getSalonTenantId(tenantId);
  const local = getLocalProducts(tid);

  try {
    const colRef = collection(db, "saloni", tid, "prodotti");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const items: ProductItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as ProductItem;
        if (!data.isDeleted) {
          items.push({ ...data, id: docSnap.id, tenantId: tid });
        }
      });

      if (items.length > 0) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`${STORAGE_PRODUCTS_KEY}${tid}`, JSON.stringify(items));
          } catch {}
        }
        return items.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  } catch (err) {
    console.warn("Nota lettura prodotti magazzino Firestore:", err);
  }

  // Fallback
  if (local.length > 0) {
    return local.sort((a, b) => a.name.localeCompare(b.name));
  }

  return initializeDefaultProducts(tid);
}

/**
 * Salva o aggiorna un prodotto in magazzino su Cloud Firestore e cache locale
 */
export async function saveSalonProduct(
  tenantId: string,
  product: Partial<ProductItem> & { name: string; brand: string }
): Promise<ProductItem> {
  const tid = getSalonTenantId(tenantId);
  const id = product.id || `prod-${Date.now()}`;
  const now = new Date().toISOString();

  const completeProduct: ProductItem = {
    id,
    tenantId: tid,
    name: product.name.trim(),
    brand: product.brand.trim() || "Brand Salone",
    category: product.category || "RIVENDITA",
    subCategory: product.subCategory || "Generale",
    barcode: product.barcode?.trim() || undefined,
    costPrice: Number(product.costPrice) || 0,
    retailPrice: product.category === "USO_INTERNO" ? 0 : Number(product.retailPrice) || 0,
    stockQuantity: Number(product.stockQuantity) || 0,
    minStockThreshold: Number(product.minStockThreshold) || 3,
    unit: product.unit || "pz",
    notes: product.notes || undefined,
    createdAt: product.createdAt || now,
    updatedAt: now,
    isDeleted: false
  };

  // 1. Cache locale
  if (typeof window !== "undefined") {
    try {
      const all = getLocalProducts(tid);
      const filtered = all.filter((p) => p.id !== id);
      filtered.push(completeProduct);
      localStorage.setItem(`${STORAGE_PRODUCTS_KEY}${tid}`, JSON.stringify(filtered));
    } catch {}
  }

  // 2. Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tid, "prodotti", id);
    await setDoc(docRef, completeProduct, { merge: true });
  } catch (err) {
    console.warn("Nota salvataggio prodotto Firestore:", err);
  }

  // Se sotto soglia, genera notifica alert
  if (completeProduct.stockQuantity <= completeProduct.minStockThreshold) {
    addSalonNotification(tid, {
      id: `alert-stock-${id}-${Date.now()}`,
      title: `⚠️ Alert Sottoscorta: ${completeProduct.name}`,
      description: `Giacenza attuale: ${completeProduct.stockQuantity} ${completeProduct.unit}. Soglia minima di sicurezza: ${completeProduct.minStockThreshold} ${completeProduct.unit}.`,
      time: "Adesso",
      type: "system",
      link: "/magazzino"
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }

  return completeProduct;
}

/**
 * Eliminazione logica (soft-delete) di un prodotto
 */
export async function deleteSalonProduct(tenantId: string, productId: string): Promise<void> {
  const tid = getSalonTenantId(tenantId);

  // 1. Cache locale
  if (typeof window !== "undefined") {
    try {
      const all = getLocalProducts(tid);
      const updated = all.filter((p) => p.id !== productId);
      localStorage.setItem(`${STORAGE_PRODUCTS_KEY}${tid}`, JSON.stringify(updated));
    } catch {}
  }

  // 2. Cloud Firestore soft-delete
  try {
    const docRef = doc(db, "saloni", tid, "prodotti", productId);
    await setDoc(docRef, { isDeleted: true, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("Nota soft-delete prodotto Firestore:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
  }
}

/**
 * Registra un movimento di magazzino sia su Firestore che in cache locale
 */
async function recordStockMovement(
  tenantId: string,
  movement: StockMovement
): Promise<void> {
  const tid = getSalonTenantId(tenantId);

  // 1. Cache locale
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_MOVEMENTS_KEY}${tid}`);
      const existing: StockMovement[] = raw ? JSON.parse(raw) : [];
      const updated = [movement, ...existing.slice(0, 199)]; // ultimi 200 movimenti
      localStorage.setItem(`${STORAGE_MOVEMENTS_KEY}${tid}`, JSON.stringify(updated));
    } catch {}
  }

  // 2. Cloud Firestore
  try {
    const docRef = doc(db, "saloni", tid, "stock_movements", movement.id);
    await setDoc(docRef, movement);
  } catch (err) {
    console.warn("Nota registrazione movimento magazzino Firestore:", err);
  }
}

/**
 * Modifica la giacenza di un prodotto (Carico, Scarico manuale, Rettifica o Reso)
 */
export async function adjustProductStock(
  tenantId: string,
  productId: string,
  delta: number,
  type: StockMovementType,
  reason?: string,
  operatorName: string = "Staff Salone"
): Promise<ProductItem | null> {
  const tid = getSalonTenantId(tenantId);
  const products = await fetchSalonProducts(tid);
  const target = products.find((p) => p.id === productId);

  if (!target) return null;

  const previousStock = target.stockQuantity;
  const newStock = Math.max(0, previousStock + delta);

  const updatedProduct: ProductItem = {
    ...target,
    stockQuantity: newStock,
    updatedAt: new Date().toISOString()
  };

  // Salva il prodotto aggiornato
  await saveSalonProduct(tid, updatedProduct);

  // Registra il movimento
  const movement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId: tid,
    productId,
    productName: target.name,
    type,
    delta,
    previousStock,
    newStock,
    reason: reason || getDefaultReasonForType(type),
    operatorName,
    timestamp: new Date().toISOString()
  };

  await recordStockMovement(tid, movement);

  return updatedProduct;
}

function getDefaultReasonForType(type: StockMovementType): string {
  switch (type) {
    case "SALE_POS": return "Vendita al banco Punto Cassa";
    case "CARICO_FORNITORE": return "Carico merce da fornitore";
    case "CONSUMO_INTERNO": return "Utilizzo per trattamento tecnico in salone";
    case "RETTIFICA_MANUALE": return "Rettifica inventario periodica";
    case "RESO_CLIENTE": return "Reso prodotto da cliente";
  }
}

/**
 * Scarico automatico immediato delle scorte per gli articoli venduti al POS
 */
export async function decrementStockForCheckout(
  tenantId: string,
  items: CheckoutItem[],
  operatorName: string = "Staff Cassa"
): Promise<void> {
  const tid = getSalonTenantId(tenantId);
  const productItems = items.filter((i) => i.type === "PRODUCT");

  if (productItems.length === 0) return;

  const allProducts = await fetchSalonProducts(tid);

  for (const item of productItems) {
    // Cerca per id esatto oppure per nome prodotto
    const match = allProducts.find((p) => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
    if (match) {
      const qty = Math.max(1, item.quantity || 1);
      await adjustProductStock(
        tid,
        match.id,
        -qty,
        "SALE_POS",
        `Vendita POS (${qty} ${match.unit})`,
        operatorName
      );
    }
  }
}

/**
 * Recupera lo storico dei movimenti di magazzino
 */
export async function fetchStockMovements(tenantId: string, productId?: string): Promise<StockMovement[]> {
  const tid = getSalonTenantId(tenantId);

  // 1. Prova Cloud Firestore
  try {
    const colRef = collection(db, "saloni", tid, "stock_movements");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const items: StockMovement[] = [];
      snap.forEach((d) => items.push(d.data() as StockMovement));
      const filtered = productId ? items.filter((m) => m.productId === productId) : items;
      return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } catch (err) {
    console.warn("Nota lettura movimenti magazzino Firestore:", err);
  }

  // 2. Fallback cache locale
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_MOVEMENTS_KEY}${tid}`);
      if (raw) {
        const parsed: StockMovement[] = JSON.parse(raw);
        const filtered = productId ? parsed.filter((m) => m.productId === productId) : parsed;
        return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch {}
  }

  return [];
}

/**
 * Calcola i totali e gli indicatori chiave del magazzino
 */
export function computeInventoryStats(products: ProductItem[]) {
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;
  const lowStockProducts: ProductItem[] = [];
  const outOfStockProducts: ProductItem[] = [];

  for (const p of products) {
    totalUnits += p.stockQuantity;
    totalCostValue += p.stockQuantity * p.costPrice;
    if (p.category === "RIVENDITA") {
      totalRetailValue += p.stockQuantity * p.retailPrice;
    }

    if (p.stockQuantity <= 0) {
      outOfStockProducts.push(p);
      lowStockProducts.push(p);
    } else if (p.stockQuantity <= p.minStockThreshold) {
      lowStockProducts.push(p);
    }
  }

  const potentialGrossMargin = totalRetailValue - totalCostValue;

  return {
    totalProductsCount: products.length,
    totalUnits,
    totalCostValue,
    totalRetailValue,
    potentialGrossMargin,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    lowStockProducts,
    outOfStockProducts
  };
}
