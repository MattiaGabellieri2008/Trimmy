"use client";

import { useState, useEffect } from "react";
import { Plus, X, Phone, Mail, CalendarPlus, MessageCircle, Loader2, Calendar, Users } from "lucide-react";
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
import { fetchSalonCustomers, saveSalonCustomer } from "@/lib/customers-store";

export default function ClientiPage() {
  const [salonTenantId, setSalonTenantId] = useState<string>("");
  const [customers, setCustomers] = useState<ListCustomersData["customers"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer states
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  
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

  const fetchCustomers = async (tenantId: string, alternateId?: string) => {
    if (!tenantId) return;
    try {
      const list = await fetchSalonCustomers(tenantId, alternateId || auth.currentUser?.uid);
      setCustomers(
        list.map((c) => ({
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tid = getSalonTenantId(user.uid);
        setSalonTenantId(tid);
        await ensureSalonTenant(user.uid, user.displayName || "Il Mio Salone");
        fetchCustomers(tid, user.uid);
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
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("trimmy-data-updated", handleUpdate);
      return () => {
        window.removeEventListener("trimmy-data-updated", handleUpdate);
      };
    }
  }, [salonTenantId]);

  const handleSaveCustomer = async () => {
    if (!formData.firstName || !formData.lastName || !formData.phone || !salonTenantId) return;
    setIsSubmitting(true);
    try {
      await saveSalonCustomer(salonTenantId, {
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (e) {
      console.error("Errore salvataggio cliente:", e);
    } finally {
      setIsSubmitting(false);
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
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Clienti</h2>
          <p className="text-sm text-zinc-500 mt-1">Gestisci anagrafiche, storico e note tecniche.</p>
        </div>
        <button 
          onClick={() => setIsNewDrawerOpen(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Nuovo Cliente
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer) => (
            <div 
              key={customer.id} 
              onClick={() => handleCustomerClick(customer.id)}
              className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
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
                <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900 text-white text-[13px] font-medium rounded-md hover:bg-zinc-800 transition-colors shadow-sm" onClick={(e) => e.stopPropagation()}>
                  <CalendarPlus className="w-4 h-4" /> Prenota
                </button>
                <button className="flex items-center justify-center p-2 text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-md hover:bg-zinc-200 transition-colors" title="Invia Messaggio" onClick={(e) => e.stopPropagation()}>
                  <MessageCircle className="w-4 h-4" />
                </button>
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
      {(isNewDrawerOpen || isDetailsDrawerOpen) && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => { setIsNewDrawerOpen(false); setIsDetailsDrawerOpen(false); }}
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
      </div>

    </div>
  );
}
