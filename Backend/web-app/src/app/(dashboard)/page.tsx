"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getDailyAppointments, 
  GetDailyAppointmentsData,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  listCustomers,
  ListCustomersData,
  listStaff,
  ListStaffData
} from "../../dataconnect-generated";
import { dataConnect, auth, db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getSalonTenantId, ensureSalonTenant, ensureSalonStaff, ensureSalonService } from "@/lib/tenant-helper";
import { getSalonServices, fetchSalonServices, SalonServiceItem } from "@/lib/services-store";
import { fetchSalonCustomers, saveSalonCustomer, CustomerItem } from "@/lib/customers-store";
import { 
  fetchSalonAppointments, 
  saveSalonAppointment, 
  updateSalonAppointmentStatus, 
  deleteSalonAppointment 
} from "@/lib/appointments-service";
import { getUserProfile, fetchUserProfile } from "@/lib/user-profile";
import { addSalonNotification } from "@/lib/salon-notifications";
import { parseDateSafe } from "@/lib/date-utils";
import { buildWhatsAppClickToChatUrl } from "@/lib/notifications-service";
import { 
  Plus, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon, 
  Briefcase, 
  Loader2, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Users, 
  Scissors, 
  Check, 
  CalendarDays,
  CalendarRange,
  AlertCircle,
  MessageSquare,
  Phone
} from "lucide-react";

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", 
  "13:00", "14:00", "15:00", "16:00", "17:00", 
  "18:00", "19:00", "20:00"
];

type CalendarViewMode = "giornaliera" | "settimanale" | "mensile" | "staff";

export default function AgendaPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [salonTenantId, setSalonTenantId] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Data selezionata
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [todayDate, setTodayDate] = useState<Date | null>(null);
  
  // Modalità di visualizzazione
  const [viewMode, setViewMode] = useState<CalendarViewMode>("giornaliera");

  // Dati Reali
  const [appuntamenti, setAppuntamenti] = useState<GetDailyAppointmentsData["appointments"]>([]);
  const [customers, setCustomers] = useState<ListCustomersData["customers"]>([]);
  const [services, setServices] = useState<{ id: string; name: string; durationMinutes: number; price: number }[]>([]);
  const [activeStaff, setActiveStaff] = useState<{ id: string; fullName: string; role: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drawer & Modali
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<GetDailyAppointmentsData["appointments"][0] | null>(null);

  // Form Nuovo Appuntamento
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");
  const [newCustomerLastName, setNewCustomerLastName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerBirthday, setNewCustomerBirthday] = useState("");
  const [newCustomerNotes, setNewCustomerNotes] = useState("");

  const [formServiceId, setFormServiceId] = useState("");
  const [formStaffId, setFormStaffId] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formDate, setFormDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Inizializza data corrente lato client
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today);
    setTodayDate(today);
    setFormDate(today.toISOString().split("T")[0]);
  }, []);

  // 1. Controllo Autenticazione & Determinazione Tenant Reale
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUser(user);
        const tid = getSalonTenantId(user.uid);
        setSalonTenantId(tid);
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Caricamento Risorse Reali del Salone
  useEffect(() => {
    if (checkingAuth || !currentUser || !salonTenantId) return;

    async function loadSalonResources() {
      try {
        const profile = await fetchUserProfile(currentUser!.uid) || getUserProfile(currentUser!.uid);
        const salonName = profile?.salonName || currentUser!.displayName || "Il Mio Salone";

        // Assicura l'esistenza del salone in PostgreSQL con il piano reale
        await ensureSalonTenant(currentUser!.uid, salonName, profile?.planType || "PRO");

        // Assicura l'esistenza del titolare come staff in PostgreSQL
        const ownerStaffObj = {
          id: currentUser!.uid,
          fullName: currentUser!.displayName || salonName || "Titolare Salone",
          role: "Titolare"
        };
        await ensureSalonStaff(currentUser!.uid, salonTenantId, ownerStaffObj.fullName, currentUser!.phoneNumber || undefined, "Titolare");

        // Carica clienti reali del salone (Isolamento Multi-tenant rigoroso per tenantId e auth UID)
        const salonCusts = await fetchSalonCustomers(salonTenantId, currentUser!.uid);
        setCustomers(
          salonCusts.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            email: c.email || undefined,
            birthday: c.birthday || undefined,
            technicalNotes: c.technicalNotes || undefined
          }))
        );

        // Carica staff reale del salone da Cloud SQL
        const uRes = await listStaff(dataConnect, { tenantId: salonTenantId });
        if (uRes.data.users && uRes.data.users.length > 0) {
          setActiveStaff(uRes.data.users);
        } else {
          setActiveStaff([ownerStaffObj]);
        }

        // Carica trattamenti reali del salone (da Firestore / cache) e sincronizza su SQL
        const rawServices = await fetchSalonServices(currentUser!.uid);
        if (rawServices && rawServices.length > 0) {
          const mapped = await Promise.all(
            rawServices.map(async (s) => {
              const uuid = await ensureSalonService(String(s.id), salonTenantId, s.name, s.durationMinutes, s.price);
              return {
                id: uuid,
                name: s.name,
                durationMinutes: s.durationMinutes,
                price: s.price
              };
            })
          );
          setServices(mapped);
        } else {
          setServices([]);
        }
      } catch (err) {
        console.error("Errore caricamento risorse salone:", err);
      }
    }

    loadSalonResources();
  }, [checkingAuth, currentUser, salonTenantId]);

  // Intervallo di date in base alla vista selezionata
  const dateRange = useMemo(() => {
    if (!selectedDate) {
      const fallback = new Date(2026, 0, 1);
      return { start: fallback, end: fallback };
    }

    if (viewMode === "giornaliera" || viewMode === "staff") {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (viewMode === "settimanale") {
      // Lunedì della settimana
      const curr = new Date(selectedDate);
      const day = curr.getDay(); // 0 è Domenica, 1 Lunedì, ...
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(curr.setDate(diff));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    // Mensile
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [selectedDate, viewMode]);

  // Caricamento Appuntamenti (Combina Firestore, DataConnect e cache locale)
  const fetchAppuntamenti = async () => {
    if (!selectedDate) return;
    const tid = salonTenantId || getSalonTenantId(auth.currentUser?.uid);
    if (!tid) return;
    setIsLoading(true);
    try {
      const items = await fetchSalonAppointments(tid, auth.currentUser?.uid, dateRange);
      setAppuntamenti(items);
    } catch (error) {
      console.log("Database appuntamenti:", error);
      setAppuntamenti([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth && selectedDate && salonTenantId) {
      fetchAppuntamenti();
    }
  }, [selectedDate, viewMode, checkingAuth, salonTenantId]);

  // Ascolta aggiornamenti in tempo reale sia locali che cross-device (PC Salone <-> Smartphone Cliente)
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAppuntamenti();
      if (currentUser && salonTenantId) {
        fetchSalonCustomers(salonTenantId, currentUser.uid).then((salonCusts) => {
          setCustomers(
            salonCusts.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
              phone: c.phone,
              email: c.email || undefined,
              birthday: c.birthday || undefined,
              technicalNotes: c.technicalNotes || undefined
            }))
          );
        });
      }
    };

    // 1. Ascolto eventi locali della finestra corrente
    if (typeof window !== "undefined") {
      window.addEventListener("trimmy-data-updated", handleDataUpdated);
    }

    // 2. Ascolto in tempo reale Cloud Firestore per modifiche da altri dispositivi (es. prenotazioni clienti online)
    let unsubApptsTid = () => {};
    let unsubApptsRaw = () => {};
    let unsubCusts = () => {};

    if (currentUser) {
      const tid = salonTenantId || getSalonTenantId(currentUser.uid);
      const rawUid = currentUser.uid;

      try {
        unsubApptsTid = onSnapshot(collection(db, "saloni", tid, "appuntamenti"), (snap) => {
          if (!snap.metadata.hasPendingWrites) {
            handleDataUpdated();
          }
        }, (err) => console.warn("Nota real-time snapshot appuntamenti tid:", err));
      } catch (e) {
        console.warn("Errore setup snapshot appuntamenti tid:", e);
      }

      if (rawUid && rawUid !== tid) {
        try {
          unsubApptsRaw = onSnapshot(collection(db, "saloni", rawUid, "appuntamenti"), (snap) => {
            if (!snap.metadata.hasPendingWrites) {
              handleDataUpdated();
            }
          }, (err) => console.warn("Nota real-time snapshot appuntamenti rawUid:", err));
        } catch (e) {
          console.warn("Errore setup snapshot appuntamenti rawUid:", e);
        }
      }

      try {
        unsubCusts = onSnapshot(collection(db, "saloni", tid, "clienti"), (snap) => {
          if (!snap.metadata.hasPendingWrites) {
            handleDataUpdated();
          }
        }, (err) => console.warn("Nota real-time snapshot clienti:", err));
      } catch (e) {
        console.warn("Errore setup snapshot clienti:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("trimmy-data-updated", handleDataUpdated);
      }
      unsubApptsTid();
      unsubApptsRaw();
      unsubCusts();
    };
  }, [salonTenantId, currentUser, selectedDate, viewMode, dateRange]);

  // Gestione Spostamento Temporale (Precedente / Successivo / Oggi)
  const handlePrev = () => {
    if (!selectedDate) return;
    const prev = new Date(selectedDate);

    if (viewMode === "giornaliera" || viewMode === "staff") {
      prev.setDate(prev.getDate() - 1);
    } else if (viewMode === "settimanale") {
      prev.setDate(prev.getDate() - 7);
    } else if (viewMode === "mensile") {
      prev.setMonth(prev.getMonth() - 1);
    }
    setSelectedDate(prev);
  };

  const handleNext = () => {
    if (!selectedDate) return;
    const next = new Date(selectedDate);

    if (viewMode === "giornaliera" || viewMode === "staff") {
      next.setDate(next.getDate() + 1);
    } else if (viewMode === "settimanale") {
      next.setDate(next.getDate() + 7);
    } else if (viewMode === "mensile") {
      next.setMonth(next.getMonth() + 1);
    }
    setSelectedDate(next);
  };

  const handleToday = () => {
    if (todayDate) {
      setSelectedDate(new Date(todayDate));
    }
  };

  // Titolo dinamico in base alla vista
  const formattedDateTitle = useMemo(() => {
    if (!selectedDate) return "Caricamento...";

    if (viewMode === "giornaliera" || viewMode === "staff") {
      return selectedDate.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    if (viewMode === "settimanale") {
      const startStr = dateRange.start.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
      const endStr = dateRange.end.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
      return `Settimana ${startStr} - ${endStr}`;
    }

    // Mensile
    return selectedDate.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric"
    });
  }, [selectedDate, viewMode, dateRange]);

  const isTodaySelected = useMemo(() => {
    if (!selectedDate || !todayDate) return false;
    return (
      selectedDate.getDate() === todayDate.getDate() &&
      selectedDate.getMonth() === todayDate.getMonth() &&
      selectedDate.getFullYear() === todayDate.getFullYear()
    );
  }, [selectedDate, todayDate]);

  // Lista giorni della settimana (per vista settimanale)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(dateRange.start);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [dateRange]);

  // Calendario mensile (giorni del mese + padding)
  const monthCalendarDays = useMemo(() => {
    if (!selectedDate) return [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysCount = lastDayOfMonth.getDate();
    // Giorno della settimana dell'1 del mese (0 Domenica, 1 Lunedì -> aggiustiamo per Lunedì = 0)
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    const days: ({ day: number; date: Date; isCurrentMonth: boolean })[] = [];

    // Giorni mese precedente per completare la griglia
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ day: prevMonthLastDay - i, date: d, isCurrentMonth: false });
    }

    // Giorni mese corrente
    for (let i = 1; i <= daysCount; i++) {
      const d = new Date(year, month, i);
      days.push({ day: i, date: d, isCurrentMonth: true });
    }

    // Giorni mese successivo per chiudere la griglia a multipli di 7
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ day: i, date: d, isCurrentMonth: false });
    }

    return days;
  }, [selectedDate]);

  // Creazione Nuovo Appuntamento
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formServiceId || !formStaffId || !formDate || !formTime) {
      alert("Compila tutti i campi obbligatori per servizio, orario e collaboratore!");
      return;
    }

    setIsSubmitting(true);
    try {
      const tid = salonTenantId || getSalonTenantId(auth.currentUser?.uid);
      if (!tid) throw new Error("ID salone non trovato");

      let targetCustomerId = formCustomerId;
      let custName = "Cliente";

      if (clientMode === "new") {
        if (!newCustomerFirstName.trim() || !newCustomerLastName.trim() || !newCustomerPhone.trim()) {
          alert("Inserisci Nome, Cognome e Telefono del nuovo cliente!");
          setIsSubmitting(false);
          return;
        }

        // Salva il cliente nei database (DataConnect + Firestore /saloni/{id}/clienti + Firestore /users con role cliente)
        const savedCustomer = await saveSalonCustomer(tid, {
          firstName: newCustomerFirstName,
          lastName: newCustomerLastName,
          phone: newCustomerPhone,
          email: newCustomerEmail.trim() || null,
          birthday: newCustomerBirthday || null,
          technicalNotes: newCustomerNotes || null
        });

        targetCustomerId = savedCustomer.id;
        custName = `${savedCustomer.firstName} ${savedCustomer.lastName}`;

        // Ricarica la lista clienti del salone
        const freshCusts = await fetchSalonCustomers(tid);
        setCustomers(
          freshCusts.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            email: c.email || undefined,
            birthday: c.birthday || undefined,
            technicalNotes: c.technicalNotes || undefined
          }))
        );
      } else {
        if (!formCustomerId) {
          alert("Seleziona un cliente esistente dall'elenco!");
          setIsSubmitting(false);
          return;
        }
        const custObj = customers.find((c) => c.id === formCustomerId);
        custName = custObj ? `${custObj.firstName} ${custObj.lastName}` : "Cliente";
      }

      const selectedService = services.find((s) => s.id === formServiceId);
      const duration = selectedService?.durationMinutes || 30;

      const [hours, minutes] = formTime.split(":").map(Number);
      const start = parseDateSafe(formDate);
      start.setHours(hours, minutes, 0, 0);

      const end = new Date(start.getTime() + duration * 60 * 1000);
      const manualApptId = `appt-manual-${Date.now()}`;
      const staffObj = activeStaff.find((s) => s.id === formStaffId);
      const staffName = staffObj ? staffObj.fullName : "Staff";
      const srvName = selectedService?.name || "Trattamento";

      await saveSalonAppointment({
        id: manualApptId,
        tenantId: tid,
        salonRawId: currentUser?.uid || tid,
        salonName: "Salone",
        customerId: targetCustomerId,
        customer: {
          id: targetCustomerId,
          firstName: custName.split(" ")[0] || "Cliente",
          lastName: custName.split(" ").slice(1).join(" ") || "",
          phone: newCustomerPhone || (customers.find((c) => c.id === targetCustomerId)?.phone || "")
        },
        serviceId: formServiceId,
        service: {
          id: formServiceId,
          name: srvName,
          durationMinutes: duration,
          price: selectedService?.price || 0
        },
        staffId: formStaffId,
        staff: {
          id: formStaffId,
          fullName: staffName
        },
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
        price: selectedService?.price || 0
      });

      if (currentUser?.uid) {
        addSalonNotification(currentUser.uid, {
          id: `appt-manual-${Date.now()}`,
          title: `Nuovo appuntamento: ${custName}`,
          description: `${srvName} fissato il ${formDate} alle ore ${formTime} con ${staffName}`,
          time: "Adesso",
          type: "appointment",
          link: "/"
        });
      }

      setIsDrawerOpen(false);
      setFormCustomerId("");
      setNewCustomerFirstName("");
      setNewCustomerLastName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
      setNewCustomerBirthday("");
      setNewCustomerNotes("");
      setFormServiceId("");
      setFormStaffId("");
      await fetchAppuntamenti();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err: any) {
      console.error("Errore creazione appuntamento:", err);
      if (err?.code === "SLOT_CONFLICT" || err?.message?.includes("occupato")) {
        alert("⚠️ Conflitto Concorrenza: " + err.message);
      } else {
        alert("Impossibile salvare l'appuntamento: " + (err?.message || "Errore imprevisto."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggiornamento Stato Appuntamento
  const handleUpdateStatus = async (apptId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      await updateSalonAppointmentStatus(salonTenantId, currentUser?.uid, apptId, newStatus);
      setSelectedAppt((prev) => (prev && prev.id === apptId ? { ...prev, status: newStatus as any } : prev));
      await fetchAppuntamenti();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err) {
      console.error("Errore aggiornamento stato:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancellazione Appuntamento
  const handleDeleteAppointment = async (apptId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo appuntamento?")) return;
    setActionLoading(true);
    try {
      await deleteSalonAppointment(salonTenantId, currentUser?.uid, apptId);
      setSelectedAppt(null);
      await fetchAppuntamenti();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err) {
      console.error("Errore cancellazione:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  if (checkingAuth || !selectedDate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
       {/* 1. HEADER & CONTROLLI NAVIGAZIONE */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 capitalize tracking-tight">
              {formattedDateTitle}
            </h1>
            {isTodaySelected && viewMode === "giornaliera" && (
              <span className="text-[10px] sm:text-[11px] font-semibold bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                Oggi
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 sm:mt-1">
            {appuntamenti.length} {appuntamenti.length === 1 ? "appuntamento trovato" : "appuntamenti trovati"}.
          </p>
        </div>

        {/* Pulsantiere Navigazione & Selezione Viste */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          
          {/* Frecce Indietro / Oggi / Avanti */}
          <div className="flex items-center bg-white border border-zinc-200/80 rounded-lg p-0.5 shadow-xs">
            <button 
              onClick={handlePrev} 
              className="p-1 sm:p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors"
              title="Precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleToday}
              className="px-2.5 sm:px-3 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors"
            >
              Oggi
            </button>
            <button 
              onClick={handleNext} 
              className="p-1 sm:p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors"
              title="Successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date Picker Diretto */}
          <div className="relative">
            <input 
              type="date" 
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value + "T12:00:00"));
                }
              }}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
            />
            <button className="flex items-center gap-1.5 bg-white border border-zinc-200/80 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50">
              <CalendarDays className="w-4 h-4 text-zinc-500" />
              <span className="hidden xs:inline">Data</span>
            </button>
          </div>

          {/* Selettore Modalità Vista: Giornaliera, Settimanale, Mensile, Staff */}
          <div className="bg-zinc-100 p-0.5 rounded-lg flex items-center border border-zinc-200/60 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setViewMode("giornaliera")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all ${
                viewMode === "giornaliera"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Giorno
            </button>
            <button
              onClick={() => setViewMode("settimanale")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all ${
                viewMode === "settimanale"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Settimana
            </button>
            <button
              onClick={() => setViewMode("mensile")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all ${
                viewMode === "mensile"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Mese
            </button>
            <button
              onClick={() => setViewMode("staff")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all ${
                viewMode === "staff"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Staff
            </button>
          </div>

          {/* Nuovo Appuntamento */}
          <button 
            onClick={() => {
              setFormDate(selectedDate.toISOString().split("T")[0]);
              setIsDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900 text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Prenota
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            title="Disconnetti"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. AREA PRINCIPALE: VISUALIZZAZIONE CALENDARIO */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-zinc-200/60 p-12 sm:p-16 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-zinc-600" />
          <p className="text-sm">Caricamento appuntamenti in corso...</p>
        </div>
      ) : viewMode === "giornaliera" ? (

        /* ========================================================================= */
        /* VISTA 1: GIORNALIERA (TIMELINE ORARIA)                                   */
        /* ========================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-zinc-200/60 overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 border-b border-zinc-200/60 bg-zinc-50/70">
            <div className="col-span-3 sm:col-span-2 md:col-span-1 p-2.5 sm:p-3 text-center text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-zinc-500 border-r border-zinc-200/60">
              Ora
            </div>
            <div className="col-span-9 sm:col-span-10 md:col-span-11 p-2.5 sm:p-3 text-[11px] sm:text-[12px] font-semibold text-zinc-600">
              Orario di Lavoro
            </div>
          </div>

          <div className="divide-y divide-zinc-100 overflow-y-auto max-h-[720px] scroll-smooth">
            {TIME_SLOTS.map((time) => {
              const currentHour = parseInt(time.split(":")[0]);
              const slotAppointments = appuntamenti.filter((appt) => {
                const apptDate = new Date(appt.startTime);
                return apptDate.getDate() === selectedDate.getDate() && apptDate.getHours() === currentHour;
              });

              return (
                <div key={time} className="grid grid-cols-12 min-h-[82px] sm:min-h-[92px] group hover:bg-zinc-50/40 transition-colors">
                  <div className="col-span-3 sm:col-span-2 md:col-span-1 border-r border-zinc-100 flex items-start justify-center pt-2.5 sm:pt-3 relative bg-zinc-50/20">
                    <span className="text-[10px] sm:text-[11px] font-mono font-medium text-zinc-400 bg-white px-1 sm:px-1.5 py-0.5 rounded border border-zinc-200/60">
                      {time}
                    </span>
                  </div>

                  <div className="col-span-9 sm:col-span-10 md:col-span-11 p-2 flex flex-wrap gap-2.5 sm:gap-3 items-start relative">
                    {slotAppointments.map((appt) => {
                      const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const endTimeStr = new Date(appt.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const isCompleted = appt.status === "COMPLETED";
                      const isCancelled = appt.status === "CANCELLED";

                      return (
                        <div 
                          key={appt.id} 
                          onClick={() => setSelectedAppt(appt)}
                          className={`w-full sm:w-auto sm:min-w-[240px] sm:max-w-[340px] border rounded-xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer text-left relative overflow-hidden ${
                            isCompleted 
                              ? "bg-zinc-50 border-zinc-200 opacity-75"
                              : isCancelled
                              ? "bg-red-50/30 border-red-200/60 opacity-60 line-through"
                              : "bg-white border-zinc-200/80 hover:border-zinc-400"
                          }`}
                        >
                          <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                            isCompleted ? "bg-emerald-500" : isCancelled ? "bg-red-400" : "bg-zinc-900"
                          }`} />

                          <div className="flex justify-between items-start gap-2 pl-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-zinc-900 leading-tight truncate">
                                {appt.service.name}
                              </p>
                              <p className="text-[12px] font-medium text-zinc-600 mt-0.5 truncate">
                                {appt.customer.firstName} {appt.customer.lastName}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                              {startTimeStr} - {endTimeStr}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 pl-1.5 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1 text-zinc-500 truncate">
                              <UserIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate">{appt.staff.fullName}</span>
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded shrink-0 ${
                              isCompleted 
                                ? "text-emerald-700 bg-emerald-50" 
                                : isCancelled 
                                ? "text-red-700 bg-red-50" 
                                : "text-zinc-700 bg-zinc-100"
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {slotAppointments.length === 0 && (
                      <div 
                        onClick={() => {
                          setFormTime(time);
                          setFormDate(selectedDate.toISOString().split("T")[0]);
                          setIsDrawerOpen(true);
                        }}
                        className="w-full h-full min-h-[50px] sm:min-h-[60px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-700"
                      >
                        + Clicca per prenotare alle {time}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : viewMode === "settimanale" ? (

        /* ========================================================================= */
        /* VISTA 2: SETTIMANALE (7 COLONNE GIORNALIERE CON SCROLL ORIZZONTALE)     */
        /* ========================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-zinc-200/60 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <div className="min-w-[720px] sm:min-w-full">
              {/* Header 7 Colonne */}
              <div className="grid grid-cols-7 border-b border-zinc-200/60 bg-zinc-50/70">
                {weekDays.map((d) => {
                  const isToday = todayDate ? todayDate.toDateString() === d.toDateString() : false;
                  const isCurrentSelected = selectedDate.toDateString() === d.toDateString();

                  return (
                    <div 
                      key={d.toISOString()} 
                      onClick={() => setSelectedDate(d)}
                      className={`p-3 text-center border-r last:border-r-0 border-zinc-200/60 cursor-pointer transition-colors ${
                        isCurrentSelected ? "bg-zinc-100/80" : "hover:bg-zinc-100/40"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                        {d.toLocaleDateString("it-IT", { weekday: "short" })}
                      </p>
                      <div className="mt-1 flex items-center justify-center">
                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday ? "bg-zinc-900 text-white" : "text-zinc-900"
                        }`}>
                          {d.getDate()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Griglia Appuntamenti Settimanale */}
              <div className="grid grid-cols-7 min-h-[500px] sm:min-h-[550px] divide-x divide-zinc-100 overflow-y-auto max-h-[720px]">
            {weekDays.map((d) => {
              const dayAppointments = appuntamenti.filter((appt) => {
                const apptDate = new Date(appt.startTime);
                return apptDate.toDateString() === d.toDateString();
              });

              return (
                <div key={d.toISOString()} className="p-2 space-y-2 bg-zinc-50/10">
                  {dayAppointments.map((appt) => {
                    const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                    const isCompleted = appt.status === "COMPLETED";
                    const isCancelled = appt.status === "CANCELLED";

                    return (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className={`p-2.5 rounded-lg border text-left shadow-xs hover:shadow-md transition-all cursor-pointer ${
                          isCompleted 
                            ? "bg-zinc-50 border-emerald-200 opacity-80" 
                            : isCancelled 
                            ? "bg-red-50/30 border-red-200 line-through opacity-60" 
                            : "bg-white border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                          <span>{startTimeStr}</span>
                          <span>{appt.service.durationMinutes}m</span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-900 truncate mt-1">
                          {appt.service.name}
                        </p>
                        <p className="text-[11px] text-zinc-600 truncate">
                          {appt.customer.firstName} {appt.customer.lastName}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {appt.staff.fullName}
                        </p>
                      </div>
                    );
                  })}

                  {dayAppointments.length === 0 && (
                    <div 
                      onClick={() => {
                        setSelectedDate(d);
                        setFormDate(d.toISOString().split("T")[0]);
                        setIsDrawerOpen(true);
                      }}
                      className="h-24 flex items-center justify-center text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/50 rounded-lg cursor-pointer border border-dashed border-transparent hover:border-zinc-200 transition-all"
                    >
                      + Prenota
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>

      ) : viewMode === "mensile" ? (

        /* ========================================================================= */
        /* VISTA 3: MENSILE (CALENDARIO A GRIGLIA CON SCROLL ORIZZONTALE MOBILE)    */
        /* ========================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-zinc-200/60 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] sm:min-w-full">
              {/* Intestazione giorni Lun - Dom */}
              <div className="grid grid-cols-7 border-b border-zinc-200/60 bg-zinc-50/70 text-center">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((dayName) => (
                  <div key={dayName} className="p-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Griglia giorni del mese */}
              <div className="grid grid-cols-7 border-collapse divide-x divide-y divide-zinc-100">
                {monthCalendarDays.map(({ day, date, isCurrentMonth }, idx) => {
                  const isToday = todayDate ? todayDate.toDateString() === date.toDateString() : false;
                  const isSelected = selectedDate.toDateString() === date.toDateString();
                  
                  // Appuntamenti di questo giorno
                  const dayAppts = appuntamenti.filter((appt) => {
                    const apptDate = new Date(appt.startTime);
                    return apptDate.toDateString() === date.toDateString();
                  });

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[90px] sm:min-h-[110px] p-2 flex flex-col justify-between cursor-pointer transition-colors ${
                        !isCurrentMonth ? "bg-zinc-50/40 text-zinc-300" : "bg-white hover:bg-zinc-50/60"
                      } ${isSelected ? "ring-2 ring-zinc-900 ring-inset" : ""}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday 
                            ? "bg-zinc-900 text-white" 
                            : isCurrentMonth 
                            ? "text-zinc-800" 
                            : "text-zinc-400"
                        }`}>
                          {day}
                        </span>

                        {dayAppts.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-zinc-100 text-zinc-700 rounded-full">
                            {dayAppts.length}
                          </span>
                        )}
                      </div>

                      {/* Elenco badge appuntamenti */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayAppts.slice(0, 3).map((appt) => (
                          <div 
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppt(appt);
                            }}
                            className="text-[10px] font-medium bg-zinc-100 text-zinc-800 truncate px-1.5 py-0.5 rounded hover:bg-zinc-200 transition-colors"
                          >
                            {new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} {appt.service.name}
                          </div>
                        ))}
                        {dayAppts.length > 3 && (
                          <p className="text-[9px] text-zinc-400 font-semibold pl-1">
                            +{dayAppts.length - 3} altri
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      ) : (

        /* ========================================================================= */
        /* VISTA 4: COLONNE STAFF                                                   */
        /* ========================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-zinc-200/60 overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid border-b border-zinc-200/60 bg-zinc-50/70" style={{ gridTemplateColumns: `repeat(${activeStaff.length}, minmax(0, 1fr))` }}>
              {activeStaff.map((st) => (
                <div key={st.id} className="p-3 text-center border-r last:border-r-0 border-zinc-200/60">
                  <p className="text-sm font-semibold text-zinc-900">{st.fullName}</p>
                  <p className="text-[11px] text-zinc-400 uppercase tracking-wider">{st.role}</p>
                </div>
              ))}
            </div>

            <div className="grid min-h-[500px] divide-x divide-zinc-100" style={{ gridTemplateColumns: `repeat(${activeStaff.length}, minmax(0, 1fr))` }}>
              {activeStaff.map((st) => {
                const staffAppointments = appuntamenti.filter((a) => a.staff.id === st.id);

                return (
                  <div key={st.id} className="p-3 space-y-3 bg-zinc-50/10">
                    {staffAppointments.map((appt) => {
                      const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const endTimeStr = new Date(appt.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const isCompleted = appt.status === "COMPLETED";
                      const isCancelled = appt.status === "CANCELLED";

                      return (
                        <div
                          key={appt.id}
                          onClick={() => setSelectedAppt(appt)}
                          className={`p-3 bg-white border rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer ${
                            isCompleted ? "border-emerald-200 opacity-80" : isCancelled ? "border-red-200 line-through opacity-60" : "border-zinc-200"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[11px] font-mono font-medium text-zinc-500">
                              {startTimeStr} - {endTimeStr}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                              {appt.service.durationMinutes}m
                            </span>
                          </div>
                          <p className="font-semibold text-xs text-zinc-900 mt-1">{appt.service.name}</p>
                          <p className="text-xs text-zinc-600">{appt.customer.firstName} {appt.customer.lastName}</p>
                        </div>
                      );
                    })}

                    {staffAppointments.length === 0 && (
                      <p className="text-[12px] text-zinc-400 text-center pt-8">
                        Nessun appuntamento
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. MODALE DETTAGLI & GESTIONE STATO APPUNTAMENTO */}
      {selectedAppt && (
        <div 
          className="fixed inset-0 bg-zinc-900/30 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedAppt(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-6 border-b border-zinc-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Dettaglio Appuntamento
                </span>
                <h3 className="text-xl font-bold text-zinc-900 mt-0.5">
                  {selectedAppt.service.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAppt(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Box Cliente & Staff */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs">
                <div>
                  <p className="text-zinc-400 font-medium">Cliente</p>
                  <p className="font-semibold text-zinc-900 mt-0.5">
                    {selectedAppt.customer.firstName} {selectedAppt.customer.lastName}
                  </p>
                  <p className="text-zinc-500 mt-0.5">{selectedAppt.customer.phone}</p>
                </div>
                <div>
                  <p className="text-zinc-400 font-medium">Collaboratore</p>
                  <p className="font-semibold text-zinc-900 mt-0.5">
                    {selectedAppt.staff.fullName}
                  </p>
                </div>
              </div>

              {/* Orario & Prezzo */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs">
                <div>
                  <p className="text-zinc-400 font-medium">Data & Orario</p>
                  <p className="font-semibold text-zinc-900 mt-0.5">
                    {new Date(selectedAppt.startTime).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} ore {new Date(selectedAppt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-zinc-500 mt-0.5">{selectedAppt.service.durationMinutes} minuti</p>
                </div>
                <div>
                  <p className="text-zinc-400 font-medium">Importo</p>
                  <p className="font-semibold text-zinc-900 mt-0.5 text-sm">
                    €{selectedAppt.service.price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Contatto Rapido WhatsApp & Telefono */}
              {selectedAppt.customer?.phone && (
                <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Promemoria / Contatto
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">{selectedAppt.customer.phone}</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={buildWhatsAppClickToChatUrl(
                        selectedAppt.customer.phone,
                        `Ciao ${selectedAppt.customer.firstName}! Ti ricordiamo il tuo appuntamento per ${selectedAppt.service.name} il ${new Date(selectedAppt.startTime).toLocaleDateString("it-IT", { day: "numeric", month: "long" })} alle ore ${new Date(selectedAppt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Invia WhatsApp 💬
                    </a>
                    <a
                      href={`tel:${selectedAppt.customer.phone}`}
                      className="py-1.5 px-3 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Chiama
                    </a>
                  </div>
                </div>
              )}

              {/* Cambia Stato Appuntamento */}
              <div>
                <p className="text-xs font-semibold text-zinc-700 mb-2">Aggiorna Stato:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedAppt.id, "CONFIRMED")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                      selectedAppt.status === "CONFIRMED"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    Confermato
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedAppt.id, "COMPLETED")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                      selectedAppt.status === "COMPLETED"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    Completato
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedAppt.id, "CANCELLED")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                      selectedAppt.status === "CANCELLED"
                        ? "bg-red-600 text-white border-red-600 shadow-xs"
                        : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                    }`}
                  >
                    Annullato
                  </button>
                </div>
              </div>
            </div>

            {/* Footer con opzione Elimina */}
            <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center">
              <button
                disabled={actionLoading}
                onClick={() => handleDeleteAppointment(selectedAppt.id)}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Elimina Definitivamente
              </button>

              <button
                onClick={() => setSelectedAppt(null)}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-xs"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DRAWER: NUOVO APPUNTAMENTO */}
      {isDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 bg-zinc-900/20 backdrop-blur-xs z-40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex items-center justify-between p-6 border-b border-zinc-200/60">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Nuovo Appuntamento</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Inserisci un nuovo appuntamento in agenda.</p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="p-6 space-y-5">
                
                {/* Selezione / Creazione Cliente */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      Cliente *
                    </label>
                    <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => setClientMode("existing")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                          clientMode === "existing"
                            ? "bg-white text-zinc-900 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        Già registrato
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientMode("new")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                          clientMode === "new"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        Nuovo Cliente
                      </button>
                    </div>
                  </div>

                  {clientMode === "existing" ? (
                    <div>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                        <select 
                          value={formCustomerId}
                          onChange={(e) => setFormCustomerId(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                        >
                          <option value="">Seleziona cliente...</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.lastName} {c.firstName} ({c.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                      {customers.length === 0 ? (
                        <p className="text-[11px] text-amber-600 mt-1">
                          Nessun cliente registrato per questo salone. Seleziona <strong>"Nuovo Cliente"</strong> in alto per registrarne uno.
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-400 mt-1">
                          {customers.length} clienti in archivio per il tuo salone.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-xs text-zinc-700 font-semibold border-b border-zinc-200/60 pb-2">
                        <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                        Dati Anagrafica Nuovo Cliente
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Verrà creato un nuovo account cliente registrato nei nostri database (Cloud SQL + profilo Firestore).
                      </p>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Nome *
                          </label>
                          <input
                            type="text"
                            placeholder="Es. Marco"
                            value={newCustomerFirstName}
                            onChange={(e) => setNewCustomerFirstName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Cognome *
                          </label>
                          <input
                            type="text"
                            placeholder="Es. Bianchi"
                            value={newCustomerLastName}
                            onChange={(e) => setNewCustomerLastName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Telefono *
                          </label>
                          <input
                            type="tel"
                            placeholder="Es. 340 1234567"
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Email (Opzionale)
                          </label>
                          <input
                            type="email"
                            placeholder="cliente@email.it"
                            value={newCustomerEmail}
                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Data di Nascita
                          </label>
                          <input
                            type="date"
                            value={newCustomerBirthday}
                            onChange={(e) => setNewCustomerBirthday(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-600 uppercase mb-1">
                            Note Tecniche
                          </label>
                          <input
                            type="text"
                            placeholder="Es. Cute sensibile, taglio #2"
                            value={newCustomerNotes}
                            onChange={(e) => setNewCustomerNotes(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selezione Servizio */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Servizio *
                  </label>
                  <div className="relative">
                    <Scissors className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <select 
                      required
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Seleziona trattamento...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — €{s.price} ({s.durationMinutes} min)
                        </option>
                      ))}
                    </select>
                  </div>
                  {services.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Nessun trattamento a listino. Vai in <a href="/trattamenti" className="underline font-semibold hover:text-amber-700">"Trattamenti"</a> per creare i tuoi servizi.
                    </p>
                  )}
                </div>

                {/* Selezione Staff */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Collaboratore / Staff *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <select 
                      required
                      value={formStaffId}
                      onChange={(e) => setFormStaffId(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Assegna collaboratore...</option>
                      {activeStaff.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({st.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Data e Ora */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Data *
                    </label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input 
                        type="date" 
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Ora Inizio *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input 
                        type="time" 
                        required
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottoni submit */}
              <div className="p-6 border-t border-zinc-200/60 bg-zinc-50 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-50 transition-colors shadow-xs"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 transition-colors flex justify-center items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Conferma Prenotazione
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </>
      )}

    </div>
  );
}