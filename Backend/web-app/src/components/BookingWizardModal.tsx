"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Scissors, 
  Check, 
  MapPin, 
  CalendarPlus, 
  Download, 
  ChevronRight, 
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  Navigation,
  QrCode,
  CheckCircle2,
  Phone
} from "lucide-react";
import { 
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
import { addSalonNotification } from "@/lib/salon-notifications";
import { parseDateSafe } from "@/lib/date-utils";
import { ensureCustomerForBooking } from "@/lib/customers-store";
import { 
  saveSalonAppointment, 
  getOccupiedSlotsForStaff, 
  isTimeRangeOverlapping, 
  SlotConflictError, 
  getLocalDateString 
} from "@/lib/appointments-service";
import { getSalonTenantId } from "@/lib/tenant-helper";
import { fetchSalonStaff } from "@/lib/staff-store";
import { 
  DaySchedule, 
  fetchSalonWorkingHours, 
  generateAvailableBookingDays, 
  filterTimeSlotsByWorkingHours, 
  getSalonScheduleForDate,
  BookingDayOption
} from "@/lib/working-hours-store";

interface BookingWizardModalProps {
  salon: SalonListing;
  isOpen: boolean;
  onClose: () => void;
  userUid?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  onBookingConfirmed?: () => void;
  preselectedServiceId?: string;
}

export default function BookingWizardModal({
  salon,
  isOpen,
  onClose,
  userUid = "cliente-demo",
  userEmail,
  userName = "Cliente Trimmy",
  userPhone = "320 000 0000",
  onBookingConfirmed,
  preselectedServiceId
}: BookingWizardModalProps) {
  // Step 1: Servizio | Step 2: Staff | Step 3: Data & Ora | Step 4: Conferma | Step 5: VIP Boarding Pass
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId || DEFAULT_BOOKING_SERVICES[0].id);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("10:30");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<ClientAppointmentItem | null>(null);
  const [availableDays, setAvailableDays] = useState<BookingDayOption[]>([]);
  const [salonWorkingHours, setSalonWorkingHours] = useState<DaySchedule[]>([]);
  const [occupiedSlots, setOccupiedSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Dati cliente per la prenotazione (modificabili/confermabili nello step 4)
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState(userPhone);
  const [customerEmail, setCustomerEmail] = useState(userEmail || (userUid && userUid.includes("@") ? userUid : ""));
  const [customerNotes, setCustomerNotes] = useState("");

  // Lista servizi dinamica: usa quelli del salone se presenti, altrimenti fallback
  const servicesList = useMemo(() => {
    if (salon.services && salon.services.length > 0) {
      return salon.services;
    }
    return DEFAULT_BOOKING_SERVICES;
  }, [salon.services]);

  // Raggruppamento per Categoria per elenco a scorrimento verticale con intestazioni sticky
  const servicesByCategory = useMemo(() => {
    const groups: Record<string, typeof servicesList> = {};
    servicesList.forEach((s) => {
      const cat = s.category || "Trattamenti Principali";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [servicesList]);

  // Lista staff reale recuperata da Firestore per il salone
  const [salonStaffList, setSalonStaffList] = useState<any[]>([]);

  useEffect(() => {
    if (!salon.id) return;
    const tid = getSalonTenantId(salon.id);
    fetchSalonStaff(salon.id).then((staff) => {
      if (staff && staff.length > 0) {
        setSalonStaffList(staff);
      }
    }).catch(() => {});

    // Carica orari ufficiali di apertura del salone
    fetchSalonWorkingHours(tid).then((hours) => {
      if (hours && hours.length > 0) {
        setSalonWorkingHours(hours);
      }
    }).catch(() => {});
  }, [salon.id]);

  const staffList = useMemo(() => {
    if (salonStaffList.length > 0) {
      return salonStaffList.map((st) => ({
        id: st.id,
        fullName: st.fullName,
        role: st.role || "Stylist",
        rating: st.rating || 4.9
      }));
    }
    return DEFAULT_BOOKING_STAFF;
  }, [salonStaffList]);

  useEffect(() => {
    const parts = (userName || "Cliente").trim().split(" ");
    setCustomerFirstName(parts[0] || "Cliente");
    setCustomerLastName(parts.slice(1).join(" ") || "Trimmy");
    if (userPhone) setCustomerPhone(userPhone);
    if (userEmail) setCustomerEmail(userEmail);
  }, [userName, userPhone, userEmail]);

  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId);
    } else if (servicesList.length > 0) {
      setSelectedServiceId(String(servicesList[0].id));
    }
  }, [preselectedServiceId, servicesList]);

  // Generazione dinamica dei giorni disponibili con rispetto dei giorni di chiusura del salone
  useEffect(() => {
    const days = generateAvailableBookingDays(
      new Date(),
      14,
      salonWorkingHours.length > 0 ? salonWorkingHours : undefined
    );
    setAvailableDays(days);

    // Seleziona automaticamente il primo giorno aperto
    const firstOpenDay = days.find((d) => d.isOpen) || days[0];
    if (firstOpenDay) {
      setSelectedDate(firstOpenDay.dateStr);
    }
  }, [salonWorkingHours]);

  // Servizio selezionato
  const activeService = useMemo(() => {
    return servicesList.find((s) => String(s.id) === String(selectedServiceId)) || servicesList[0];
  }, [servicesList, selectedServiceId]);

  // Operatore selezionato
  const activeStaff = useMemo(() => {
    if (selectedStaffId === "any") {
      return { id: staffList[0]?.id || "staff-default", fullName: "Qualsiasi operatore disponibile", role: "Staff " + salon.name };
    }
    return staffList.find((st) => String(st.id) === String(selectedStaffId)) || staffList[0];
  }, [selectedStaffId, staffList, salon.name]);

  // Orari del salone per la data selezionata (apertura, chiusura e pausa)
  const daySchedule = useMemo(() => {
    if (!selectedDate) return undefined;
    const tid = getSalonTenantId(salon.id);
    return getSalonScheduleForDate(
      tid,
      selectedDate,
      salonWorkingHours.length > 0 ? salonWorkingHours : undefined
    );
  }, [salon.id, selectedDate, salonWorkingHours]);

  // Griglia oraria unica e compatta filtrata dagli orari reali del salone (e pause)
  const timeSlots = useMemo(() => {
    const baseSlots = [
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
      "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
    ];
    if (!daySchedule) return baseSlots;
    return filterTimeSlotsByWorkingHours(baseSlots, daySchedule);
  }, [daySchedule]);

  // Se lo slot selezionato non è compreso negli slot validi del giorno, reimposta al primo valido
  useEffect(() => {
    if (timeSlots.length > 0 && !timeSlots.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(timeSlots[0]);
    }
  }, [timeSlots, selectedTimeSlot]);

  // Controllo slot occupati in tempo reale da Cloud Firestore
  useEffect(() => {
    if (!isOpen || currentStep !== 3 || !selectedDate) return;
    let isMounted = true;
    setIsLoadingSlots(true);
    const salonTenantId = getSalonTenantId(salon.id);
    getOccupiedSlotsForStaff(salonTenantId, activeStaff.id, selectedDate)
      .then((slots) => {
        if (isMounted) setOccupiedSlots(slots);
      })
      .catch((err) => console.warn("Errore caricamento slot occupati:", err))
      .finally(() => {
        if (isMounted) setIsLoadingSlots(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, currentStep, selectedDate, activeStaff.id, salon.id]);

  const isSlotOccupied = (time: string) => {
    if (!selectedDate) return false;
    const [h, m] = time.split(":").map(Number);
    const start = parseDateSafe(selectedDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + activeService.durationMinutes * 60 * 1000);

    return occupiedSlots.some((occ) =>
      isTimeRangeOverlapping(start, end, occ.startTime, occ.endTime)
    );
  };

  if (!isOpen) return null;

  // Calcolo data e ora inizio/fine con supporto cross-browser
  const getAppointmentDates = () => {
    const [hours, minutes] = selectedTimeSlot.split(":").map(Number);
    const start = selectedDate ? parseDateSafe(selectedDate) : new Date();
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + activeService.durationMinutes * 60 * 1000);
    return { start, end };
  };

  const { start, end } = getAppointmentDates();

  const formattedDayStr = parseDateSafe(selectedDate).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const handleFinalConfirm = async () => {
    setIsSubmitting(true);
    setConflictError(null);

    const salonTenantId = getSalonTenantId(salon.id);
    const salonRawId = salon.id;

    const effectiveFirstName = (customerFirstName || "Cliente").trim();
    const effectiveLastName = (customerLastName || "Trimmy").trim();
    const effectiveFullName = `${effectiveFirstName} ${effectiveLastName}`.trim();
    const effectivePhone = (customerPhone || "320 000 0000").trim();
    const effectiveEmail = (customerEmail || "").trim() || (userUid && userUid.includes("@") ? userUid : undefined);

    const newAppt: ClientAppointmentItem = {
      id: "appt-" + Date.now(),
      tenantId: salonTenantId,
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
      createdAt: new Date().toISOString(),
      customerName: effectiveFullName,
      customerPhone: effectivePhone,
      customerEmail: effectiveEmail || undefined,
      notes: customerNotes || undefined
    };

    try {
      // 1. Assicura cliente registrato nel CRM
      const customerRecord = await ensureCustomerForBooking(
        salonTenantId,
        {
          firstName: effectiveFirstName,
          lastName: effectiveLastName,
          phone: effectivePhone,
          email: effectiveEmail || null
        },
        salonRawId
      );

      // 2. Salva nell'agenda del salone con transazione atomica anti double-booking
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
          email: customerRecord.email
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
          fullName: activeStaff.fullName
        },
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
        price: activeService.price,
        notes: customerNotes || undefined
      });

      // 3. Salva nell'area personale del cliente
      saveClientAppointment(userUid, newAppt);

      // 4. Invia notifica in-app e push al salone
      const notifData = {
        id: `notif-client-${newAppt.id}`,
        title: `Nuova prenotazione: ${newAppt.serviceName}`,
        description: `Ricevuta prenotazione da ${effectiveFullName} per ${newAppt.serviceName} con ${newAppt.staffName} il ${formattedDayStr} alle ${selectedTimeSlot} (€${newAppt.price})`,
        time: "Adesso",
        type: "appointment" as const,
        link: "/"
      };
      addSalonNotification(salon.id, notifData);
      if (salonTenantId !== salon.id) {
        addSalonNotification(salonTenantId, notifData);
      }

      setConfirmedAppointment(newAppt);
      setCurrentStep(5);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }

      if (onBookingConfirmed) {
        onBookingConfirmed();
      }
    } catch (err: any) {
      console.error("Errore salvataggio prenotazione:", err);
      if (err instanceof SlotConflictError || err?.code === "SLOT_CONFLICT" || err?.message?.includes("occupato")) {
        setConflictError(err.message || "L'orario selezionato è stato appena occupato da un altro cliente. Per favore scegli un altro orario o un altro operatore.");
        setCurrentStep(3);
      } else {
        alert("Si è verificato un errore durante la prenotazione. Riprova.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/90 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] text-zinc-900">
        
        {/* Animated Stepper Progress Bar at Top */}
        <div className="w-full bg-zinc-100 h-1.5 relative overflow-hidden">
          <div 
            className="bg-zinc-900 h-full transition-all duration-300 ease-out"
            style={{ width: `${currentStep === 1 ? 25 : currentStep === 2 ? 50 : currentStep === 3 ? 75 : 100}%` }}
          />
        </div>

        {/* Header Modal con Stepper e Dettagli */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep > 1 && currentStep < 5 && (
              <button 
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-xl transition-colors"
                title="Torna indietro"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              {/* Stepper Crumb */}
              {currentStep < 5 ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                  <span className={`flex items-center gap-1 ${currentStep >= 1 ? "text-zinc-900 font-bold" : ""}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentStep >= 1 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"}`}>1</span>
                    Servizio
                  </span>
                  <ChevronRight className="w-3 h-3 text-zinc-300" />
                  <span className={`flex items-center gap-1 ${currentStep >= 2 ? "text-zinc-900 font-bold" : ""}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentStep >= 2 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"}`}>2</span>
                    Stylist
                  </span>
                  <ChevronRight className="w-3 h-3 text-zinc-300" />
                  <span className={`flex items-center gap-1 ${currentStep >= 3 ? "text-zinc-900 font-bold" : ""}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentStep >= 3 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"}`}>3</span>
                    Data/Ora
                  </span>
                  <ChevronRight className="w-3 h-3 text-zinc-300" />
                  <span className={`flex items-center gap-1 ${currentStep >= 4 ? "text-zinc-900 font-bold" : ""}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentStep >= 4 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"}`}>4</span>
                    Conferma
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Biglietto Confermato
                </span>
              )}

              <h2 className="text-base font-bold text-zinc-900 mt-1 tracking-tight flex items-center gap-2">
                {currentStep === 1 && "Seleziona il trattamento"}
                {currentStep === 2 && "Scegli il tuo stylist"}
                {currentStep === 3 && "Scegli data e orario"}
                {currentStep === 4 && "Riepilogo e conferma dati"}
                {currentStep === 5 && "VIP Boarding Pass"}
                <span className="text-xs font-normal text-zinc-400">| {salon.name}</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-white">

          {/* STEP 1: SCELTA SERVIZIO (Elenco continuo a scorrimento con intestazioni sticky) */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  Listino ufficiale verificato di <strong>{salon.name}</strong>:
                </p>
                <span className="text-[11px] text-zinc-600 font-mono font-medium bg-zinc-100 px-2 py-0.5 rounded-md">
                  {servicesList.length} trattamenti disponibili
                </span>
              </div>

              <div className="space-y-6">
                {Object.entries(servicesByCategory).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    {/* Intestazione Sticky */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-2 px-1 border-b border-zinc-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                          {category}
                        </h4>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono font-medium">
                        {items.length} {items.length === 1 ? "voce" : "voci"}
                      </span>
                    </div>

                    {/* Elenco card servizi */}
                    <div className="space-y-2.5 pt-1">
                      {items.map((srv) => {
                        const isSelected = String(selectedServiceId) === String(srv.id);
                        return (
                          <div
                            key={srv.id}
                            onClick={() => setSelectedServiceId(String(srv.id))}
                            className={`group p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                              isSelected 
                                ? "border-zinc-900 bg-zinc-50/90 text-zinc-900 ring-2 ring-zinc-900/10 shadow-xs" 
                                : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                            }`}
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm sm:text-base text-zinc-900 leading-tight">
                                  {srv.name}
                                </h4>
                                {srv.price >= 40 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                    ★ Top
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs line-clamp-2 leading-relaxed ${isSelected ? "text-zinc-600" : "text-zinc-500"}`}>
                                {srv.description}
                              </p>
                              <div className="flex items-center gap-3 pt-0.5 text-xs">
                                <span className={`flex items-center gap-1 font-medium ${isSelected ? "text-zinc-900" : "text-zinc-500"}`}>
                                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                  {srv.durationMinutes} min
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-lg font-black block tracking-tight text-zinc-900">
                                {srv.price.toFixed(2)} €
                              </span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
                                  <Check className="w-3.5 h-3.5" /> Selezionato
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-400 font-medium mt-1 block opacity-0 group-hover:opacity-100 transition-opacity">
                                  Scegli
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: SCELTA OPERATORE / STYLIST */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Seleziona il professionista dedicato al tuo appuntamento:
              </p>
              <div className="space-y-3">
                {/* Opzione Qualsiasi Operatore */}
                <div
                  onClick={() => setSelectedStaffId("any")}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedStaffId === "any"
                      ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-2 ring-zinc-900/10 shadow-xs"
                      : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      selectedStaffId === "any" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}>
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900">Qualsiasi operatore disponibile</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Consigliato per avere la massima disponibilità di orari e date
                      </p>
                    </div>
                  </div>
                  {selectedStaffId === "any" && <Check className="w-5 h-5 text-emerald-600" />}
                </div>

                {/* Lista Operatori Specifici */}
                {staffList.map((st) => {
                  const isSelected = String(selectedStaffId) === String(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStaffId(String(st.id))}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-2 ring-zinc-900/10 shadow-xs"
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
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {st.role}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-emerald-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SCELTA DATA & ORARIO (Griglia oraria unica e compatta) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {conflictError && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{conflictError}</span>
                </div>
              )}

              {/* Selezione Giorno (Capsule Orizzontali) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    1. Seleziona il giorno
                  </label>
                  <span className="text-[11px] text-zinc-500">Prossimi 14 giorni</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                  {availableDays.map((d) => {
                    const isSelected = selectedDate === d.dateStr;
                    const isClosed = !d.isOpen;
                    return (
                      <button
                        key={d.dateStr}
                        disabled={isClosed}
                        onClick={() => {
                          if (isClosed) return;
                          setSelectedDate(d.dateStr);
                          setConflictError(null);
                        }}
                        title={isClosed ? `Salone chiuso (${d.dayName})` : `Seleziona ${d.dayName} ${d.dayNumber}`}
                        className={`flex flex-col items-center justify-center min-w-[74px] py-3.5 px-2 rounded-2xl border transition-all text-center ${
                          isClosed
                            ? "opacity-40 line-through bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                            : isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-md font-bold scale-[1.02] cursor-pointer"
                            : "bg-white text-zinc-700 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer"
                        }`}
                      >
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          isClosed ? "text-zinc-400" : isSelected ? "text-zinc-300" : "text-zinc-500"
                        }`}>
                          {d.dayName}
                        </span>
                        <span className="text-lg font-black my-0.5 tracking-tight">{d.dayNumber}</span>
                        <span className={`text-[10px] font-semibold ${
                          isClosed ? "text-zinc-400 font-normal" : isSelected ? "text-zinc-300" : "text-zinc-500"
                        }`}>
                          {isClosed ? "Chiuso" : d.isToday ? "Oggi" : d.monthName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Se il giorno selezionato è chiuso dal salone */}
              {daySchedule && !daySchedule.isOpen ? (
                <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center mx-auto text-base">
                    🔒
                  </div>
                  <h4 className="text-sm font-bold text-zinc-800">Salone Chiuso di {daySchedule.dayName}</h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Il salone non accetta appuntamenti in questo giorno della settimana. Seleziona un&apos;altra data dal calendario in alto.
                  </p>
                </div>
              ) : (
                /* Selezione Fascia Oraria (Griglia Unica e Compatta) */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                        2. Scegli l&apos;orario ({activeService.durationMinutes} min)
                      </label>
                      {daySchedule?.openTime && daySchedule?.closeTime && (
                        <span className="text-[10px] text-zinc-400">
                          Orario salone: {daySchedule.openTime} - {daySchedule.closeTime}
                          {daySchedule.hasBreak && daySchedule.breakStart && daySchedule.breakEnd ? ` (pausa ${daySchedule.breakStart}-${daySchedule.breakEnd})` : ""}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {isLoadingSlots ? "Verifica slot..." : "Slot live anti-conflitto"}
                    </span>
                  </div>
                  
                  {/* Griglia oraria unica e compatta con tutti gli slot affiancati */}
                  {timeSlots.length === 0 ? (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-xs text-zinc-500">
                      Nessuno slot disponibile per questo giorno negli orari di apertura del salone.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2">
                      {timeSlots.map((time) => {
                        const isSelected = selectedTimeSlot === time;
                        const isOccupied = isSlotOccupied(time);

                        return (
                          <button
                            key={time}
                            disabled={isOccupied}
                            onClick={() => {
                              setSelectedTimeSlot(time);
                              setConflictError(null);
                            }}
                            className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center min-h-[44px] ${
                              isOccupied
                                ? "bg-zinc-100/70 text-zinc-400 border-zinc-200/60 opacity-45 cursor-not-allowed line-through"
                                : isSelected
                                ? "bg-zinc-900 text-white border-zinc-900 shadow-sm ring-2 ring-zinc-900/10 scale-105"
                                : "bg-zinc-50 text-zinc-700 border-zinc-200/70 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 cursor-pointer"
                            }`}
                            title={isOccupied ? "Orario già occupato o pausa" : `Prenota alle ${time}`}
                          >
                            <span>{time}</span>
                            {isOccupied && (
                              <span className="text-[8px] font-semibold no-underline text-rose-500/80 -mt-0.5">
                                Occupato
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Suggerimento Operatore Alternativo se tutti gli slot dello stylist selezionato sono occupati */}
                  {timeSlots.length > 0 && timeSlots.every((s) => isSlotOccupied(s)) && selectedStaffId !== "any" && (
                    <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <p className="font-semibold text-amber-950">
                            Tutti gli orari sono occupati per {activeStaff.fullName} in questa data.
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Puoi verificare se altri operatori del salone hanno slot disponibili subito.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStaffId("any")}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 transition self-end sm:self-auto shadow-xs"
                      >
                        Cerca con tutti gli stylist
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: RIEPILOGO & CONFERMA */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="bg-zinc-50/70 border border-zinc-200/80 p-5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between border-b border-zinc-200/60 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Salone Selezionato</span>
                    <h3 className="text-lg font-bold text-zinc-900 mt-1 tracking-tight">{salon.name}</h3>
                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {salon.address}, {salon.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Totale Trattamento</span>
                    <span className="text-2xl font-black text-zinc-900">{activeService.price.toFixed(2)} €</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-1">Trattamento</span>
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-zinc-600" />
                      {activeService.name}
                    </span>
                    <span className="text-zinc-500 text-[11px] mt-0.5 block">{activeService.durationMinutes} minuti stimati</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-1">Operatore</span>
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-600" />
                      {activeStaff.fullName}
                    </span>
                  </div>

                  <div className="col-span-2 pt-3 border-t border-zinc-200/60">
                    <span className="text-zinc-500 block mb-1">Data & Orario Confermato</span>
                    <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
                      <CalendarIcon className="w-4 h-4 text-zinc-600" />
                      <span className="capitalize">{formattedDayStr}</span> alle ore {selectedTimeSlot}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dati Cliente per Anagrafica Salone */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                    I tuoi Dati di Contatto
                  </span>
                  <span className="text-[11px] text-zinc-400">Sincronizzati con il gestionale del salone</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Nome *</label>
                    <input
                      type="text"
                      value={customerFirstName}
                      onChange={(e) => setCustomerFirstName(e.target.value)}
                      placeholder="Il tuo nome"
                      required
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Cognome *</label>
                    <input
                      type="text"
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                      placeholder="Il tuo cognome"
                      required
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Cellulare *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Es. 333 1234567"
                      required
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Email (per conferma)</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="tua@email.it"
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Note o preferenze per il salone (facoltativo)</label>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Es. Richiesta colore biondo caldo, sfumatura alta..."
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Conferma Immediata Cloud:</strong> L&apos;appuntamento viene inserito istantaneamente nell&apos;agenda del salone. Nessun anticipo richiesto.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: VIP BOARDING PASS CON QR CODE & AZIONI */}
          {currentStep === 5 && confirmedAppointment && (
            <div className="py-2 space-y-6 animate-in zoom-in-95 duration-300">
              
              {/* Badge di successo */}
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
                  Prenotazione Confermata!
                </h3>
                <p className="text-xs text-zinc-500">
                  Mostra il tuo VIP Boarding Pass al desk di accoglienza al tuo arrivo in salone.
                </p>
              </div>

              {/* VIP BOARDING PASS TICKET */}
              <div className="relative max-w-md mx-auto bg-white border border-zinc-200/90 rounded-3xl shadow-xl overflow-hidden">
                {/* Header Ticket */}
                <div className="bg-zinc-950 text-white p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white border border-white/10 text-sm">
                      ✂️
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">TRIMMY VIP PASS</p>
                      <h4 className="font-bold text-sm text-white tracking-tight leading-tight">{salon.name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      CONFIRMED
                    </span>
                    <p className="text-[10px] font-mono text-zinc-400 mt-1">
                      #{confirmedAppointment.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Ticket Details Body */}
                <div className="p-5 space-y-4 bg-zinc-50/50">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Trattamento</span>
                      <p className="font-bold text-zinc-900 text-sm mt-0.5">{activeService.name}</p>
                      <span className="text-[11px] text-zinc-500">{activeService.durationMinutes} min • {activeService.price.toFixed(2)} €</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Stylist Assegnato</span>
                      <p className="font-bold text-zinc-900 text-sm mt-0.5">{activeStaff.fullName}</p>
                      <span className="text-[11px] text-zinc-500">{activeStaff.role}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200/60 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Data Appuntamento</span>
                      <p className="font-bold text-zinc-900 text-sm mt-0.5 capitalize">{formattedDayStr}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Orario di Inizio</span>
                      <p className="font-black text-zinc-900 text-base mt-0.5">{selectedTimeSlot}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-200/60">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Indirizzo Salone</span>
                    <p className="text-xs font-medium text-zinc-700 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      {salon.address}, {salon.city}
                    </p>
                  </div>
                </div>

                {/* FUSTELLATURA & LINEA DI STRAPPO / PERFORAZIONE */}
                <div className="relative py-2 bg-zinc-50/50">
                  <div className="border-t-2 border-dashed border-zinc-300 mx-5" />
                  {/* Tacche fustellate laterali */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-200 border border-zinc-300/80" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-200 border border-zinc-300/80" />
                </div>

                {/* Sezione Inferiore: Check-in QR Code */}
                <div className="p-5 pt-3 bg-white text-center space-y-3">
                  <div className="inline-block p-2 bg-white rounded-2xl border-2 border-zinc-100 shadow-sm">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`TRIMMY-PASS:${confirmedAppointment.id}:${salon.id}`)}&color=09090b`}
                      alt="QR Check-in Pass"
                      className="w-28 h-28 mx-auto rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500">
                    CODICE CHECK-IN DESK: <strong className="text-zinc-900">{confirmedAppointment.id.slice(-8).toUpperCase()}</strong>
                  </p>
                </div>
              </div>

              {/* Bottoni di Azione Rapida: Mappe, Calendari e Chiusura */}
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.name + " " + salon.address + " " + salon.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-semibold transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5 text-zinc-600" />
                    Indicazioni Mappe
                  </a>

                  {/* WhatsApp al Salone */}
                  {salon.phone && (
                    <a
                      href={`https://wa.me/${salon.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Ciao ${salon.name}, ho appena prenotato per ${activeService.name} il ${formattedDayStr} alle ${selectedTimeSlot}. A presto!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl font-semibold transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Chat WhatsApp
                    </a>
                  )}
                </div>

                {/* Sincronizzazione Calendario */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <a
                    href={buildGoogleCalendarUrl({
                      title: `${activeService.name} - ${salon.name}`,
                      description: `Appuntamento per ${activeService.name} con ${activeStaff.fullName}.\nIndirizzo: ${salon.address}\nTelefono: ${salon.phone}`,
                      location: salon.address,
                      startTime: start,
                      endTime: end
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl font-semibold text-zinc-800 transition-colors shadow-2xs"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                    Google Calendar
                  </a>

                  <button
                    onClick={() =>
                      downloadIcsFile({
                        id: confirmedAppointment.id,
                        title: `${activeService.name} - ${salon.name}`,
                        description: `Appuntamento per ${activeService.name} con ${activeStaff.fullName}.\nIndirizzo: ${salon.address}`,
                        location: salon.address,
                        startTime: start,
                        endTime: end
                      })
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl font-semibold text-zinc-800 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-700" />
                    Apple / .ics
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="w-full mt-2 py-3 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-sm"
                >
                  Chiudi e Torna al Salone
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions (Step 1 -> 4) */}
        {currentStep < 5 && (
          <div className="px-5 sm:px-6 py-4 bg-zinc-50/70 border-t border-zinc-100 flex items-center justify-between">
            <div className="text-xs text-zinc-500 min-w-0 flex-1 pr-2 truncate">
              {currentStep === 1 && (
                <span>Trattamento: <strong className="text-zinc-900">{activeService.name} ({activeService.price.toFixed(2)} €)</strong></span>
              )}
              {currentStep === 2 && (
                <span>Operatore: <strong className="text-zinc-900">{activeStaff.fullName}</strong></span>
              )}
              {currentStep === 3 && (
                <span>Data scelta: <strong className="text-zinc-900 capitalize">{formattedDayStr} alle {selectedTimeSlot}</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentStep < 4 ? (
                <button
                  onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                >
                  Avanti
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinalConfirm}
                  disabled={isSubmitting || !customerFirstName.trim() || !customerLastName.trim() || !customerPhone.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  {isSubmitting ? "Registrazione..." : "Conferma Prenotazione"}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
