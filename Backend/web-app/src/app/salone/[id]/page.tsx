"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  Scissors, 
  MapPin, 
  Phone, 
  Clock, 
  Star, 
  ArrowLeft, 
  Check, 
  Calendar as CalendarIcon, 
  Sparkles, 
  ShieldCheck, 
  Heart, 
  Share2, 
  MessageSquare, 
  CheckCircle2, 
  Navigation, 
  User, 
  ChevronRight, 
  Camera, 
  Award, 
  Sparkle, 
  Info,
  CalendarCheck2
} from "lucide-react";
import { 
  SalonListing, 
  INITIAL_SALONS, 
  DEFAULT_BOOKING_SERVICES, 
  DEFAULT_BOOKING_STAFF, 
  toggleFavoriteSalon, 
  getFavoriteSalons 
} from "@/lib/client-booking";
import { fetchSalonById } from "@/lib/salons-service";
import { fetchSalonStaff } from "@/lib/staff-store";
import BookingWizardModal from "@/components/BookingWizardModal";
import SalonShareModal from "@/components/SalonShareModal";
import { fetchSalonThemeSettings, applyThemeToDocument } from "@/lib/theme-store";

// Collezioni immagini Lookbook e Salon Interior stile Airbnb
const SALON_GALLERIES: Record<string, string[]> = {
  barber: [
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=600&q=80"
  ],
  woman: [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=600&q=80"
  ],
  spa: [
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1608248597359-00e93a0279a1?auto=format&fit=crop&w=600&q=80"
  ]
};

function SalonePageContent() {
  const router = useRouter();
  const params = useParams();
  const salonId = String(params?.id || "");

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [salon, setSalon] = useState<SalonListing | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"listino" | "team" | "lookbook" | "recensioni" | "orari">("listino");
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedLookbookFilter, setSelectedLookbookFilter] = useState("all");

  // Modali
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | undefined>(undefined);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const favs = getFavoriteSalons(user.uid);
        setIsFavorite(favs.includes(salonId));
      }
    });

    if (salonId) {
      fetchSalonById(salonId).then((found) => {
        if (found) {
          setSalon(found);
        } else {
          // fallback su primo salone se non trovato
          setSalon(INITIAL_SALONS[0]);
        }
        setLoading(false);
      });

      fetchSalonStaff(salonId).then((staff) => {
        if (staff && staff.length > 0) {
          setStaffList(staff);
        }
      });

      fetchSalonThemeSettings(salonId).then((theme) => {
        if (theme) {
          applyThemeToDocument(theme);
        }
      });
    }

    return () => unsub();
  }, [salonId]);

  const handleToggleFavorite = () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    const updated = toggleFavoriteSalon(currentUser.uid, salonId);
    setIsFavorite(updated.includes(salonId));
  };

  const galleryImages = useMemo(() => {
    if (!salon) return SALON_GALLERIES.barber;
    const cat = salon.category.toLowerCase();
    if (cat.includes("donna") || cat.includes("hair")) return SALON_GALLERIES.woman;
    if (cat.includes("estetico") || cat.includes("spa") || cat.includes("beauty")) return SALON_GALLERIES.spa;
    return SALON_GALLERIES.barber;
  }, [salon]);

  // Lista servizi dinamica
  const servicesList = useMemo(() => {
    if (salon?.services && salon.services.length > 0) {
      return salon.services;
    }
    return DEFAULT_BOOKING_SERVICES;
  }, [salon?.services]);

  // Raggruppamento per Categoria
  const servicesByCategory = useMemo(() => {
    const groups: Record<string, typeof servicesList> = {};
    servicesList.forEach((s) => {
      const cat = s.category || "Trattamenti Principali";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [servicesList]);

  // Mock Recensioni verificate realistiche
  const reviews = useMemo(() => {
    return [
      {
        id: "r1",
        author: "Marco B.",
        date: "2 giorni fa",
        rating: 5,
        treatment: "Taglio Sartoriale & Barba",
        comment: "Esperienza eccellente. Puntualità impeccabile, ambiente raffinato e grande cura nei minimi dettagli. Lo staff è altamente qualificato!"
      },
      {
        id: "r2",
        author: "Chiara V.",
        date: "1 settimana fa",
        rating: 5,
        treatment: "Balayage & Trattamento Gloss",
        comment: "Il miglior salone in cui sia mai stata. Il colore è luminoso e naturale, proprio come desideravo. Prenotazione online super comoda con Trimmy."
      },
      {
        id: "r3",
        author: "Alessandro M.",
        date: "2 settimane fa",
        rating: 5,
        treatment: "Modellatura Barba a Lama",
        comment: "Servizio di altissimo livello. Taglio barba con panno caldo rilassante e profumato. Ci tornerò sicuramente!"
      }
    ];
  }, []);

  if (loading || !salon) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-md animate-pulse">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold font-mono">
            Caricamento Profilo Salone...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-200">
      
      {/* 1. Header Minimal Sticky */}
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200/70 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/cliente")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Torna ai Saloni</span>
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm text-zinc-900 tracking-tight">{salon.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-xl border transition-all ${
              isFavorite
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
            title={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-rose-500" : ""}`} />
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
            title="Condividi / QR Code"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setPreselectedServiceId(undefined);
              setIsBookingOpen(true);
            }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>Prenota Ora</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        
        {/* Intestazione Titolo Salone */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white uppercase tracking-wider">
              {salon.category}
            </span>
            {salon.badge && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {salon.badge}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verificato Trimmy
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
            {salon.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-zinc-600 pt-1">
            <span className="flex items-center gap-1 font-bold text-zinc-900">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              {salon.rating}
              <span className="font-normal text-zinc-500 underline ml-0.5">({salon.reviewCount} recensioni verificate)</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-zinc-400" />
              {salon.address}, {salon.city} ({salon.zone})
            </span>
          </div>
        </div>

        {/* 3. GRIGLIA FOTOGRAFICA STILE AIRBNB (1 principale + 4 miniature lookbook) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 rounded-3xl overflow-hidden max-h-[460px] relative shadow-md">
          {/* Foto Principale Panoramica (2 colonne) */}
          <div className="md:col-span-2 relative group overflow-hidden bg-zinc-900 min-h-[260px] md:min-h-[440px]">
            <img 
              src={galleryImages[0]} 
              alt={salon.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* 4 Miniature Lookbook (2 colonne x 2 righe) */}
          <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-2.5">
            {galleryImages.slice(1, 5).map((img, idx) => (
              <div key={idx} className="relative group overflow-hidden bg-zinc-900 h-[215px]">
                <img 
                  src={img} 
                  alt={`Lookbook ${idx + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              </div>
            ))}
          </div>

          {/* Badge "Mostra tutte le foto" */}
          <button 
            onClick={() => setActiveTab("lookbook")}
            className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-900 border border-zinc-200/80 shadow-md flex items-center gap-2 hover:bg-white hover:scale-105 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Guarda il Lookbook Completo</span>
          </button>
        </div>

        {/* 4. LAYOUT A DUE COLONNE: TAB CONTENUTI A SINISTRA + STICKY BOOKING CARD A DESTRA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          
          {/* COLONNA SINISTRA (8 Cols): Schede di Navigazione */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Tab Bar Stile Clean Apple/Airbnb */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-200 scrollbar-none">
              <button
                onClick={() => setActiveTab("listino")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "listino"
                    ? "bg-brand text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                ✂️ Listino & Trattamenti
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "team"
                    ? "bg-brand text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                👥 Il Nostro Team
              </button>
              <button
                onClick={() => setActiveTab("lookbook")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "lookbook"
                    ? "bg-brand text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                📸 Lookbook & Tagli
              </button>
              <button
                onClick={() => setActiveTab("recensioni")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "recensioni"
                    ? "bg-brand text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                ⭐ Recensioni ({salon.reviewCount})
              </button>
              <button
                onClick={() => setActiveTab("orari")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "orari"
                    ? "bg-brand text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                📍 Orari & Posizione
              </button>
            </div>

            {/* TAB 1: LISTINO TRATTAMENTI CATEGORIZZATO */}
            {activeTab === "listino" && (
              <div className="space-y-6">
                <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight">Listino Ufficiale</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Scegli un trattamento per prenotare direttamente all&apos;orario desiderato.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {Object.entries(servicesByCategory).map(([category, items]) => (
                      <div key={category} className="space-y-3">
                        <div className="sticky top-20 z-10 bg-white/95 backdrop-blur-xs py-1.5 border-b border-zinc-100 flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                            {category}
                          </h4>
                          <span className="text-[11px] text-zinc-400 font-mono">{items.length} servizi</span>
                        </div>

                        <div className="space-y-2.5">
                          {items.map((service) => (
                            <div 
                              key={service.id}
                              className="p-4 rounded-2xl border border-zinc-200/70 hover:border-zinc-300 hover:bg-zinc-50/70 transition-all flex items-start justify-between gap-4"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm sm:text-base text-zinc-900">{service.name}</h5>
                                  {service.price >= 40 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                      ★ Top
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{service.description}</p>
                                <span className="text-xs text-zinc-500 flex items-center gap-1 font-medium pt-1">
                                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                  {service.durationMinutes} minuti
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-lg font-black text-zinc-900 block">
                                  {service.price.toFixed(2)} €
                                </span>
                                <button
                                  onClick={() => {
                                    setPreselectedServiceId(String(service.id));
                                    setIsBookingOpen(true);
                                  }}
                                  className="mt-1.5 px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                                >
                                  Prenota
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: IL NOSTRO TEAM */}
            {activeTab === "team" && (
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight">I Professionisti del Salone</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Il team qualificato pronto a prendersi cura del tuo look e del tuo benessere.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {(staffList.length > 0 ? staffList : DEFAULT_BOOKING_STAFF).map((member) => (
                    <div 
                      key={member.id}
                      className="p-5 rounded-2xl border border-zinc-200/70 hover:border-zinc-300 transition-all flex items-center gap-4 bg-zinc-50/50"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {member.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-zinc-900 truncate">{member.fullName}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            ★ {member.rating || 4.9}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">{member.role || "Stylist & Specialist"}</p>
                        <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Disponibile per appuntamenti
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: LOOKBOOK & FOTO TAGLI */}
            {activeTab === "lookbook" && (
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight">Lookbook del Salone</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Scorri i lavori recenti eseguiti dal team per trovare ispirazione per il tuo prossimo taglio.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryImages.concat(galleryImages).map((src, i) => (
                    <div key={i} className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-100 border border-zinc-200 shadow-2xs">
                      <img 
                        src={src} 
                        alt={`Look ${i + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span className="text-white text-xs font-bold">Lavoro #{i + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: RECENSIONI */}
            {activeTab === "recensioni" && (
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-zinc-900">{salon.rating}</span>
                      <div className="space-y-0.5">
                        <div className="flex text-amber-500">
                          {"★★★★★"}
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">Valutazione basata su {salon.reviewCount} clienti reali</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center sm:border-l sm:border-zinc-200 sm:pl-6 text-xs">
                    <div>
                      <span className="font-bold text-zinc-900 block">5.0</span>
                      <span className="text-[10px] text-zinc-400">Puntualità</span>
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">4.9</span>
                      <span className="text-[10px] text-zinc-400">Pulizia</span>
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">5.0</span>
                      <span className="text-[10px] text-zinc-400">Cortesia</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="text-sm font-bold text-zinc-900 block">{rev.author}</strong>
                          <span className="text-[11px] text-zinc-400">{rev.date} • Trattamento: {rev.treatment}</span>
                        </div>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          ★ {rev.rating}.0
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: ORARI & POSIZIONE */}
            {activeTab === "orari" && (
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight">Orari di Apertura & Sede</h3>
                  <p className="text-xs text-zinc-500 mt-1">Vieni a trovarci o contattaci telefonicamente.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-zinc-500" /> Orario Settimanale
                    </h4>
                    <div className="space-y-2 font-medium">
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-500">Lunedì</span>
                        <span className="text-zinc-400 font-semibold">Chiuso</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-900">Martedì</span>
                        <span className="font-bold text-zinc-900">09:00 - 19:30</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-900">Mercoledì</span>
                        <span className="font-bold text-zinc-900">09:00 - 19:30</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-900">Giovedì</span>
                        <span className="font-bold text-zinc-900">09:00 - 20:30 (Orario Prolungato)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-900">Venerdì</span>
                        <span className="font-bold text-zinc-900">09:00 - 19:30</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-900">Sabato</span>
                        <span className="font-bold text-zinc-900">08:30 - 19:00</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-500">Domenica</span>
                        <span className="text-zinc-400 font-semibold">Chiuso</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-zinc-500" /> Indirizzo & Navigazione
                    </h4>
                    <p className="text-zinc-600 font-medium leading-relaxed">
                      {salon.address}<br />
                      {salon.city} ({salon.zone})
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.name + " " + salon.address + " " + salon.city)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-800 font-bold transition-colors"
                      >
                        <Navigation className="w-4 h-4 text-zinc-600" />
                        Apri in Google Maps
                      </a>

                      {salon.phone && (
                        <a
                          href={`tel:${salon.phone}`}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 rounded-xl text-zinc-800 font-bold transition-colors"
                        >
                          <Phone className="w-4 h-4 text-zinc-600" />
                          Chiama {salon.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* COLONNA DESTRA (4 Cols): STICKY BOOKING CARD STILE AIRBNB */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white border-2 border-zinc-900/10 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Prezzo a partire da</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-zinc-900">€{salon.minPrice}</span>
                    <span className="text-xs text-zinc-500 font-medium">/ trattamento</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    {salon.rating}
                  </span>
                </div>
              </div>

              {/* Informazioni Salone veloci */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-zinc-600">
                  <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Aperto oggi fino alle 19:30</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Conferma istantanea con blocco anti double-booking</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-600">
                  <CalendarIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Cancellazione gratuita fino a 2h prima</span>
                </div>
              </div>

              {/* Bottone CTA Principale */}
              <button
                type="button"
                onClick={() => {
                  setPreselectedServiceId(undefined);
                  setIsBookingOpen(true);
                }}
                className="w-full py-4 bg-brand hover:bg-brand-hover text-white rounded-2xl font-black text-sm tracking-wide shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <CalendarCheck2 className="w-4 h-4" />
                <span>Prenota Appuntamento</span>
              </button>

              {/* WhatsApp Rapido */}
              {salon.phone && (
                <a
                  href={`https://wa.me/${salon.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Ciao ${salon.name}, vorrei maggiori informazioni sui vostri trattamenti.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Richiedi Info su WhatsApp</span>
                </a>
              )}
            </div>

            {/* Micro Card Garanzia Trimmy */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-center text-xs text-zinc-500 space-y-1">
              <p className="font-bold text-zinc-700">Prenotazione Garantita Trimmy</p>
              <p className="text-[11px] leading-relaxed">Nessun anticipo obbligatorio. Mostri il pass al desk al tuo arrivo.</p>
            </div>
          </div>

        </div>

      </main>

      {/* MODALE DI PRENOTAZIONE */}
      {isBookingOpen && (
        <BookingWizardModal
          salon={salon}
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          userUid={currentUser?.uid}
          userEmail={currentUser?.email || undefined}
          userName={currentUser?.displayName || undefined}
          userPhone={currentUser?.phoneNumber || undefined}
          preselectedServiceId={preselectedServiceId}
          onBookingConfirmed={() => {
            setIsBookingOpen(false);
            router.push("/cliente");
          }}
        />
      )}

      {/* MODALE CONDIVISIONE / QR */}
      {isShareOpen && (
        <SalonShareModal
          salon={salon}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}

    </div>
  );
}

export default function SalonePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-md animate-pulse">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold font-mono">
            Caricamento Profilo Salone...
          </span>
        </div>
      </div>
    }>
      <SalonePageContent />
    </Suspense>
  );
}
