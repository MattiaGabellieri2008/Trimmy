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
  AlertCircle
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
  // Step 1: Servizio | Step 2: Staff | Step 3: Data & Ora | Step 4: Conferma | Step 5: Successo
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId || DEFAULT_BOOKING_SERVICES[0].id);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("10:30");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<ClientAppointmentItem | null>(null);
  const [availableDays, setAvailableDays] = useState<{ dateStr: string; dayName: string; dayNumber: number; monthName: string; isToday: boolean }[]>([]);
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

  // Lista staff reale recuperata da Firestore per il salone
  const [salonStaffList, setSalonStaffList] = useState<any[]>([]);

  useEffect(() => {
    if (!salon.id) return;
    fetchSalonStaff(salon.id).then((staff) => {
      if (staff && staff.length > 0) {
        setSalonStaffList(staff);
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

  useEffect(() => {
    const now = new Date();
    setSelectedDate(getLocalDateString(now));

    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      // Salta le domeniche
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
  }, []);

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

  // Slot orari disponibili (dalle 09:00 alle 19:30)
  const timeSlots = useMemo(() => {
    return [
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
      "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
    ];
  }, []);

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
  const formattedDayStr = start.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const handleFinalConfirm = async () => {
    setIsSubmitting(true);
    const { start, end } = getAppointmentDates();
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
      serviceId: activeService.id,
      serviceName: activeService.name,
      staffId: activeStaff.id,
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
      // 1. Assicura che il cliente sia registrato nell'anagrafica del salone (sia su Firestore che su LocalStorage e Postgres)
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

      // 2. Registra l'appuntamento direttamente nell'Agenda del salone (Firestore + LocalStorage + DataConnect)
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
        serviceId: activeService.id,
        service: {
          id: activeService.id,
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

      // 3. Salva l'appuntamento anche nell'area personale del cliente
      saveClientAppointment(userUid, newAppt);

      // 4. Invia la notifica push/badge al salone
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/80 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] text-zinc-900">
        
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            {currentStep > 1 && currentStep < 5 && (
              <button 
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-xl transition-colors"
                title="Torna allo step precedente"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200/70 rounded-full tracking-wide">
                  Step {Math.min(currentStep, 4)} di 4
                </span>
                <span className="text-xs text-zinc-500 font-medium">| {salon.name}</span>
              </div>
              <h2 className="text-base font-bold text-zinc-900 mt-1 tracking-tight">
                {currentStep === 1 && "Seleziona il trattamento"}
                {currentStep === 2 && "Scegli il tuo stylist di fiducia"}
                {currentStep === 3 && "Scegli data e orario"}
                {currentStep === 4 && "Riepilogo e Conferma"}
                {currentStep === 5 && "Prenotazione Conclusa! 🎉"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin bg-white">

          {/* STEP 1: SCELTA SERVIZIO */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  Listino ufficiale verificato per <strong>{salon.name}</strong>:
                </p>
                <span className="text-[11px] text-zinc-600 font-mono font-medium">
                  {servicesList.length} servizi attivi
                </span>
              </div>

              <div className="space-y-2.5">
                {servicesList.map((srv) => {
                  const isSelected = String(selectedServiceId) === String(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => setSelectedServiceId(String(srv.id))}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                        isSelected 
                          ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-1 ring-zinc-900 shadow-xs" 
                          : "border-zinc-200/80 bg-white hover:bg-zinc-50/70 hover:border-zinc-300 text-zinc-700"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide uppercase ${
                            isSelected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {srv.category}
                          </span>
                          <h4 className="font-bold text-sm sm:text-base text-zinc-900">{srv.name}</h4>
                        </div>
                        <p className={`text-xs line-clamp-2 leading-relaxed ${isSelected ? "text-zinc-600" : "text-zinc-500"}`}>
                          {srv.description}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-xs">
                          <span className={`flex items-center gap-1 font-medium ${isSelected ? "text-zinc-900" : "text-zinc-500"}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {srv.durationMinutes} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black block tracking-tight text-zinc-900">
                          {srv.price.toFixed(2)} €
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

          {/* STEP 2: SCELTA OPERATORE / STYLIST */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Seleziona lo stylist per il tuo appuntamento:
              </p>
              <div className="space-y-3">
                {/* Opzione Qualsiasi Operatore */}
                <div
                  onClick={() => setSelectedStaffId("any")}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedStaffId === "any"
                      ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-1 ring-zinc-900 shadow-xs"
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
                        Consigliato per avere la massima disponibilità di orari
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
                          ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-1 ring-zinc-900 shadow-xs"
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

          {/* STEP 3: SCELTA DATA & ORARIO */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Alert di Conflitto Concorrenza (se un altro utente ha appena prenotato) */}
              {conflictError && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{conflictError}</span>
                </div>
              )}

              {/* Selezione Giorno */}
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
                    return (
                      <button
                        key={d.dateStr}
                        onClick={() => {
                          setSelectedDate(d.dateStr);
                          setConflictError(null);
                        }}
                        className={`flex flex-col items-center justify-center min-w-[74px] py-3.5 px-2 rounded-2xl border transition-all text-center ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-md font-bold scale-[1.02]"
                            : "bg-white text-zinc-700 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                          {d.dayName}
                        </span>
                        <span className="text-lg font-black my-0.5 tracking-tight">{d.dayNumber}</span>
                        <span className={`text-[10px] font-semibold ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                          {d.isToday ? "Oggi" : d.monthName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selezione Fascia Oraria */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    2. Scegli l&apos;orario ({activeService.durationMinutes} min)
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    {isLoadingSlots ? "Verifica slot..." : "Slot live anti-conflitto"}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center min-h-[46px] ${
                          isOccupied
                            ? "bg-zinc-100/70 text-zinc-400 border-zinc-200/60 opacity-45 cursor-not-allowed line-through"
                            : isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-zinc-900/10 scale-105"
                            : "bg-zinc-50 text-zinc-700 border-zinc-200/70 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                        }`}
                        title={isOccupied ? "Orario già occupato" : `Prenota alle ${time}`}
                      >
                        <span>{time}</span>
                        {isOccupied && (
                          <span className="text-[9px] font-semibold no-underline text-rose-500/80 -mt-0.5">
                            Occupato
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
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
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {salon.address}
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
                  <span className="text-[11px] text-zinc-400">Inseriti nel gestionale del salone</span>
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
                      placeholder="Es. Richiesta colore biondo caldo, capelli sottili..."
                      className="w-full bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Conferma Immediata Cloud:</strong> L&apos;appuntamento viene sincronizzato in tempo reale con il gestionale del salone. Nessun pagamento anticipato richiesto.
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-xs text-indigo-900 flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Notifica Push Firebase:</strong> Riceverai la conferma immediata e il promemoria automatico gestiti da Firebase Cloud Messaging.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESSO E AGGIUNTA AL CALENDARIO */}
          {currentStep === 5 && confirmedAppointment && (
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs animate-in zoom-in-75 duration-300">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
                  Prenotazione Conclusa
                </span>
                <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
                  Appuntamento Confermato!
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                  Ti aspettiamo presso <strong>{salon.name}</strong> il giorno{" "}
                  <strong className="text-zinc-900 capitalize">{formattedDayStr}</strong> alle ore <strong className="text-zinc-900">{selectedTimeSlot}</strong>.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-full text-xs font-medium">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Avviso di conferma inviato al {customerPhone || "tuo numero"}
                </div>
              </div>

              {/* Bottoni Calendario */}
              <div className="bg-zinc-50 border border-zinc-200/80 p-5 rounded-2xl max-w-md mx-auto space-y-3 text-left">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-zinc-700" />
                  Salva nel tuo calendario personale
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Aggiungi l&apos;appuntamento per ricevere il promemoria automatico:
                </p>
                
                <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Google Calendar */}
                  <a
                    href={buildGoogleCalendarUrl({
                      title: `${activeService.name} - ${salon.name}`,
                      description: `Appuntamento per ${activeService.name} (${activeService.durationMinutes} min) con ${activeStaff.fullName}.\nIndirizzo: ${salon.address}\nTelefono: ${salon.phone}`,
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

                  {/* Apple / Outlook .ics */}
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
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-semibold text-zinc-800 transition-colors shadow-2xs"
                  >
                    <Download className="w-4 h-4 text-zinc-700" />
                    Apple / Outlook (.ics)
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm"
                >
                  Visualizza i Miei Appuntamenti
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions (Step 1 -> 4) */}
        {currentStep < 5 && (
          <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
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

            <div className="flex items-center gap-2">
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
