"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { getUserProfile, fetchUserProfile, updateUserProfile, UserProfile } from "@/lib/user-profile";
import { addSalonNotification } from "@/lib/salon-notifications";
import { 
  Scissors, 
  Check, 
  Sparkles, 
  CreditCard, 
  LogOut, 
  Loader2, 
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar
} from "lucide-react";

export default function AbbonamentoProPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState<"MEDIUM" | "PRO">("PRO");
  const [isActivating, setIsActivating] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUser(user);
        let p = await fetchUserProfile(user.uid) || getUserProfile(user.uid);
        setProfile(p);

        // Se l'utente è un cliente, rimandalo alla sua area
        if (p && p.role === "cliente") {
          router.push("/cliente");
          return;
        }

        // Preseleziona il piano più naturale per l'upgrade
        if (p?.planType === "MEDIUM") {
          setSelectedPlan("PRO");
        } else if (p?.planType === "FREE") {
          setSelectedPlan("MEDIUM");
        }

        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const currentPlan = profile?.planType || (profile?.staffCount && profile.staffCount > 3 ? "PRO" : profile?.staffCount && profile.staffCount > 1 ? "MEDIUM" : "FREE");
  const staffCount = profile?.staffCount || 1;
  const salonName = profile?.salonName || "Il tuo Salone";

  const handleUpgrade = async (targetPlan: "MEDIUM" | "PRO") => {
    if (!currentUser) return;
    setIsActivating(true);

    // Simulazione transazione Stripe / Firebase
    await new Promise((r) => setTimeout(r, 1000));

    const newStaffCount = targetPlan === "PRO" ? Math.max(staffCount, 4) : Math.max(staffCount, 3);

    updateUserProfile(currentUser.uid, {
      planType: targetPlan,
      planStatus: "ACTIVE",
      billingPeriod: billingCycle,
      staffCount: newStaffCount
    });

    addSalonNotification(currentUser.uid, {
      id: `plan-upgrade-${Date.now()}`,
      title: `Piano ${targetPlan} Attivato! 🚀`,
      description: `Il tuo salone è ora attivo con il piano ${targetPlan}. Tutte le funzionalità premium e collaboratori sono abilitati.`,
      time: "Adesso",
      type: "system",
      link: "/abbonamento-pro"
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
    }

    setUpgradeSuccess(true);
    setIsActivating(false);

    // Reindirizzamento all'agenda come da specifica utente
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-zinc-900 flex flex-col selection:bg-zinc-200">
      {/* Header */}
      <header className="h-16 bg-white border-b border-zinc-200/60 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Torna all'Agenda"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Torna all&apos;Agenda</span>
          </button>

          <div className="h-4 w-px bg-zinc-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-900">Trimmy SaaS</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
            <span>Salone: <strong>{salonName}</strong></span>
            <span>•</span>
            <span>Piano Attuale: <strong className="text-zinc-900 uppercase">{currentPlan}</strong></span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Esci</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 space-y-8 flex flex-col justify-center">
        
        {/* Banner Notifica Successo Upgrade */}
        {upgradeSuccess && (
          <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
              <div>
                <p className="font-bold text-sm">Upgrade completato con successo!</p>
                <p className="text-xs text-emerald-100 mt-0.5">Il tuo salone è ora abilitato al nuovo piano. Reindirizzamento all&apos;agenda in corso...</p>
              </div>
            </div>
            <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
          </div>
        )}

        {/* Intestazione e Switcher Mensile / Annuale */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Aggiorna il tuo Abbonamento Gestionale</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight">
            Fai crescere il tuo salone con Trimmy
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            Sblocca postazioni di lavoro per il tuo team, statistiche avanzate su fatturato e clienti, e supporto prioritario.
          </p>

          {/* Switch Mensile / Annuale (-20%) */}
          <div className="pt-2 flex justify-center">
            <div className="inline-flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  billingCycle === "monthly" 
                    ? "bg-white text-zinc-900 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Fatturazione Mensile
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  billingCycle === "yearly" 
                    ? "bg-zinc-900 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <span>Fatturazione Annuale</span>
                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] rounded-full font-extrabold">
                  -20% SCONTO
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Griglia Piani: MEDIUM vs PRO */}
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          
          {/* PIANO MEDIUM */}
          <div className={`bg-white rounded-3xl p-6 sm:p-8 border-2 transition-all flex flex-col justify-between ${
            selectedPlan === "MEDIUM" 
              ? "border-indigo-600 shadow-xl ring-4 ring-indigo-50" 
              : "border-zinc-200 hover:border-zinc-300 shadow-sm"
          }`}>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    Piccoli Saloni & Barber
                  </span>
                  <h3 className="text-2xl font-black text-zinc-900 mt-2">Piano Medium</h3>
                  <p className="text-xs text-zinc-500 mt-1">Ideale per team fino a 3 collaboratori.</p>
                </div>
                {currentPlan === "MEDIUM" && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Piano Attivo
                  </span>
                )}
              </div>

              {/* Prezzo */}
              <div className="pt-2 pb-4 border-b border-zinc-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-zinc-900">
                    {billingCycle === "monthly" ? "€ 11,99" : "€ 115,99"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    {billingCycle === "monthly" ? "/ mese" : "/ anno (IVA incl.)"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    Equivalente a ~€ 9,66/mese (-20% risparmiato)
                  </p>
                )}
              </div>

              {/* Vantaggi */}
              <ul className="space-y-2.5 text-xs text-zinc-600 pt-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Fino a 3 collaboratori</strong> con calendari e turni dedicati</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Agenda digitale sincronizzata in tempo reale</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Anagrafica clienti illimitata e storico tagli</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Presenza sul marketplace clienti Trimmy & Mappa</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Gestione listino trattamenti personalizzati</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlan("MEDIUM");
                  handleUpgrade("MEDIUM");
                }}
                disabled={isActivating || currentPlan === "MEDIUM"}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currentPlan === "MEDIUM"
                    ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
                }`}
              >
                {isActivating && selectedPlan === "MEDIUM" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Attivazione in corso...</span>
                  </>
                ) : currentPlan === "MEDIUM" ? (
                  <span>Piano Già Attivo</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Passa al Piano Medium</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PIANO PRO */}
          <div className={`bg-zinc-900 text-white rounded-3xl p-6 sm:p-8 border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
            selectedPlan === "PRO" 
              ? "border-amber-400 shadow-2xl ring-4 ring-amber-400/20" 
              : "border-zinc-800 hover:border-zinc-700 shadow-md"
          }`}>
            {/* Badge Top */}
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-gradient-to-r from-amber-400 to-amber-300 text-zinc-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Consigliato • Senza Limiti</span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-white/10 px-2.5 py-1 rounded-full">
                    Grandi Saloni & Catene
                  </span>
                  <h3 className="text-2xl font-black text-white mt-2">Piano Pro</h3>
                  <p className="text-xs text-zinc-400 mt-1">Tutto illimitato per il massimo rendimento.</p>
                </div>
                {currentPlan === "PRO" && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    Piano Attivo
                  </span>
                )}
              </div>

              {/* Prezzo */}
              <div className="pt-2 pb-4 border-b border-zinc-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    {billingCycle === "monthly" ? "€ 39,00" : "€ 374,40"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">
                    {billingCycle === "monthly" ? "/ mese" : "/ anno (IVA incl.)"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-[11px] text-amber-300 font-semibold mt-1">
                    Risparmi € 93,60 all&apos;anno (pari a € 31,20/mese)
                  </p>
                )}
              </div>

              {/* Vantaggi */}
              <ul className="space-y-2.5 text-xs text-zinc-300 pt-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Collaboratori e postazioni illimitate</strong> ({staffCount}+ persone)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Report avanzati su fatturato, incassi e produttività team</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Badge &ldquo;Partner PRO&rdquo; in evidenza su Marketplace e Mappa</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Agenda avanzata con viste multiple per singolo stylist</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Assistenza e supporto prioritario WhatsApp dedicato 24/7</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlan("PRO");
                  handleUpgrade("PRO");
                }}
                disabled={isActivating || currentPlan === "PRO"}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currentPlan === "PRO"
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-lg shadow-amber-400/20"
                }`}
              >
                {isActivating && selectedPlan === "PRO" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Attivazione in corso...</span>
                  </>
                ) : currentPlan === "PRO" ? (
                  <span>Piano Massimo Già Attivo</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Effettua Upgrade a Piano Pro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Link rapido ritorno agenda in basso */}
        <div className="text-center pt-4">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Non vuoi modificare il piano adesso? Torna all&apos;Agenda del gestionale</span>
          </button>
        </div>

      </main>
    </div>
  );
}
