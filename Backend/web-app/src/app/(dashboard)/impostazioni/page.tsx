"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Settings, Shield, CreditCard, Building, User, Mail, Lock, Plus, Check, X, Loader2, LogOut, Trash2, AlertTriangle, Users, Copy, RotateCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, updateProfile, signOut, deleteUser, User as FirebaseUser } from "firebase/auth";
import { getUserProfile, fetchUserProfile, subscribeUserProfile, updateUserProfile, deleteUserProfile, UserProfile, PlanType } from "@/lib/user-profile";
import { ensureSalonTenant, getSalonTenantId } from "@/lib/tenant-helper";
import { addSalonNotification } from "@/lib/salon-notifications";
import { 
  fetchSalonStaff, 
  inviteStaffMemberWithFirebase, 
  removeStaffMember, 
  canAddStaffMember, 
  StaffMemberItem,
  PLAN_STAFF_LIMITS 
} from "@/lib/staff-store";

type TabType = "profilo" | "salone" | "team" | "abbonamento";

function ImpostazioniContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("profilo");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [authProvider, setAuthProvider] = useState<"google" | "email" | "unknown">("unknown");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Dati Salone Form State
  const [salonName, setSalonName] = useState("");
  const [salonAddress, setSalonAddress] = useState("");
  const [salonCity, setSalonCity] = useState("Milano");
  const [salonPhone, setSalonPhone] = useState("");
  const [salonPartitaIva, setSalonPartitaIva] = useState("");
  const [salonCategory, setSalonCategory] = useState<"Barber Shop" | "Hair Stylist Donna" | "Unisex" | "Centro Estetico">("Barber Shop");
  const [savingSalon, setSavingSalon] = useState(false);
  const [salonMessage, setSalonMessage] = useState("");

  // Staff & Team State
  const [staffList, setStaffList] = useState<StaffMemberItem[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Staff");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");
  const [inviteErrorMsg, setInviteErrorMsg] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [showUpgradeLimitModal, setShowUpgradeLimitModal] = useState(false);

  // Delete Account Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleDirectUpgrade = async (targetPlan: "MEDIUM" | "PRO") => {
    if (!currentUser) return;
    setIsUpgrading(true);
    try {
      const newStaffCount = targetPlan === "PRO" ? Math.max(userProfile?.staffCount || 1, 4) : 3;
      await updateUserProfile(currentUser.uid, {
        planType: targetPlan,
        planStatus: "ACTIVE",
        staffCount: newStaffCount
      });
      await ensureSalonTenant(currentUser.uid, userProfile?.salonName || salonName || "Il Mio Salone", targetPlan);
      addSalonNotification(currentUser.uid, {
        id: `plan-upgrade-${Date.now()}`,
        title: `Piano ${targetPlan} Attivato! 🚀`,
        description: `Il tuo salone è ora attivo con il piano ${targetPlan}. Tutte le funzionalità premium e collaboratori sono abilitati.`,
        time: "Adesso",
        type: "system",
        link: "/impostazioni?tab=abbonamento"
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
      // Reindirizzamento all'agenda come da specifica
      router.push("/");
    } catch (err) {
      console.error("Errore upgrade:", err);
      router.push("/abbonamento-pro");
    } finally {
      setIsUpgrading(false);
    }
  };

  // Leggi il parametro 'tab' dall'URL al montaggio
  useEffect(() => {
    const tab = searchParams.get("tab") as TabType;
    if (tab && ["profilo", "salone", "team", "abbonamento"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Ascolta lo stato di autenticazione Firebase e il profilo in tempo reale da Cloud Firestore
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (unsubProfile) unsubProfile();
        router.push("/login");
      } else {
        setCurrentUser(user);
        setProfileName(user.displayName || user.email?.split("@")[0] || "");
        
        // Listener real-time da Cloud Firestore: garantisce che il piano PRO e ogni modifica siano istantanee
        if (unsubProfile) unsubProfile();
        unsubProfile = subscribeUserProfile(user.uid, (p) => {
          if (p) {
            setUserProfile(p);
            setSalonName(p.salonName || p.displayName || "Il mio Salone");
            setSalonAddress(p.address || "");
            setSalonCity(p.city || "Milano");
            setSalonPhone(p.phone || "");
            setSalonPartitaIva(p.partitaIva || "");
            if (p.category) setSalonCategory(p.category);
          }
        });
        
        // Carica la lista del team reale isolata per questo salone
        const tid = getSalonTenantId(user.uid);
        fetchSalonStaff(tid, {
          uid: user.uid,
          displayName: user.displayName || "Titolare",
          email: user.email || ""
        }).then(setStaffList).catch(console.error);

        // Determina il provider di autenticazione
        const providers = user.providerData.map(p => p.providerId);
        if (providers.includes("google.com")) {
          setAuthProvider("google");
        } else if (providers.includes("password")) {
          setAuthProvider("email");
        }
        
        setCheckingAuth(false);
      }
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [router]);

  const loadTeamStaff = async () => {
    if (!currentUser) return;
    setIsLoadingStaff(true);
    try {
      const tid = getSalonTenantId(currentUser.uid);
      const list = await fetchSalonStaff(tid, {
        uid: currentUser.uid,
        displayName: userProfile?.salonName || currentUser.displayName || "Titolare",
        email: currentUser.email || ""
      });
      setStaffList(list);
    } catch (e) {
      console.error("Errore caricamento staff:", e);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleOpenInvite = () => {
    const currentCount = staffList.length;
    const plan = userProfile?.planType || "FREE";
    const check = canAddStaffMember(plan, currentCount);

    if (!check.allowed) {
      setShowUpgradeLimitModal(true);
      return;
    }

    setInviteSuccessMsg("");
    setInviteErrorMsg("");
    setInviteFullName("");
    setInviteEmail("");
    setInviteRole("Staff");
    setLastInviteUrl(null);
    setCopiedInviteUrl(false);
    setIsInviteOpen(true);
  };

  const handleSendStaffInvite = async () => {
    if (!currentUser) return;
    if (!inviteFullName.trim() || !inviteEmail.trim()) {
      setInviteErrorMsg("Inserisci il nome e un indirizzo email valido.");
      return;
    }

    // Validazione formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteErrorMsg("Inserisci un indirizzo email sintatticamente valido.");
      return;
    }

    setIsSendingInvite(true);
    setInviteErrorMsg("");
    setInviteSuccessMsg("");

    try {
      const tid = getSalonTenantId(currentUser.uid);
      const effectivePlan = userProfile?.planType || "FREE";
      const sName = userProfile?.salonName || salonName || "Il Mio Salone";
      const ownerName = userProfile?.displayName || currentUser.displayName || "Titolare";

      const res = await inviteStaffMemberWithFirebase(
        tid,
        sName,
        ownerName,
        effectivePlan,
        {
          fullName: inviteFullName,
          email: inviteEmail,
          role: inviteRole
        }
      );

      if (!res.success) {
        setInviteErrorMsg(res.error || "Impossibile inviare l'invito.");
        return;
      }

      if (res.inviteUrl) {
        setLastInviteUrl(res.inviteUrl);
      }

      if (res.emailSentSuccessfully) {
        setInviteSuccessMsg(`Invito inviato con successo! Un'email reale di attivazione con il link di accesso a Trimmy è stata recapitata a ${inviteEmail}.`);
      } else {
        setInviteSuccessMsg(`Collaboratore registrato nel team! Puoi copiare il link di invito qui sotto o condividerlo direttamente su WhatsApp.`);
      }

      await loadTeamStaff();

      addSalonNotification(currentUser.uid, {
        id: `invite-${Date.now()}`,
        title: `Invito creato per ${inviteFullName}`,
        description: `Collaboratore aggiunto al salone per il ruolo di ${inviteRole}`,
        time: "Adesso",
        type: "system",
        link: "/impostazioni?tab=team"
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }

    } catch (err: any) {
      console.error("Errore invio invito staff:", err);
      setInviteErrorMsg(err.message || "Errore durante l'invio dell'invito.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!currentUser) return;
    if (!confirm("Sei sicuro di voler rimuovere questo collaboratore dal salone?")) return;

    try {
      const tid = getSalonTenantId(currentUser.uid);
      const updated = await removeStaffMember(tid, staffId);
      setStaffList(updated);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
    } catch (err) {
      console.error("Errore rimozione staff:", err);
    }
  };


  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSavingProfile(true);
    setSaveMessage("");
    try {
      await updateProfile(currentUser, { displayName: profileName });
      setSaveMessage("Profilo aggiornato con successo!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err: any) {
      console.error("Errore salvataggio:", err);
      setSaveMessage("Errore durante il salvataggio.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSalon = async () => {
    if (!currentUser) return;
    setSavingSalon(true);
    setSalonMessage("");
    try {
      updateUserProfile(currentUser.uid, {
        salonName,
        address: salonAddress,
        city: salonCity,
        phone: salonPhone,
        partitaIva: salonPartitaIva,
        category: salonCategory,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trimmy-data-updated"));
      }
      setSalonMessage("Dati del salone aggiornati con successo!");
      setTimeout(() => setSalonMessage(""), 3000);
    } catch (err: any) {
      console.error("Errore aggiornamento salone:", err);
      setSalonMessage("Errore durante il salvataggio.");
    } finally {
      setSavingSalon(false);
    }
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      const uidToDelete = currentUser.uid;
      // 1. Elimina il profilo e i dati dal database Cloud Firestore
      await deleteUserProfile(uidToDelete);
      // 2. Elimina l'utente da Firebase Auth
      await deleteUser(currentUser);
      setIsDeleteModalOpen(false);
      router.push("/login");
    } catch (err: any) {
      console.error("Errore eliminazione account:", err);
      if (err.code === "auth/requires-recent-login") {
        setDeleteError("Per motivi di sicurezza, per eliminare l'account devi aver effettuato l'accesso di recente. Esci, riaccedi ed esegui nuovamente l'eliminazione.");
      } else {
        setDeleteError(err.message || "Si è verificato un errore durante l'eliminazione dell'account.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Mostra il loader durante il check dell'autenticazione
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Helper: iniziali utente per l'avatar
  const userInitials = currentUser?.displayName
    ? currentUser.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : currentUser?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      
      {/* Intestazione */}
      <header className="pb-4 border-b border-zinc-200/60">
        <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Impostazioni Account</h2>
        <p className="text-sm text-zinc-500 mt-1">Gestisci il tuo profilo, il team e le preferenze del salone.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* Menu di Navigazione Laterale (Impostazioni) */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row overflow-x-auto pb-2 md:pb-0 md:flex-col gap-1.5 scrollbar-hide">
            <button
              onClick={() => setActiveTab("profilo")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "profilo" ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"}`}
            >
              <User className="w-4 h-4" />
              Profilo Personale
            </button>
            <button
              onClick={() => setActiveTab("salone")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "salone" ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"}`}
            >
              <Building className="w-4 h-4" />
              Dettagli Salone
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "team" ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"}`}
            >
              <Shield className="w-4 h-4" />
              Gestione Team
            </button>
            <button
              onClick={() => setActiveTab("abbonamento")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "abbonamento" ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"}`}
            >
              <CreditCard className="w-4 h-4" />
              Abbonamento SaaS
            </button>
          </nav>
        </aside>

        {/* Contenuto Principale (Form e Viste) */}
        <div className="flex-1 bg-white border border-zinc-200/60 rounded-xl p-4 sm:p-6 shadow-sm">
          
          {/* TAB: PROFILO */}
          {activeTab === "profilo" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Profilo Personale</h3>
                <p className="text-sm text-zinc-500">Le tue informazioni personali e di accesso.</p>
              </div>
              
              {/* Avatar e metodo di accesso */}
              <div className="flex items-center gap-4 p-4 bg-zinc-50/80 border border-zinc-200/60 rounded-xl">
                <div className="w-14 h-14 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-700 font-semibold text-lg shrink-0">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{currentUser?.displayName || currentUser?.email?.split("@")[0]}</p>
                  <p className="text-xs text-zinc-500 truncate">{currentUser?.email}</p>
                </div>
                {authProvider === "google" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/60 rounded-full text-[11px] font-medium text-zinc-600 shrink-0 shadow-sm">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </span>
                )}
                {authProvider === "email" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/60 rounded-full text-[11px] font-medium text-zinc-600 shrink-0 shadow-sm">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="email" 
                      value={currentUser?.email || ""}
                      readOnly
                      className="w-full pl-9 pr-4 py-2 bg-zinc-100/70 border border-zinc-200/60 rounded-lg text-sm text-zinc-600 cursor-not-allowed" 
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 ml-0.5">L&apos;email è associata al tuo account e non può essere modificata da qui.</p>
                </div>
                {authProvider === "email" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cambia Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input type="password" placeholder="Nuova password" className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all" />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                {saveMessage ? (
                  <span className={`text-xs font-medium ${saveMessage.includes("Errore") ? "text-rose-600" : "text-emerald-600"}`}>
                    {saveMessage}
                  </span>
                ) : <span />}
                <button 
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salva Modifiche
                </button>
              </div>

              {/* Zona Sicurezza & Gestione Account */}
              <div className="pt-6 border-t border-zinc-200/60 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">Sessione & Sicurezza Account</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Gestisci l&apos;accesso al tuo account o rimuovilo in modo permanente.</p>
                </div>

                {/* Pulsante Logout */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-50/80 border border-zinc-200/60 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Disconnetti la sessione</p>
                    <p className="text-xs text-zinc-500">Esci dal gestionale su questo dispositivo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg transition-colors shadow-xs shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Esci dall&apos;account
                  </button>
                </div>

                {/* Pulsante Eliminazione Definitiva */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50/50 border border-rose-200/70 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-rose-900">Zona Pericolosa: Eliminazione Account</p>
                    <p className="text-xs text-rose-600/90">Elimina definitivamente l&apos;account e tutti i dati associati dal database.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setIsDeleteModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Elimina Account Definitivamente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SALONE */}
          {activeTab === "salone" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Dettagli Salone</h3>
                <p className="text-sm text-zinc-500">Gestisci i dati pubblici della tua attività che appariranno ai clienti e nella mappa.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nome del Salone</label>
                  <input 
                    type="text" 
                    value={salonName} 
                    onChange={(e) => setSalonName(e.target.value)}
                    placeholder="Es. Barber & Style Club" 
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all font-semibold" 
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tipologia Attività</label>
                    <select
                      value={salonCategory}
                      onChange={(e) => setSalonCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Barber Shop">Barber Shop & Uomo</option>
                      <option value="Hair Stylist Donna">Hair Stylist Donna</option>
                      <option value="Unisex">Salone Unisex</option>
                      <option value="Centro Estetico">Centro Estetico & Beauty</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Città</label>
                    <input 
                      type="text" 
                      value={salonCity} 
                      onChange={(e) => setSalonCity(e.target.value)}
                      placeholder="Es. Milano, Roma, Firenze..." 
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Indirizzo Fisico (Via / Piazza e N. Civico)</label>
                  <input 
                    type="text" 
                    value={salonAddress} 
                    onChange={(e) => setSalonAddress(e.target.value)}
                    placeholder="Es. Via Montenapoleone 18, 20121 Milano" 
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all" 
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Partita IVA</label>
                    <input 
                      type="text" 
                      value={salonPartitaIva} 
                      onChange={(e) => setSalonPartitaIva(e.target.value)}
                      placeholder="IT01234567890" 
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all font-mono uppercase" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Telefono di Contatto</label>
                    <input 
                      type="text" 
                      value={salonPhone} 
                      onChange={(e) => setSalonPhone(e.target.value)}
                      placeholder="Es. 02 8945 2311" 
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                {salonMessage ? (
                  <span className={`text-xs font-semibold ${salonMessage.includes("Errore") ? "text-rose-600" : "text-emerald-600"}`}>
                    {salonMessage}
                  </span>
                ) : <span />}

                <button 
                  onClick={handleSaveSalon}
                  disabled={savingSalon}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingSalon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Aggiorna Dati Salone</span>
                </button>
              </div>
            </div>
          )}


          {/* TAB: TEAM */}
          {activeTab === "team" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {(() => {
                const plan = userProfile?.planType || "FREE";
                const maxStaff = PLAN_STAFF_LIMITS[plan] || 1;
                const currentCount = staffList.length;
                const isLimitReached = currentCount >= maxStaff;

                return (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-semibold text-zinc-900">Gestione Team</h3>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            isLimitReached && plan !== "PRO"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}>
                            {plan === "PRO" ? `${currentCount} membri (Illimitati)` : `${currentCount} / ${maxStaff} membri usati`}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5">
                          Aggiungi o rimuovi collaboratori e invia inviti via email tramite Firebase.
                        </p>
                      </div>

                      <button 
                        onClick={handleOpenInvite}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer ${
                          isLimitReached && plan !== "PRO"
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isLimitReached && plan !== "PRO" ? "Aggiungi (Richiede Upgrade)" : "Nuovo Membro"}
                      </button>
                    </div>

                    {/* Banner Avviso Limite Piano Raggiunto */}
                    {isLimitReached && plan !== "PRO" && (
                      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                              Limite Collaboratori Raggiunto ({currentCount}/{maxStaff})
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {plan === "FREE"
                                ? "Il tuo Piano Starter permette solo 1 postazione (il titolare). Per aggiungere altri collaboratori, effettua l'upgrade a Medium o Pro."
                                : "Il tuo Piano Medium permette fino a 3 collaboratori. Per aggiungere membri senza limiti, passa a Pro."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                          {plan === "FREE" && (
                            <button
                              onClick={() => handleDirectUpgrade("MEDIUM")}
                              disabled={isUpgrading}
                              className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                            >
                              Passa a Medium (€11,99)
                            </button>
                          )}
                          <button
                            onClick={() => handleDirectUpgrade("PRO")}
                            disabled={isUpgrading}
                            className="flex-1 sm:flex-initial px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
                          >
                            Passa a Pro (€39)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Elenco Membri Staff */}
                    <div className="border border-zinc-200/60 rounded-xl divide-y divide-zinc-100 bg-white overflow-hidden shadow-xs">
                      {staffList.map((st) => {
                        const isOwner = st.role === "Titolare" || st.id === currentUser?.uid;
                        return (
                          <div key={st.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/60 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 font-semibold text-xs uppercase overflow-hidden">
                                {isOwner && currentUser?.photoURL ? (
                                  <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  st.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {st.fullName} {isOwner && <span className="text-zinc-500 font-normal">(Tu)</span>}
                                  </p>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    isOwner 
                                      ? "bg-zinc-900 text-white" 
                                      : st.status === "INVITATO" 
                                        ? "bg-amber-100 text-amber-800 border border-amber-200" 
                                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  }`}>
                                    {isOwner ? "Proprietario" : st.status === "INVITATO" ? "Invito Inviato" : "Attivo"}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5">{st.email || "Nessuna email registrata"}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-md">
                                {st.role}
                              </span>
                              {!isOwner && (
                                <button
                                  onClick={() => handleRemoveStaff(st.id)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Rimuovi collaboratore"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {staffList.length <= 1 && (
                        <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-50/50">
                          Nessun altro collaboratore aggiunto oltre al titolare. Clicca &quot;Nuovo Membro&quot; per inviare inviti email al tuo staff.
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}


          {/* TAB: ABBONAMENTO */}
          {activeTab === "abbonamento" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">Abbonamento Salone</h3>
                  <p className="text-sm text-zinc-500">Gestisci il tuo piano e i dettagli della sottoscrizione.</p>
                </div>
                <button
                  onClick={async () => {
                    if (currentUser) {
                      setIsUpgrading(true);
                      const p = await fetchUserProfile(currentUser.uid);
                      if (p) setUserProfile(p);
                      setIsUpgrading(false);
                    }
                  }}
                  disabled={isUpgrading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
                  title="Sincronizza piano da Cloud Firestore"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isUpgrading ? "animate-spin text-zinc-900" : "text-zinc-500"}`} />
                  Sincronizza Stato Piano
                </button>
              </div>
              
              {(() => {
                const planType = userProfile?.planType || (userProfile?.staffCount && userProfile.staffCount > 3 ? "PRO" : userProfile?.staffCount && userProfile.staffCount > 1 ? "MEDIUM" : "FREE");
                const isYearly = userProfile?.billingPeriod === "yearly";

                if (planType === "FREE") {
                  return (
                    <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                            Piano Starter (Gratuito)
                          </span>
                          <h4 className="text-xl font-bold text-zinc-900">€ 0,00 <span className="text-sm text-zinc-500 font-normal">/ mese</span></h4>
                          <p className="text-xs text-zinc-500 mt-1">Incluso: 1 persona nel salone, gestione clienti e agenda digitale completa.</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Attivo
                        </span>
                      </div>
                      <div className="pt-3 border-t border-zinc-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">Passa ad un abbonamento con più collaboratori e statistiche avanzate:</span>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <button 
                            onClick={() => handleDirectUpgrade("MEDIUM")}
                            disabled={isUpgrading}
                            className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {isUpgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Passa a Medium (€ 11,99/m)
                          </button>
                          <button 
                            onClick={() => handleDirectUpgrade("PRO")}
                            disabled={isUpgrading}
                            className="flex-1 sm:flex-initial px-3.5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {isUpgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Passa a Pro (€ 39/m)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (planType === "MEDIUM") {
                  return (
                    <div className="bg-white border-2 border-indigo-600 rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                            Piano Medium (Fino a 3 Persone)
                          </span>
                          <h4 className="text-xl font-bold text-zinc-900">
                            {isYearly ? "€ 115,99" : "€ 11,99"} 
                            <span className="text-sm text-zinc-500 font-normal"> {isYearly ? "/ anno (-20%)" : "/ mese"}</span>
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1">
                            Team: {userProfile?.staffCount || "Fino a 3"} persone registrate. Include tutte le funzionalità Pro.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Attivo
                          </span>
                          <p className="text-[11px] text-zinc-400 mt-1">Rinnovo automatico</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          Stai crescendo e vuoi collaboratori illimitati?
                        </span>
                        <button 
                          onClick={() => handleDirectUpgrade("PRO")}
                          disabled={isUpgrading}
                          className="w-full sm:w-auto px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isUpgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          Passa al Piano Pro (€ 39/m) & Vai all&apos;Agenda
                        </button>
                      </div>
                    </div>
                  );
                }

                // Default: Piano PRO
                return (
                  <div className="bg-zinc-900 text-white rounded-2xl p-6 space-y-4 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                          Piano Pro
                        </span>
                        <h4 className="text-xl font-bold text-white">
                          {isYearly ? "€ 374,40" : "€ 39,00"} 
                          <span className="text-sm text-zinc-400 font-normal"> {isYearly ? "/ anno (-20%)" : "/ mese"}</span>
                        </h4>
                        <p className="text-xs text-zinc-300 mt-1">
                          Collaboratori e turni illimitati ({userProfile?.staffCount || 4}+ collaboratori). Supporto prioritario.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-400 border border-emerald-400/30">
                          Attivo
                        </span>
                        <p className="text-[11px] text-zinc-400 mt-1">Rinnovo automatico</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Piano massimo attivo con tutte le feature sbloccate.</span>
                      <button 
                        disabled
                        className="px-4 py-2 bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold opacity-70 cursor-not-allowed"
                      >
                        Piano Massimo
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* Drawer: Invito Membro Staff con Email Reale Firebase */}
      {isInviteOpen && (
        <>
          <div 
            className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => !isSendingInvite && setIsInviteOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex items-center justify-between p-6 border-b border-zinc-200/60">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Invita Membro del Team</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Invio reale di un&apos;email di partecipazione tramite Firebase Auth.</p>
              </div>
              <button 
                onClick={() => !isSendingInvite && setIsInviteOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {inviteSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-950">Invito Completato!</p>
                      <p className="mt-0.5 leading-relaxed">{inviteSuccessMsg}</p>
                    </div>
                  </div>
                  {lastInviteUrl && (
                    <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (lastInviteUrl) {
                            navigator.clipboard.writeText(lastInviteUrl);
                            setCopiedInviteUrl(true);
                            setTimeout(() => setCopiedInviteUrl(false), 2500);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        {copiedInviteUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedInviteUrl ? "Link Copiato!" : "Copia Link Diretto"}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Ciao! Ti ho aggiunto al team del salone "${userProfile?.salonName || salonName || "Trimmy"}". Clicca qui per completare l'accesso ed entrare nella tua area staff: ${lastInviteUrl}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        Condividi su WhatsApp 💬
                      </a>
                    </div>
                  )}
                </div>
              )}

              {inviteErrorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Impossibile Inviare Invito</p>
                    <p className="mt-0.5 leading-relaxed">{inviteErrorMsg}</p>
                  </div>
                </div>
              )}

              {!inviteSuccessMsg && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Nome Completo Collaboratore *
                    </label>
                    <input 
                      type="text" 
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      placeholder="Es. Mario Rossi" 
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Indirizzo Email Reale Destinatario *
                    </label>
                    <input 
                      type="email" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="collaboratore@gmail.com" 
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                      L&apos;email riceverà il link di accesso a Trimmy per visualizzare i turni e la propria agenda.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Ruolo Assegnato nel Salone
                    </label>
                    <select 
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Staff">Staff (Agenda personale e gestione trattamenti)</option>
                      <option value="Manager">Manager (Accesso completo ai report e gestione)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200/70 rounded-xl text-xs text-zinc-500 space-y-1">
                    <p className="font-semibold text-zinc-700">Dettagli Invito Firebase:</p>
                    <p>• Mittente: Servizio Notifiche Firebase</p>
                    <p>• Salone: <strong>{userProfile?.salonName || salonName || "Il Mio Salone"}</strong></p>
                    <p>• Piano Salone: <strong>{userProfile?.planType || "Starter"}</strong></p>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200/60 bg-zinc-50">
              {inviteSuccessMsg ? (
                <button 
                  type="button"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setInviteSuccessMsg("");
                    setInviteFullName("");
                    setInviteEmail("");
                    setLastInviteUrl(null);
                  }}
                  className="w-full px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
                >
                  Fatto, torna al Team
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    type="button"
                    disabled={isSendingInvite}
                    onClick={() => setIsInviteOpen(false)}
                    className="flex-1 px-4 py-2 bg-white border border-zinc-200/80 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Annulla
                  </button>
                  <button 
                    type="button"
                    disabled={isSendingInvite}
                    onClick={handleSendStaffInvite}
                    className="flex-1 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isSendingInvite ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Invio email...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Invia Invito
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* Modal: Blocco Limite Collaboratori Raggiunto con Invito Upgrade */}
      {showUpgradeLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowUpgradeLimitModal(false)}
          />
          <div className="relative bg-white border border-zinc-200/80 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-zinc-900 leading-snug">
                  Limite Collaboratori Raggiunto
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Il tuo abbonamento attuale non permette di aggiungere altri collaboratori.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowUpgradeLimitModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-2 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold text-amber-950">
                Piano attuale: {userProfile?.planType || "Starter (FREE)"} ({staffList.length}/{PLAN_STAFF_LIMITS[userProfile?.planType || "FREE"]} membri attivi)
              </p>
              <p className="text-amber-800">
                {userProfile?.planType === "FREE" || !userProfile?.planType
                  ? "Il piano Starter gratuito include solo 1 postazione (il titolare). Per aggiungere collaboratori al tuo team, effettua l'upgrade a Medium o Pro."
                  : "Il piano Medium include fino a 3 collaboratori. Per aggiungere membri senza alcun limite, passa al piano Pro."}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {(userProfile?.planType === "FREE" || !userProfile?.planType) && (
                <button
                  type="button"
                  disabled={isUpgrading}
                  onClick={() => {
                    setShowUpgradeLimitModal(false);
                    handleDirectUpgrade("MEDIUM");
                  }}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Upgrade a Piano Medium (€ 11,99/m — fino a 3 persone)
                </button>
              )}
              <button
                type="button"
                disabled={isUpgrading}
                onClick={() => {
                  setShowUpgradeLimitModal(false);
                  handleDirectUpgrade("PRO");
                }}
                className="w-full px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Upgrade a Piano Pro (€ 39/m — collaboratori illimitati)
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeLimitModal(false)}
                className="w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Ho capito, mantieni piano attuale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Conferma Eliminazione Account Definitiva */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => !isDeletingAccount && setIsDeleteModalOpen(false)}
          />
          <div className="relative bg-white border border-zinc-200/80 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-zinc-900 leading-snug">Sei sicuro di voler eliminare l&apos;account?</h3>
                <p className="text-xs text-zinc-500 mt-1">Questa azione è immediata e irreversibile.</p>
              </div>
              <button 
                type="button"
                onClick={() => !isDeletingAccount && setIsDeleteModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/70 rounded-xl space-y-1.5 text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold text-rose-950 flex items-center gap-1.5">
                <span>⚠️</span> Conseguenze dell&apos;eliminazione:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-rose-800">
                <li>L&apos;account ({currentUser?.email}) verrà <strong>completamente cancellato</strong> dal database di autenticazione.</li>
                <li>Perderai l&apos;accesso immediato e definitivo al gestionale.</li>
                <li>Questa operazione non può essere annullata.</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-100/70 border border-rose-300 rounded-xl text-xs text-rose-800 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeletingAccount ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sì, Elimina Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ImpostazioniPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Caricamento impostazioni...</div>}>
      <ImpostazioniContent />
    </Suspense>
  );
}
