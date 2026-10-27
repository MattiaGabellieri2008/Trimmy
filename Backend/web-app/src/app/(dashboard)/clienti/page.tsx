"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Plus, 
  X, 
  Phone, 
  Mail, 
  CalendarPlus, 
  MessageCircle, 
  Loader2, 
  Calendar, 
  Users, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck,
  Clock,
  UserCheck,
  Scissors,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { dataConnect, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getSalonTenantId, ensureSalonTenant } from "@/lib/tenant-helper";
import { 
  listCustomers, 
  createCustomer, 
  getCustomerDetails,
  ListCustomersData, 
  GetCustomerDetailsData 
} from "../../../dataconnect-generated";
import { 
  fetchSalonCustomers, 
  saveSalonCustomer, 
  deleteSalonCustomer,
  normalizeCustomerPhone,
  normalizeCustomerEmail,
  deduplicateCustomersList 
} from "@/lib/customers-store";
import { fetchSalonServices, SalonServiceItem } from "@/lib/services-store";
import { fetchSalonStaff, StaffMemberItem } from "@/lib/staff-store";
import { saveSalonAppointment, UnifiedAppointmentItem, SlotConflictError } from "@/lib/appointments-service";
import { sendNotification } from "@/lib/notifications-service";
import { fetchUserProfile } from "@/lib/user-profile";
import { parseDateSafe } from "@/lib/date-utils";

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
];

export default function ClientiPage() {
  const [salonTenantId, setSalonTenantId] = useState<string>("");
  const [customers, setCustomers] = useState<ListCustomersData["customers"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer states
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  
  // New Customer form
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    birthday: "",
    technicalNotes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected customer details
  const [selectedCustomer, setSelectedCustomer] = useState<GetCustomerDetailsData["customer"] | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "info"; linkUrl?: string; linkLabel?: string } | null>(null);

  // Booking Drawer states & resources
  const [bookingCustomer, setBookingCustomer] = useState<{ id: string; firstName: string; lastName: string; phone: string; email?: string | null } | null>(null);
  const [services, setServices] = useState<SalonServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMemberItem[]>([]);
  const [salonName, setSalonName] = useState<string>("Salone");

  const [bookingServiceId, setBookingServiceId] = useState<string>("");
  const [bookingStaffId, setBookingStaffId] = useState<string>("");
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingTime, setBookingTime] = useState<string>("10:00");
  const [bookingNotes, setBookingNotes] = useState<string>("");
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [todayDate, setTodayDate] = useState<string>("");

  const fetchCustomers = async (tenantId: string, alternateId?: string) => {
    if (!tenantId) return;
    try {
      const list = await fetchSalonCustomers(tenantId, alternateId || auth.currentUser?.uid);
      const deduplicated = deduplicateCustomersList(list);
      setCustomers(
        deduplicated.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email || undefined,
          birthday: c.birthday || undefined,
          technicalNotes: c.technicalNotes || undefined
        }))
      );
    } catch (e) {
      console.error("Errore recupero clienti:", e);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTodayDate(new Date().toISOString().split("T")[0]);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tid = getSalonTenantId(user.uid);
        setSalonTenantId(tid);
        await ensureSalonTenant(user.uid, user.displayName || "Il Mio Salone");
        fetchCustomers(tid, user.uid);

        // Carica listino servizi, collaboratori e profilo salone per il booking immediato
        fetchSalonServices(tid).then((srvs) => {
          setServices(srvs);
          if (srvs.length > 0) setBookingServiceId(String(srvs[0].id));
        });
        fetchSalonStaff(tid).then((stfs) => {
          setStaffList(stfs);
          if (stfs.length > 0) setBookingStaffId(stfs[0].id);
        });
        fetchUserProfile(user.uid).then((prof) => {
          if (prof?.salonName) setSalonName(prof.salonName);
        });
      } else {
        setIsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Ascolto in tempo reale degli aggiornamenti (es. prenotazioni cliente)
  useEffect(() => {
    const handleUpdate = () => {
      if (salonTenantId) {
        fetchCustomers(salonTenantId, auth.currentUser?.uid);
        fetchSalonServices(salonTenantId).then(setServices);
        fetchSalonStaff(salonTenantId).then(setStaffList);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("trimmy-data-updated", handleUpdate);
      return () => {
        window.removeEventListener("trimmy-data-updated", handleUpdate);
      };
    }
  }, [salonTenantId]);

  const handleOpenBooking = (customer: { id: string; firstName: string; lastName: string; phone: string; email?: string | null }) => {
    setBookingCustomer(customer);
    if (services.length > 0) {
      setBookingServiceId(String(services[0].id));
    }
    if (staffList.length > 0) {
      setBookingStaffId(staffList[0].id);
    } else if (auth.currentUser?.uid) {
      setBookingStaffId(auth.currentUser.uid);
    }
    const today = new Date().toISOString().split("T")[0];
    setBookingDate(today);
    setBookingTime("10:00");
    setBookingNotes("");
    setBookingError(null);
    setIsDetailsDrawerOpen(false);
    setIsNewDrawerOpen(false);
    setIsBookingDrawerOpen(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCustomer || !salonTenantId) return;

    if (!bookingServiceId || !bookingDate || !bookingTime) {
      setBookingError("Seleziona servizio, data e orario per confermare l'appuntamento.");
      return;
    }

    setIsBookingSubmitting(true);
    setBookingError(null);

    try {
      const selectedService = services.find((s) => String(s.id) === String(bookingServiceId));
      const duration = selectedService?.durationMinutes || 30;
      const price = selectedService?.price || 0;
      const srvName = selectedService?.name || "Trattamento";

      const [hours, minutes] = bookingTime.split(":").map(Number);
      const start = parseDateSafe(bookingDate);
      start.setHours(hours, minutes, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);

      const staffObj = staffList.find((st) => st.id === bookingStaffId);
      const staffName = staffObj?.fullName || auth.currentUser?.displayName || "Staff";
      const staffId = staffObj?.id || auth.currentUser?.uid || "staff-general";

      const apptId = `appt-${Date.now()}`;

      const newAppt: UnifiedAppointmentItem = {
        id: apptId,
        tenantId: salonTenantId,
        salonRawId: salonTenantId,
        salonName: salonName || "Salone",
        customerId: bookingCustomer.id,
        customer: {
          id: bookingCustomer.id,
          firstName: bookingCustomer.firstName,
          lastName: bookingCustomer.lastName,
          phone: bookingCustomer.phone,
          email: bookingCustomer.email || null
        },
        serviceId: String(bookingServiceId),
        service: {
          id: String(bookingServiceId),
          name: srvName,
          durationMinutes: duration,
          price: price
        },
        staffId: staffId,
        staff: {
          id: staffId,
          fullName: staffName
        },
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
        notes: bookingNotes || undefined,
        price: price
      };

      // 1. Salva appuntamento con transazione atomica anti-double booking
      await saveSalonAppointment(newAppt);

      // 2. Invia notifica Push FCM
      try {
        await sendNotification({
          tenantId: salonTenantId,
          salonName: salonName,
          appointmentId: apptId,
          customerName: `${bookingCustomer.firstName} ${bookingCustomer.lastName}`,
          customerPhone: bookingCustomer.phone,
          type: "CONFIRMATION",
          channel: "PUSH_FCM",
          title: `Prenotazione Confermata: ${srvName}`,
          customMessage: `Ciao ${bookingCustomer.firstName}, il tuo appuntamento per ${srvName} è confermato per ${start.toLocaleDateString("it-IT", { day: "numeric", month: "long" })} alle ore ${bookingTime} (${staffName}).`
        });
      } catch (notifErr) {
        console.warn("Nota invio notifica:", notifErr);
      }

      setIsBookingDrawerOpen(false);
      setActionMessage({
        text: `Appuntamento confermato per ${bookingCustomer.firstName} ${bookingCustomer.lastName} il ${start.toLocaleDateString("it-IT", { day: "numeric", month: "long" })} alle ${bookingTime} (${srvName})!`,
        type: "success",
        linkUrl: "/",
        linkLabel: "Vedi in Agenda 📅"
      });
      setTimeout(() => setActionMessage(null), 8000);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err: any) {
      console.error("Errore salvataggio appuntamento:", err);
      if (err instanceof SlotConflictError || err?.code === "SLOT_CONFLICT") {
        setBookingError("Questo orario è già occupato per questo collaboratore. Seleziona un altro orario o un altro membro dello staff.");
      } else {
        setBookingError(err?.message || "Impossibile salvare l'appuntamento. Riprova.");
      }
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!formData.firstName || !formData.lastName || !formData.phone || !salonTenantId) return;
    setIsSubmitting(true);
    try {
      const cleanPhone = normalizeCustomerPhone(formData.phone);
      const cleanEmail = normalizeCustomerEmail(formData.email);
      const existingMatch = customers.find((c) => {
        if (cleanPhone && cleanPhone.length >= 7 && normalizeCustomerPhone(c.phone) === cleanPhone) return true;
        if (cleanEmail && cleanEmail.includes("@") && c.email && normalizeCustomerEmail(c.email) === cleanEmail) return true;
        const sameName = `${c.firstName} ${c.lastName}`.trim().toLowerCase() === `${formData.firstName} ${formData.lastName}`.trim().toLowerCase();
        if (sameName && (normalizeCustomerPhone(c.phone) === cleanPhone || !c.phone || !cleanPhone)) return true;
        return false;
      });

      await saveSalonCustomer(salonTenantId, {
        id: existingMatch?.id, // Se già esistente, aggiorna in-place senza creare duplicati
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email || null,
        birthday: formData.birthday || null,
        technicalNotes: formData.technicalNotes || null
      }, auth.currentUser?.uid);

      setIsNewDrawerOpen(false);
      setFormData({ firstName: "", lastName: "", phone: "", email: "", birthday: "", technicalNotes: "" });
      await fetchCustomers(salonTenantId, auth.currentUser?.uid);

      if (existingMatch) {
        setActionMessage({
          text: `Cliente "${formData.firstName} ${formData.lastName}" già presente: scheda aggiornata e unificata senza duplicati.`,
          type: "info"
        });
      } else {
        setActionMessage({
          text: `Nuovo cliente "${formData.firstName} ${formData.lastName}" salvato con successo!`,
          type: "success"
        });
      }

      setTimeout(() => setActionMessage(null), 4000);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (e) {
      console.error("Errore salvataggio cliente:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!customerId || !salonTenantId) return;
    const targetCust = customers.find((c) => c.id === customerId);
    const name = targetCust ? `${targetCust.firstName} ${targetCust.lastName}` : "questo cliente";
    
    if (!confirm(`Sei sicuro di voler eliminare l'anagrafica di ${name}? L'operazione non può essere annullata.`)) {
      return;
    }

    setIsDeletingCustomer(true);
    try {
      await deleteSalonCustomer(salonTenantId, customerId, auth.currentUser?.uid);
      setIsDetailsDrawerOpen(false);
      setSelectedCustomer(null);
      await fetchCustomers(salonTenantId, auth.currentUser?.uid);
      setActionMessage({
        text: `Scheda cliente "${name}" eliminata con successo.`,
        type: "success"
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      console.error("Errore eliminazione cliente:", err);
      alert("Impossibile eliminare il cliente. Riprova più tardi.");
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const handleCustomerClick = async (customerId: string) => {
    setIsDetailsDrawerOpen(true);
    setIsLoadingDetails(true);
    try {
      const res = await getCustomerDetails(dataConnect, { customerId });
      if (res.data?.customer) {
        setSelectedCustomer(res.data.customer);
      } else {
        const found = customers.find((c) => c.id === customerId);
        if (found) {
          setSelectedCustomer({
            id: found.id,
            tenantId: salonTenantId,
            firstName: found.firstName,
            lastName: found.lastName,
            phone: found.phone,
            email: found.email || null,
            birthday: found.birthday || null,
            technicalNotes: found.technicalNotes || null,
            pastAppointments: []
          });
        }
      }
    } catch (e) {
      console.error(e);
      const found = customers.find((c) => c.id === customerId);
      if (found) {
        setSelectedCustomer({
          id: found.id,
          tenantId: salonTenantId,
          firstName: found.firstName,
          lastName: found.lastName,
          phone: found.phone,
          email: found.email || null,
          birthday: found.birthday || null,
          technicalNotes: found.technicalNotes || null,
          pastAppointments: []
        });
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 relative">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Clienti</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Zero Duplicati
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Gestisci anagrafiche, storico e note tecniche • <span className="font-semibold text-zinc-700">{customers.length}</span> {customers.length === 1 ? "cliente registrato" : "clienti registrati"}
          </p>
        </div>
        <button 
          onClick={() => setIsNewDrawerOpen(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Nuovo Cliente
        </button>
      </header>

      {/* FEEDBACK BANNER */}
      {actionMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-all shadow-xs ${
          actionMessage.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          <div className="flex items-center gap-2.5 text-sm font-medium flex-wrap">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage.text}</span>
            {actionMessage.linkUrl && (
              <Link 
                href={actionMessage.linkUrl}
                className="ml-2 inline-flex items-center gap-1 font-semibold underline text-emerald-950 hover:text-black"
              >
                {actionMessage.linkLabel || "Vedi in Agenda 📅"}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer) => (
            <div 
              key={customer.id} 
              onClick={() => handleCustomerClick(customer.id)}
              className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-semibold text-sm text-zinc-600 uppercase">
                      {customer.firstName[0]}{customer.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                        {customer.firstName} {customer.lastName}
                      </h3>
                      {customer.birthday && (
                        <div className="mt-1 text-[11px] font-medium text-zinc-500">
                           Compleanno: {customer.birthday}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomer(customer.id);
                    }}
                    title="Elimina scheda cliente"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-1.5 mb-5">
                  <div className="flex items-center gap-2 text-[13px] text-zinc-600">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" /> {customer.phone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-[13px] text-zinc-600">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" /> {customer.email}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-100 flex gap-2">
                <button 
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900 text-white text-[13px] font-medium rounded-md hover:bg-zinc-800 transition-colors shadow-sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBooking({
                      id: customer.id,
                      firstName: customer.firstName,
                      lastName: customer.lastName,
                      phone: customer.phone,
                      email: customer.email || null
                    });
                  }}
                >
                  <CalendarPlus className="w-4 h-4" /> Prenota
                </button>
                {customer.phone ? (
                  <a 
                    href={`tel:${customer.phone}`}
                    className="flex items-center justify-center p-2 text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors shadow-2xs" 
                    title={`Chiama ${customer.phone}`} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                ) : (
                  <button className="flex items-center justify-center p-2 text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-md cursor-not-allowed" title="Nessun numero di telefono" onClick={(e) => e.stopPropagation()}>
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="col-span-full py-16 px-6 text-center bg-white border border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center max-w-lg mx-auto my-6">
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-zinc-400 mb-4 shadow-xs">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900">Nessun cliente registrato</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Non ci sono ancora clienti registrati nel tuo database. Inserisci la tua prima anagrafica o attendi le prenotazioni online dall&apos;area clienti.
              </p>
              <button
                onClick={() => setIsNewDrawerOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Aggiungi il tuo primo cliente
              </button>
            </div>
          )}
        </div>
      )}

      {/* OVERLAY */}
      {(isNewDrawerOpen || isDetailsDrawerOpen || isBookingDrawerOpen) && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => {
            setIsNewDrawerOpen(false);
            setIsDetailsDrawerOpen(false);
            setIsBookingDrawerOpen(false);
          }}
        />
      )}

      {/* NEW CUSTOMER DRAWER */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-zinc-200/60 ${isNewDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Nuovo Cliente</h2>
          <button onClick={() => setIsNewDrawerOpen(false)} className="text-zinc-400 hover:text-zinc-900 p-1 rounded-md hover:bg-zinc-50"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Anagrafica Base</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Nome *</label>
                <input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} type="text" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none" placeholder="Mario" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Cognome *</label>
                <input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} type="text" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none" placeholder="Rossi" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Telefono *</label>
              <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} type="tel" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none" placeholder="+39 000 0000000" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Email</label>
              <input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} type="email" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none" placeholder="cliente@email.com" />
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-6 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Dettagli Aggiuntivi</h3>
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Compleanno</label>
              <input value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})} type="date" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-700 focus:ring-1 focus:ring-zinc-900 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Note Tecniche (Formule, Preferenze)</label>
              <textarea value={formData.technicalNotes} onChange={(e) => setFormData({...formData, technicalNotes: e.target.value})} rows={3} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none resize-none" placeholder="Es. Tinta biondo cenere 8.1..."></textarea>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
          <button onClick={() => setIsNewDrawerOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-md shadow-sm">Annulla</button>
          <button onClick={handleSaveCustomer} disabled={isSubmitting || !formData.firstName || !formData.lastName || !formData.phone} className="px-6 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-md shadow-sm flex items-center gap-2">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Salva
          </button>
        </div>
      </div>

      {/* CUSTOMER DETAILS DRAWER */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[460px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-zinc-200/60 ${isDetailsDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Scheda Cliente</h2>
          <button onClick={() => setIsDetailsDrawerOpen(false)} className="text-zinc-400 hover:text-zinc-900 p-1 rounded-md hover:bg-zinc-50"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingDetails || !selectedCustomer ? (
            <div className="flex justify-center mt-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
          ) : (
            <div className="space-y-8">
              {/* Header Profilo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center font-semibold text-xl uppercase">
                  {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {selectedCustomer.phone}</span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <a
                        href={`tel:${selectedCustomer.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Chiama {selectedCustomer.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Box Note Tecniche */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Note Tecniche</h3>
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 text-sm text-amber-900">
                  {selectedCustomer.technicalNotes ? selectedCustomer.technicalNotes : <span className="text-amber-700/60 italic">Nessuna nota tecnica registrata.</span>}
                </div>
              </div>

              {/* Box Dettagli */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-zinc-900 truncate">{selectedCustomer.email || "-"}</p>
                </div>
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Compleanno</p>
                  <p className="text-sm font-medium text-zinc-900">{selectedCustomer.birthday || "-"}</p>
                </div>
              </div>

              {/* Storico Appuntamenti */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Storico Appuntamenti
                </h3>
                <div className="space-y-3">
                  {selectedCustomer.pastAppointments && selectedCustomer.pastAppointments.length > 0 ? (
                    selectedCustomer.pastAppointments.map((apt) => (
                      <div key={apt.id} className="p-3 border border-zinc-200/60 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{apt.service.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {new Date(apt.startTime).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-zinc-900">€{apt.service.price}</p>
                          <span className="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{apt.status}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 italic">Nessun appuntamento precedente.</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="p-6 border-t border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/50">
            <button
              type="button"
              onClick={() => handleDeleteCustomer(selectedCustomer.id)}
              disabled={isDeletingCustomer}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeletingCustomer ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Elimina
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg shadow-2xs"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenBooking({
                    id: selectedCustomer.id,
                    firstName: selectedCustomer.firstName,
                    lastName: selectedCustomer.lastName,
                    phone: selectedCustomer.phone,
                    email: selectedCustomer.email || null
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-sm transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Prenota
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOOKING DRAWER */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-zinc-200/60 ${isBookingDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Prenota Appuntamento</h2>
              <p className="text-xs text-zinc-500">
                Registra in agenda per questo cliente
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setIsBookingDrawerOpen(false)} 
            className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmBooking} className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Box Cliente Selezionato */}
            {bookingCustomer && (
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-zinc-900 text-white font-semibold text-sm flex items-center justify-center uppercase shrink-0 shadow-2xs">
                  {bookingCustomer.firstName[0]}{bookingCustomer.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Cliente</p>
                  <h4 className="text-sm font-semibold text-zinc-900 truncate">
                    {bookingCustomer.firstName} {bookingCustomer.lastName}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-600">
                    <Phone className="w-3 h-3 text-zinc-400" />
                    <span>{bookingCustomer.phone}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Errore Booking */}
            {bookingError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* Selezione Servizio */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-zinc-500" /> Servizio / Trattamento *
                </span>
                {services.length === 0 && (
                  <Link href="/servizi" className="text-[11px] text-zinc-500 underline font-normal">
                    Configura listino
                  </Link>
                )}
              </label>

              {services.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {services.map((srv) => {
                    const isSelected = String(srv.id) === String(bookingServiceId);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setBookingServiceId(String(srv.id))}
                        className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                            : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{srv.name}</p>
                          <p className={`text-xs mt-0.5 flex items-center gap-1 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                            <Clock className="w-3 h-3" /> {srv.durationMinutes || 30} min
                          </p>
                        </div>
                        <span className={`text-sm font-semibold ${isSelected ? "text-emerald-300" : "text-zinc-900"}`}>
                          €{srv.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-center">
                  <p className="text-xs text-zinc-500">Nessun servizio nel listino.</p>
                  <input
                    type="text"
                    placeholder="Nome servizio (es. Taglio & Piega)"
                    value={bookingServiceId}
                    onChange={(e) => setBookingServiceId(e.target.value)}
                    className="mt-2 w-full border border-zinc-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Selezione Collaboratore */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Collaboratore / Operatore
              </label>
              {staffList.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {staffList.map((st) => {
                    const isSelected = st.id === bookingStaffId;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setBookingStaffId(st.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                            : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 uppercase ${
                          isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
                        }`}>
                          {st.fullName[0]}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold truncate">{st.fullName}</p>
                          <p className={`text-[10px] truncate ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{st.role || "Staff"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-zinc-400" />
                  <span>Assegnato al titolare del salone</span>
                </div>
              )}
            </div>

            {/* Data e Orario */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Data Appuntamento *
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={todayDate || undefined}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Orario *
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-1 border border-zinc-100 rounded-xl bg-zinc-50/50">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = bookingTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setBookingTime(slot)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg text-center transition-all ${
                          isSelected
                            ? "bg-zinc-900 text-white shadow-2xs font-semibold"
                            : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200/60"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Note Aggiuntive */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Note o Richieste Speciali
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                rows={2}
                placeholder="Es. Richiesta sfumatura morbida, cliente preferisce shampoo delicato..."
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-zinc-900 outline-none resize-none"
              />
            </div>

            {/* Badge Notifica Push */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Notifica istantanea FCM e sincronizzazione automatica in agenda inclusa.</span>
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsBookingDrawerOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl shadow-2xs transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isBookingSubmitting || !bookingServiceId || !bookingDate || !bookingTime}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-2 transition-colors"
            >
              {isBookingSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  Conferma Appuntamento
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
