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
import { getSalonTenantId, resolveSalonTenantId, ensureSalonTenant, ensureSalonStaff, ensureSalonService } from "@/lib/tenant-helper";
import { getSalonServices, fetchSalonServices, SalonServiceItem } from "@/lib/services-store";
import { fetchSalonCustomers, saveSalonCustomer, CustomerItem } from "@/lib/customers-store";
import { 
  fetchSalonAppointments, 
  saveSalonAppointment, 
  updateSalonAppointmentStatus, 
  deleteSalonAppointment,
  rescheduleSalonAppointment,
  SlotConflictError
} from "@/lib/appointments-service";
import { getUserProfile, fetchUserProfile } from "@/lib/user-profile";
import { addSalonNotification } from "@/lib/salon-notifications";
import { sendNotification } from "@/lib/notifications-service";
import { parseDateSafe } from "@/lib/date-utils";
import CheckoutModal from "@/components/CheckoutModal";
import DailyCashClosingModal from "@/components/DailyCashClosingModal";
import SyncBanner from "@/components/SyncBanner";
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
  Phone, 
  GripVertical, 
  Undo2, 
  Clock3, 
  Sparkles, 
  AlertTriangle,
  Receipt,
  Lock,
  Coffee,
  Pause
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
  const [drawerMode, setDrawerMode] = useState<"APPOINTMENT" | "BLOCK">("APPOINTMENT");
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
  const [salonNameState, setSalonNameState] = useState<string>("Salone");

  // Form Blocco Orario (Pausa / Ferie / Permesso)
  const [blockStaffId, setBlockStaffId] = useState("");
  const [blockReason, setBlockReason] = useState("Pausa Pranzo");
  const [blockDate, setBlockDate] = useState("");
  const [blockIsAllDay, setBlockIsAllDay] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState("13:00");
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(60);
  const [blockNotes, setBlockNotes] = useState("");

  // ─── POS & CHIUSURA CASSA STATE ───
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isDailyClosingOpen, setIsDailyClosingOpen] = useState(false);
  const [checkoutInitialData, setCheckoutInitialData] = useState<{
    appointmentId?: string;
    customerName?: string;
    customerPhone?: string;
    items?: { id: string; type: "SERVICE" | "PRODUCT"; name: string; price: number; quantity: number; operatorId?: string; operatorName?: string }[];
  } | null>(null);

  // ─── DRAG & DROP & RESIZE STATE ───
  const [draggingAppt, setDraggingAppt] = useState<GetDailyAppointmentsData["appointments"][0] | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{
    type: "daily" | "weekly" | "staff";
    time?: string;
    day?: Date;
    staffId?: string;
    staffName?: string;
  } | null>(null);

  // Resize State (durata trattamento)
  const [resizingAppt, setResizingAppt] = useState<{
    appt: GetDailyAppointmentsData["appointments"][0];
    startY: number;
    initialDuration: number;
    initialEndTime: string;
    currentDuration: number;
  } | null>(null);

  // Action Toast con Undo & Notifica Cliente
  const [actionToast, setActionToast] = useState<{
    id: string;
    message: string;
    type: "success" | "error" | "info";
    undoData?: {
      apptId: string;
      prevStartTime: string;
      prevEndTime: string;
      prevStaffId: string;
      prevStaffName: string;
      prevStaffRole: string;
      prevDuration: number;
    };
    customerNotice?: {
      customerName: string;
      customerPhone?: string;
      serviceName: string;
      newDateStr: string;
      newTimeStr: string;
      staffName: string;
      appointmentId: string;
    };
  } | null>(null);

  const [toastNotifSent, setToastNotifSent] = useState<string | null>(null);

  // Inizializza data corrente lato client
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today);
    setTodayDate(today);
    setFormDate(today.toISOString().split("T")[0]);
  }, []);

  // 1. Controllo Autenticazione & Determinazione Tenant Reale
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUser(user);
        const profile = await fetchUserProfile(user.uid) || getUserProfile(user.uid);
        const tid = resolveSalonTenantId(user.uid, profile?.salonId);
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
        const isStaff = profile?.role === "collaboratore" || profile?.isStaffMember;
        const salonName = profile?.salonName || currentUser!.displayName || "Il Mio Salone";
        setSalonNameState(salonName);

        const currentStaffObj = {
          id: currentUser!.uid,
          fullName: currentUser!.displayName || salonName || (isStaff ? "Collaboratore" : "Titolare Salone"),
          role: isStaff ? "Staff" : "Titolare"
        };

        if (!isStaff) {
          // Assicura l'esistenza del salone in PostgreSQL con il piano reale
          await ensureSalonTenant(currentUser!.uid, salonName, profile?.planType || "PRO");
          await ensureSalonStaff(currentUser!.uid, salonTenantId, currentStaffObj.fullName, currentUser!.phoneNumber || undefined, "Titolare");
        } else {
          // Se collaboratore invitato, assicura la presenza nel team del salone
          await ensureSalonStaff(currentUser!.uid, salonTenantId, currentStaffObj.fullName, currentUser!.phoneNumber || undefined, "Staff");
        }

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
          setActiveStaff([currentStaffObj]);
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

  // ─── BOLLE SETTIMANALI COMPATTE & SWIPE GESTURE (TOUCH-FIRST MOBILE) ───
  const mobileBubbleDays = useMemo(() => {
    if (!selectedDate) return [];
    const curr = new Date(selectedDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Lunedì
    const monday = new Date(curr.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleCalendarTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleCalendarTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Solo se lo swipe è prevalentemente orizzontale e supera i 60px
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        handleNext(); // Swipe a sinistra -> Giorno successivo
      } else {
        handlePrev(); // Swipe a destra -> Giorno precedente
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

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

  // Creazione Blocco Orario (Pausa Pranzo / Ferie / Permesso)
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStaffId || !blockDate) {
      alert("Seleziona collaboratore e data per il blocco orario!");
      return;
    }

    setIsSubmitting(true);
    try {
      const tid = salonTenantId || getSalonTenantId(auth.currentUser?.uid);
      if (!tid) throw new Error("ID salone non trovato");

      const staffObj = activeStaff.find((s) => s.id === blockStaffId);
      const staffName = staffObj ? staffObj.fullName : "Staff";

      const start = parseDateSafe(blockDate);
      let duration = blockDurationMinutes;

      if (blockIsAllDay) {
        start.setHours(8, 30, 0, 0);
        duration = 690; // 11h 30m (dalle 08:30 alle 20:00)
      } else {
        const [h, m] = blockStartTime.split(":").map(Number);
        start.setHours(h, m, 0, 0);
      }

      const end = new Date(start.getTime() + duration * 60 * 1000);
      const blockId = `block-${Date.now()}`;
      const blockTitle = `⏸️ ${blockReason}`;

      await saveSalonAppointment({
        id: blockId,
        tenantId: tid,
        salonRawId: currentUser?.uid || tid,
        salonName: salonNameState || "Salone",
        customerId: "cust-staff-block",
        customer: {
          id: "cust-staff-block",
          firstName: "Blocco",
          lastName: blockReason,
          phone: ""
        },
        serviceId: "srv-block",
        service: {
          id: "srv-block",
          name: blockTitle,
          durationMinutes: duration,
          price: 0
        },
        staffId: blockStaffId,
        staff: {
          id: blockStaffId,
          fullName: staffName
        },
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
        price: 0,
        notes: blockNotes || `Blocco orario: ${blockReason}`
      });

      setIsDrawerOpen(false);
      setBlockNotes("");
      await fetchAppuntamenti();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err: any) {
      console.error("Errore salvataggio blocco:", err);
      if (err?.code === "SLOT_CONFLICT" || err?.message?.includes("occupato")) {
        alert("⚠️ Conflitto Concorrenza: " + err.message);
      } else {
        alert("Impossibile salvare il blocco orario: " + (err?.message || "Errore imprevisto."));
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

  // ─── RESCHEDULE & UNDO CORE LOGIC ───
  const handleReschedule = async (
    targetAppt: GetDailyAppointmentsData["appointments"][0],
    newStartTime: string,
    newEndTime: string,
    targetStaffId?: string,
    targetStaffName?: string,
    targetStaffRole?: string,
    newDurationMinutes?: number
  ) => {
    // 1. Memorizza dati precedenti per Annulla
    const prevData = {
      apptId: targetAppt.id,
      prevStartTime: targetAppt.startTime,
      prevEndTime: targetAppt.endTime,
      prevStaffId: targetAppt.staff.id,
      prevStaffName: targetAppt.staff.fullName,
      prevStaffRole: (targetAppt.staff as any)?.role || "Staff",
      prevDuration: targetAppt.service.durationMinutes
    };

    const finalStaffId = targetStaffId || targetAppt.staff.id;
    const finalStaffName = targetStaffName || targetAppt.staff.fullName;
    const finalStaffRole = targetStaffRole || (targetAppt.staff as any)?.role || "Staff";
    const finalDuration = newDurationMinutes || targetAppt.service.durationMinutes;

    // 2. Aggiornamento Ottimistico UI (0ms di latenza visiva)
    setAppuntamenti((prev) =>
      prev.map((a) =>
        a.id === targetAppt.id
          ? {
              ...a,
              startTime: newStartTime,
              endTime: newEndTime,
              staff: {
                id: finalStaffId,
                fullName: finalStaffName,
                role: finalStaffRole
              },
              service: {
                ...a.service,
                durationMinutes: finalDuration
              }
            }
          : a
      )
    );

    // 3. Esegui la sincronizzazione su Firestore & Cloud SQL
    try {
      await rescheduleSalonAppointment({
        tenantId: salonTenantId,
        salonRawId: currentUser?.uid,
        appointmentId: targetAppt.id,
        newStartTime,
        newEndTime,
        newStaffId: finalStaffId,
        newStaffName: finalStaffName,
        newStaffRole: finalStaffRole,
        newDurationMinutes: finalDuration
      });

      const d = new Date(newStartTime);
      const newTimeStr = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      const newDateFormatted = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });

      setActionToast({
        id: `toast-${Date.now()}`,
        message: `Spostato alle ${newTimeStr} con ${finalStaffName}`,
        type: "success",
        undoData: prevData,
        customerNotice: targetAppt.customer?.phone ? {
          customerName: `${targetAppt.customer.firstName} ${targetAppt.customer.lastName}`,
          customerPhone: targetAppt.customer.phone,
          serviceName: targetAppt.service.name,
          newDateStr: newDateFormatted,
          newTimeStr,
          staffName: finalStaffName,
          appointmentId: targetAppt.id
        } : undefined
      });
      setToastNotifSent(null);
    } catch (err: any) {
      console.error("Errore spostamento appuntamento:", err);
      // Rollback stato ottimistico
      setAppuntamenti((prev) =>
        prev.map((a) => (a.id === targetAppt.id ? targetAppt : a))
      );

      setActionToast({
        id: `error-${Date.now()}`,
        message: err instanceof SlotConflictError ? err.message : (err?.message || "Errore durante lo spostamento dell'appuntamento."),
        type: "error"
      });
    }
  };

  const handleUndo = async () => {
    if (!actionToast?.undoData) return;
    const { apptId, prevStartTime, prevEndTime, prevStaffId, prevStaffName, prevStaffRole, prevDuration } = actionToast.undoData;
    setActionToast(null);

    const currentItem = appuntamenti.find((a) => a.id === apptId);
    if (!currentItem) return;

    // Rollback ottimistico
    setAppuntamenti((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? {
              ...a,
              startTime: prevStartTime,
              endTime: prevEndTime,
              staff: {
                id: prevStaffId,
                fullName: prevStaffName,
                role: prevStaffRole
              },
              service: {
                ...a.service,
                durationMinutes: prevDuration
              }
            }
          : a
      )
    );

    try {
      await rescheduleSalonAppointment({
        tenantId: salonTenantId,
        salonRawId: currentUser?.uid,
        appointmentId: apptId,
        newStartTime: prevStartTime,
        newEndTime: prevEndTime,
        newStaffId: prevStaffId,
        newStaffName: prevStaffName,
        newStaffRole: prevStaffRole,
        newDurationMinutes: prevDuration
      });

      setActionToast({
        id: `undo-success-${Date.now()}`,
        message: "Spostamento annullato: appuntamento ripristinato.",
        type: "info"
      });
    } catch (e: any) {
      console.error("Errore ripristino:", e);
    }
  };

  // ─── DROP ON DAILY TIME SLOT ───
  const handleDropOnDailySlot = (timeSlot: string) => {
    if (!draggingAppt || !selectedDate) return;
    const [h, m] = timeSlot.split(":").map(Number);
    const newStart = new Date(selectedDate);
    newStart.setHours(h, m, 0, 0);

    const duration = draggingAppt.service.durationMinutes || 30;
    const newEnd = new Date(newStart.getTime() + duration * 60000);

    handleReschedule(
      draggingAppt,
      newStart.toISOString(),
      newEnd.toISOString(),
      draggingAppt.staff.id,
      draggingAppt.staff.fullName,
      (draggingAppt.staff as any)?.role || "Staff",
      duration
    );
    setDraggingAppt(null);
    setDragOverSlot(null);
  };

  // ─── DROP ON WEEKLY DAY ───
  const handleDropOnWeeklyDay = (targetDay: Date) => {
    if (!draggingAppt) return;
    const origStart = new Date(draggingAppt.startTime);
    const newStart = new Date(targetDay);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);

    const duration = draggingAppt.service.durationMinutes || 30;
    const newEnd = new Date(newStart.getTime() + duration * 60000);

    handleReschedule(
      draggingAppt,
      newStart.toISOString(),
      newEnd.toISOString(),
      draggingAppt.staff.id,
      draggingAppt.staff.fullName,
      (draggingAppt.staff as any)?.role || "Staff",
      duration
    );
    setDraggingAppt(null);
    setDragOverSlot(null);
  };

  // ─── DROP ON STAFF COLUMN ───
  const handleDropOnStaff = (staffId: string, staffName: string, staffRole?: string) => {
    if (!draggingAppt) return;
    handleReschedule(
      draggingAppt,
      draggingAppt.startTime,
      draggingAppt.endTime,
      staffId,
      staffName,
      staffRole || "Staff",
      draggingAppt.service.durationMinutes
    );
    setDraggingAppt(null);
    setDragOverSlot(null);
  };

  // ─── RESIZE LOGIC (POINTER EVENTS) ───
  const handleResizeStart = (e: React.PointerEvent, appt: GetDailyAppointmentsData["appointments"][0]) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    setResizingAppt({
      appt,
      startY: e.clientY,
      initialDuration: appt.service.durationMinutes || 30,
      initialEndTime: appt.endTime,
      currentDuration: appt.service.durationMinutes || 30
    });
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingAppt) return;
    const deltaY = e.clientY - resizingAppt.startY;
    // 24px ogni scatto di 15 minuti
    const steps = Math.round(deltaY / 24);
    const newDuration = Math.max(15, Math.min(240, resizingAppt.initialDuration + steps * 15));
    if (newDuration !== resizingAppt.currentDuration) {
      setResizingAppt((prev) => (prev ? { ...prev, currentDuration: newDuration } : null));
    }
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    if (!resizingAppt) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    const { appt, initialDuration, currentDuration } = resizingAppt;
    setResizingAppt(null);

    if (currentDuration !== initialDuration) {
      const start = new Date(appt.startTime);
      const newEnd = new Date(start.getTime() + currentDuration * 60000);
      handleReschedule(
        appt,
        appt.startTime,
        newEnd.toISOString(),
        appt.staff.id,
        appt.staff.fullName,
        (appt.staff as any)?.role || "Staff",
        currentDuration
      );
    }
  };

  // ─── NOTIFICHE CLIENTE DI CAMBIO ORARIO ───
  const handleSendWhatsAppNotice = (notice: NonNullable<typeof actionToast>["customerNotice"]) => {
    if (!notice || !notice.customerPhone) return;
    const cleanPhone = notice.customerPhone.replace(/[^0-9+]/g, "");
    const msg = `Ciao ${notice.customerName}, ti confermiamo che il tuo appuntamento per "${notice.serviceName}" presso ${salonNameState} è stato riprogrammato a ${notice.newDateStr} alle ore ${notice.newTimeStr} con ${notice.staffName}. Per qualsiasi esigenza siamo a tua disposizione!`;
    const url = `https://wa.me/${cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setToastNotifSent("WhatsApp aperto ✓");
  };

  const handleSendPushNotice = async (notice: NonNullable<typeof actionToast>["customerNotice"]) => {
    if (!notice) return;
    try {
      await sendNotification({
        tenantId: salonTenantId,
        salonName: salonNameState,
        appointmentId: notice.appointmentId,
        customerName: notice.customerName,
        customerPhone: notice.customerPhone,
        type: "CONFIRMATION",
        title: "📅 Appuntamento Riprogrammato",
        customMessage: `Il tuo appuntamento per ${notice.serviceName} è stato spostato a ${notice.newDateStr} alle ${notice.newTimeStr} con ${notice.staffName}.`,
        templateParams: {
          servizio: notice.serviceName,
          operatore: notice.staffName,
          data: notice.newDateStr,
          ora: notice.newTimeStr
        }
      });
      setToastNotifSent("Notifica push inviata ✓");
    } catch (e) {
      console.warn("Nota invio notifica:", e);
      setToastNotifSent("Invio notifica non riuscito");
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
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
       {/* 1. HEADER & CONTROLLI NAVIGAZIONE (RESPONSIVE PER DESKTOP, ANDROID & IOS) */}
      <header className="pb-3 sm:pb-4 border-b border-zinc-200/60 dark:border-zinc-800 space-y-3">
        {/* Titolo e Data Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white capitalize tracking-tight truncate">
                {formattedDateTitle}
              </h1>
              {isTodaySelected && viewMode === "giornaliera" && (
                <span className="text-[10px] sm:text-[11px] font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-0.5 rounded-full shrink-0">
                  Oggi
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {appuntamenti.length} {appuntamenti.length === 1 ? "appuntamento trovato" : "appuntamenti trovati"}.
            </p>
          </div>
        </div>

        {/* Pulsantiere Navigazione, Selezione Viste & Azioni Rapide */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Controlli Data e Switch Viste */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            {/* Frecce Indietro / Oggi / Avanti */}
            <div className="flex items-center bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 rounded-lg p-0.5 shadow-2xs shrink-0">
              <button 
                onClick={handlePrev} 
                className="p-1 sm:p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title="Precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleToday}
                className="px-2 sm:px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
              >
                Oggi
              </button>
              <button 
                onClick={handleNext} 
                className="p-1 sm:p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title="Successivo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Date Picker Diretto */}
            <div className="relative shrink-0">
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
              <button className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer">
                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="hidden xs:inline">Data</span>
              </button>
            </div>

            {/* Selettore Modalità Vista: Giornaliera, Settimanale, Mensile, Staff */}
            <div className="flex-1 sm:flex-initial bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg flex items-center border border-zinc-200/60 dark:border-zinc-700 text-xs">
              <button
                onClick={() => setViewMode("giornaliera")}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all text-center cursor-pointer ${
                  viewMode === "giornaliera"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Giorno
              </button>
              <button
                onClick={() => setViewMode("settimanale")}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all text-center cursor-pointer ${
                  viewMode === "settimanale"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Settimana
              </button>
              <button
                onClick={() => setViewMode("mensile")}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all text-center cursor-pointer ${
                  viewMode === "mensile"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Mese
              </button>
              <button
                onClick={() => setViewMode("staff")}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all text-center cursor-pointer ${
                  viewMode === "staff"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Staff
              </button>
            </div>
          </div>

          {/* Azioni Rapide: Prenota, Pausa/Ferie, Cassa Banco, Chiusura Z */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {/* Nuovo Appuntamento */}
            <button 
              onClick={() => {
                setFormDate(selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
                setDrawerMode("APPOINTMENT");
                setIsDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Prenota</span>
            </button>

            {/* Blocca Orario (Pausa / Ferie / Permesso) */}
            <button 
              onClick={() => {
                const dStr = selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
                setBlockDate(dStr);
                if (activeStaff.length > 0 && !blockStaffId) {
                  setBlockStaffId(activeStaff[0].id);
                }
                setDrawerMode("BLOCK");
                setIsDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
              title="Blocca orario per pausa pranzo, ferie o permessi staff"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span><span className="hidden sm:inline">Pausa / </span>Ferie</span>
            </button>

            {/* Punto Cassa POS Rapido */}
            <button
              onClick={() => {
                setCheckoutInitialData(null);
                setIsCheckoutOpen(true);
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
              title="Punto Cassa per vendita diretta e scontrini da banco"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Cassa </span>Banco</span>
            </button>

            {/* Chiusura Cassa Fiscale (Report Z) */}
            <button
              onClick={() => setIsDailyClosingOpen(true)}
              className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs shrink-0 cursor-pointer"
              title="Chiusura di cassa giornaliera (Report Z)"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span><span className="hidden md:inline">Chiusura </span>Z</span>
            </button>

            {/* Logout (solo Desktop) */}
            <button 
              onClick={handleLogout}
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors hidden sm:flex shrink-0 cursor-pointer"
              title="Disconnetti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── BANNER SCOMPARSA RESILIENZA SYNC OUTBOX (PostgreSQL ↔ Firestore ↔ Local) ─── */}
      <SyncBanner tenantId={salonTenantId || currentUser?.uid || "tenant-default"} />

      {/* ─── STRISCIA SETTIMANALE A BOLLE (TOUCH-FIRST MOBILE & TABLET) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 p-1.5 sm:p-2.5 shadow-2xs mb-4">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {/* Tasto Settimana Precedente */}
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 7);
              setSelectedDate(d);
            }}
            className="p-1 sm:p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer shrink-0"
            title="Settimana precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Griglia 7 Bolle Giorno */}
          <div className="flex-1 grid grid-cols-7 gap-1 sm:gap-1.5 py-0.5 select-none min-w-0">
            {mobileBubbleDays.map((d) => {
              const isSelected = selectedDate.toDateString() === d.toDateString();
              const isToday = todayDate ? todayDate.toDateString() === d.toDateString() : false;
              const dayName = d.toLocaleDateString("it-IT", { weekday: "short" }).toUpperCase().replace(".", "");
              const dayNum = d.getDate();

              // Conta appuntamenti per questo giorno
              const dayApptCount = appuntamenti.filter((a) => {
                const apptD = new Date(a.startTime);
                return apptD.toDateString() === d.toDateString();
              }).length;

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center justify-between min-h-[56px] sm:min-h-[64px] py-1.5 px-0.5 sm:px-1 rounded-xl transition-all cursor-pointer relative min-w-0 ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md ring-2 ring-zinc-900 dark:ring-white font-bold scale-102"
                      : "bg-zinc-50/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/60"
                  }`}
                >
                  <span className={`text-[9px] sm:text-[11px] font-semibold tracking-wider truncate w-full text-center ${
                    isSelected ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {dayName}
                  </span>
                  <span className={`text-xs sm:text-base font-extrabold leading-tight ${
                    isSelected ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-white"
                  }`}>
                    {dayNum}
                  </span>

                  {/* Indicatori: Appuntamenti & Badge Oggi */}
                  <div className="flex items-center justify-center gap-1 h-3">
                    {dayApptCount > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-amber-400 dark:bg-amber-500" : "bg-zinc-900 dark:bg-white"
                      }`} />
                    )}
                    {isToday && (
                      <span className={`text-[7px] sm:text-[9px] font-mono font-bold uppercase px-0.5 sm:px-1 rounded leading-tight ${
                        isSelected 
                          ? "bg-amber-500 text-zinc-950" 
                          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      }`}>
                        Oggi
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tasto Settimana Successiva */}
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 7);
              setSelectedDate(d);
            }}
            className="p-1 sm:p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer shrink-0"
            title="Settimana successiva"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. AREA PRINCIPALE: VISUALIZZAZIONE CALENDARIO (CON GESTURE SWIPE TOUCH) */}
      <div onTouchStart={handleCalendarTouchStart} onTouchEnd={handleCalendarTouchEnd}>
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

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 md:overflow-y-auto md:max-h-[720px] scroll-smooth">
            {TIME_SLOTS.map((time) => {
              const currentHour = parseInt(time.split(":")[0]);
              const slotAppointments = appuntamenti.filter((appt) => {
                const apptDate = new Date(appt.startTime);
                return apptDate.getDate() === selectedDate.getDate() && apptDate.getHours() === currentHour;
              });

              const isSlotHovered = dragOverSlot?.type === "daily" && dragOverSlot?.time === time;

              return (
                <div 
                  key={time} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverSlot?.time !== time || dragOverSlot?.type !== "daily") {
                      setDragOverSlot({ type: "daily", time, day: selectedDate });
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverSlot(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnDailySlot(time);
                  }}
                  className={`grid grid-cols-12 min-h-[82px] sm:min-h-[92px] group transition-all ${
                    isSlotHovered ? "bg-emerald-50/70 ring-2 ring-emerald-500/40 border-emerald-400" : "hover:bg-zinc-50/40"
                  }`}
                >
                  <div className="col-span-3 sm:col-span-2 md:col-span-1 border-r border-zinc-100 flex items-start justify-center pt-2.5 sm:pt-3 relative bg-zinc-50/20">
                    <span className={`text-[10px] sm:text-[11px] font-mono font-medium px-1 sm:px-1.5 py-0.5 rounded border transition-colors ${
                      isSlotHovered ? "bg-emerald-600 text-white border-emerald-600" : "text-zinc-400 bg-white border-zinc-200/60"
                    }`}>
                      {time}
                    </span>
                  </div>

                  <div className="col-span-9 sm:col-span-10 md:col-span-11 p-2 flex flex-wrap gap-2.5 sm:gap-3 items-start relative">
                    {/* Indicatore visivo di drop */}
                    {isSlotHovered && draggingAppt && (
                      <div className="w-full py-2 px-3 bg-emerald-100/90 border-2 border-dashed border-emerald-400 rounded-xl text-emerald-900 text-xs font-semibold flex items-center justify-between animate-pulse">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                          Sposta <strong>{draggingAppt.customer.firstName}</strong> alle <strong>{time}</strong>
                        </span>
                        <span className="text-[11px] text-emerald-700 bg-emerald-200/80 px-2 py-0.5 rounded-full font-mono">
                          {draggingAppt.service.durationMinutes}m
                        </span>
                      </div>
                    )}

                    {slotAppointments.map((appt) => {
                      const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const endTimeStr = new Date(appt.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const isCompleted = appt.status === "COMPLETED";
                      const isCancelled = appt.status === "CANCELLED";
                      const isBeingDragged = draggingAppt?.id === appt.id;
                      const isResizingThis = resizingAppt?.appt.id === appt.id;
                      const displayDuration = isResizingThis ? resizingAppt.currentDuration : appt.service.durationMinutes;
                      const isBlock = appt.service.id === "srv-block" || appt.service.name?.startsWith("⏸️") || appt.customer.id === "cust-staff-block";

                      return (
                        <div 
                          key={appt.id} 
                          draggable={!isCancelled}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", appt.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingAppt(appt);
                          }}
                          onDragEnd={() => {
                            setDraggingAppt(null);
                            setDragOverSlot(null);
                          }}
                          onClick={() => setSelectedAppt(appt)}
                          className={`group/card select-none w-full sm:w-auto sm:min-w-[240px] sm:max-w-[340px] border rounded-xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer text-left relative overflow-hidden ${
                            isBeingDragged
                              ? "opacity-30 scale-95 ring-2 ring-zinc-500 border-dashed"
                              : isBlock
                              ? "bg-amber-50/80 border-dashed border-amber-300 text-amber-950 hover:border-amber-400"
                              : isCompleted 
                              ? "bg-zinc-50 border-zinc-200 opacity-75"
                              : isCancelled
                              ? "bg-red-50/30 border-red-200/60 opacity-60 line-through"
                              : "bg-white border-zinc-200/80 hover:border-zinc-400"
                          }`}
                        >
                          <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                            isBlock ? "bg-amber-500" : isCompleted ? "bg-emerald-500" : isCancelled ? "bg-red-400" : "bg-zinc-900"
                          }`} />

                          {/* Badge durata dinamica durante il resize */}
                          {isResizingThis && (
                            <span className="absolute top-1.5 right-1.5 bg-zinc-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse z-10">
                              <Clock3 className="w-3 h-3 text-emerald-400" />
                              {displayDuration}m
                            </span>
                          )}

                          <div className="flex justify-between items-start gap-2 pl-1.5">
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              {!isCancelled && (
                                <span 
                                  className="cursor-grab active:cursor-grabbing text-zinc-300 group-hover/card:text-zinc-600 transition-colors p-0.5 rounded -ml-1 shrink-0" 
                                  title="Trascina per spostare orario o staff"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {isBlock ? (
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <p className="text-[13px] font-bold text-amber-950 leading-tight truncate">
                                      {appt.service.name}
                                    </p>
                                  </div>
                                  <p className="text-[11px] font-medium text-amber-700 mt-0.5 truncate">
                                    Indisponibilità / Blocco
                                  </p>
                                </div>
                              ) : (
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-semibold text-zinc-900 leading-tight truncate">
                                    {appt.service.name}
                                  </p>
                                  <p className="text-[12px] font-medium text-zinc-600 mt-0.5 truncate">
                                    {appt.customer.firstName} {appt.customer.lastName}
                                  </p>
                                </div>
                              )}
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              isBlock ? "bg-amber-100 text-amber-800" : "text-zinc-500 bg-zinc-100"
                            }`}>
                              {startTimeStr} - {endTimeStr}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 pl-1.5 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1 text-zinc-500 truncate">
                              <UserIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate">{appt.staff.fullName}</span>
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded shrink-0 ${
                              isBlock
                                ? "text-amber-800 bg-amber-100/90 border border-amber-200"
                                : isCompleted 
                                ? "text-emerald-700 bg-emerald-50" 
                                : isCancelled 
                                ? "text-red-700 bg-red-50" 
                                : "text-zinc-700 bg-zinc-100"
                            }`}>
                              {isBlock ? "BLOCCO STAFF" : appt.status}
                            </span>
                          </div>

                          {/* Maniglia di Resize (allunga/accorcia durata) */}
                          {!isCancelled && (
                            <div 
                              onPointerDown={(e) => handleResizeStart(e, appt)}
                              onPointerMove={handleResizeMove}
                              onPointerUp={handleResizeEnd}
                              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-gradient-to-t from-zinc-200/50 to-transparent"
                              title="Trascina per allungare o accorciare la durata (+/- 15 min)"
                            >
                              <div className="w-8 h-1 bg-zinc-400/80 rounded-full" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {slotAppointments.length === 0 && !isSlotHovered && (
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

              const isDayHovered = dragOverSlot?.type === "weekly" && dragOverSlot?.day?.toDateString() === d.toDateString();

              return (
                <div 
                  key={d.toISOString()} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverSlot?.type !== "weekly" || dragOverSlot?.day?.toDateString() !== d.toDateString()) {
                      setDragOverSlot({ type: "weekly", day: d });
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverSlot(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnWeeklyDay(d);
                  }}
                  className={`p-2 space-y-2 transition-all ${
                    isDayHovered ? "bg-emerald-50/70 ring-2 ring-emerald-500/50 rounded-lg border-emerald-400" : "bg-zinc-50/10"
                  }`}
                >
                  {/* Drop indicator banner */}
                  {isDayHovered && draggingAppt && (
                    <div className="p-1.5 bg-emerald-100 border border-emerald-300 rounded text-emerald-800 text-[10px] font-bold text-center flex items-center justify-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Sposta a {d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" })}
                    </div>
                  )}

                  {dayAppointments.map((appt) => {
                    const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                    const isCompleted = appt.status === "COMPLETED";
                    const isCancelled = appt.status === "CANCELLED";
                    const isBeingDragged = draggingAppt?.id === appt.id;
                    const isResizingThis = resizingAppt?.appt.id === appt.id;
                    const displayDuration = isResizingThis ? resizingAppt.currentDuration : appt.service.durationMinutes;
                    const isBlock = appt.service.id === "srv-block" || appt.service.name?.startsWith("⏸️") || appt.customer.id === "cust-staff-block";

                    return (
                      <div
                        key={appt.id}
                        draggable={!isCancelled}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", appt.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingAppt(appt);
                        }}
                        onDragEnd={() => {
                          setDraggingAppt(null);
                          setDragOverSlot(null);
                        }}
                        onClick={() => setSelectedAppt(appt)}
                        className={`group/card select-none relative p-2.5 rounded-lg border text-left shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                          isBeingDragged
                            ? "opacity-30 scale-95 ring-2 ring-zinc-500 border-dashed"
                            : isBlock
                            ? "bg-amber-50/80 border-dashed border-amber-300 text-amber-950 hover:border-amber-400"
                            : isCompleted 
                            ? "bg-zinc-50 border-emerald-200 opacity-80" 
                            : isCancelled 
                            ? "bg-red-50/30 border-red-200 line-through opacity-60" 
                            : "bg-white border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        {isResizingThis && (
                          <span className="absolute top-1 right-1 bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-md flex items-center gap-1 animate-pulse z-10">
                            <Clock3 className="w-2.5 h-2.5 text-emerald-400" />
                            {displayDuration}m
                          </span>
                        )}

                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                          <div className="flex items-center gap-1">
                            {!isCancelled && (
                              <span 
                                className="cursor-grab active:cursor-grabbing text-zinc-300 group-hover/card:text-zinc-600 transition-colors -ml-1 shrink-0" 
                                title="Trascina su un altro giorno"
                              >
                                <GripVertical className="w-3 h-3" />
                              </span>
                            )}
                            <span className={isBlock ? "text-amber-800 font-semibold" : ""}>{startTimeStr}</span>
                          </div>
                          <span className={isBlock ? "text-amber-800 font-semibold" : ""}>{displayDuration}m</span>
                        </div>
                        {isBlock ? (
                          <>
                            <div className="flex items-center gap-1 mt-1 text-amber-950">
                              <Coffee className="w-3 h-3 text-amber-600 shrink-0" />
                              <p className="text-xs font-bold truncate">{appt.service.name}</p>
                            </div>
                            <p className="text-[10px] text-amber-700 font-medium truncate mt-0.5">
                              {appt.staff.fullName} (Blocco)
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-zinc-900 truncate mt-1">
                              {appt.service.name}
                            </p>
                            <p className="text-[11px] text-zinc-600 truncate">
                              {appt.customer.firstName} {appt.customer.lastName}
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                              {appt.staff.fullName}
                            </p>
                          </>
                        )}

                        {/* Maniglia di Resize */}
                        {!isCancelled && (
                          <div 
                            onPointerDown={(e) => handleResizeStart(e, appt)}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-gradient-to-t from-zinc-200/50 to-transparent"
                            title="Trascina per allungare o accorciare la durata (+/- 15 min)"
                          >
                            <div className="w-6 h-0.5 bg-zinc-400/80 rounded-full" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {dayAppointments.length === 0 && !isDayHovered && (
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
                        {dayAppts.slice(0, 3).map((appt) => {
                          const isBlock = appt.service.id === "srv-block" || appt.service.name?.startsWith("⏸️") || appt.customer.id === "cust-staff-block";
                          return (
                            <div 
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppt(appt);
                              }}
                              className={`text-[10px] font-medium truncate px-1.5 py-0.5 rounded transition-colors ${
                                isBlock 
                                  ? "bg-amber-100/90 text-amber-900 border border-amber-300/60 font-semibold" 
                                  : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                              }`}
                            >
                              {new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} {appt.service.name}
                            </div>
                          );
                        })}
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
        /* VISTA 4: COLONNE STAFF (GOOGLE CALENDAR STYLE CON SCORRIMENTO ORIZZONTALE) */
        /* ========================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-zinc-200/60 overflow-x-auto touch-pan-x scrollbar-thin">
          <div 
            className="flex divide-x divide-zinc-200/60" 
            style={{ 
              minWidth: `${Math.max(activeStaff.length * 260, 780)}px`,
              width: "max-content"
            }}
          >
            {activeStaff.map((st) => {
              const staffAppointments = appuntamenti.filter((a) => a.staff.id === st.id);
              const isStaffHovered = dragOverSlot?.type === "staff" && dragOverSlot?.staffId === st.id;
              const initials = st.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

              return (
                <div 
                  key={st.id} 
                  className="w-[260px] sm:w-[300px] flex flex-col bg-zinc-50/20"
                >
                  {/* Sticky Staff Header con Avatar, Ruolo e Badge contatore */}
                  <div className="sticky top-0 z-10 p-3 bg-zinc-50/95 backdrop-blur-xs border-b border-zinc-200/60 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-zinc-900 truncate">{st.fullName}</p>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider truncate">{st.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700 font-mono shrink-0">
                      {staffAppointments.length} appt
                    </span>
                  </div>

                  {/* Body Colonna Staff */}
                  <div 
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverSlot?.type !== "staff" || dragOverSlot?.staffId !== st.id) {
                        setDragOverSlot({ type: "staff", staffId: st.id, staffName: st.fullName });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDragOverSlot(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnStaff(st.id, st.fullName, st.role);
                    }}
                    className={`p-3 space-y-3 flex-1 min-h-[500px] transition-all ${
                      isStaffHovered ? "bg-emerald-50/70 ring-2 ring-emerald-500/50 rounded-b-xl border-emerald-400" : ""
                    }`}
                  >
                    {isStaffHovered && draggingAppt && (
                      <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-bold text-center animate-pulse flex items-center justify-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Assegna a {st.fullName}
                      </div>
                    )}

                    {staffAppointments.map((appt) => {
                      const startTimeStr = new Date(appt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const endTimeStr = new Date(appt.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const isCompleted = appt.status === "COMPLETED";
                      const isCancelled = appt.status === "CANCELLED";
                      const isBeingDragged = draggingAppt?.id === appt.id;
                      const isResizingThis = resizingAppt?.appt.id === appt.id;
                      const displayDuration = isResizingThis ? resizingAppt.currentDuration : appt.service.durationMinutes;
                      const isBlock = appt.service.id === "srv-block" || appt.service.name?.startsWith("⏸️") || appt.customer.id === "cust-staff-block";

                      return (
                        <div
                          key={appt.id}
                          draggable={!isCancelled}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", appt.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingAppt(appt);
                          }}
                          onDragEnd={() => {
                            setDraggingAppt(null);
                            setDragOverSlot(null);
                          }}
                          onClick={() => setSelectedAppt(appt)}
                          className={`group/card select-none relative p-3 border rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                            isBeingDragged
                              ? "opacity-30 scale-95 ring-2 ring-zinc-500 border-dashed"
                              : isBlock
                              ? "bg-amber-50/80 border-dashed border-amber-300 text-amber-950 hover:border-amber-400"
                              : isCompleted 
                              ? "bg-zinc-50 border-emerald-200 opacity-80" 
                              : isCancelled 
                              ? "bg-red-50/30 border-red-200 line-through opacity-60" 
                              : "bg-white border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {isResizingThis && (
                            <span className="absolute top-1.5 right-1.5 bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-md flex items-center gap-1 animate-pulse z-10">
                              <Clock3 className="w-2.5 h-2.5 text-emerald-400" />
                              {displayDuration}m
                            </span>
                          )}

                          <div className="flex justify-between items-start gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              {!isCancelled && (
                                <span 
                                  className="cursor-grab active:cursor-grabbing text-zinc-300 group-hover/card:text-zinc-600 transition-colors -ml-1 shrink-0" 
                                  title="Trascina su un altro collaboratore"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className={`text-[11px] font-mono font-medium ${isBlock ? "text-amber-800" : "text-zinc-500"}`}>
                                {startTimeStr} - {endTimeStr}
                              </span>
                            </div>
                            <span className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${
                              isBlock ? "bg-amber-100 text-amber-800" : "text-zinc-400 bg-zinc-100"
                            }`}>
                              {displayDuration}m
                            </span>
                          </div>
                          {isBlock ? (
                            <>
                              <div className="flex items-center gap-1.5 mt-1 text-amber-950">
                                <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <p className="font-bold text-xs truncate">{appt.service.name}</p>
                              </div>
                              <p className="text-[11px] text-amber-700 mt-0.5 truncate">Blocco Orario Staff</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-xs text-zinc-900 mt-1">{appt.service.name}</p>
                              <p className="text-xs text-zinc-600">{appt.customer.firstName} {appt.customer.lastName}</p>
                            </>
                          )}

                          {/* Maniglia di Resize */}
                          {!isCancelled && (
                            <div 
                              onPointerDown={(e) => handleResizeStart(e, appt)}
                              onPointerMove={handleResizeMove}
                              onPointerUp={handleResizeEnd}
                              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-gradient-to-t from-zinc-200/50 to-transparent"
                              title="Trascina per allungare o accorciare la durata (+/- 15 min)"
                            >
                              <div className="w-8 h-1 bg-zinc-400/80 rounded-full" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {staffAppointments.length === 0 && !isStaffHovered && (
                      <p className="text-[12px] text-zinc-400 text-center pt-8">
                        Nessun appuntamento
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {/* ─── FLOATING ACTION TOAST CON UNDO & PROMPT NOTIFICHE ─── */}
      {actionToast && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] bg-zinc-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-zinc-700/60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                actionToast.type === "error" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
              }`}>
                {actionToast.type === "error" ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  {actionToast.type === "error" ? "Conflitto o Errore" : "Appuntamento Riprogrammato"}
                </p>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                  {actionToast.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {actionToast.undoData && (
                <button
                  onClick={handleUndo}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors border border-white/10"
                >
                  <Undo2 className="w-3 h-3" />
                  Annulla
                </button>
              )}
              <button
                onClick={() => setActionToast(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Prompt Notifica Cliente */}
          {actionToast.customerNotice && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400">
                Avvisa <strong>{actionToast.customerNotice.customerName}</strong>:
              </span>
              <div className="flex items-center gap-2">
                {actionToast.customerNotice.customerPhone && (
                  <button
                    onClick={() => handleSendWhatsAppNotice(actionToast.customerNotice!)}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </button>
                )}
                <button
                  onClick={() => handleSendPushNotice(actionToast.customerNotice!)}
                  className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Push
                </button>
                {toastNotifSent && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {toastNotifSent}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MODALE DETTAGLI & GESTIONE STATO APPUNTAMENTO (BOTTOM SHEET MOBILE / MODALE DESKTOP) */}
      {selectedAppt && (() => {
        const isBlock = selectedAppt.service.id === "srv-block" || selectedAppt.service.name?.startsWith("⏸️") || selectedAppt.customer.id === "cust-staff-block";

        return (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedAppt(null)}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border-t sm:border border-zinc-200 overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-250 sm:slide-in-from-bottom-0 sm:zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Maniglia Touch per Swipe-down su Smartphone */}
            <div 
              className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer"
              onClick={() => setSelectedAppt(null)}
            >
              <div className="w-12 h-1.5 bg-zinc-300 hover:bg-zinc-400 rounded-full transition-colors" />
            </div>

            <div className="flex justify-between items-start px-6 py-4 sm:p-6 border-b border-zinc-100">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isBlock ? "text-amber-600" : "text-zinc-400"}`}>
                  {isBlock ? "Blocco Orario Staff (Indisponibilità)" : "Dettaglio Appuntamento"}
                </span>
                <h3 className="text-xl font-bold text-zinc-900 mt-0.5">
                  {selectedAppt.service.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAppt(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {isBlock ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                      <Coffee className="w-4 h-4 text-amber-600" />
                      Fascia Oraria Indisponibile
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Questo orario è bloccato in agenda per pause, ferie o permessi del personale. I clienti non potranno prenotare questo operatore in questo lasso temporale.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs">
                    <div>
                      <p className="text-zinc-400 font-medium">Collaboratore</p>
                      <p className="font-semibold text-zinc-900 mt-0.5">
                        {selectedAppt.staff.fullName}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-400 font-medium">Motivo Blocco</p>
                      <p className="font-semibold text-zinc-900 mt-0.5">
                        {selectedAppt.service.name}
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs space-y-1">
                    <p className="text-zinc-400 font-medium">Fascia Oraria</p>
                    <p className="font-semibold text-zinc-900">
                      {new Date(selectedAppt.startTime).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <p className="text-zinc-600 font-mono">
                      ore {new Date(selectedAppt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - {new Date(selectedAppt.endTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} ({selectedAppt.service.durationMinutes} min)
                    </p>
                  </div>

                  {(selectedAppt as any).notes && (
                    <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs">
                      <p className="text-zinc-400 font-medium mb-1">Note aggiuntive</p>
                      <p className="text-zinc-700">{(selectedAppt as any).notes}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleDeleteAppointment(selectedAppt.id)}
                      className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      Rimuovi Blocco e Libera Orario Staff
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                  {/* Incassa al Banco / Checkout POS */}
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutInitialData({
                        appointmentId: selectedAppt.id,
                        customerName: `${selectedAppt.customer.firstName} ${selectedAppt.customer.lastName}`.trim(),
                        customerPhone: selectedAppt.customer.phone || "",
                        items: [
                          {
                            id: selectedAppt.service.id,
                            type: "SERVICE",
                            name: selectedAppt.service.name,
                            price: selectedAppt.service.price,
                            quantity: 1,
                            operatorId: selectedAppt.staff.id,
                            operatorName: selectedAppt.staff.fullName
                          }
                        ]
                      });
                      setSelectedAppt(null);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full py-3.5 sm:py-2.5 px-4 min-h-[48px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-98 transition cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    Incassa al Banco / Scontrino POS 💳
                  </button>

                  {/* Contatto Rapido Notifica Push Firebase & Telefono */}
                  {selectedAppt.customer?.phone && (
                    <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                          Notifiche Firebase & Contatto
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">{selectedAppt.customer.phone}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!currentUser || !selectedAppt) return;
                            try {
                              await sendNotification({
                                tenantId: currentUser.uid,
                                salonName: salonNameState,
                                appointmentId: selectedAppt.id,
                                customerName: `${selectedAppt.customer.firstName} ${selectedAppt.customer.lastName}`,
                                customerPhone: selectedAppt.customer.phone,
                                type: "REMINDER",
                                channel: "PUSH_FCM",
                                title: `Promemoria: ${selectedAppt.service.name}`,
                                customMessage: `Promemoria appuntamento per ${selectedAppt.service.name} il ${new Date(selectedAppt.startTime).toLocaleDateString("it-IT", { day: "numeric", month: "long" })} alle ore ${new Date(selectedAppt.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`
                              });
                              alert("Notifica Push Firebase inviata con successo al cliente!");
                            } catch (err: any) {
                              alert("Impossibile inviare notifica: " + (err.message || "Errore"));
                            }
                          }}
                          className="flex-1 py-3 sm:py-1.5 px-3 min-h-[48px] sm:min-h-auto bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Invia Push FCM 🔔
                        </button>
                        <a
                          href={`tel:${selectedAppt.customer.phone}`}
                          className="py-3 sm:py-1.5 px-4 min-h-[48px] sm:min-h-auto bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 active:scale-98 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
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
                        className={`py-3 sm:py-2 px-3 min-h-[48px] sm:min-h-auto rounded-xl text-xs font-semibold border text-center transition-all active:scale-98 ${
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
                        className={`py-3 sm:py-2 px-3 min-h-[48px] sm:min-h-auto rounded-xl text-xs font-semibold border text-center transition-all active:scale-98 ${
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
                        className={`py-3 sm:py-2 px-3 min-h-[48px] sm:min-h-auto rounded-xl text-xs font-semibold border text-center transition-all active:scale-98 ${
                          selectedAppt.status === "CANCELLED"
                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                            : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                        }`}
                      >
                        Annullato
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer con opzione Elimina */}
            <div className="p-4 sm:p-6 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
              {!isBlock && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleDeleteAppointment(selectedAppt.id)}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold p-2 transition-colors min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina Definitivamente
                </button>
              )}

              <button
                onClick={() => setSelectedAppt(null)}
                className="px-5 py-2.5 sm:px-4 sm:py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-zinc-100 active:scale-98 shadow-xs min-h-[44px] sm:min-h-auto flex items-center justify-center ml-auto"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* 4. DRAWER: NUOVO APPUNTAMENTO O BLOCCO ORARIO */}
      {isDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 bg-zinc-900/20 backdrop-blur-xs z-40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex items-center justify-between p-6 border-b border-zinc-200/60">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
                  {drawerMode === "APPOINTMENT" ? "Nuovo Appuntamento" : "Blocca Orario Staff"}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {drawerMode === "APPOINTMENT" 
                    ? "Inserisci un nuovo appuntamento in agenda."
                    : "Imposta pause, ferie o permessi del personale."}
                </p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Selector Drawer Mode */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setDrawerMode("APPOINTMENT")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    drawerMode === "APPOINTMENT"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Appuntamento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerMode("BLOCK");
                    if (activeStaff.length > 0 && !blockStaffId) {
                      setBlockStaffId(activeStaff[0].id);
                    }
                    if (!blockDate) {
                      setBlockDate(selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    drawerMode === "BLOCK"
                      ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  Pausa / Ferie / Permesso
                </button>
              </div>
            </div>

            {drawerMode === "APPOINTMENT" ? (
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
            ) : (
              <form onSubmit={handleCreateBlock} className="flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="p-6 space-y-5">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Blocco Atomico Calendario
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Questa fascia oraria verrà bloccata sia in questa agenda che nel wizard di prenotazione online dei clienti.
                    </p>
                  </div>

                  {/* Collaboratore */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Collaboratore / Staff *
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <select
                        required
                        value={blockStaffId}
                        onChange={(e) => setBlockStaffId(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Seleziona collaboratore...</option>
                        {activeStaff.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.fullName} ({st.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Motivo Blocco */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Tipo di Blocco / Motivo *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Pausa Pranzo", icon: "🥪" },
                        { label: "Ferie", icon: "🏖️" },
                        { label: "Permesso Personale", icon: "🕒" },
                        { label: "Formazione / Corso", icon: "📚" },
                        { label: "Altro Blocco", icon: "⏸️" }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setBlockReason(item.label)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all flex items-center gap-2 cursor-pointer ${
                            blockReason === item.label
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                              : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Data *
                    </label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input 
                        type="date" 
                        required
                        value={blockDate}
                        onChange={(e) => setBlockDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Opzione Intera Giornata */}
                  <div className="flex items-center gap-2.5 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="blockIsAllDay"
                      checked={blockIsAllDay}
                      onChange={(e) => setBlockIsAllDay(e.target.checked)}
                      className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                    <label htmlFor="blockIsAllDay" className="text-xs font-semibold text-zinc-800 cursor-pointer select-none">
                      Blocca per l&apos;intera giornata lavorativa (es. Ferie)
                    </label>
                  </div>

                  {/* Orario e Durata (se non intera giornata) */}
                  {!blockIsAllDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                          Ora Inizio *
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                          <input 
                            type="time" 
                            required
                            value={blockStartTime}
                            onChange={(e) => setBlockStartTime(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                          Durata *
                        </label>
                        <select
                          value={blockDurationMinutes}
                          onChange={(e) => setBlockDurationMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                        >
                          <option value={30}>30 minuti</option>
                          <option value={45}>45 minuti</option>
                          <option value={60}>1 ora</option>
                          <option value={90}>1 ora 30 min</option>
                          <option value={120}>2 ore</option>
                          <option value={180}>3 ore</option>
                          <option value={240}>4 ore (mezza giornata)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Note opzionali */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Note Interne (Opzionali)
                    </label>
                    <textarea
                      rows={2}
                      value={blockNotes}
                      onChange={(e) => setBlockNotes(e.target.value)}
                      placeholder="Es. Visita medica, ferie estive concordate..."
                      className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Bottoni submit blocco */}
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
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Coffee className="w-4 h-4" />
                        Conferma Blocco Orario
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </>
      )}

      {/* 5. MODALE PUNTO CASSA (POS) */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        tenantId={salonTenantId || currentUser?.uid || "tenant-default"}
        salonRawId={currentUser?.uid}
        salonName={salonNameState}
        appointmentId={checkoutInitialData?.appointmentId}
        initialCustomerName={checkoutInitialData?.customerName || "Cliente al Banco"}
        initialCustomerPhone={checkoutInitialData?.customerPhone || ""}
        initialItems={checkoutInitialData?.items || []}
        availableStaff={activeStaff}
        onTransactionCompleted={async () => {
          await fetchAppuntamenti();
        }}
      />

      {/* 6. MODALE CHIUSURA CASSA GIORNALIERA (REPORT Z) */}
      <DailyCashClosingModal
        isOpen={isDailyClosingOpen}
        onClose={() => setIsDailyClosingOpen(false)}
        tenantId={salonTenantId || currentUser?.uid || "tenant-default"}
        salonName={salonNameState}
      />

      {/* 7. FLOATING ACTION BUTTON (FAB) PER SMARTPHONE - Posizionato sopra la Bottom Navigation Bar */}
      <button
        onClick={() => {
          setFormDate(selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
          setDrawerMode("APPOINTMENT");
          setIsDrawerOpen(true);
        }}
        className="md:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 w-13 h-13 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xl flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-90 transition-all cursor-pointer border-2 border-white/20 dark:border-zinc-800"
        title="Nuova Prenotazione"
        aria-label="Nuova Prenotazione"
      >
        <Plus className="w-6 h-6" />
      </button>

    </div>
  );
}