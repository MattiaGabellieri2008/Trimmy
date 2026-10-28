"use client";

import { useState, useEffect } from "react";
import { 
  Mail, 
  Lock, 
  Loader2, 
  Scissors, 
  User, 
  Building, 
  Check, 
  Star, 
  Sparkles, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getUserProfile, 
  fetchUserProfile,
  saveUserProfile, 
  calculatePlan, 
  UserRole, 
  UserProfile 
} from "@/lib/user-profile";

async function bindStaffToSalon(user: FirebaseUser, salonId: string, memberName?: string) {
  try {
    const staffDocRef = doc(db, "saloni", salonId, "staff", user.uid);
    await setDoc(staffDocRef, {
      id: user.uid,
      uid: user.uid,
      tenantId: salonId,
      fullName: memberName || user.displayName || user.email || "Collaboratore",
      email: user.email,
      role: "Staff",
      status: "ATTIVO",
      acceptedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn("Nota associazione staff al salone:", err);
  }
}

export default function LandingPage() {
  const router = useRouter();

  // Auth State
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("salone");
  const [partitaIva, setPartitaIva] = useState("");
  const [staffCount, setStaffCount] = useState<number>(1);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formError, setFormError] = useState("");
  const [inviteSalonId, setInviteSalonId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  // Cattura parametri di invito dal link (?inviteSalonId=...&inviteEmail=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get("inviteSalonId");
      const sEmail = params.get("inviteEmail");
      if (sId) {
        setInviteSalonId(sId);
        setRole("collaboratore");
      }
      if (sEmail) {
        setInviteEmail(sEmail);
        setEmail(sEmail);
      }
    }
  }, []);

  // Modal per completare profilo se primo login Google
  const [isPendingGoogleOnboarding, setIsPendingGoogleOnboarding] = useState(false);
  const [pendingUser, setPendingUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const currentInviteSalonId = inviteSalonId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("inviteSalonId") : null);
      if (user) {
        // Recupera profilo aggiornato da Cloud Firestore (con fallback su cache locale)
        const p = await fetchUserProfile(user.uid, user.email) || getUserProfile(user.uid);

        if (currentInviteSalonId) {
          const staffProfile: UserProfile = {
            ...(p || {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "Collaboratore",
              createdAt: new Date().toISOString(),
            }),
            role: "collaboratore",
            salonId: currentInviteSalonId,
            isStaffMember: true,
            planType: "PRO",
            planStatus: "ACTIVE",
            updatedAt: new Date().toISOString()
          };
          saveUserProfile(staffProfile);
          await bindStaffToSalon(user, currentInviteSalonId, staffProfile.displayName);
          router.push("/");
          return;
        }

        if (p) {
          if (p.role === "cliente") {
            router.push("/cliente");
          } else if (p.role === "salone" && p.planStatus === "PAYMENT_REQUIRED") {
            router.push("/abbonamento-pro");
          } else {
            router.push("/");
          }
        } else {
          // Utente autenticato ma senza ruolo salvato (es. primo accesso Google)
          setPendingUser(user);
          setIsPendingGoogleOnboarding(true);
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsLoading(true);
    const currentInviteSalonId = inviteSalonId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("inviteSalonId") : null);

    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const user = cred.user;
        const profile = await fetchUserProfile(user.uid, user.email) || getUserProfile(user.uid);

        if (currentInviteSalonId) {
          const staffProfile: UserProfile = {
            ...(profile || {
              uid: user.uid,
              email: user.email || email,
              displayName: user.displayName || "Collaboratore",
              createdAt: new Date().toISOString(),
            }),
            role: "collaboratore",
            salonId: currentInviteSalonId,
            isStaffMember: true,
            planType: "PRO",
            planStatus: "ACTIVE",
            updatedAt: new Date().toISOString()
          };
          saveUserProfile(staffProfile);
          await bindStaffToSalon(user, currentInviteSalonId, staffProfile.displayName);
          router.push("/");
          return;
        }

        if (profile) {
          if (profile.role === "cliente") {
            router.push("/cliente");
          } else if (profile.role === "salone" && profile.planStatus === "PAYMENT_REQUIRED") {
            router.push("/abbonamento-pro");
          } else {
            router.push("/");
          }
        } else {
          router.push("/");
        }
      } else {
        // Validazione campi obbligatori per Salone
        if (!currentInviteSalonId && role === "salone") {
          if (!partitaIva.trim()) {
            setFormError("La Partita IVA è obbligatoria per creare un account Salone.");
            setIsLoading(false);
            return;
          }
          if (staffCount < 1) {
            setFormError("Il numero di persone che lavorano nel salone deve essere almeno 1.");
            setIsLoading(false);
            return;
          }
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;

        if (name) {
          try {
            await updateProfile(user, { displayName: name });
          } catch (e) {
            console.error("Errore aggiornamento nome:", e);
          }
        }

        if (currentInviteSalonId) {
          const staffProfile: UserProfile = {
            uid: user.uid,
            email: user.email || email,
            displayName: name || "Collaboratore",
            role: "collaboratore",
            salonId: currentInviteSalonId,
            isStaffMember: true,
            staffCount: 1,
            planType: "PRO",
            planStatus: "ACTIVE",
            createdAt: new Date().toISOString(),
          };
          saveUserProfile(staffProfile);
          await bindStaffToSalon(user, currentInviteSalonId, name);
          router.push("/");
          return;
        }

        const plan = calculatePlan(role, staffCount);
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || email,
          displayName: name || (role === "salone" ? "Salone" : "Cliente"),
          role: role,
          salonName: role === "salone" ? name : undefined,
          partitaIva: role === "salone" ? partitaIva.trim() : undefined,
          staffCount: role === "salone" ? staffCount : 1,
          planType: plan.planType,
          planStatus: plan.planStatus,
          createdAt: new Date().toISOString(),
        };
        saveUserProfile(newProfile);

        if (role === "cliente") {
          router.push("/cliente");
        } else if (role === "salone" && plan.planStatus === "PAYMENT_REQUIRED") {
          router.push("/abbonamento-pro");
        } else {
          router.push("/");
        }
      }
    } catch (error: any) {
      console.error("Errore autenticazione:", error.message);
      setFormError("Errore: " + error.message);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError("");
    const currentInviteSalonId = inviteSalonId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("inviteSalonId") : null);

    // Se siamo in modalità registrazione (signup), verifichiamo i campi prima del popup Google
    if (!currentInviteSalonId && mode === "signup" && role === "salone") {
      if (!partitaIva.trim()) {
        setFormError("Inserisci la Partita IVA obbligatoria prima di procedere con Google.");
        return;
      }
      if (!staffCount || staffCount < 1) {
        setFormError("Inserisci il numero di collaboratori del salone.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;

      let profile = await fetchUserProfile(user.uid, user.email) || getUserProfile(user.uid);

      if (currentInviteSalonId) {
        const staffProfile: UserProfile = {
          ...(profile || {
            uid: user.uid,
            email: user.email || "",
            createdAt: new Date().toISOString(),
          }),
          displayName: user.displayName || name || "Collaboratore",
          role: "collaboratore",
          salonId: currentInviteSalonId,
          isStaffMember: true,
          staffCount: 1,
          planType: "PRO",
          planStatus: "ACTIVE",
          updatedAt: new Date().toISOString()
        };
        saveUserProfile(staffProfile);
        await bindStaffToSalon(user, currentInviteSalonId, staffProfile.displayName);
        router.push("/");
        return;
      }

      if (!profile) {
        if (mode === "signup") {
          if (currentInviteSalonId) {
          const staffProfile: UserProfile = {
            uid: user.uid,
            email: user.email || email,
            displayName: name || "Collaboratore",
            role: "collaboratore",
            salonId: currentInviteSalonId,
            isStaffMember: true,
            staffCount: 1,
            planType: "PRO",
            planStatus: "ACTIVE",
            createdAt: new Date().toISOString(),
          };
          saveUserProfile(staffProfile);
          await bindStaffToSalon(user, currentInviteSalonId, name);
          router.push("/");
          return;
        }

        const plan = calculatePlan(role, staffCount);
          profile = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || name || (role === "salone" ? "Salone" : "Cliente"),
            role: role,
            salonName: role === "salone" ? (name || user.displayName || "Il mio Salone") : undefined,
            partitaIva: role === "salone" ? partitaIva.trim() : undefined,
            staffCount: role === "salone" ? staffCount : 1,
            planType: plan.planType,
            planStatus: plan.planStatus,
            createdAt: new Date().toISOString(),
          };
          saveUserProfile(profile);
        } else {
          // Accesso con Google senza profilo salvato in precedenza
          setPendingUser(user);
          setIsPendingGoogleOnboarding(true);
          setIsLoading(false);
          return;
        }
      }

      if (profile.role === "cliente") {
        router.push("/cliente");
      } else if (profile.role === "salone" && profile.planStatus === "PAYMENT_REQUIRED") {
        router.push("/abbonamento-pro");
      } else {
        router.push("/");
      }
    } catch (error: any) {
      console.error("Errore Google Sign-In:", error.message);
      setFormError("Errore Google: " + error.message);
      setIsLoading(false);
    }
  };

  // Completamento Onboarding per Google
  const handleCompleteGoogleOnboarding = () => {
    if (!pendingUser) return;
    setFormError("");

    if (role === "salone") {
      if (!partitaIva.trim()) {
        setFormError("La Partita IVA è obbligatoria per creare l'account Salone.");
        return;
      }
      if (staffCount < 1) {
        setFormError("Il numero di persone che lavorano nel salone deve essere almeno 1.");
        return;
      }
    }

    const plan = calculatePlan(role, staffCount);
    const newProfile: UserProfile = {
      uid: pendingUser.uid,
      email: pendingUser.email || "",
      displayName: name || pendingUser.displayName || (role === "salone" ? "Salone" : "Cliente"),
      role: role,
      salonName: role === "salone" ? (name || pendingUser.displayName || "Il mio Salone") : undefined,
      partitaIva: role === "salone" ? partitaIva.trim() : undefined,
      staffCount: role === "salone" ? staffCount : 1,
      planType: plan.planType,
      planStatus: plan.planStatus,
      createdAt: new Date().toISOString(),
    };
    saveUserProfile(newProfile);
    setIsPendingGoogleOnboarding(false);

    if (role === "cliente") {
      router.push("/cliente");
    } else if (role === "salone" && plan.planStatus === "PAYMENT_REQUIRED") {
      router.push("/abbonamento-pro");
    } else {
      router.push("/");
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-zinc-200">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-zinc-200/60 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900">Trimmy</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#prezzi" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block">Prezzi</a>
            <a href="#funzionalita" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block">Funzionalità</a>
            <button
              onClick={() => {
                document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
                setMode("login");
              }}
              className="text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
            >
              Accedi
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section id="funzionalita" className="pt-32 pb-20 px-6 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-sm font-medium text-zinc-700 shadow-sm">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Il software gestionale n°1 per Saloni</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tighter text-zinc-900 leading-[1.1]">
              Gestisci il tuo <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-400">Salone</span> senza stress.
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed max-w-lg">
              Agenda digitale, prenotazioni online, gestione staff e clienti.
              Tutto in un&apos;unica piattaforma elegante, veloce e semplice da usare.
            </p>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-zinc-50 bg-zinc-200 flex items-center justify-center text-xs font-medium overflow-hidden shadow-sm">
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e4e4e7`} alt="avatar" />
                  </div>
                ))}
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-900">1000+</span> saloni attivi
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div id="auth-section" className="relative animate-in fade-in zoom-in-95 duration-700 delay-150 lg:ml-auto w-full max-w-md">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-zinc-200 to-zinc-400 rounded-3xl blur opacity-30"></div>

            <div className="relative bg-white p-7 sm:p-8 rounded-3xl shadow-xl border border-zinc-200/60">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
                  {mode === "login" ? "Bentornato" : "Crea Account"}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                  {mode === "login" 
                    ? "Accedi alla tua area riservata" 
                    : "Scegli se registrarti come Salone o come Cliente"}
                </p>
              </div>

              {/* Toggle Accedi / Registrati */}
              <div className="flex p-1 mb-5 bg-zinc-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setFormError(""); }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === "login" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Accedi
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setFormError(""); }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === "signup" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Registrati
                </button>
              </div>

              {/* Banner Invito Collaboratore */}
              {inviteSalonId && (
                <div className="p-3.5 mb-4 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in duration-200">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Invito Salone Ricevuto</span>
                    <span className="text-emerald-700">Sei stato invitato come collaboratore. Accedi o crea il tuo account per visualizzare l&apos;agenda condivisa e i clienti del salone.</span>
                  </div>
                </div>
              )}

              {/* Errore Form */}
              {formError && (
                <div className="p-3 mb-4 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{formError}</span>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                
                {/* Selezione Obbligatoria del Ruolo in caso di Registrazione */}
                {mode === "signup" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {inviteSalonId ? (
                      <div className="space-y-3.5 p-3.5 bg-zinc-50/70 border border-zinc-200/70 rounded-2xl">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Il Tuo Nome e Cognome <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Mario Rossi"
                            autoComplete="name"
                            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          />
                        </div>
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl text-[11px] text-emerald-800 font-medium">
                          ✨ Con questo account collaboratore accederai direttamente all&apos;agenda del salone.
                        </div>
                      </div>
                    ) : (
                      <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Tipo di Account da creare <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => { setRole("salone"); setFormError(""); }}
                          className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-all cursor-pointer text-center ${
                            role === "salone" 
                              ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" 
                              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                          }`}
                        >
                          <Building className="w-5 h-5 mb-1" />
                          <span className="text-xs font-bold">Salone / Barber</span>
                          <span className={`text-[10px] mt-0.5 ${role === "salone" ? "text-zinc-300" : "text-zinc-400"}`}>
                            Gestione attività
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setRole("cliente"); setFormError(""); }}
                          className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-all cursor-pointer text-center ${
                            role === "cliente" 
                              ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" 
                              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                          }`}
                        >
                          <User className="w-5 h-5 mb-1" />
                          <span className="text-xs font-bold">Cliente</span>
                          <span className={`text-[10px] mt-0.5 ${role === "cliente" ? "text-zinc-300" : "text-zinc-400"}`}>
                            Prenotazioni
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Dati Salone: Nome + Partita IVA + N° persone */}
                    {role === "salone" ? (
                      <div className="space-y-3.5 p-3.5 bg-zinc-50/70 border border-zinc-200/70 rounded-2xl">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Nome Salone o Referente <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Beauty Studio Milano"
                            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Partita IVA <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={partitaIva}
                            onChange={(e) => setPartitaIva(e.target.value)}
                            placeholder="Es. IT01234567890"
                            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-semibold text-zinc-700">
                              Persone che lavorano nel salone <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-800">
                              {staffCount} {staffCount === 1 ? "persona" : "collaboratori"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={50}
                              required
                              value={staffCount}
                              onChange={(e) => setStaffCount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 px-3 py-2 border border-zinc-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-zinc-900 outline-none text-center"
                            />
                            <div className="flex-1 flex gap-1.5">
                              {[1, 2, 3, 5].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setStaffCount(num)}
                                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                    staffCount === num
                                      ? "bg-zinc-900 text-white border-zinc-900"
                                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                                  }`}
                                >
                                  {num === 5 ? "5+" : num}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Feedback dinamico del Piano (Gratis vs Medium vs PRO) */}
                        {staffCount === 1 ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-0.5">
                            <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                              <span>✓</span> Diritto al Piano Starter (Gratis)
                            </p>
                            <p className="text-[11px] text-emerald-800 leading-snug">
                              Con 1 sola persona nel salone hai accesso gratuito e immediato all&apos;agenda e al gestionale.
                            </p>
                          </div>
                        ) : staffCount <= 3 ? (
                          <div className="p-3 bg-indigo-950 text-white rounded-xl text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-indigo-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                Richiesto Piano Medium
                              </span>
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                                {staffCount} persone (max 3)
                              </span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-snug">
                              Per saloni fino a 3 persone: abbonamento <strong>Medium</strong> a <strong>11,99 €/mese</strong> o <strong>115,99 €/anno</strong> (-20% sconto).
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-zinc-900 text-white rounded-xl text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-amber-400 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                Richiesto Piano Pro
                              </span>
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                                {staffCount} persone (illimitate)
                              </span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-snug">
                              Per 4 o più collaboratori: abbonamento <strong>Pro</strong> con collaboratori illimitati a <strong>39 €/mese</strong> o <strong>374,40 €/anno</strong> (-20% sconto).
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Dati Cliente */
                      <div className="space-y-3 p-3.5 bg-zinc-50/70 border border-zinc-200/70 rounded-2xl">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Nome Completo <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Mario Rossi"
                            autoComplete="name"
                            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          />
                        </div>
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl text-[11px] text-emerald-800 font-medium">
                          ✨ Accesso gratuito dedicato alle prenotazioni online nei saloni.
                        </div>
                      </div>
                    )}
                    </>
                  )}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Indirizzo Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@esempio.it"
                      autoComplete="username email"
                      inputMode="email"
                      className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-xl text-sm bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    {mode === "login" && (
                      <a href="#" className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900">
                        Password dimenticata?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-xl text-sm bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Pulsante Submit Email/Password */}
                <button
                  type="submit"
                  disabled={isLoading || !email || !password || (mode === "signup" && (!name || (!inviteSalonId && role === "salone" && !partitaIva)))}
                  className="w-full mt-2 flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    mode === "login" ? "Accedi all'Account" : "Crea Account"
                  )}
                </button>
              </form>

              {/* Divisore */}
              <div className="my-5 relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200"></div>
                </div>
                <span className="relative px-3 bg-white text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  oppure
                </span>
              </div>

              {/* Google Sign-in */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2.5 py-2.5 px-4 border border-zinc-200 rounded-xl shadow-xs text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-900 transition-all disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {mode === "login" ? "Accedi con Google" : "Registrati con Google"}
              </button>

            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="prezzi" className="py-24 bg-white border-t border-zinc-200/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Piani semplici e trasparenti</h2>
              <p className="text-zinc-500 mt-4 text-lg">Inizia gratis se lavori da solo, oppure scegli il piano Medium o Pro per il tuo salone.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
              
              {/* Piano Starter */}
              <div className="border border-zinc-200 rounded-3xl p-8 shadow-sm flex flex-col bg-white">
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 bg-zinc-100 rounded-full text-xs font-semibold text-zinc-800 mb-3">
                    Per 1 Persona
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900">Starter</h3>
                  <p className="text-sm text-zinc-500 mt-1">Perfetto per professionisti e saloni individuali.</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-zinc-900">€ 0</span>
                    <span className="text-zinc-500 font-medium">/ mese</span>
                  </div>
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  {[
                    '1 solo collaboratore / operatore',
                    'Agenda digitale completa',
                    'Gestione clienti illimitata',
                    'Accesso immediato senza carta di credito'
                  ].map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-zinc-700 font-medium">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
                    setMode("signup");
                    setRole("salone");
                    setStaffCount(1);
                  }}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Registrati Gratis (1 persona)
                </button>
              </div>

              {/* Piano Medium */}
              <div className="border-2 border-indigo-600 rounded-3xl p-8 shadow-md flex flex-col bg-white relative">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                  Fino a 3 persone
                </div>
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold mb-3">
                    Piccoli Saloni
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900">Medium</h3>
                  <p className="text-sm text-zinc-500 mt-1">Gli stessi vantaggi del piano Pro, per massimo 3 persone.</p>
                  <div className="mt-4 flex flex-col gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold tracking-tight text-zinc-900">€ 11,99</span>
                      <span className="text-zinc-500 font-medium">/ mese</span>
                    </div>
                    <span className="text-xs text-indigo-600 font-semibold">oppure € 115,99 / anno (-20%)</span>
                  </div>
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  {[
                    'Fino a 3 persone che lavorano nel salone',
                    'Stessi vantaggi e funzionalità del piano Pro',
                    'Agenda digitale multi-operatore',
                    'Gestione clienti e appuntamenti avanzata',
                    'Statistiche e report attività',
                    'Configurazione listino trattamenti',
                    'Supporto dedicato'
                  ].map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-zinc-700 font-medium">
                      <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
                    setMode("signup");
                    setRole("salone");
                    setStaffCount(3);
                  }}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
                >
                  Scegli Piano Medium
                </button>
              </div>

              {/* Piano Pro */}
              <div className="border-2 border-zinc-900 rounded-3xl p-8 shadow-xl flex flex-col relative transform md:-translate-y-2 bg-zinc-900 text-white">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-white text-zinc-900 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                  Da 4+ persone
                </div>
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-amber-400 mb-3">
                    Team & Saloni Grandi
                  </div>
                  <h3 className="text-2xl font-bold">Pro</h3>
                  <p className="text-sm text-zinc-400 mt-1">Per saloni con 4 o più collaboratori e turni illimitati.</p>
                  <div className="mt-4 flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold tracking-tight">€ 39</span>
                      <span className="text-zinc-400 font-medium text-sm">/ mese</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold">oppure € 374,40 / anno (-20%)</span>
                  </div>
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  {[
                    'Collaboratori e turni illimitati (4 o più persone)',
                    'Agenda con visualizzazione per singolo staff',
                    'Statistiche avanzate e report ricavi completi',
                    'Configurazione listino trattamenti',
                    'Supporto prioritario dedicato 24/7'
                  ].map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-zinc-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
                    setMode("signup");
                    setRole("salone");
                    setStaffCount(4);
                  }}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-zinc-900 bg-white hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  Attiva Piano Pro
                </button>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Modal di Completamento Profilo per Google Sign-In */}
      {isPendingGoogleOnboarding && pendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-xs transition-opacity" />
          
          <div className="relative bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shrink-0">
                <Scissors className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Un ultimo passaggio!</h3>
                <p className="text-xs text-zinc-500">Configura il tuo profilo associato a {pendingUser.email}</p>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Scegli che tipo di account creare: <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole("salone")}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-all cursor-pointer ${
                      role === "salone" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    <Building className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Salone / Barber</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("cliente")}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-all cursor-pointer ${
                      role === "cliente" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    <User className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Cliente</span>
                  </button>
                </div>
              </div>

              {role === "salone" ? (
                <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Nome Salone</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Es. Salon Deluxe"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Partita IVA <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={partitaIva}
                      onChange={(e) => setPartitaIva(e.target.value)}
                      placeholder="Es. IT01234567890"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Numero di persone che lavorano nel salone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={staffCount}
                      onChange={(e) => setStaffCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold bg-white"
                    />
                    <div className="mt-2">
                      {staffCount === 1 ? (
                        <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          ✓ Assegnato Piano Starter (Gratis per 1 persona)
                        </p>
                      ) : staffCount <= 3 ? (
                        <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                          ★ Richiesto Piano Medium (11,99 €/m o 115,99 €/anno fino a 3 persone)
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-900 font-semibold flex items-center gap-1">
                          ★ Richiesto Piano Pro (39 €/m o 374,40 €/anno collaboratori illimitati)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  ✨ Con l&apos;account cliente potrai prenotare trattamenti nei migliori saloni.
                </div>
              )}
            </div>

            <button
              onClick={handleCompleteGoogleOnboarding}
              className="w-full py-3 px-4 bg-zinc-900 text-white font-semibold text-sm rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Completa Registrazione
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-zinc-400 text-sm border-t border-zinc-200/60 bg-white">
        © 2026 Trimmy. Tutti i diritti riservati.
      </footer>
    </div>
  );
}
