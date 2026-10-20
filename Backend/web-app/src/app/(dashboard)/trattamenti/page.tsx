"use client";

import { useEffect, useState } from "react";
import { Plus, X, MoreHorizontal, Clock, Euro, Users, Sparkles, PlusCircle, Edit2, Trash2, CheckCircle2, Scissors } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  SalonServiceItem, 
  getSalonServices, 
  saveSalonServices, 
  fetchSalonServices,
  DEFAULT_INITIAL_SERVICES 
} from "@/lib/services-store";

const CATEGORIES = ["Tutti", "Taglio & Piega", "Colorazione", "Trattamenti Curativi", "Estetica"];

export default function TrattamentiPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [services, setServices] = useState<SalonServiceItem[]>(() => {
    if (typeof window !== "undefined") {
      const directUid = auth.currentUser?.uid;
      if (directUid) return getSalonServices(directUid);
    }
    return getSalonServices("default");
  });
  const [activeCategory, setActiveCategory] = useState("Tutti");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // State for dropdown menus
  const [openDropdownId, setOpenDropdownId] = useState<number | string | null>(null);

  // State for editing
  const [editingServiceId, setEditingServiceId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Taglio & Piega",
    price: "",
    durationMinutes: "",
    description: ""
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Lettura immediata da cache locale per evitare flickering
        const cached = getSalonServices(user.uid);
        if (cached && cached.length > 0) {
          setServices(cached);
        }
        // Sync con Firestore
        const userServices = await fetchSalonServices(user.uid);
        if (userServices) {
          setServices(userServices);
        }
      }
    });
    return () => unsub();
  }, []);

  const filteredServices = activeCategory === "Tutti" 
    ? services 
    : services.filter(s => s.category === activeCategory);

  const handleDelete = async (id: number | string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo servizio?")) {
      const targetUid = currentUser?.uid || auth.currentUser?.uid || "default";
      const updated = services.filter(s => s.id !== id);
      setServices(updated);
      setOpenDropdownId(null);
      showToast("Servizio rimosso con successo");
      await saveSalonServices(targetUid, updated);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    }
  };

  const handleEdit = (service: SalonServiceItem) => {
    setEditingServiceId(service.id);
    setFormData({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      durationMinutes: service.durationMinutes.toString(),
      description: service.description
    });
    setOpenDropdownId(null);
    setIsDrawerOpen(true);
  };

  const handleCreateNew = () => {
    setEditingServiceId(null);
    setFormData({ name: "", category: "Taglio & Piega", price: "", durationMinutes: "", description: "" });
    setIsDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const targetUid = currentUser?.uid || auth.currentUser?.uid || "default";
    let updated: SalonServiceItem[];

    if (editingServiceId) {
      updated = services.map(s => s.id === editingServiceId ? {
        ...s,
        name: formData.name.trim(),
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        durationMinutes: parseInt(formData.durationMinutes) || 30,
        description: formData.description
      } : s);
      showToast("Trattamento aggiornato con successo! ✨");
    } else {
      const newService: SalonServiceItem = {
        id: "srv-" + Date.now(),
        name: formData.name.trim(),
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        durationMinutes: parseInt(formData.durationMinutes) || 30,
        description: formData.description,
        staffLevels: ["Titolare"],
        relatedServices: []
      };
      updated = [newService, ...services];
      showToast("Nuovo servizio aggiunto e salvato! 🎉");
    }

    setServices(updated);
    setIsDrawerOpen(false);
    await saveSalonServices(targetUid, updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
    }
  };

  return (
    <div 
      className="max-w-7xl mx-auto space-y-8 relative" 
      onClick={() => setOpenDropdownId(null)}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
      
      {/* Intestazione */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-4 border-b border-zinc-200/60">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Trattamenti & Servizi</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Catalogo servizi, prezzario e configurazione delle competenze.
          </p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); handleCreateNew(); }}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Nuovo Servizio
        </button>
      </header>

      {/* Tabs Categorie (Stile Apple) */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={(e) => { e.stopPropagation(); setActiveCategory(category); }}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border shrink-0 ${
              activeCategory === category 
                ? "bg-zinc-900 text-white border-zinc-900 shadow-sm" 
                : "bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Griglia Servizi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredServices.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-zinc-300 rounded-2xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
              <Scissors className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-base">Nessun trattamento presente</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Non hai ancora inserito servizi nel listino. Clicca sul pulsante &ldquo;Nuovo Trattamento&rdquo; per iniziare a personalizzare i tuoi servizi con durata e prezzo.
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aggiungi il tuo primo Trattamento</span>
            </button>
          </div>
        )}

        {filteredServices.map((service) => (
          <div key={service.id} className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative">

            
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 mb-1 block">
                    {service.category}
                  </span>
                  <h3 className="font-semibold text-zinc-900 text-[15px] leading-tight">
                    {service.name}
                  </h3>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === service.id ? null : service.id);
                    }}
                    className={`text-zinc-400 hover:text-zinc-900 p-1 rounded-md hover:bg-zinc-50 transition-colors ${openDropdownId === service.id ? "opacity-100 bg-zinc-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {openDropdownId === service.id && (
                    <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 shadow-lg rounded-md overflow-hidden z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEdit(service); }}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Modifica
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(service.id); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Elimina
                      </button>
                    </div>
                  )}
                </div>

              </div>

              <p className="text-xs text-zinc-500 mb-5 leading-relaxed line-clamp-2">
                {service.description}
              </p>

              {/* Dettagli Base (Prezzo, Durata) */}
              <div className="flex gap-4 mb-5 border-b border-zinc-100 pb-5">
                <div className="flex items-center gap-1.5 text-zinc-900">
                  <Euro className="w-4 h-4 text-zinc-400" />
                  <span className="font-semibold text-sm">{service.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-900">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium">{service.durationMinutes} min</span>
                </div>
              </div>

              {/* Dettagli Operativi CRM (Competenze & Correlati) */}
              <div className="space-y-3">
                {service.staffLevels && service.staffLevels.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-400" /> Competenze richieste
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {service.staffLevels.map(level => (
                        <span key={level} className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">
                          {level}
                        </span>
                      ))}
                    </div>
                  </div>
                )}


                {service.relatedServices && service.relatedServices.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Proponi con
                    </div>
                    <div className="flex flex-col gap-1">
                      {service.relatedServices.map(rel => (
                        <div key={rel} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <PlusCircle className="w-3 h-3 text-zinc-300" /> {rel}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Overlay Sfondo (per Drawer) */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Nuovo/Modifica Servizio */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-zinc-200/60 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">
            {editingServiceId ? "Modifica Servizio" : "Aggiungi Servizio"}
          </h2>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded-md hover:bg-zinc-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Dettagli Principali</h3>
            
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Nome Servizio</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all placeholder:text-zinc-400" 
                placeholder="Es. Taglio Uomo" 
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Categoria</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all bg-white"
              >
                <option>Taglio & Piega</option>
                <option>Colorazione</option>
                <option>Estetica</option>
                <option>Trattamenti Curativi</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Prezzo (€)</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                  <input 
                    type="number" 
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all placeholder:text-zinc-400" 
                    placeholder="0.00" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Durata (Min)</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                  <input 
                    type="number" 
                    step="5" 
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({...formData, durationMinutes: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all placeholder:text-zinc-400" 
                    placeholder="30" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Descrizione Pubblica</label>
              <textarea 
                rows={3} 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all resize-none placeholder:text-zinc-400" 
                placeholder="Descrizione visibile al cliente..."
              ></textarea>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-6 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Impostazioni Operative</h3>
            
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Chi può eseguirlo? (Livello Staff)</label>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" /> Junior
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" defaultChecked /> Senior
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Servizi da consigliare (Upselling)</label>
              <input type="text" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all placeholder:text-zinc-400" placeholder="Cerca trattamenti..." />
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-md transition-colors shadow-sm"
          >
            Annulla
          </button>
          <button 
            onClick={handleSave}
            disabled={!formData.name}
            className="px-6 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-md transition-colors shadow-sm"
          >
            Salva Servizio
          </button>
        </div>
      </div>

    </div>
  );
}
