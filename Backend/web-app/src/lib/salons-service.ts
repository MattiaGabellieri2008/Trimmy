import { db } from "./firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { SalonListing, INITIAL_SALONS } from "./client-booking";
import { getSalonServices, SalonServiceItem } from "./services-store";

// Coordinate GPS di riferimento per le principali città italiane
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  milano: { lat: 45.4642, lng: 9.1900 },
  roma: { lat: 41.9028, lng: 12.4964 },
  firenze: { lat: 43.7696, lng: 11.2558 },
  torino: { lat: 45.0703, lng: 7.6869 },
  bologna: { lat: 44.4949, lng: 11.3426 },
  napoli: { lat: 40.8518, lng: 14.2681 },
  genova: { lat: 44.4056, lng: 8.9463 },
  verona: { lat: 45.4384, lng: 10.9916 },
  venezia: { lat: 45.4408, lng: 12.3155 },
  palermo: { lat: 38.1157, lng: 13.3615 },
  bari: { lat: 41.1171, lng: 16.8719 },
};

/**
 * Genera un piccolo offset deterministico sulle coordinate basato sull'UID
 * per evitare che saloni nella stessa città si sovrappongano esattamente sullo stesso punto mappa.
 */
function getJitteredCoords(city: string, uid: string): { lat: number; lng: number } {
  const normCity = (city || "").toLowerCase().trim();
  const base = CITY_COORDINATES[normCity] || CITY_COORDINATES["milano"];

  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((hash % 100) / 10000) * 1.5;
  const lngOffset = (((hash >> 3) % 100) / 10000) * 1.5;

  return {
    lat: Number((base.lat + latOffset).toFixed(5)),
    lng: Number((base.lng + lngOffset).toFixed(5)),
  };
}

/**
 * Converte un documento utente salone registrato nel DB in un oggetto SalonListing per il marketplace e la mappa.
 */
export function mapUserDocToSalonListing(docId: string, data: any): SalonListing {
  const salonName = data.salonName || data.displayName || "Salone Partner Trimmy";
  const city = data.city || "Milano";
  const address = data.address || `${city} - Sede Operativa`;
  const zone = data.zone || "Centro";
  const phone = data.phone || (data.partitaIva ? `P.IVA: ${data.partitaIva}` : "Contatto Diretto");
  const category = (data.category as any) || "Barber Shop";
  
  // Coordinate: usa lat/lng reali se salvati, altrimenti le calcola dalla città con jitter deterministico
  let lat = typeof data.lat === "number" ? data.lat : undefined;
  let lng = typeof data.lng === "number" ? data.lng : undefined;

  if (typeof lat !== "number" || typeof lng !== "number") {
    const coords = getJitteredCoords(city, docId);
    lat = coords.lat;
    lng = coords.lng;
  }

  // Recupera i trattamenti reali salvati per questo salone (priorità su data.services salvati su Firestore)
  const rawServices = Array.isArray(data.services) && data.services.length > 0
    ? data.services
    : getSalonServices(docId);

  const realServices = rawServices.map((s: any) => ({
    id: s.id || `srv-${s.name}`,
    name: s.name,
    category: s.category || "Servizi Salone",
    price: Number(s.price) || 20,
    durationMinutes: Number(s.durationMinutes || s.duration) || 30,
    description: s.description || ""
  }));

  const featuredServices = realServices.slice(0, 3).map((s: any) => ({
    name: s.name,
    price: s.price,
    duration: s.durationMinutes,
  }));

  const minPrice = realServices.length > 0 
    ? Math.min(...realServices.map((s: any) => s.price)) 
    : 20;

  const planBadge = data.planType === "PRO" 
    ? "Salone Partner PRO" 
    : data.planType === "MEDIUM" 
    ? "Salone Verificato Medium" 
    : "Salone Ufficiale Trimmy";

  return {
    id: docId,
    name: salonName,
    category: category,
    city: city,
    address: address,
    zone: zone,
    badge: planBadge,
    rating: data.rating || 4.9,
    reviewCount: data.reviewCount || 1,
    phone: phone,
    openingHours: data.openingHours || "Mar - Sab: 09:00 - 19:30",
    lat: lat,
    lng: lng,
    priceLevel: minPrice > 40 ? "€€€" : minPrice > 25 ? "€€" : "€",
    minPrice: minPrice,
    distance: "Nel tuo comune",
    servicesCount: realServices.length,
    featuredServices: featuredServices.length > 0 ? featuredServices : [
      { name: "Taglio Sartoriale", price: minPrice, duration: 30 }
    ],
    services: realServices.length > 0 ? realServices : undefined,
  };
}

/**
 * Interroga Cloud Firestore per recuperare TUTTI gli account salone reali registrati.
 */
export async function fetchRealSalonsFromDatabase(): Promise<SalonListing[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "salone"));
    const snap = await getDocs(q);

    const salons: SalonListing[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      salons.push(mapUserDocToSalonListing(doc.id, data));
    });

    // Se ci sono saloni reali nel database, salvali in cache locale e restituiscili
    if (salons.length > 0) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("trimmy_real_salons_cache", JSON.stringify(salons));
        } catch (e) {
          // ignore cache errors
        }
      }
      return salons;
    }
  } catch (err) {
    console.warn("Avviso durante il caricamento dei saloni da Firestore:", err);
  }

  // Fallback da cache locale se offline
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("trimmy_real_salons_cache");
      if (cached) {
        return JSON.parse(cached) as SalonListing[];
      }
    } catch (e) {
      // ignore
    }
  }

  return [];
}

/**
 * Recupera un singolo salone per ID:
 * 1. Da Cloud Firestore (documento users/{salonId})
 * 2. Fallback su INITIAL_SALONS
 */
export async function fetchSalonById(salonId: string): Promise<SalonListing | null> {
  if (!salonId) return null;

  // 1. Prova da Cloud Firestore
  try {
    const docRef = doc(db, "users", salonId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return mapUserDocToSalonListing(snap.id, snap.data());
    }
  } catch (err) {
    console.warn("Nota lettura salone per ID da Firestore:", err);
  }

  // 2. Fallback su saloni predefiniti
  const fallback = INITIAL_SALONS.find((s) => s.id === salonId);
  return fallback || null;
}
