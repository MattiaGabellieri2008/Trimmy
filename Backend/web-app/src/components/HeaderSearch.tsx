"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  User, 
  Scissors, 
  Calendar, 
  BarChart2, 
  Settings, 
  X, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Phone, 
  BadgePercent, 
  Layers, 
  CalendarPlus,
  HelpCircle,
  Tag
} from "lucide-react";
import { 
  listCustomers, 
  listStaff,
  ListCustomersData, 
  ListServicesData,
  ListStaffData 
} from "@/dataconnect-generated";
import { dataConnect, auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getSalonTenantId } from "@/lib/tenant-helper";
import { getSalonServices, SalonServiceItem } from "@/lib/services-store";

// Azioni & Pagine rapide del Gestionale con sinonimi/keyword
const SYSTEM_ACTIONS = [
  { title: "Nuovo Appuntamento", category: "Azioni Rapide", href: "/?action=new", icon: CalendarPlus, keywords: ["prenota", "prenotazione", "fissa", "agenda", "orario", "calendario"] },
  { title: "Agenda Giornaliera", category: "Navigazione", href: "/", icon: Calendar, keywords: ["oggi", "calendario", "impegni", "orari", "planning"] },
  { title: "Anagrafica Clienti", category: "Navigazione", href: "/clienti", icon: User, keywords: ["scheda cliente", "rubrica", "contatti", "telefoni", "crm", "fidelizzazione"] },
  { title: "Catalogo Trattamenti & Prezzi", category: "Navigazione", href: "/trattamenti", icon: Scissors, keywords: ["listino", "prezzario", "servizi", "costi", "tariffe", "menu"] },
  { title: "Statistiche & Ricavi", category: "Navigazione", href: "/statistiche", icon: BarChart2, keywords: ["fatturato", "incassi", "guadagni", "report", "kpi", "grafici", "finanza"] },
  { title: "Impostazioni Salone & Team", category: "Navigazione", href: "/impostazioni?tab=salone", icon: Settings, keywords: ["collaboratori", "staff", "orari apertura", "profilo", "account"] }
];

// Suggerimenti popolari quando il campo è vuoto o appena cliccato
const POPULAR_SEARCHES = [
  "Nuovo Appuntamento", "Anagrafica Clienti", "Trattamenti", "Statistiche", "Impostazioni"
];

// Calcolo semplice somiglianza (Levenshtein-based o fuzzy match)
function fuzzyScore(source: string, target: string): number {
  const s = source.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (s === t) return 100;
  if (t.includes(s)) return 80;
  if (s.includes(t)) return 70;

  // Controllo match per parole
  const sWords = s.split(/\s+/);
  const tWords = t.split(/\s+/);
  let matches = 0;
  for (const sw of sWords) {
    if (tWords.some(tw => tw.includes(sw) || sw.includes(tw))) {
      matches++;
    }
  }
  if (matches > 0) return 50 + (matches * 10);

  return 0;
}

export function HeaderSearch() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState<ListCustomersData["customers"]>([]);
  const [services, setServices] = useState<SalonServiceItem[]>([]);
  const [staffList, setStaffList] = useState<ListStaffData["users"]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Caricamento Dati Reali del Salone
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setCurrentUser(user);
      const tenantId = getSalonTenantId(user.uid);
      
      // Carica servizi reali salvati dal salone
      const realServices = getSalonServices(user.uid);
      setServices(realServices);

      try {
        const [cRes, uRes] = await Promise.allSettled([
          listCustomers(dataConnect, { tenantId }),
          listStaff(dataConnect, { tenantId })
        ]);

        if (cRes.status === "fulfilled" && cRes.value.data.customers) {
          setCustomers(cRes.value.data.customers);
        }
        if (uRes.status === "fulfilled" && uRes.value.data.users.length > 0) {
          setStaffList(uRes.value.data.users);
        }
      } catch (err) {
        console.error("Errore caricamento ricerca salone:", err);
      }
    });

    return () => unsub();
  }, []);

  // Chiudi cliccando fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Servizi reali del salone mappati per la ricerca
  const allServices = useMemo(() => {
    return services.map(s => ({
      id: String(s.id),
      name: s.name,
      category: s.category || "Trattamento",
      durationMinutes: s.durationMinutes,
      price: s.price,
      keywords: [s.category.toLowerCase(), "servizio", "trattamento"]
    }));
  }, [services]);

  // Risultati di Ricerca con Punteggio di Pertinenza & Sinonimi
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    // 1. Ricerca Clienti
    const matchedCustomers = customers.filter(c => {
      const text = `${c.firstName} ${c.lastName} ${c.phone} ${c.email || ""} ${c.technicalNotes || ""}`.toLowerCase();
      return text.includes(q);
    }).slice(0, 4);

    // 2. Ricerca Servizi & Trattamenti (anche per parole chiave/sinonimi)
    const matchedServices = allServices.map(s => {
      let score = fuzzyScore(q, s.name);
      if (s.category.toLowerCase().includes(q)) score = Math.max(score, 75);
      if (s.keywords.some(k => k.includes(q) || q.includes(k))) score = Math.max(score, 65);
      return { service: s, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.service)
      .slice(0, 4);

    // 3. Ricerca Pagine & Azioni di Sistema
    const matchedActions = SYSTEM_ACTIONS.map(action => {
      let score = fuzzyScore(q, action.title);
      if (action.keywords.some(k => k.includes(q) || q.includes(k))) score = Math.max(score, 65);
      return { action, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.action)
      .slice(0, 3);

    // 4. Suggerimenti correlati/simili
    const relatedSuggestions: string[] = [];
    if (matchedServices.length > 0) {
      matchedServices.forEach(s => {
        s.keywords.slice(0, 2).forEach(k => {
          if (!relatedSuggestions.includes(k) && !k.toLowerCase().includes(q)) {
            relatedSuggestions.push(k);
          }
        });
      });
    }

    const totalCount = matchedCustomers.length + matchedServices.length + matchedActions.length;

    return {
      customers: matchedCustomers,
      services: matchedServices,
      actions: matchedActions,
      relatedSuggestions: relatedSuggestions.slice(0, 4),
      totalCount
    };
  }, [query, customers, allServices]);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(url);
  };

  const handleApplySuggestion = (text: string) => {
    setQuery(text);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      
      {/* Campo di input integrato */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none" strokeWidth={2} />
        <input 
          type="text" 
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Cerca clienti, trattamenti..." 
          className="w-full pl-9 sm:pl-10 pr-8 sm:pr-9 py-2 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs sm:text-sm placeholder:text-zinc-400 placeholder:truncate focus:outline-none focus:bg-white focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 transition-all shadow-2xs"
        />
        {query && (
          <button 
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors"
            title="Cancella"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Menu a tendina dei Risultati Intelligenti */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-[460px] overflow-y-auto">
          
          {/* A. Stato Vuoto (Consigli di ricerca rapida) */}
          {!query.trim() && (
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                Ricerche consigliate
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SEARCHES.map((item) => (
                  <button
                    key={item}
                    onClick={() => handleApplySuggestion(item)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <p className="text-[11px] text-zinc-400">
                  💡 Puoi cercare per nome cliente, numero telefonico, tipo di trattamento o parola chiave (es. <em>biondo</em>, <em>tinta</em>, <em>orari</em>).
                </p>
              </div>
            </div>
          )}

          {/* B. Risultati Trovati */}
          {searchResults && searchResults.totalCount > 0 && (
            <div className="divide-y divide-zinc-100">
              
              {/* 1. Clienti */}
              {searchResults.customers.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Clienti Trovati
                    </p>
                    <span className="text-[10px] text-zinc-400 font-medium">{searchResults.customers.length}</span>
                  </div>
                  {searchResults.customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelect("/clienti")}
                      className="flex items-center justify-between p-2 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 font-bold flex items-center justify-center text-xs">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-300" />
                            {c.phone}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium group-hover:text-zinc-900 flex items-center gap-0.5">
                        Scheda <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Trattamenti & Servizi */}
              {searchResults.services.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Trattamenti & Servizi
                    </p>
                    <span className="text-[10px] text-zinc-400 font-medium">{searchResults.services.length}</span>
                  </div>
                  {searchResults.services.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelect("/trattamenti")}
                      className="flex items-center justify-between p-2 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center text-xs shrink-0">
                          <Scissors className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950">
                            {s.name}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {s.category} &bull; {s.durationMinutes} min &bull; <strong className="text-zinc-700 font-semibold">€{s.price}</strong>
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium group-hover:text-zinc-900 flex items-center gap-0.5">
                        Listino <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Azioni & Navigazione */}
              {searchResults.actions.length > 0 && (
                <div className="p-2">
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
                    Azioni Rapide
                  </p>
                  {searchResults.actions.map((act) => (
                    <div
                      key={act.title}
                      onClick={() => handleSelect(act.href)}
                      className="flex items-center justify-between p-2 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
                          <act.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950">
                            {act.title}
                          </p>
                          <p className="text-[11px] text-zinc-400">{act.category}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                    </div>
                  ))}
                </div>
              )}

              {/* 4. Parole chiave e argomenti correlati */}
              {searchResults.relatedSuggestions.length > 0 && (
                <div className="p-3 bg-zinc-50/70">
                  <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-zinc-400" />
                    Suggerimenti correlati per &ldquo;{query}&rdquo;:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.relatedSuggestions.map((sug) => (
                      <button
                        key={sug}
                        onClick={() => handleApplySuggestion(sug)}
                        className="px-2 py-0.5 bg-white border border-zinc-200/80 hover:bg-zinc-100 text-zinc-700 text-[11px] font-medium rounded-md shadow-2xs transition-colors cursor-pointer capitalize"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* C. Nessun Risultato Trovato + Suggerimenti Alternativi */}
          {searchResults && searchResults.totalCount === 0 && (
            <div className="p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800">
                  Nessun risultato esatto per &ldquo;{query}&rdquo;
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Prova a cercare per categoria generale o seleziona uno dei suggerimenti:
                </p>
              </div>
              <div className="flex justify-center flex-wrap gap-1.5 pt-1">
                {["Taglio", "Colore", "Clienti", "Agenda", "Piega"].map((item) => (
                  <button
                    key={item}
                    onClick={() => handleApplySuggestion(item)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
