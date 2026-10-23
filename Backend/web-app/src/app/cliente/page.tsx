"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { getUserProfile, fetchUserProfile, updateUserProfile, UserProfile } from "@/lib/user-profile";
import { 
  Scissors, 
  Calendar, 
  Clock, 
  Star, 
  LogOut, 
  User, 
  Sparkles, 
  MapPin, 
  Search, 
  CalendarPlus, 
  QrCode, 
  RotateCcw, 
  Heart, 
  ChevronRight, 
  Trash2, 
  ExternalLink,
  Phone,
  Navigation,
  Compass,
  CheckCircle2,
  Check,
  Loader2,
  X,
  SlidersHorizontal,
  Bookmark,
  Menu,
  ArrowUpDown,
  Filter,
  CheckCheck,
  LocateFixed
} from "lucide-react";
import { 
  INITIAL_SALONS, 
  SalonListing, 
  ClientAppointmentItem,
  DEFAULT_BOOKING_SERVICES,
  getClientAppointments,
  fetchClientAppointmentsCloud,
  cancelClientAppointment,
  getFavoriteSalons,
  toggleFavoriteSalon,
  buildGoogleCalendarUrl,
  downloadIcsFile,
  calculateDistanceKm,
  formatDistance
} from "@/lib/client-booking";
import { parseDateSafe } from "@/lib/date-utils";
import { fetchRealSalonsFromDatabase } from "@/lib/salons-service";
import BookingWizardModal from "@/components/BookingWizardModal";
import ReviewModal from "@/components/ReviewModal";
import SalonShareModal from "@/components/SalonShareModal";
import { ClientSidebar, ClientTabType } from "@/components/ClientSidebar";

type SortOption = "rating" | "reviews" | "price" | "name" | "distance";

export default function ClientePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Responsive Mobile Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lista saloni dal database reale (con fallback se vuoto)
  const [salonsList, setSalonsList] = useState<SalonListing[]>(INITIAL_SALONS);

  // Tab Principale: "marketplace" | "appuntamenti" | "preferiti" | "profilo"
  const [activeTab, setActiveTab] = useState<ClientTabType>("marketplace");

  // Filtri e Ricerca Intelligente Marketplace
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("Tutte");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tutti");
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("rating");

  // Geolocalizzazione "Vicino a Me"
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isNearMeActive, setIsNearMeActive] = useState(false);

  // Dati cliente
  const [appointments, setAppointments] = useState<ClientAppointmentItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stato Modifica Area Personale Cliente
  const [clientDisplayName, setClientDisplayName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientBeautyNotes, setClientBeautyNotes] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Modali interattivi
  const [activeBookingSalon, setActiveBookingSalon] = useState<SalonListing | null>(null);
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | undefined>(undefined);
  const [activeReviewAppt, setActiveReviewAppt] = useState<ClientAppointmentItem | null>(null);
  const [activeShareSalon, setActiveShareSalon] = useState<SalonListing | null>(null);

  // Data per evitare errori di idratazione
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    setCurrentDate(new Date());

    // 1. Carica i saloni reali registrati nel database Firestore
    fetchRealSalonsFromDatabase().then((realSalons) => {
      if (realSalons && realSalons.length > 0) {
        setSalonsList(realSalons);
      }
    });

    // 2. Ascolta l'autenticazione utente
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUser(user);
        let p = await fetchUserProfile(user.uid) || getUserProfile(user.uid);
        if (p && p.role === "salone") {
          router.push(p.planStatus === "PAYMENT_REQUIRED" ? "/abbonamento-pro" : "/");
          return;
        }
        setProfile(p);

        // Prepopola i campi del profilo personale cliente
        if (p) {
          setClientDisplayName(p.displayName || user.displayName || "");
          setClientPhone(p.phoneNumber || "");
          setClientCity(p.preferredCity || "");
          setClientBeautyNotes(p.beautyNotes || "");
        } else {
          setClientDisplayName(user.displayName || user.email?.split("@")[0] || "");
        }
        
        // Carica subito da cache per un'apertura istantanea, poi allinea dal cloud Firestore (cercando sia UID che Email)
        const cached = getClientAppointments(user.uid);
        setAppointments(cached);
        fetchClientAppointmentsCloud(user.uid, user.email).then((cloudAppts) => {
          setAppointments(cloudAppts);
        });

        setFavoriteIds(getFavoriteSalons(user.uid));
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Ascolta aggiornamenti in tempo reale (prenotazioni, cancellazioni, recensioni)
  useEffect(() => {
    const handleUpdate = () => {
      if (currentUser) {
        fetchClientAppointmentsCloud(currentUser.uid, currentUser.email).then((cloudAppts) => {
          setAppointments(cloudAppts);
        });
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("trimmy-data-updated", handleUpdate);
      return () => {
        window.removeEventListener("trimmy-data-updated", handleUpdate);
      };
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleSaveClientProfile = async () => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const updated = updateUserProfile(currentUser.uid, {
        displayName: clientDisplayName,
        phoneNumber: clientPhone,
        preferredCity: clientCity,
        beautyNotes: clientBeautyNotes,
      });
      setProfile(updated);
      showToast("Scheda personale e preferenze salvate con successo! ✨");
    } catch {
      showToast("Errore durante il salvataggio.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Elenco città dinamiche
  const cities = useMemo(() => {
    const list = Array.from(new Set(salonsList.map((s) => s.city)));
    return ["Tutte", ...list];
  }, [salonsList]);

  // Categorie Principali
  const categories = [
    { id: "Tutti", label: "Tutte le categorie", icon: Compass },
    { id: "Barber Shop", label: "Barber Shop", icon: Scissors },
    { id: "Hair Stylist Donna", label: "Hair & Colore", icon: Sparkles },
    { id: "Unisex", label: "Salone Unisex", icon: User },
    { id: "Centro Estetico", label: "Beauty & Spa", icon: Star }
  ];

  // Attivazione/disattivazione geolocalizzazione "Vicino a me"
  const handleNearMeToggle = () => {
    if (isNearMeActive) {
      setIsNearMeActive(false);
      setSortBy("rating");
      showToast("Filtro 'Vicino a me' disattivato");
      return;
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("⚠️ La geolocalizzazione non è supportata da questo browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setIsNearMeActive(true);
        setSortBy("distance");
        setIsLocating(false);
        showToast("📍 Posizione rilevata! Saloni ordinati dal più vicino a te.");
      },
      (error) => {
        setIsLocating(false);
        console.warn("Geolocalizzazione errore:", error);
        showToast("⚠️ Impossibile rilevare la posizione (permesso negato nel browser)");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Mappa delle distanze reali per ciascun salone (Formula di Haversine)
  const salonDistances = useMemo(() => {
    if (!userLocation) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    salonsList.forEach((salon) => {
      if (salon.lat && salon.lng) {
        map[salon.id] = calculateDistanceKm(userLocation.lat, userLocation.lng, salon.lat, salon.lng);
      }
    });
    return map;
  }, [salonsList, userLocation]);

  // Chip Intelligenti con Trend e Ricerche Rapide
  const quickFilters = [
    { id: "all", label: "Tutti" },
    { id: "barba", label: "🧔 Barba & Rasatura", keyword: "barba" },
    { id: "taglio", label: "✂️ Taglio & Styling", keyword: "taglio" },
    { id: "colore", label: "🎨 Colore & Schiariture", keyword: "colore" },
    { id: "top_rated", label: "⭐ Top Rated (4.8+)", minRating: 4.8 },
    { id: "convenienti", label: "🏷️ Miglior Prezzo (≤ 25€)", maxPrice: 25 }
  ];

  // MOTORE DI RICERCA ULTRA-INTELLIGENTE (MULTICAMPO: NOME, CITTA, SERVIZI, ZONA, DISTANZA)
  const { filteredSalons, matchReasons } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const reasonsMap: Record<string, string> = {};

    let list = salonsList.filter((salon) => {
      // 1. Filtro Citta
      if (selectedCity !== "Tutte" && salon.city !== selectedCity) {
        return false;
      }

      // 2. Filtro Categoria
      if (selectedCategory !== "Tutti" && salon.category !== selectedCategory) {
        return false;
      }

      // 3. Filtri Rapidi Chip
      const currentQuick = quickFilters.find((q) => q.id === selectedQuickFilter);
      if (currentQuick) {
        if (currentQuick.minRating && salon.rating < currentQuick.minRating) {
          return false;
        }
        if (currentQuick.maxPrice && salon.minPrice > currentQuick.maxPrice) {
          return false;
        }
        if (currentQuick.keyword) {
          const matchCat = salon.category.toLowerCase().includes(currentQuick.keyword);
          const matchServ = salon.featuredServices.some((s) => s.name.toLowerCase().includes(currentQuick.keyword));
          if (!matchCat && !matchServ) return false;
        }
      }

      // 4. Ricerca Testuale Intelligente Multi-Campo
      if (!query) return true;

      const nameMatch = salon.name.toLowerCase().includes(query);
      const cityMatch = salon.city.toLowerCase().includes(query);
      const zoneMatch = salon.zone.toLowerCase().includes(query);
      const addressMatch = salon.address.toLowerCase().includes(query);
      const categoryMatch = salon.category.toLowerCase().includes(query);

      // Cerca nei servizi specifici offerti
      const matchedService = salon.featuredServices.find((s) => s.name.toLowerCase().includes(query));

      if (matchedService) {
        reasonsMap[salon.id] = `Include servizio: "${matchedService.name}" (€${matchedService.price})`;
        return true;
      }
      if (zoneMatch) {
        reasonsMap[salon.id] = `Zona: ${salon.zone}`;
        return true;
      }
      if (cityMatch) {
        reasonsMap[salon.id] = `Città: ${salon.city}`;
        return true;
      }
      if (categoryMatch) {
        reasonsMap[salon.id] = `Categoria: ${salon.category}`;
        return true;
      }
      if (nameMatch || addressMatch) {
        return true;
      }

      return false;
    });

    // Ordinamento (supporta anche 'distance' via GPS)
    list = [...list].sort((a, b) => {
      if (sortBy === "distance" && userLocation) {
        const distA = a.lat && a.lng ? calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) : 99999;
        const distB = b.lat && b.lng ? calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng) : 99999;
        return distA - distB;
      }
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
      if (sortBy === "price") return a.minPrice - b.minPrice;
      return a.name.localeCompare(b.name, "it-IT");
    });

    return { filteredSalons: list, matchReasons: reasonsMap };
  }, [salonsList, searchQuery, selectedCity, selectedCategory, selectedQuickFilter, sortBy, userLocation]);

  const favoriteSalons = useMemo(() => {
    return salonsList.filter((s) => favoriteIds.includes(s.id));
  }, [salonsList, favoriteIds]);

  // Suddivisione appuntamenti imminenti / passati
  const { upcomingAppointments, pastAppointments } = useMemo(() => {
    if (!currentDate) return { upcomingAppointments: [], pastAppointments: [] };
    const upcoming: ClientAppointmentItem[] = [];
    const past: ClientAppointmentItem[] = [];

    appointments.forEach((item) => {
      const apptDate = parseDateSafe(item.startTime);
      if (item.status === "CONFIRMED" && apptDate >= currentDate) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    });

    upcoming.sort((a, b) => parseDateSafe(a.startTime).getTime() - parseDateSafe(b.startTime).getTime());
    past.sort((a, b) => parseDateSafe(b.startTime).getTime() - parseDateSafe(a.startTime).getTime());

    return { upcomingAppointments: upcoming, pastAppointments: past };
  }, [appointments, currentDate]);

  const handleCancelAppointment = (apptId: string) => {
    if (!currentUser) return;
    if (!confirm("Confermi di voler cancellare questo appuntamento? Lo slot orario verrà riaperto immediatamente.")) return;
    const updated = cancelClientAppointment(currentUser.uid, apptId);
    setAppointments(updated);
    showToast("Appuntamento annullato con successo");
  };

  const handleToggleFavorite = (salonId: string) => {
    if (!currentUser) return;
    const updated = toggleFavoriteSalon(currentUser.uid, salonId);
    setFavoriteIds(updated);
    showToast(updated.includes(salonId) ? "Aggiunto ai tuoi saloni preferiti ❤️" : "Rimosso dai preferiti");
  };

  const handleBookingConfirmed = () => {
    if (currentUser) {
      setAppointments(getClientAppointments(currentUser.uid));
      setActiveTab("appuntamenti");
      showToast("🎉 Appuntamento registrato con successo!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] text-zinc-900 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-md animate-pulse">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold font-mono">
            Caricamento Spazio Cliente...
          </span>
        </div>
      </div>
    );
  }

  const displayName = clientDisplayName || profile?.displayName || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Cliente";
  const nextAppt = upcomingAppointments[0];

  return (
    <div className="flex h-screen h-[100dvh] bg-white font-sans text-zinc-900 overflow-hidden w-full antialiased">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. BARRA LATERALE CLIENTE (DESKTOP) */}
      <ClientSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        appointmentsCount={upcomingAppointments.length}
        favoritesCount={favoriteIds.length}
        nextAppointment={nextAppt}
        displayName={displayName}
        email={currentUser?.email || ""}
        onLogout={handleLogout}
      />

      {/* 2. DRAWER MOBILE CON BACKDROP BLUR (SMARTPHONE) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <ClientSidebar
              isMobile
              activeTab={activeTab}
              onTabChange={setActiveTab}
              appointmentsCount={upcomingAppointments.length}
              favoritesCount={favoriteIds.length}
              nextAppointment={nextAppt}
              displayName={displayName}
              email={currentUser?.email || ""}
              onLogout={handleLogout}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 3. AREA CENTRALE / CONTENUTO PRINCIPALE */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
        
        {/* HEADER SUPERIORE ADATTIVO (SALONE DASHBOARD STYLE) */}
        <header className="h-16 bg-white border-b border-zinc-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-20 shrink-0 gap-3">
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors border border-zinc-200/70 cursor-pointer"
              title="Apri menu"
              aria-label="Apri menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-zinc-900 tracking-tight capitalize">
                {activeTab === "marketplace" && "Esplora Saloni & Trattamenti"}
                {activeTab === "appuntamenti" && "I Miei Appuntamenti"}
                {activeTab === "preferiti" && "I Miei Saloni Preferiti"}
                {activeTab === "profilo" && "Scheda Personale Cliente"}
              </span>
            </div>
          </div>

          {/* Quick Account Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {nextAppt && (
              <button
                onClick={() => setActiveTab("appuntamenti")}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-xs font-semibold hover:bg-emerald-100/70 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Prossima seduta: {nextAppt.serviceName}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("profilo")}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-all cursor-pointer"
              title="Area personale"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-zinc-800 hidden sm:inline-block max-w-[120px] truncate">
                {displayName}
              </span>
            </button>
          </div>

        </header>

        {/* CONTENUTO SCORREVOLE */}
        <main 
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-28 md:pb-12"
          style={{ paddingBottom: "max(6rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))" }}
        >

          {/* ======================= SEZIONE 1: MARKETPLACE & RICERCA VALORIZZATA ======================= */}
          {activeTab === "marketplace" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              
              {/* HERO SEARCH BOX ULTRA-INTELLIGENTE */}
              <div className="p-4 sm:p-6 bg-white border border-zinc-200/80 rounded-3xl shadow-xs space-y-4">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
                      Cerca il tuo salone di fiducia
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                      Ricerca intelligente per nome salone, via, città o <strong>trattamento specifico</strong> (es. barba, taglio, colore, piega).
                    </p>
                  </div>

                  {/* Conteggio Saloni Disponibili */}
                  <div className="flex items-center px-3.5 py-1.5 bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 shrink-0 self-start md:self-auto border border-zinc-200/80">
                    <span>{filteredSalons.length} saloni disponibili</span>
                  </div>
                </div>

                {/* Barra di Ricerca Multi-Parametro con Geolocalizzazione 'Vicino a me' */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
                  
                  {/* Campo Testo Principale (5 cols) */}
                  <div className="md:col-span-5 relative flex items-center bg-zinc-50 border border-zinc-200/90 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:bg-white transition-all">
                    <Search className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cerca salone, via o trattamento (es. taglio, barba, balayage)..."
                      className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none font-medium"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")} 
                        className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                        title="Cancella ricerca"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Pulsante 'Vicino a me' Geolocalizzato (2.5 cols) */}
                  <div className="md:col-span-2 sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleNearMeToggle}
                      disabled={isLocating}
                      className={`w-full h-full min-h-[42px] flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                        isNearMeActive
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs hover:bg-emerald-700"
                          : "bg-zinc-50 border-zinc-200/90 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                      title="Usa la tua posizione per trovare i saloni più vicini in km"
                    >
                      {isLocating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                          <span className="truncate">Rilevo GPS...</span>
                        </>
                      ) : isNearMeActive ? (
                        <>
                          <LocateFixed className="w-4 h-4 text-white animate-pulse" />
                          <span className="truncate font-bold">Vicino a me</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="w-4 h-4 text-zinc-500" />
                          <span className="truncate">Vicino a me</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Selettore Città (2.5 cols) */}
                  <div className="md:col-span-2 flex items-center bg-zinc-50 border border-zinc-200/90 rounded-2xl px-3.5 py-2.5">
                    <MapPin className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-zinc-800 focus:outline-none cursor-pointer truncate"
                    >
                      {cities.map((city) => (
                        <option key={city} value={city}>
                          {city === "Tutte" ? "Tutte le Città" : `📍 ${city}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ordinamento (2.5 cols) */}
                  <div className="md:col-span-3 flex items-center bg-zinc-50 border border-zinc-200/90 rounded-2xl px-3.5 py-2.5">
                    <ArrowUpDown className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        const val = e.target.value as SortOption;
                        setSortBy(val);
                        if (val === "distance" && !userLocation) {
                          handleNearMeToggle();
                        }
                      }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-zinc-800 focus:outline-none cursor-pointer"
                    >
                      <option value="rating">Miglior Voto ⭐️</option>
                      <option value="distance">Più Vicini a Me 📍</option>
                      <option value="reviews">Più Recensiti 💬</option>
                      <option value="price">Prezzo più Basso 🏷️</option>
                      <option value="name">Alfabetico (A-Z)</option>
                    </select>
                  </div>

                </div>

                {/* Chip Rapidi Trend / Categorie */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase text-zinc-400 font-mono mr-1">
                    Filtro rapido:
                  </span>
                  {quickFilters.map((qf) => {
                    const isSel = selectedQuickFilter === qf.id;
                    return (
                      <button
                        key={qf.id}
                        onClick={() => setSelectedQuickFilter(qf.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                          isSel
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                            : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
                        }`}
                      >
                        {qf.label}
                      </button>
                    );
                  })}
                  {(searchQuery || selectedCity !== "Tutte" || selectedCategory !== "Tutti" || selectedQuickFilter !== "all") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCity("Tutte");
                        setSelectedCategory("Tutti");
                        setSelectedQuickFilter("all");
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline ml-auto cursor-pointer"
                    >
                      Azzera Filtri
                    </button>
                  )}
                </div>

              </div>

              {/* VISTA GRIGLIA SALONI ADERENTI */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
                    <span>Trovati <strong>{filteredSalons.length} saloni</strong> aderenti</span>
                    {searchQuery && (
                      <span className="text-zinc-700">
                        Risultati per: &quot;<strong className="text-zinc-900">{searchQuery}</strong>&quot;
                      </span>
                    )}
                  </div>

                  {filteredSalons.length === 0 ? (
                    <div className="py-16 px-6 text-center bg-white border border-dashed border-zinc-200 rounded-3xl max-w-lg mx-auto my-6">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-base text-zinc-900">Nessun salone trovato</h3>
                      <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                        Nessun risultato corrisponde ai criteri cercati. Prova a modificare la parola chiave o la città.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCity("Tutte");
                          setSelectedCategory("Tutti");
                          setSelectedQuickFilter("all");
                        }}
                        className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Mostra tutti i saloni
                      </button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredSalons.map((salon) => {
                        const isFav = favoriteIds.includes(salon.id);
                        const matchReason = matchReasons[salon.id];

                        return (
                          <div
                            key={salon.id}
                            className="group rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative"
                          >
                            <div>
                              {/* Top Bar Card */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                                  {salon.category}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setActiveShareSalon(salon)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                                    title="Condividi / QR Code"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleFavorite(salon.id)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 transition-colors cursor-pointer"
                                    title="Salva tra i preferiti"
                                  >
                                    <Heart className={`w-4 h-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                                  </button>
                                </div>
                              </div>

                              {/* Match Reason Badge se presente */}
                              {matchReason && (
                                <div className="mt-2 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                  <CheckCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">{matchReason}</span>
                                </div>
                              )}

                              {/* Title & Location */}
                              <div className="mt-3">
                                <h3 className="font-bold text-base text-zinc-900 tracking-tight group-hover:text-zinc-700 transition-colors">
                                  {salon.name}
                                </h3>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.name + " " + salon.address + " " + salon.city)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 mt-1 transition-colors group/loc"
                                  title="Apri posizione su Google Maps"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-zinc-400 group-hover/loc:text-zinc-700 shrink-0" />
                                  <span className="truncate">{salon.address}, {salon.city} ({salon.zone})</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover/loc:opacity-100 transition-opacity" />
                                </a>
                              </div>

                              {/* Rating & Distance */}
                              <div className="flex items-center gap-3 mt-3.5 py-2 px-3 rounded-xl bg-zinc-50 border border-zinc-200/60 text-xs">
                                <span className="flex items-center gap-1 font-bold text-amber-700">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                  {salon.rating}
                                </span>
                                <span className="text-zinc-400 font-mono">({salon.reviewCount})</span>
                                <span className={`ml-auto flex items-center gap-1 ${
                                  userLocation && salonDistances[salon.id] !== undefined
                                    ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold text-[11px]"
                                    : "text-zinc-500 font-medium"
                                }`}>
                                  <Navigation className={`w-3 h-3 ${userLocation ? "text-emerald-600" : "text-zinc-400"}`} />
                                  {userLocation && salonDistances[salon.id] !== undefined
                                    ? `${formatDistance(salonDistances[salon.id])} da te`
                                    : salon.distance}
                                </span>
                              </div>

                              {/* Servizi Chiave Disponibili */}
                              <div className="mt-4 space-y-1.5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                                  Servizi più richiesti:
                                </span>
                                <div className="space-y-1.5">
                                  {salon.featuredServices.slice(0, 3).map((fs, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        setActiveBookingSalon(salon);
                                        setPreselectedServiceId(DEFAULT_BOOKING_SERVICES[0].id);
                                      }}
                                      className="w-full text-left p-2 rounded-xl bg-zinc-50/70 hover:bg-zinc-100/70 border border-zinc-200/50 hover:border-zinc-300 transition-colors flex items-center justify-between text-xs group/btn cursor-pointer"
                                    >
                                      <span className="text-zinc-700 font-medium truncate pr-2 group-hover/btn:text-zinc-900">
                                        {fs.name}
                                      </span>
                                      <span className="font-bold text-zinc-900 shrink-0">
                                        {fs.price} €
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                            </div>

                            {/* Card Footer Button */}
                            <div className="pt-3 border-t border-zinc-100 flex gap-2">
                              <button
                                onClick={() => {
                                  setActiveBookingSalon(salon);
                                  setPreselectedServiceId(undefined);
                                }}
                                className="w-full py-2.5 px-4 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                              >
                                <CalendarPlus className="w-4 h-4" />
                                <span>Prenota Ora</span>
                                <span className="text-[10px] text-zinc-300 font-mono ml-auto">da {salon.minPrice}€</span>
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

            </div>
          )}

          {/* ======================= SEZIONE 3: I MIEI APPUNTAMENTI ======================= */}
          {activeTab === "appuntamenti" && (
            <div className="space-y-8 max-w-5xl mx-auto">
              
              {/* Prossimi Appuntamenti */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">Appuntamenti Confermati</h2>
                    <p className="text-xs text-zinc-500">I tuoi appuntamenti in programma con conferma immediata.</p>
                  </div>
                  {upcomingAppointments.length > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-mono">
                      {upcomingAppointments.length} attivo/i
                    </span>
                  )}
                </div>

                {upcomingAppointments.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white border border-zinc-200/80 text-center space-y-4 shadow-xs">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900">Nessuna prenotazione attiva</h3>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                        Non hai appuntamenti in programma. Esplora i saloni partner e prenota in pochi secondi.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("marketplace")}
                      className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                    >
                      Esplora Saloni & Prenota
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.map((appt) => {
                      const startDate = parseDateSafe(appt.startTime);
                      const endDate = parseDateSafe(appt.endTime);
                      const gCalUrl = buildGoogleCalendarUrl({
                        title: `${appt.serviceName} - ${appt.salonName}`,
                        description: `Appuntamento confermato per ${appt.serviceName} presso ${appt.salonName}. Operatore: ${appt.staffName || "Staff"}.`,
                        location: `${appt.salonAddress}, ${appt.salonCity}`,
                        startTime: startDate,
                        endTime: endDate,
                      });

                      return (
                        <div
                          key={appt.id}
                          className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex flex-col items-center justify-center shrink-0">
                              <span className="text-xs font-extrabold leading-none">
                                {startDate.getDate()}
                              </span>
                              <span className="text-[10px] uppercase font-mono font-medium text-zinc-400 mt-0.5">
                                {startDate.toLocaleDateString("it-IT", { month: "short" })}
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  Confermato
                                </span>
                                <span className="text-xs text-zinc-400 font-mono">
                                  Ore {startDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - {endDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <h4 className="font-bold text-base text-zinc-900 mt-1">
                                {appt.serviceName}
                              </h4>
                              <p className="text-xs text-zinc-600 mt-0.5">
                                <strong>{appt.salonName}</strong> • con {appt.staffName}
                              </p>
                              <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 text-zinc-400" />
                                {appt.salonAddress}, {appt.salonCity}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-zinc-100 sm:border-t-0">
                            {/* Aggiungi a Google Calendar */}
                            <a
                              href={gCalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                              title="Salva in Google Calendar"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Google Calendar</span>
                            </a>

                            {/* Annulla */}
                            <button
                              onClick={() => handleCancelAppointment(appt.id)}
                              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Annulla appuntamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Storico Appuntamenti Passati */}
              {pastAppointments.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-zinc-200/60">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 font-mono">
                    Storico Trattamenti Conclusi ({pastAppointments.length})
                  </h3>
                  <div className="space-y-2.5">
                    {pastAppointments.map((appt) => {
                      const startDate = parseDateSafe(appt.startTime);
                      return (
                        <div
                          key={appt.id}
                          className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between text-xs text-zinc-600"
                        >
                          <div>
                            <p className="font-semibold text-zinc-900">{appt.serviceName} • {appt.salonName}</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {startDate.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })} con {appt.staffName} (€{appt.price})
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveReviewAppt(appt)}
                            className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Recensisci ⭐️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ======================= SEZIONE 4: SALONI PREFERITI ======================= */}
          {activeTab === "preferiti" && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">I Tuoi Saloni Preferiti</h2>
                <p className="text-xs text-zinc-500">I tuoi locali di fiducia salvati per prenotazioni veloci.</p>
              </div>

              {favoriteSalons.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white border border-zinc-200/80 text-center space-y-4 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                    <Heart className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900">Nessun salone salvato</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                      Clicca sull&apos;icona del cuore sui saloni del marketplace per aggiungerli alla tua lista dei preferiti.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("marketplace")}
                    className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                  >
                    Esplora Saloni
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {favoriteSalons.map((salon) => (
                    <div
                      key={salon.id}
                      className="p-5 rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-300 shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full border border-zinc-200">
                            {salon.category}
                          </span>
                          <button
                            onClick={() => handleToggleFavorite(salon.id)}
                            className="p-1 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Rimuovi dai preferiti"
                          >
                            <Heart className="w-4 h-4 fill-rose-500" />
                          </button>
                        </div>

                        <h4 className="font-bold text-base text-zinc-900 mt-2">{salon.name}</h4>
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          {salon.address}, {salon.city}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{salon.rating}</span>
                          <span className="text-zinc-400 font-normal">({salon.reviewCount} recensioni)</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 flex gap-2">
                        <button
                          onClick={() => {
                            setActiveBookingSalon(salon);
                            setPreselectedServiceId(undefined);
                          }}
                          className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Prenota Subito
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================= SEZIONE 5: SCHEDA PERSONALE & PROFILO CLIENTE ======================= */}
          {activeTab === "profilo" && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Scheda Bellezza & Profilo</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    I tuoi dati di contatto e le tue preferenze tecniche di stile visibili ai parrucchieri durante le prenotazioni.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Nome e Cognome
                      </label>
                      <input
                        type="text"
                        value={clientDisplayName}
                        onChange={(e) => setClientDisplayName(e.target.value)}
                        placeholder="Es. Marco Rossi"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Numero di Telefono
                      </label>
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Es. 340 1234567"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Indirizzo Email (Account)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={currentUser?.email || ""}
                      className="w-full px-3.5 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-500 font-mono cursor-not-allowed"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">L&apos;indirizzo email è vincolato al tuo account Google/Firebase.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Città Preferita per le Ricerche
                    </label>
                    <input
                      type="text"
                      value={clientCity}
                      onChange={(e) => setClientCity(e.target.value)}
                      placeholder="Es. Milano, Roma, Firenze..."
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Note Tecniche di Bellezza / Preferenze di Taglio
                    </label>
                    <textarea
                      rows={3}
                      value={clientBeautyNotes}
                      onChange={(e) => setClientBeautyNotes(e.target.value)}
                      placeholder="Es. Cute sensibile, preferisco sfumatura a forbice, no cere lucide, allergia al nichel..."
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all resize-none"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Queste note saranno visibili al parrucchiere quando prenoti un appuntamento per offrirti un servizio su misura.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-mono">
                    Ruolo: <strong className="text-zinc-800 uppercase">Cliente Verificato</strong>
                  </span>

                  <button
                    onClick={handleSaveClientProfile}
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Salva Modifiche
                  </button>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ================= MODALI POPUP ================= */}
      {/* 1. Modal Wizard di Prenotazione */}
      {activeBookingSalon && (
        <BookingWizardModal
          salon={activeBookingSalon}
          isOpen={!!activeBookingSalon}
          onClose={() => setActiveBookingSalon(null)}
          userUid={currentUser?.uid || "cliente-demo"}
          userEmail={currentUser?.email || undefined}
          userName={displayName}
          userPhone={clientPhone || "320 000 0000"}
          onBookingConfirmed={handleBookingConfirmed}
          preselectedServiceId={preselectedServiceId}
        />
      )}

      {/* 2. Modal Lascia Recensione */}
      {activeReviewAppt && (
        <ReviewModal
          appointment={activeReviewAppt}
          isOpen={!!activeReviewAppt}
          onClose={() => setActiveReviewAppt(null)}
          userUid={currentUser?.uid || "cliente-demo"}
          onReviewSubmitted={(updated) => {
            setAppointments(updated);
            showToast("Grazie per la recensione! ⭐");
          }}
        />
      )}

      {/* 3. Modal QR Code e Condivisione */}
      {activeShareSalon && (
        <SalonShareModal
          salon={activeShareSalon}
          isOpen={!!activeShareSalon}
          onClose={() => setActiveShareSalon(null)}
        />
      )}

    </div>
  );
}
