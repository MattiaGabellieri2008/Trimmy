"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_TEMPLATES, ServiceTemplate } from "@/lib/onboarding-templates";
import { Check, ChevronRight, Euro, Clock, User, Scissors, Building, ArrowRight, X } from "lucide-react";

type SetupData = {
  salonName: string;
  businessCategory: string;
  services: Array<ServiceTemplate & { price: string; duration: string }>;
  staffName: string;
  staffRole: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [data, setData] = useState<SetupData>({
    salonName: "",
    businessCategory: "Parrucchiere",
    services: [],
    staffName: "",
    staffRole: "Proprietario / Senior Stylist",
  });

  const handleCategorySelect = (category: string) => {
    setData(prev => ({
      ...prev,
      businessCategory: category,
      // Pre-popola l'array di servizi con quelli del template selezionato
      services: ONBOARDING_TEMPLATES[category].map(s => ({
        ...s,
        price: "",
        duration: "30",
      }))
    }));
  };

  const handleServiceChange = (index: number, field: "price" | "duration", value: string) => {
    const newServices = [...data.services];
    newServices[index][field] = value;
    setData(prev => ({ ...prev, services: newServices }));
  };

  const removeService = (index: number) => {
    const newServices = [...data.services];
    newServices.splice(index, 1);
    setData(prev => ({ ...prev, services: newServices }));
  };

  const canProceedStep1 = data.salonName.trim() !== "";
  // Check if all prices are filled
  const canProceedStep2 = data.services.every(s => s.price.trim() !== "");
  const canProceedStep3 = data.staffName.trim() !== "";

  const finishOnboarding = async () => {
    setIsSubmitting(true);
    // Qui andrebbe la chiamata a Firebase (aggiornamento Tenant, inserimento servizi e staff)
    // Es. updateTenantMutation({ id: tenantId, businessCategory: data.businessCategory })
    
    // Simulazione rete
    await new Promise(r => setTimeout(r, 1500));
    
    // Redirect forzato alla Dashboard
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
          Benvenuto su Gestionale Saloni
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Configuriamo il tuo spazio di lavoro in 3 semplici step.
        </p>

        {/* Progress Bar Minimalista */}
        <div className="mt-8 flex justify-center items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-16 rounded-full transition-colors ${step >= s ? "bg-zinc-900" : "bg-zinc-200"}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-zinc-200/60">
          
          {/* STEP 1: Salone & Categoria */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-lg font-semibold text-zinc-900">1. Il tuo Business</h3>
                <p className="text-sm text-zinc-500">Come si chiama la tua attività e a quale categoria appartiene?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nome del Salone</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-5 h-5 text-zinc-400" />
                  <input 
                    type="text" 
                    value={data.salonName}
                    onChange={(e) => setData({...data, salonName: e.target.value})}
                    className="w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900" 
                    placeholder="Es. Glamour Studio" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-3">Categoria Principale</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.keys(ONBOARDING_TEMPLATES).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategorySelect(cat)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium border text-center transition-all ${
                        data.businessCategory === cat 
                          ? "bg-zinc-900 text-white border-zinc-900 ring-2 ring-zinc-900 ring-offset-1" 
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => {
                  if (data.services.length === 0) handleCategorySelect(data.businessCategory);
                  setStep(2);
                }}
                disabled={!canProceedStep1}
                className="w-full flex justify-center items-center gap-2 bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed mt-8 transition-colors"
              >
                Avanti <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Configurazione Listino Prezzi */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-lg font-semibold text-zinc-900">2. Crea il Listino</h3>
                <p className="text-sm text-zinc-500">Abbiamo preparato i servizi più comuni per la categoria <b>{data.businessCategory}</b>. Inserisci i tuoi prezzi e tempi (o rimuovi quelli che non fai).</p>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {data.services.map((service, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 relative group">
                    <button 
                      onClick={() => removeService(idx)}
                      className="absolute -top-2 -right-2 bg-white border border-zinc-200 text-zinc-400 hover:text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    
                    <div className="mb-3">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 block mb-0.5">{service.category}</span>
                      <h4 className="font-semibold text-sm text-zinc-900">{service.name}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Prezzo (€)</label>
                        <div className="relative">
                          <Euro className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-400" />
                          <input 
                            type="number" 
                            value={service.price}
                            onChange={(e) => handleServiceChange(idx, "price", e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 border border-zinc-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 bg-white" 
                            placeholder="0.00" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Durata (Min)</label>
                        <div className="relative">
                          <Clock className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-400" />
                          <input 
                            type="number" 
                            value={service.duration}
                            onChange={(e) => handleServiceChange(idx, "duration", e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 border border-zinc-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 bg-white" 
                            placeholder="30" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {data.services.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 text-sm">
                    Nessun servizio selezionato. Potrai aggiungerli in seguito.
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                >
                  Indietro
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2 && data.services.length > 0}
                  className="flex-1 flex justify-center items-center gap-2 bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  Avanti <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Primo Dipendente */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-lg font-semibold text-zinc-900">3. Il tuo Profilo</h3>
                <p className="text-sm text-zinc-500">Imposta il profilo del primo membro dello staff, in modo da poter ricevere subito le prenotazioni.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Il tuo Nome / Nome d&apos;arte</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-5 h-5 text-zinc-400" />
                  <input 
                    type="text" 
                    value={data.staffName}
                    onChange={(e) => setData({...data, staffName: e.target.value})}
                    className="w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900" 
                    placeholder="Es. Marco o Francesca" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ruolo (Visibile ai clienti)</label>
                <div className="relative">
                  <Scissors className="absolute left-3 top-2.5 w-5 h-5 text-zinc-400" />
                  <input 
                    type="text" 
                    value={data.staffRole}
                    onChange={(e) => setData({...data, staffRole: e.target.value})}
                    className="w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900" 
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                >
                  Indietro
                </button>
                <button 
                  onClick={finishOnboarding}
                  disabled={!canProceedStep3 || isSubmitting}
                  className="flex-1 flex justify-center items-center gap-2 bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Completamento...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Vai alla Dashboard <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
