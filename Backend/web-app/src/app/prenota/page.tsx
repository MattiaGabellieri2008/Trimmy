"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  CalendarPlus,
  Download,
  User,
  ChevronRight
} from "lucide-react";
import { 
  INITIAL_SALONS, 
  SalonListing, 
  DEFAULT_BOOKING_SERVICES, 
  DEFAULT_BOOKING_STAFF,
  buildGoogleCalendarUrl,
  downloadIcsFile,
  saveClientAppointment,
  ClientAppointmentItem
} from "@/lib/client-booking";
import { dataConnect } from "@/lib/firebase";
import { createAppointment } from "@/dataconnect-generated";
import { parseDateSafe } from "@/lib/date-utils";
import { ensureCustomerForBooking } from "@/lib/customers-store";
import { fetchSalonById } from "@/lib/salons-service";
import { fetchSalonStaff } from "@/lib/staff-store";
import { saveSalonAppointment, getLocalDateString } from "@/lib/appointments-service";
import { getSalonTenantId } from "@/lib/tenant-helper";

function PrenotaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saloneId = searchParams.get("salone") || INITIAL_SALONS[0].id;

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [salon, setSalon] = useState<SalonListing>(() => {
    return INITIAL_SALONS.find((s) => s.id === saloneId) || INITIAL_SALONS[0];
  });

  // Wizard state: 1: Trattamento, 2: Operatore, 3: Data & Ora, 4: Conferma, 5: Fatto
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("any");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("11:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<ClientAppointmentItem | null>(null);
  const [availableDays, setAvailableDays] = useState<{ dateStr: string; dayName: string; dayNumber: number; monthName: string; isToday: boolean }[]>([]);
  const [salonStaffList, setSalonStaffList] = useState<any[]>([]);

  // Carica i dati reali del salone da Cloud Firestore (o fallback su INITIAL_SALONS)
  useEffect(() => {
    if (!saloneId) return;
    fetchSalonById(saloneId).then((found) => {
      if (found) {
        setSalon(found);
        if (found.services && found.services.length > 0) {
          setSelectedServiceId(String(found.services[0].id));
        }
      }
    }).catch(() => {});

    fetchSalonStaff(saloneId).then((staff) => {
      if (staff && staff.length > 0) {
        setSalonStaffList(staff);
      }
    }).catch(() => {});
  }, [saloneId]);

  // Lista trattamenti (reali o predefiniti)
  const servicesList = salon.services && salon.services.length > 0
    ? salon.services
    : DEFAULT_BOOKING_SERVICES;

  // Lista staff (reali o predefiniti)
  const staffList = salonStaffList.length > 0
    ? salonStaffList.map((st) => ({
        id: st.id,
        fullName: st.fullName,
        role: st.role || "Stylist",
        rating: st.rating || 4.9
      }))
    : DEFAULT_BOOKING_STAFF;

  useEffect(() => {
    if (!selectedServiceId && servicesList.length > 0) {
      setSelectedServiceId(String(servicesList[0].id));
    }
  }, [selectedServiceId, servicesList]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    const now = new Date();
    setSelectedDate(getLocalDateString(now));

    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      if (d.getDay() === 0) continue;
      days.push({
        dateStr: getLocalDateString(d),
        dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString("it-IT", { month: "short" }),
        isToday: i === 0
      });
    }
    setAvailableDays(days);

    return () => unsub();
  }, []);

  const activeService = servicesList.find((s) => String(s.id) === String(selectedServiceId)) || servicesList[0];
  const activeStaff = selectedStaffId === "any"
    ? { id: staffList[0]?.id || "staff-default", fullName: "Qualsiasi operatore disponibile", role: "Team " + salon.name }
    : staffList.find((st) => String(st.id) === String(selectedStaffId)) || staffList[0];

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"
  ];

  const getDates = () => {
    const [hours, minutes] = selectedTimeSlot.split(":").map(Number);
    const start = selectedDate ? parseDateSafe(selectedDate) : new Date();
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + activeService.durationMinutes * 60 * 1000);
    return { start, end };
  };

  const { start, end } = getDates();
  const formattedDayStr = start.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const userUid = currentUser?.uid || "ospite-anonimo";

    const newAppt: ClientAppointmentItem = {
      id: "appt-" + Date.now(),
      tenantId: salon.id,
      salonId: salon.id,
      salonName: salon.name,
      salonAddress: salon.address,
      salonCity: salon.city,
      salonPhone: salon.phone,
      serviceId: String(activeService.id),
      serviceName: activeService.name,
      staffId: String(activeStaff.id),
      staffName: activeStaff.fullName,
      price: activeService.price,
      durationMinutes: activeService.durationMinutes,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "CONFIRMED",
      createdAt: new Date().toISOString()
    };

    try {
      try {
        const clientName = currentUser?.displayName || "Cliente Trimmy";
        const nameParts = clientName.trim().split(" ");
        const firstName = nameParts[0] || "Cliente";
        const lastName = nameParts.slice(1).join(" ") || "Trimmy";
        const salonTenantId = getSalonTenantId(salon.id);
        const salonRawId = salon.id;

        const customerRecord = await ensureCustomerForBooking(salonTenantId, {
          firstName,
          lastName,
          phone: currentUser?.phoneNumber || "320 000 0000",
          email: currentUser?.email || null
        }, salonRawId);

        // Salva direttamente nell'agenda reale del salone (Cloud Firestore + schedule locks)
        await saveSalonAppointment({
          id: newAppt.id,
          tenantId: salonTenantId,
          salonRawId: salonRawId,
          salonName: salon.name,
          customerId: customerRecord.id,
          customer: {
            id: customerRecord.id,
            firstName: customerRecord.firstName,
            lastName: customerRecord.lastName,
            phone: customerRecord.phone,
            email: customerRecord.email || undefined
          },
          serviceId: String(activeService.id),
          service: {
            id: String(activeService.id),
            name: activeService.name,
            durationMinutes: activeService.durationMinutes,
            price: activeService.price
          },
          staffId: activeStaff.id,
          staff: {
            id: activeStaff.id,
            fullName: activeStaff.fullName,
            role: activeStaff.role
          },
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          status: "CONFIRMED",
          createdAt: new Date().toISOString(),
          price: activeService.price
        });

        // Sincronizzazione opzionale su Data Connect
        createAppointment(dataConnect, {
          tenantId: salonTenantId,
          customerId: customerRecord.id,
          serviceId: String(activeService.id),
          staffId: activeStaff.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          status: "CONFIRMED"
        }).catch((e) => console.warn("SQL Connect background sync:", e));
      } catch (e) {
        console.warn("Sync errore appuntamento:", e);
      }

      saveClientAppointment(userUid, newAppt);
      setConfirmedAppt(newAppt);
      setStep(5);
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio prenotazione.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex flex-col font-sans antialiased">
      
      {/* Navbar Minimal Light */}
      <header className="h-16 bg-white border-b border-zinc-200/60 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/cliente")}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors px-2.5 py-1.5 hover:bg-zinc-100 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Torna all&apos;Area Cliente</span>
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-900">{salon.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline font-medium text-zinc-600">Prenotazione Online Certificata</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Salon Card Banner */}
        <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative">
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/60 uppercase tracking-wider">
              {salon.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">{salon.name}</h1>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              {salon.address}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:border-l sm:border-zinc-100 sm:pl-6 text-xs">
            <div className="text-left">
              <span className="flex items-center gap-1 font-bold text-amber-700 text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" /> {salon.rating}
              </span>
              <span className="text-[11px] text-zinc-400">{salon.reviewCount} recensioni verificate</span>
            </div>
            <a
              href={`tel:${salon.phone}`}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl font-semibold text-zinc-800 transition-all shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-zinc-600" />
              Chiama
            </a>
          </div>
        </div>

        {/* Wizard Form Container */}
        <div className="bg-white border border-zinc-200/80 rounded-3xl shadow-xs overflow-hidden">
          
          {/* Progress Bar */}
          {step < 5 && (
            <div className="grid grid-cols-4 border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-semibold">
              <button
                onClick={() => setStep(1)}
                className={`py-3.5 text-center border-b-2 transition-all ${
                  step === 1 ? "border-zinc-900 text-zinc-900 bg-white font-bold" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                1. Servizio
              </button>
              <button
                onClick={() => step > 1 && setStep(2)}
                className={`py-3.5 text-center border-b-2 transition-all ${
                  step === 2 ? "border-zinc-900 text-zinc-900 bg-white font-bold" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                2. Stylist
              </button>
              <button
                onClick={() => step > 2 && setStep(3)}
                className={`py-3.5 text-center border-b-2 transition-all ${
                  step === 3 ? "border-zinc-900 text-zinc-900 bg-white font-bold" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                3. Data & Ora
              </button>
              <button
                onClick={() => step > 3 && setStep(4)}
                className={`py-3.5 text-center border-b-2 transition-all ${
                  step === 4 ? "border-zinc-900 text-zinc-900 bg-white font-bold" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                4. Conferma
              </button>
            </div>
          )}

          {/* Form Content */}
          <div className="p-6 sm:p-8 space-y-6">

            {/* STEP 1: SERVIZIO */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-zinc-900 tracking-tight">Seleziona il tuo trattamento</h3>
                  <span className="text-xs text-zinc-500 font-mono">{servicesList.length} disponibili</span>
                </div>
                <div className="space-y-3">
                  {servicesList.map((s) => {
                    const isSelected = String(selectedServiceId) === String(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedServiceId(String(s.id))}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 shadow-xs"
                            : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isSelected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {s.category}
                          </span>
                          <h4 className="font-bold text-sm sm:text-base text-zinc-900">{s.name}</h4>
                          <p className={`text-xs leading-relaxed ${isSelected ? "text-zinc-600" : "text-zinc-500"}`}>{s.description}</p>
                          <div className={`text-xs font-medium pt-1 flex items-center gap-1 ${isSelected ? "text-zinc-900" : "text-zinc-500"}`}>
                            <Clock className="w-3.5 h-3.5" /> {s.durationMinutes} minuti
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black block tracking-tight text-zinc-900">
                            {s.price.toFixed(2)} €
                          </span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
                              <Check className="w-3.5 h-3.5" /> Selezionato
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: STAFF */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-zinc-900 tracking-tight">Chi si prenderà cura di te?</h3>
                <div className="space-y-3">
                  <div
                    onClick={() => setSelectedStaffId("any")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedStaffId === "any"
                        ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 shadow-xs"
                        : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                        selectedStaffId === "any" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        <Sparkles className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900">Qualsiasi operatore disponibile</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Massima flessibilità per orari e disponibilità
                        </p>
                      </div>
                    </div>
                    {selectedStaffId === "any" && <Check className="w-5 h-5 text-emerald-600" />}
                  </div>

                  {staffList.map((st) => {
                    const isSelected = String(selectedStaffId) === String(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedStaffId(String(st.id))}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 shadow-xs"
                            : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            isSelected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {st.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-zinc-900">{st.fullName}</h4>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                ★ {st.rating}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{st.role}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-emerald-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: DATA & ORARIO */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 mb-1 tracking-tight">Giorno & Orario</h3>
                  <p className="text-xs text-zinc-500 mb-3">Scegli tra gli slot liberi verificati in tempo reale.</p>
                  
                  {/* Giorni */}
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                    {availableDays.map((d) => {
                      const isSelected = selectedDate === d.dateStr;
                      return (
                        <button
                          key={d.dateStr}
                          onClick={() => setSelectedDate(d.dateStr)}
                          className={`flex flex-col items-center justify-center min-w-[74px] py-3.5 px-2 rounded-2xl border transition-all text-center ${
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-md font-bold scale-[1.02]"
                              : "bg-white text-zinc-700 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                          }`}
                        >
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{d.dayName}</span>
                          <span className="text-lg font-black my-0.5 tracking-tight">{d.dayNumber}</span>
                          <span className={`text-[10px] font-semibold ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{d.isToday ? "Oggi" : d.monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Orari */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                      Orari disponibili ({activeService.durationMinutes} min)
                    </label>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Disponibilità live
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {timeSlots.map((time) => {
                      const isSelected = selectedTimeSlot === time;
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTimeSlot(time)}
                          className={`py-2.5 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-zinc-900/10 scale-105"
                              : "bg-zinc-50 text-zinc-700 border-zinc-200/70 hover:border-zinc-300 hover:bg-white"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: RIEPILOGO */}
            {step === 4 && (
              <div className="space-y-6">
                <h3 className="font-bold text-lg text-zinc-900 tracking-tight">Riepilogo Prenotazione</h3>

                <div className="bg-zinc-50/70 border border-zinc-200/80 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="flex justify-between items-start border-b border-zinc-200/60 pb-4">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Salone</span>
                      <strong className="text-base text-zinc-900 block mt-0.5">{salon.name}</strong>
                      <p className="text-zinc-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        {salon.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 block">Totale Trattamento</span>
                      <strong className="text-2xl font-black text-zinc-900">{activeService.price.toFixed(2)} €</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-zinc-500 block mb-1">Servizio</span>
                      <strong className="text-zinc-900 font-bold flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-zinc-600" />
                        {activeService.name}
                      </strong>
                      <span className="text-zinc-500 text-[11px] block mt-0.5">{activeService.durationMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block mb-1">Operatore</span>
                      <strong className="text-zinc-900 font-bold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-600" />
                        {activeStaff.fullName}
                      </strong>
                    </div>
                    <div className="col-span-2 pt-3 border-t border-zinc-200/60">
                      <span className="text-zinc-500 block mb-1">Data & Orario Confermato</span>
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                        <CalendarIcon className="w-4 h-4 text-zinc-600" />
                        <span className="capitalize">{formattedDayStr}</span> alle ore {selectedTimeSlot}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Conferma istantanea: lo slot orario viene sincronizzato sul database del salone. Nessun pagamento anticipato.</span>
                </div>
              </div>
            )}

            {/* STEP 5: PRENOTAZIONE CONCLUSA */}
            {step === 5 && confirmedAppt && (
              <div className="text-center py-6 space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs animate-in zoom-in-75 duration-300">
                  <Check className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
                    Prenotazione Conclusa
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">Appuntamento Fissato! 🎉</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                    Ti aspettiamo il giorno <strong className="text-zinc-900 capitalize">{formattedDayStr}</strong> alle ore <strong className="text-zinc-900">{selectedTimeSlot}</strong> presso <strong>{salon.name}</strong>.
                  </p>
                </div>

                {/* Pulsanti Calendario */}
                <div className="bg-zinc-50 border border-zinc-200/80 p-5 rounded-2xl max-w-md mx-auto space-y-3 text-left">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4 text-zinc-700" />
                    Aggiungi al tuo calendario personale
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <a
                      href={buildGoogleCalendarUrl({
                        title: `${activeService.name} - ${salon.name}`,
                        description: `Trattamento: ${activeService.name}\nOperatore: ${activeStaff.fullName}\nIndirizzo: ${salon.address}\nTelefono: ${salon.phone}`,
                        location: salon.address,
                        startTime: start,
                        endTime: end
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-semibold text-zinc-800 transition-colors shadow-2xs"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M19.5 3h-15C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zm-8.25 13.5H9v-6h2.25v6zm3.75 0h-2.25v-9H15v9z"/>
                      </svg>
                      Google Calendar
                    </a>

                    <button
                      onClick={() =>
                        downloadIcsFile({
                          id: confirmedAppt.id,
                          title: `${activeService.name} - ${salon.name}`,
                          description: `Appuntamento con ${activeStaff.fullName} presso ${salon.name}`,
                          location: salon.address,
                          startTime: start,
                          endTime: end
                        })
                      }
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-semibold text-zinc-800 transition-colors shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-zinc-700" />
                      Apple / Outlook (.ics)
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => router.push("/cliente")}
                    className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                  >
                    Vai alla tua Area Cliente Trimmy
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Wizard Footer Controls */}
          {step < 5 && (
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={() => setStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-semibold transition-colors"
                >
                  Indietro
                </button>
              ) : <div />}

              {step < 4 ? (
                <button
                  onClick={() => setStep((prev) => (prev + 1) as any)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                >
                  Prosegui
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  {isSubmitting ? "Registrazione in corso..." : "Conferma Prenotazione"}
                </button>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-zinc-500 border-t border-zinc-200/60 bg-white mt-auto">
        © 2026 Trimmy • Piattaforma Ufficiale di Prenotazione Saloni
      </footer>
    </div>
  );
}

export default function PrenotaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PrenotaContent />
    </Suspense>
  );
}
