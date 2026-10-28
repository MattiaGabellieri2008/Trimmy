"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Calendar,
  ExternalLink,
  ShieldCheck,
  Receipt
} from "lucide-react";

function AbbonamentoProContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"MEDIUM" | "PRO">("PRO");
  const [isActivating, setIsActivating] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gestione stato di ritorno da Stripe Checkout (?status=success o cancelled)
  useEffect(() => {
    const status = searchParams.get("status");
    const plan = searchParams.get("plan") as "MEDIUM" | "PRO" | null;
    const cycle = searchParams.get("cycle") as "monthly" | "yearly" | null;
    const isDemo = searchParams.get("demo") === "true";

    if (status === "success" && currentUser) {
      setUpgradeSuccess(true);
      const targetPlan = plan || "PRO";
      const targetCycle = cycle || "monthly";
      const newStaffCount = targetPlan === "PRO" ? 10 : 3;

      updateUserProfile(currentUser.uid, {
        planType: targetPlan,
        planStatus: "ACTIVE",
        billingPeriod: targetCycle,
        staffCount: newStaffCount
      });

      addSalonNotification(currentUser.uid, {
        id: `plan-upgrade-stripe-${Date.now()}`,
        title: `Abbonamento ${targetPlan} Operativo! 🚀`,
        description: `Il pagamento Stripe è stato registrato. Tutte le funzionalità del piano ${targetPlan} sono attive.`,
        time: "Adesso",
        type: "system",
        link: "/abbonamento-pro"
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }

      // Pulisce l'URL senza ricaricare la pagina
      window.history.replaceState({}, "", "/abbonamento-pro");
    } else if (status === "cancelled") {
      setErrorMessage("Transazione Stripe annullata. Il piano corrente non è stato modificato.");
      window.history.replaceState({}, "", "/abbonamento-pro");
    }
  }, [searchParams, currentUser]);

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

        // Preseleziona il piano naturale
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
    setErrorMessage(null);

    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/stripe/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          planType: targetPlan,
          billingCycle,
          userId: currentUser.uid,
          salonName,
          userEmail: currentUser.email
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossibile avviare il checkout Stripe");
      }

      if (data.url) {
        // Se demo o reale, reindirizza all'URL generato da Stripe o dall'API
        window.location.href = data.url;
      } else {
        throw new Error("Nessun URL di pagamento restituito da Stripe");
      }
    } catch (err: any) {
      console.error("Errore avvio Stripe Checkout:", err);
      setErrorMessage(err.message || "Si è verificato un errore durante l'avvio del checkout sicuro Stripe.");
      setIsActivating(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    if (!currentUser) return;
    setIsOpeningPortal(true);
    setErrorMessage(null);

    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: currentUser.uid
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossibile aprire il portale Stripe");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Errore apertura portale Stripe:", err);
      setErrorMessage(err.message || "Errore apertura portale fatturazione Stripe.");
    } finally {
      setIsOpeningPortal(false);
    }
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
                <p className="font-bold text-sm">Abbonamento Stripe attivato con successo!</p>
                <p className="text-xs text-emerald-100 mt-0.5">Il tuo salone è ora abilitato al piano selezionato. Ricevute e fatture sono disponibili nel portale Stripe.</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-3.5 py-1.5 bg-white text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shrink-0"
            >
              Vai all&apos;Agenda
            </button>
          </div>
        )}

        {/* Banner Errore / Annullamento */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between animate-in fade-in duration-200 text-xs font-medium">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900 font-bold ml-3">
              Chiudi
            </button>
          </div>
        )}

        {/* Intestazione e Switcher Mensile / Annuale */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Piani Ufficiali Trimmy Saloni</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight">
            Fai crescere il tuo salone con Trimmy
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            Sblocca postazioni per il tuo staff, gestione cassa, notifiche automatiche e checkout sicuro tramite Stripe.
          </p>

          {/* Switch Mensile / Annuale (-20%) */}
          <div className="pt-2 flex justify-center">
            <div className="inline-flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  billingCycle === "yearly" 
                    ? "bg-zinc-900 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <span>Fatturazione Annuale</span>
                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] rounded-full font-extrabold">
                  2 MESI GRATIS
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Griglia Piani: MEDIUM (29€/m) vs PRO (59€/m) */}
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          
          {/* PIANO MEDIUM */}
          <div className={`bg-white rounded-3xl p-6 sm:p-8 border-2 transition-all flex flex-col justify-between ${
            selectedPlan === "MEDIUM" 
              ? "border-zinc-900 shadow-xl ring-4 ring-zinc-900/5" 
              : "border-zinc-200 hover:border-zinc-300 shadow-sm"
          }`}>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-full">
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
                    {billingCycle === "monthly" ? "€ 29,00" : "€ 290,00"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    {billingCycle === "monthly" ? "/ mese" : "/ anno (IVA incl.)"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    Equivalente a ~€ 24,16/mese (2 mesi in omaggio)
                  </p>
                )}
              </div>

              {/* Vantaggi */}
              <ul className="space-y-2.5 text-xs text-zinc-600 pt-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  <span><strong>Fino a 3 collaboratori</strong> con calendari e turni dedicati</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  <span>Agenda interattiva Drag & Drop con controllo collisioni</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  <span>Anagrafica clienti illimitata e storico trattamenti</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  <span>Presenza sul marketplace clienti Trimmy & Prenotazioni QR</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5" />
                  <span>Checkout sicuro gestito tramite <strong>Stripe Billing</strong></span>
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
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currentPlan === "MEDIUM"
                    ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-md hover:shadow-lg active:scale-[0.98]"
                }`}
              >
                {isActivating && selectedPlan === "MEDIUM" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Connessione a Stripe Checkout...</span>
                  </>
                ) : currentPlan === "MEDIUM" ? (
                  <span>Piano Già Attivo</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Attiva Medium con Stripe</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PIANO PRO */}
          <div className={`bg-zinc-950 text-white rounded-3xl p-6 sm:p-8 border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
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
                    {billingCycle === "monthly" ? "€ 59,00" : "€ 590,00"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">
                    {billingCycle === "monthly" ? "/ mese" : "/ anno (IVA incl.)"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-[11px] text-amber-300 font-semibold mt-1">
                    Equivalente a ~€ 49,16/mese (2 mesi in omaggio)
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
                  <span>Badge &ldquo;Partner PRO&rdquo; in evidenza sul Marketplace</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Notifiche Push Web e Click-to-Chat WhatsApp per i clienti</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Assistenza prioritaria e portale fatture Stripe dedicato</span>
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
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currentPlan === "PRO"
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-lg shadow-amber-400/20 active:scale-[0.98]"
                }`}
              >
                {isActivating && selectedPlan === "PRO" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Connessione a Stripe Checkout...</span>
                  </>
                ) : currentPlan === "PRO" ? (
                  <span>Piano Massimo Già Attivo</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Attiva Piano Pro con Stripe</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Gestione Fatturazione Stripe (Customer Portal) se l'utente ha già un piano attivo */}
        {(currentPlan === "MEDIUM" || currentPlan === "PRO" || profile?.stripeCustomerId) && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900">Portale Clienti & Fatture Stripe</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Scarica le ricevute di pagamento, modifica il metodo di pagamento o gestisci il rinnovo del piano.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenCustomerPortal}
              disabled={isOpeningPortal}
              className="px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
            >
              {isOpeningPortal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>Gestisci su Stripe</span>
            </button>
          </div>
        )}

        {/* Sicurezza Stripe & Ritorno all'agenda */}
        <div className="text-center pt-2 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Transazioni protette con crittografia end-to-end certificata PCI-DSS Livello 1 da Stripe.</span>
          </div>

          <div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Non vuoi modificare il piano adesso? Torna all&apos;Agenda del gestionale</span>
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function AbbonamentoProPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    }>
      <AbbonamentoProContent />
    </Suspense>
  );
}
