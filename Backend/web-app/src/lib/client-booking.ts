/**
 * Utility e tipi per l'Area Cliente, Marketplace Saloni,
 * prenotazioni e integrazione Calendari (Google Calendar & Apple/Outlook .ics).
 */
import { db } from "./firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendNotification } from "./notifications-service";
import { parseDateSafe } from "./date-utils";

export interface SalonListing {
  id: string; // Tenant ID
  name: string;
  category: "Barber Shop" | "Hair Stylist Donna" | "Unisex" | "Centro Estetico";
  city: string;
  address: string;
  zone: string;
  badge?: string;
  rating: number;
  reviewCount: number;
  coverImage?: string;
  phone: string;
  openingHours: string;
  lat: number;
  lng: number;
  priceLevel: "€" | "€€" | "€€€";
  minPrice: number;
  distance: string;
  servicesCount: number;
  featuredServices: { name: string; price: number; duration: number }[];
  services?: { id: string | number; name: string; category: string; price: number; durationMinutes: number; description?: string }[];
}

export interface ClientAppointmentItem {
  id: string;
  tenantId: string;
  salonId?: string;
  salonName: string;
  salonAddress: string;
  salonCity: string;
  salonPhone?: string;
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  staffId: string;
  staffName: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  rating?: number;
  reviewComment?: string;
  confirmationSent?: boolean;
  reminderSent?: boolean;
  reviewRequestSent?: boolean;
}

// Saloni demo partner ad alta fedeltà con geolocalizzazione
export const INITIAL_SALONS: SalonListing[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Gentleman's Barber Club",
    category: "Barber Shop",
    city: "Milano",
    address: "Via Montenapoleone 18, 20121 Milano",
    zone: "Quadrilatero Moda",
    badge: "Top Scelto • ★ 4.9",
    rating: 4.9,
    reviewCount: 142,
    phone: "02 8945 2311",
    openingHours: "Mar - Sab: 09:00 - 19:30",
    lat: 45.4691,
    lng: 9.1952,
    priceLevel: "€€",
    minPrice: 28,
    distance: "0.8 km",
    servicesCount: 8,
    featuredServices: [
      { name: "Taglio Sartoriale & Styling", price: 32, duration: 45 },
      { name: "Rasatura Tradizionale Panno Caldo", price: 24, duration: 30 }
    ]
  },
  {
    id: "660e8400-e29b-41d4-a716-446655440001",
    name: "Atelier Bellezza & Colore",
    category: "Hair Stylist Donna",
    city: "Roma",
    address: "Via del Corso 240, 00186 Roma",
    zone: "Centro Storico",
    badge: "Esclusivo Trimmy",
    rating: 4.8,
    reviewCount: 98,
    phone: "06 6791 4452",
    openingHours: "Mar - Sab: 09:30 - 19:00",
    lat: 41.9056,
    lng: 12.4792,
    priceLevel: "€€€",
    minPrice: 35,
    distance: "1.2 km",
    servicesCount: 12,
    featuredServices: [
      { name: "Balayage Soleil & Gloss", price: 85, duration: 120 },
      { name: "Piega Sublime & Trattamento Botox", price: 35, duration: 40 }
    ]
  },
  {
    id: "770e8400-e29b-41d4-a716-446655440002",
    name: "Blade & Scissors Barbershop",
    category: "Barber Shop",
    city: "Firenze",
    address: "Piazza della Repubblica 8, 50123 Firenze",
    zone: "Duomo",
    badge: "Disponibile Oggi",
    rating: 4.9,
    reviewCount: 85,
    phone: "055 2145 990",
    openingHours: "Lun - Sab: 08:30 - 19:00",
    lat: 43.7714,
    lng: 11.2541,
    priceLevel: "€€",
    minPrice: 25,
    distance: "0.5 km",
    servicesCount: 6,
    featuredServices: [
      { name: "Taglio Fade & Barba Curata", price: 42, duration: 55 },
      { name: "Modellatura Barba a Lama", price: 20, duration: 25 }
    ]
  },
  {
    id: "880e8400-e29b-41d4-a716-446655440003",
    name: "Lumina Hair & Spa Unisex",
    category: "Unisex",
    city: "Torino",
    address: "Via Roma 75, 10121 Torino",
    zone: "Piazza San Carlo",
    badge: "Eco-Friendly Spa",
    rating: 4.7,
    reviewCount: 114,
    phone: "011 5623 881",
    openingHours: "Mar - Sab: 09:00 - 19:30",
    lat: 45.0682,
    lng: 7.6821,
    priceLevel: "€€",
    minPrice: 30,
    distance: "1.8 km",
    servicesCount: 15,
    featuredServices: [
      { name: "Taglio Rigenerante & Scrub Cute", price: 45, duration: 50 },
      { name: "Trattamento Idratante Bio", price: 30, duration: 35 }
    ]
  },
  {
    id: "990e8400-e29b-41d4-a716-446655440004",
    name: "Pure Skin & Hair Lounge",
    category: "Centro Estetico",
    city: "Bologna",
    address: "Via dell'Indipendenza 32, 40121 Bologna",
    zone: "Porta Galliera",
    badge: "Beauty & Nails",
    rating: 4.9,
    reviewCount: 67,
    phone: "051 2341 550",
    openingHours: "Mar - Sab: 09:30 - 19:30",
    lat: 44.4989,
    lng: 11.3435,
    priceLevel: "€€",
    minPrice: 28,
    distance: "0.9 km",
    servicesCount: 10,
    featuredServices: [
      { name: "Manicure Spa & Smalto Semi", price: 38, duration: 45 },
      { name: "Pulizia Viso Ultrasuoni Relax", price: 55, duration: 60 }
    ]
  },
  {
    id: "aa0e8400-e29b-41d4-a716-446655440005",
    name: "Partenope Barber Saloon",
    category: "Barber Shop",
    city: "Napoli",
    address: "Via Toledo 156, 80134 Napoli",
    zone: "Quartieri Spagnoli",
    badge: "Tradizione Storica",
    rating: 4.8,
    reviewCount: 130,
    phone: "081 5512 344",
    openingHours: "Mar - Dom: 08:30 - 20:00",
    lat: 40.8415,
    lng: 14.2492,
    priceLevel: "€",
    minPrice: 20,
    distance: "0.3 km",
    servicesCount: 7,
    featuredServices: [
      { name: "Taglio Capelli Napoletano", price: 22, duration: 35 },
      { name: "Barba all'Italiana & Colonia", price: 15, duration: 25 }
    ]
  }
];

// Servizi tipici per salone quando non ancora personalizzati
export const DEFAULT_BOOKING_SERVICES = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Taglio Capelli & Styling",
    description: "Consulenza stile, lavaggio relax, taglio sartoriale e styling personalizzato con prodotti premium.",
    durationMinutes: 45,
    price: 32.0,
    category: "Taglio"
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Rasatura Tradizionale & Panno Caldo",
    description: "Trattamento barba tradizionale con oli pre-rasatura, doppio panno caldo e massaggio lenitivo dopobarba.",
    durationMinutes: 30,
    price: 24.0,
    category: "Barba"
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Taglio + Rifinitura Barba Deluxe",
    description: "Pacchetto completo per look curato: taglio capelli e modellatura barba a forbice o rasoio.",
    durationMinutes: 60,
    price: 48.0,
    category: "Combo"
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Colore Gloss & Trattamento Ricostruzione",
    description: "Lucidatura colore brillante senza ammoniaca con fiala di cheratina nutriente intensiva.",
    durationMinutes: 90,
    price: 65.0,
    category: "Colore"
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "Trattamento Cute Purificante & Massaggio",
    description: "Scrub esfoliante detossinante con massaggio craniale rivitalizzante da 15 minuti.",
    durationMinutes: 35,
    price: 28.0,
    category: "Trattamento"
  }
];

export const DEFAULT_BOOKING_STAFF = [
  { id: "staff-marco", fullName: "Marco Rossi", role: "Master Barber & Stylist", rating: 4.9 },
  { id: "staff-laura", fullName: "Laura Conti", role: "Color & Trend Specialist", rating: 4.9 },
  { id: "staff-alessio", fullName: "Alessio Moretti", role: "Fade & Shave Artist", rating: 4.8 }
];

/**
 * Genera l'URL di aggiunta diretta a Google Calendar
 */
export function buildGoogleCalendarUrl(appointment: {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
}): string {
  const formatTime = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const startStr = formatTime(appointment.startTime);
  const endStr = formatTime(appointment.endTime);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: appointment.title,
    dates: `${startStr}/${endStr}`,
    details: appointment.description,
    location: appointment.location
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Genera e scarica direttamente il file .ics per Apple Calendar / Outlook
 */
export function downloadIcsFile(appointment: {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
}): void {
  const formatIcsTime = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trimmy Gestionale Saloni//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:trimmy-${appointment.id}@trimmy.app`,
    `DTSTAMP:${formatIcsTime(new Date())}`,
    `DTSTART:${formatIcsTime(appointment.startTime)}`,
    `DTEND:${formatIcsTime(appointment.endTime)}`,
    `SUMMARY:${appointment.title}`,
    `DESCRIPTION:${appointment.description.replace(/\n/g, "\\n")}`,
    `LOCATION:${appointment.location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `appuntamento-${appointment.id.slice(0, 8)}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const CLIENT_APPTS_KEY = "trimmy_client_appointments_";
const CLIENT_FAVS_KEY = "trimmy_client_favorites_";

/**
 * Recupera gli appuntamenti del cliente da LocalStorage (lettura sincrona istantanea)
 */
export function getClientAppointments(userUid: string): ClientAppointmentItem[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const raw = localStorage.getItem(`${CLIENT_APPTS_KEY}${userUid}`);
    if (!raw) return [];
    return JSON.parse(raw) as ClientAppointmentItem[];
  } catch (e) {
    console.error("Errore lettura appuntamenti cliente:", e);
    return [];
  }
}

/**
 * Recupera gli appuntamenti del cliente combinando LocalStorage e Cloud Firestore
 * (cercando sia per userUid che per userEmail per massima resilienza tra browser e dispositivi)
 */
export async function fetchClientAppointmentsCloud(
  userUid: string,
  userEmail?: string | null
): Promise<ClientAppointmentItem[]> {
  if (!userUid) return [];

  // 1. Carica prima i dati locali per un rendering a 0ms di latenza
  const localAppts = getClientAppointments(userUid);
  const apptsMap = new Map<string, ClientAppointmentItem>();
  localAppts.forEach((a) => apptsMap.set(a.id, a));

  // 2. Query Firestore su /appointments per customerId == userUid
  try {
    const qUid = query(collection(db, "appointments"), where("customerId", "==", userUid));
    const snapUid = await getDocs(qUid);
    snapUid.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.startTime) {
        apptsMap.set(data.id, {
          id: data.id,
          tenantId: data.tenantId || "",
          salonId: data.salonRawId || data.tenantId,
          salonName: data.salonName || "Salone",
          salonAddress: data.salonAddress || "Sede Operativa",
          salonCity: data.salonCity || "Città",
          salonPhone: data.salonPhone,
          serviceId: data.serviceId || data.service?.id || "",
          serviceName: data.service?.name || data.serviceName || "Trattamento",
          price: data.price || data.service?.price || 0,
          durationMinutes: data.service?.durationMinutes || data.durationMinutes || 30,
          staffId: data.staffId || data.staff?.id || "",
          staffName: data.staff?.fullName || data.staffName || "Staff",
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status || "CONFIRMED",
          createdAt: data.createdAt || data.startTime,
          notes: data.notes,
          customerName: data.customer?.firstName ? `${data.customer.firstName} ${data.customer.lastName || ""}` : data.customerName,
          customerPhone: data.customer?.phone || data.customerPhone,
          customerEmail: data.customer?.email || data.customerEmail,
          rating: data.rating,
          reviewComment: data.reviewComment
        });
      }
    });
  } catch (err) {
    console.warn("Nota lettura appuntamenti cliente Firestore per UID:", err);
  }

  // 3. Se l'utente ha un'email, cerca anche gli appuntamenti associati per email
  // (es. appuntamenti creati direttamente dal salone usando la mail del cliente)
  const cleanEmail = userEmail?.trim().toLowerCase();
  if (cleanEmail) {
    try {
      const qEmail = query(
        collection(db, "appointments"),
        where("customer.email", "==", cleanEmail)
      );
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => {
        const data = d.data();
        if (data && data.id && data.startTime) {
          apptsMap.set(data.id, {
            id: data.id,
            tenantId: data.tenantId || "",
            salonId: data.salonRawId || data.tenantId,
            salonName: data.salonName || "Salone",
            salonAddress: data.salonAddress || "Sede Operativa",
            salonCity: data.salonCity || "Città",
            salonPhone: data.salonPhone,
            serviceId: data.serviceId || data.service?.id || "",
            serviceName: data.service?.name || data.serviceName || "Trattamento",
            price: data.price || data.service?.price || 0,
            durationMinutes: data.service?.durationMinutes || data.durationMinutes || 30,
            staffId: data.staffId || data.staff?.id || "",
            staffName: data.staff?.fullName || data.staffName || "Staff",
            startTime: data.startTime,
            endTime: data.endTime,
            status: data.status || "CONFIRMED",
            createdAt: data.createdAt || data.startTime,
            notes: data.notes,
            customerName: data.customer?.firstName ? `${data.customer.firstName} ${data.customer.lastName || ""}` : data.customerName,
            customerPhone: data.customer?.phone || data.customerPhone,
            customerEmail: data.customer?.email || data.customerEmail,
            rating: data.rating,
            reviewComment: data.reviewComment
          });
        }
      });
    } catch (err) {
      console.warn("Nota lettura appuntamenti cliente Firestore per Email:", err);
    }
  }

  const merged = Array.from(apptsMap.values()).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Aggiorna cache locale per il cliente
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${CLIENT_APPTS_KEY}${userUid}`, JSON.stringify(merged));
    } catch (e) {
      console.warn("Errore aggiornamento cache cliente:", e);
    }
  }

  return merged;
}

/**
 * Salva un nuovo appuntamento per il cliente
 */
export function saveClientAppointment(userUid: string, appt: ClientAppointmentItem): void {
  if (typeof window === "undefined" || !userUid) return;
  try {
    const existing = getClientAppointments(userUid);
    const updated = [appt, ...existing.filter((item) => item.id !== appt.id)];
    localStorage.setItem(`${CLIENT_APPTS_KEY}${userUid}`, JSON.stringify(updated));

    // Invio notifica automatica di conferma
    if (appt.customerPhone && !appt.confirmationSent) {
      const d = parseDateSafe(appt.startTime);
      const dateStr = d ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
      const timeStr = d ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

      sendNotification({
        tenantId: appt.tenantId || appt.salonId || "salone-default",
        salonName: appt.salonName,
        appointmentId: appt.id,
        customerName: appt.customerName || "Cliente",
        customerPhone: appt.customerPhone,
        type: "CONFIRMATION",
        templateParams: {
          servizio: appt.serviceName,
          operatore: appt.staffName,
          data: dateStr,
          ora: timeStr
        }
      }).catch((e) => console.warn("Nota invio notifica cliente conferma:", e));
      appt.confirmationSent = true;
    }
  } catch (e) {
    console.error("Errore salvataggio appuntamento cliente:", e);
  }
}

/**
 * Annulla un appuntamento del cliente (in locale e su Cloud Firestore)
 */
export function cancelClientAppointment(userUid: string, apptId: string): ClientAppointmentItem[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const existing = getClientAppointments(userUid);
    const target = existing.find((item) => item.id === apptId);
    const updated = existing.map((item) =>
      item.id === apptId ? { ...item, status: "CANCELLED" as const } : item
    );
    localStorage.setItem(`${CLIENT_APPTS_KEY}${userUid}`, JSON.stringify(updated));

    // Notifica su Cloud Firestore
    try {
      updateDoc(doc(db, "appointments", apptId), { status: "CANCELLED" }).catch(() => {});
      if (target?.tenantId) {
        updateDoc(doc(db, "saloni", target.tenantId, "appuntamenti", apptId), { status: "CANCELLED" }).catch(() => {});
      }
      if (target?.salonId && target.salonId !== target.tenantId) {
        updateDoc(doc(db, "saloni", target.salonId, "appuntamenti", apptId), { status: "CANCELLED" }).catch(() => {});
      }
    } catch (e) {
      console.warn("Errore aggiornamento cancellazione Firestore:", e);
    }

    // Invio notifica di cancellazione
    if (target && target.customerPhone) {
      const d = parseDateSafe(target.startTime);
      const dateStr = d ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
      const timeStr = d ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

      sendNotification({
        tenantId: target.tenantId || target.salonId || "salone-default",
        salonName: target.salonName,
        appointmentId: target.id,
        customerName: target.customerName || "Cliente",
        customerPhone: target.customerPhone,
        type: "CANCELLATION",
        templateParams: {
          servizio: target.serviceName,
          data: dateStr,
          ora: timeStr
        }
      }).catch((e) => console.warn("Nota invio notifica cancellazione:", e));
    }

    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
    return updated;
  } catch (e) {
    console.error("Errore cancellazione appuntamento:", e);
    return [];
  }
}

/**
 * Aggiunge recensione con stelline a un appuntamento completato (in locale e su Cloud Firestore)
 */
export function rateClientAppointment(
  userUid: string,
  apptId: string,
  rating: number,
  comment?: string
): ClientAppointmentItem[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const existing = getClientAppointments(userUid);
    const target = existing.find((item) => item.id === apptId);
    const updated = existing.map((item) =>
      item.id === apptId ? { ...item, rating, reviewComment: comment } : item
    );
    localStorage.setItem(`${CLIENT_APPTS_KEY}${userUid}`, JSON.stringify(updated));

    // Notifica su Cloud Firestore
    try {
      updateDoc(doc(db, "appointments", apptId), { rating, reviewComment: comment || null }).catch(() => {});
      if (target?.tenantId) {
        updateDoc(doc(db, "saloni", target.tenantId, "appuntamenti", apptId), { rating, reviewComment: comment || null }).catch(() => {});
      }
    } catch (e) {
      console.warn("Errore aggiornamento recensione Firestore:", e);
    }

    window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
    return updated;
  } catch (e) {
    console.error("Errore recensione appuntamento:", e);
    return [];
  }
}

/**
 * Gestione saloni preferiti del cliente
 */
export function getFavoriteSalons(userUid: string): string[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const raw = localStorage.getItem(`${CLIENT_FAVS_KEY}${userUid}`);
    return raw ? JSON.parse(raw) : ["550e8400-e29b-41d4-a716-446655440000"];
  } catch {
    return ["550e8400-e29b-41d4-a716-446655440000"];
  }
}

export function toggleFavoriteSalon(userUid: string, salonId: string): string[] {
  if (typeof window === "undefined" || !userUid) return [];
  try {
    const current = getFavoriteSalons(userUid);
    const next = current.includes(salonId)
      ? current.filter((id) => id !== salonId)
      : [...current, salonId];
    localStorage.setItem(`${CLIENT_FAVS_KEY}${userUid}`, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

/**
 * Calcola la distanza in km tra due coordinate geografiche (Formula di Haversine)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raggio medio terrestre in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Formatta la distanza per l'interfaccia utente (es. "850 m" o "2.4 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

