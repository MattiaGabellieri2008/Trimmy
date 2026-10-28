"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Settings, Shield, CreditCard, Building, User, Mail, Lock, Plus, Check, X, Loader2, LogOut, Trash2, AlertTriangle, Users, Copy, RotateCw, MessageSquare, Smartphone, Send, Clock, Star, BellRing, Sparkles, Share2, Palette, Sun, Moon, Laptop, Paintbrush, Award, Ticket, Gift, Coins, Percent } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { BRAND_PALETTES, BrandPalette, ThemeMode } from "@/lib/theme-store";
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
import { 
  NotificationSettings, 
  NotificationLogItem, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  PLAN_NOTIFICATION_CREDITS,
  DEFAULT_NOTIFICATION_TEMPLATES
} from "@/lib/notifications-types";
import { 
  fetchSalonNotificationSettings, 
  saveSalonNotificationSettings, 
  fetchNotificationLogs, 
  sendNotification 
} from "@/lib/notifications-service";
import { 
  requestPushNotificationPermission, 
  getPushPermissionStatus 
} from "@/lib/fcm-client";
import { 
  DaySchedule, 
  fetchSalonWorkingHours, 
  saveSalonWorkingHours, 
  DEFAULT_WORKING_HOURS 
} from "@/lib/working-hours-store";

import {
  fetchSalonLoyaltySettings,
  saveSalonLoyaltySettings,
  fetchSalonTreatmentPackages,
  saveSalonTreatmentPackage,
  deleteSalonTreatmentPackage,
  LoyaltySettings,
  DEFAULT_LOYALTY_SETTINGS,
  TreatmentPackage
} from "@/lib/fidelity-store";

type TabType = "profilo" | "salone" | "brand" | "orari" | "team" | "notifiche" | "fidelity" | "abbonamento";

function ImpostazioniContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("profilo");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Orari Salone State
  const [workingHours, setWorkingHours] = useState<DaySchedule[]>(DEFAULT_WORKING_HOURS);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaveMessage, setHoursSaveMessage] = useState("");

  // Theme & Brand Palette State
  const { 
    themeMode, 
    setThemeMode, 
    paletteId, 
    setPaletteId, 
    customHex, 
    setCustomHex, 
    resolvedPalette, 
    saveCurrentSettings 
  } = useTheme();
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandSaveMessage, setBrandSaveMessage] = useState("");
  const [customHexInput, setCustomHexInput] = useState(customHex || "#18181b");

  useEffect(() => {
    if (customHex) setCustomHexInput(customHex);
  }, [customHex]);

  const handleSaveBrand = async () => {
    setSavingBrand(true);
    setBrandSaveMessage("");
    try {
      await saveCurrentSettings({
        themeMode,
        paletteId,
        customPrimaryHex: paletteId === "custom" ? customHexInput : undefined,
      });
      setBrandSaveMessage("Configurazione Brand & Aspetto salvata con successo!");
      setTimeout(() => setBrandSaveMessage(""), 3500);
    } catch (err) {
      console.error("Errore salvataggio brand:", err);
      setBrandSaveMessage("Errore durante il salvataggio.");
    } finally {
      setSavingBrand(false);
    }
  };

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

  // Notifiche Firebase Cloud Messaging (FCM) State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notifLogs, setNotifLogs] = useState<NotificationLogItem[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const [savingNotifSettings, setSavingNotifSettings] = useState(false);
  const [notifSaveMsg, setNotifSaveMsg] = useState("");
  const [selectedTemplateTab, setSelectedTemplateTab] = useState<"confirmation" | "reminder" | "cancellation" | "reviewRequest" | "marketing">("confirmation");
  const [testPushTitle, setTestPushTitle] = useState("🔔 Prova Notifica Trimmy");
  const [testPushBody, setTestPushBody] = useState("Questo è un messaggio di test inviato tramite Firebase Cloud Messaging.");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPushPermission(getPushPermissionStatus());
    }
  }, []);

  const loadNotificationData = async (tid: string) => {
    setIsLoadingNotifs(true);
    try {
      const [settings, logs] = await Promise.all([
        fetchSalonNotificationSettings(tid),
        fetchNotificationLogs(tid)
      ]);
      setNotifSettings(settings);
      setNotifLogs(logs);
    } catch (e) {
      console.warn("Nota caricamento impostazioni notifiche:", e);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  // Fidelity & Pacchetti State (Modulo B7)
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [treatmentPackages, setTreatmentPackages] = useState<TreatmentPackage[]>([]);
  const [savingFidelity, setSavingFidelity] = useState(false);
  const [fidelitySaveMsg, setFidelitySaveMsg] = useState("");
  const [newPkgModalOpen, setNewPkgModalOpen] = useState(false);
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgServiceName, setNewPkgServiceName] = useState("");
  const [newPkgSessions, setNewPkgSessions] = useState(6);
  const [newPkgPrice, setNewPkgPrice] = useState(110);
  const [newPkgValidityDays, setNewPkgValidityDays] = useState(180);
  const [isSavingPkg, setIsSavingPkg] = useState(false);

  const loadFidelityData = async (tid: string) => {
    try {
      const [settings, pkgs] = await Promise.all([
        fetchSalonLoyaltySettings(tid),
        fetchSalonTreatmentPackages(tid)
      ]);
      setLoyaltySettings(settings);
      setTreatmentPackages(pkgs);
    } catch (e) {
      console.warn("Nota caricamento fidelity in impostazioni:", e);
    }
  };

  const handleSaveFidelitySettings = async () => {
    if (!currentUser) return;
    setSavingFidelity(true);
    setFidelitySaveMsg("");
    try {
      const tid = getSalonTenantId(currentUser.uid);
      await saveSalonLoyaltySettings(tid, loyaltySettings);
      setFidelitySaveMsg("Regole Fidelity salvate con successo!");
      setTimeout(() => setFidelitySaveMsg(""), 3500);
    } catch (err: any) {
      console.error("Errore salvataggio fidelity:", err);
      setFidelitySaveMsg("Errore durante il salvataggio delle regole fidelity.");
    } finally {
      setSavingFidelity(false);
    }
  };

  const handleCreatePackage = async () => {
    if (!currentUser || !newPkgName.trim() || !newPkgServiceName.trim()) return;
    setIsSavingPkg(true);
    try {
      const tid = getSalonTenantId(currentUser.uid);
      const pkgId = `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newPkg: TreatmentPackage = {
        id: pkgId,
        salonId: tid,
        name: newPkgName.trim(),
        serviceId: `srv-${newPkgServiceName.toLowerCase().replace(/\s+/g, "-")}`,
        serviceName: newPkgServiceName.trim(),
        totalSessions: Math.max(2, Number(newPkgSessions) || 6),
        price: Math.max(0, Number(newPkgPrice) || 0),
        validityDays: Math.max(30, Number(newPkgValidityDays) || 180),
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await saveSalonTreatmentPackage(tid, newPkg);
      const updated = await fetchSalonTreatmentPackages(tid);
      setTreatmentPackages(updated);
      setNewPkgName("");
      setNewPkgServiceName("");
      setNewPkgSessions(6);
      setNewPkgPrice(110);
      setNewPkgValidityDays(180);
      setNewPkgModalOpen(false);
    } catch (err) {
      console.error("Errore creazione pacchetto trattamenti:", err);
    } finally {
      setIsSavingPkg(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!currentUser) return;
    if (!confirm("Sei sicuro di voler eliminare questo pacchetto dal catalogo?")) return;
    try {
      const tid = getSalonTenantId(currentUser.uid);
      await deleteSalonTreatmentPackage(tid, packageId);
      setTreatmentPackages((prev) => prev.filter((p) => p.id !== packageId));
    } catch (err) {
      console.error("Errore eliminazione pacchetto:", err);
    }
  };

  const handleEnablePush = async () => {
    if (!currentUser) return;
    setIsEnablingPush(true);
    try {
      const res = await requestPushNotificationPermission(currentUser.uid);
      if (res.success && res.token) {
        setPushPermission("granted");
        setTestResultMsg({ success: true, text: "Notifiche Push abilitate con successo su questo dispositivo! Token registrato su Firebase." });
      } else {
        setPushPermission(getPushPermissionStatus());
        setTestResultMsg({ success: false, text: res.error || "Impossibile abilitare le notifiche push." });
      }
    } catch (err: any) {
      setTestResultMsg({ success: false, text: err.message || "Errore attivazione notifiche push." });
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSaveNotifSettings = async () => {
    if (!currentUser) return;
    setSavingNotifSettings(true);
    setNotifSaveMsg("");
    try {
      const tid = getSalonTenantId(currentUser.uid);
      await saveSalonNotificationSettings(tid, notifSettings);
      setNotifSaveMsg("Impostazioni notifiche Firebase salvate con successo!");
      setTimeout(() => setNotifSaveMsg(""), 3500);
    } catch (e: any) {
      setNotifSaveMsg("Errore durante il salvataggio.");
    } finally {
      setSavingNotifSettings(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!currentUser) return;
    setIsSendingTest(true);
    setTestResultMsg(null);
    try {
      const tid = getSalonTenantId(currentUser.uid);
      const sName = userProfile?.salonName || salonName || "Trimmy Salone";
      const res = await sendNotification({
        tenantId: tid,
        salonName: sName,
        customerName: "Dispositivo Salone",
        type: "TEST",
        channel: "PUSH_FCM",
        title: testPushTitle,
        customMessage: testPushBody
      });
      if (res.success) {
        setTestResultMsg({
          success: true,
          text: res.simulated
            ? `Notifica di prova simulata con successo! (Registrata nel log Firebase FCM sottostante)`
            : `Notifica Push Firebase Cloud Messaging inviata con successo! ID: ${res.messageId || "fcm-ok"}`
        });
        const updatedLogs = await fetchNotificationLogs(tid);
        setNotifLogs(updatedLogs);
      } else {
        setTestResultMsg({ success: false, text: res.error || "Impossibile inviare la notifica di test." });
      }
    } catch (err: any) {
      setTestResultMsg({ success: false, text: err.message || "Errore durante l'invio del test FCM." });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveWorkingHours = async () => {
    if (!currentUser) return;
    setSavingHours(true);
    setHoursSaveMessage("");
    try {
      const tid = getSalonTenantId(currentUser.uid);
      await saveSalonWorkingHours(tid, workingHours);
      setHoursSaveMessage("Orari di apertura e chiusura salvati con successo!");
      setTimeout(() => setHoursSaveMessage(""), 3500);
    } catch (err: any) {
      setHoursSaveMessage("Errore durante il salvataggio degli orari.");
    } finally {
      setSavingHours(false);
    }
  };

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
    if (tab && ["profilo", "salone", "brand", "orari", "team", "notifiche", "abbonamento"].includes(tab)) {
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

        // Carica impostazioni e log notifiche Firebase Cloud Messaging (FCM)
        loadNotificationData(tid).catch(console.error);

        // Carica impostazioni fidelity e pacchetti
        loadFidelityData(tid).catch(console.error);

        // Carica orari di apertura del salone
        fetchSalonWorkingHours(tid).then((hours) => {
          if (hours && hours.length > 0) setWorkingHours(hours);
        }).catch(console.error);

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
        setInviteSuccessMsg(`Collaboratore registrato nel team! Puoi copiare il link di invito qui sotto o condividerlo con il collaboratore.`);
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
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "profilo" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <User className="w-4 h-4" />
              Profilo Personale
            </button>
            <button
              onClick={() => setActiveTab("salone")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "salone" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <Building className="w-4 h-4" />
              Dettagli Salone
            </button>
            <button
              onClick={() => setActiveTab("brand")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "brand" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <Palette className="w-4 h-4 text-brand" />
              Brand & Aspetto
            </button>
            <button
              onClick={() => setActiveTab("orari")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "orari" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              Orari Salone
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "team" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <Shield className="w-4 h-4" />
              Gestione Team
            </button>
            <button
              onClick={() => {
                setActiveTab("notifiche");
                if (currentUser) loadNotificationData(getSalonTenantId(currentUser.uid));
              }}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "notifiche" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <BellRing className="w-4 h-4 text-indigo-600" />
              Notifiche Push (FCM)
            </button>
            <button
              onClick={() => {
                setActiveTab("fidelity");
                if (currentUser) loadFidelityData(getSalonTenantId(currentUser.uid));
              }}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "fidelity" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              Fidelity & Pacchetti
            </button>
            <button
              onClick={() => setActiveTab("abbonamento")}
              className={`flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left shrink-0 whitespace-nowrap ${activeTab === "abbonamento" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              <CreditCard className="w-4 h-4" />
              Abbonamento SaaS
            </button>
          </nav>
        </aside>

        {/* Contenuto Principale (Form e Viste) */}
        <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm text-zinc-900 dark:text-zinc-100">
          
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
                <p className="text-sm text-zinc-500">Gestisci i dati pubblici della tua attività che appariranno ai clienti nel marketplace.</p>
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

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                {salonMessage ? (
                  <span className={`text-xs font-semibold ${salonMessage.includes("Errore") ? "text-rose-600" : "text-emerald-600"}`}>
                    {salonMessage}
                  </span>
                ) : <span />}

                <button 
                  onClick={handleSaveSalon}
                  disabled={savingSalon}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingSalon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Aggiorna Dati Salone</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: BRAND & ASPETTO (PALETTE SALONE & DARK MODE) */}
          {activeTab === "brand" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Palette className="w-5 h-5 text-brand" />
                    Brand & Aspetto Salone
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Personalizza il tema dell&apos;interfaccia (Chiaro/Scuro) e il colore guida del tuo salone, sincronizzato su gestionale e vetrina online.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveBrand}
                  disabled={savingBrand}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Salva Configurazione Brand</span>
                </button>
              </div>

              {brandSaveMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{brandSaveMessage}</span>
                </div>
              )}

              {/* 1. SELEZIONE MODALITÀ TEMA INTERFACCIA (DARK MODE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Modalità Interfaccia (Dark Mode)</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Scegli come visualizzare il gestionale su computer e tablet.</p>
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Attivo: {themeMode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card Light */}
                  <div
                    onClick={() => setThemeMode("light")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      themeMode === "light"
                        ? "border-brand bg-zinc-50/80 dark:bg-zinc-800/80 ring-2 ring-brand/20 shadow-xs"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <Sun className="w-5 h-5" />
                      </div>
                      {themeMode === "light" && (
                        <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-xs">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-zinc-900 dark:text-white">Tema Chiaro</h5>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        Sfondo bianco puro e ad alto contrasto, ideale per ambienti luminosi.
                      </p>
                    </div>
                  </div>

                  {/* Card Dark */}
                  <div
                    onClick={() => setThemeMode("dark")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      themeMode === "dark"
                        ? "border-brand bg-zinc-50/80 dark:bg-zinc-800/80 ring-2 ring-brand/20 shadow-xs"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400">
                        <Moon className="w-5 h-5" />
                      </div>
                      {themeMode === "dark" && (
                        <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-xs">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-zinc-900 dark:text-white">Tema Scuro</h5>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        Tonalità scura profonda (#09090b), riposante per gli occhi durante le lunghe giornate.
                      </p>
                    </div>
                  </div>

                  {/* Card System */}
                  <div
                    onClick={() => setThemeMode("system")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      themeMode === "system"
                        ? "border-brand bg-zinc-50/80 dark:bg-zinc-800/80 ring-2 ring-brand/20 shadow-xs"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {themeMode === "system" && (
                        <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-xs">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-zinc-900 dark:text-white">Sistema (Auto)</h5>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        Si adatta automaticamente al tema di Windows, macOS, iPad o Android.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SELEZIONE PALETTE SALONE (BRAND IDENTITY) */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Palette Colore Salone</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Seleziona una delle palette di lusso predefinite oppure definisci il tuo codice HEX personalizzato.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {BRAND_PALETTES.map((palette) => {
                    const isSelected = paletteId === palette.id;
                    return (
                      <div
                        key={palette.id}
                        onClick={() => setPaletteId(palette.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                          isSelected
                            ? "border-zinc-900 dark:border-white bg-zinc-50/60 dark:bg-zinc-800/60 shadow-sm"
                            : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                        }`}
                        style={{
                          borderColor: isSelected ? palette.primaryHex : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span 
                              className="w-7 h-7 rounded-full shadow-xs border border-white/20 shrink-0" 
                              style={{ backgroundColor: palette.primaryHex }}
                            />
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              {palette.name}
                            </span>
                          </div>
                          {isSelected && (
                            <span 
                              className="w-5 h-5 rounded-full text-white flex items-center justify-center text-xs shrink-0"
                              style={{ backgroundColor: palette.primaryHex }}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          {palette.description}
                        </p>

                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-400">HEX: {palette.primaryHex}</span>
                          <span 
                            className="px-2 py-0.5 rounded-md font-semibold text-[10px]"
                            style={{ 
                              backgroundColor: palette.subtleHex,
                              color: palette.primaryHex
                            }}
                          >
                            Sample
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Card Colore Personalizzato (HEX) */}
                  <div
                    onClick={() => setPaletteId("custom")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      paletteId === "custom"
                        ? "border-zinc-900 dark:border-white bg-zinc-50/60 dark:bg-zinc-800/60 shadow-sm"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                    style={{
                      borderColor: paletteId === "custom" ? customHexInput : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <label 
                          htmlFor="customColorPicker" 
                          className="w-7 h-7 rounded-full shadow-xs border border-white/20 shrink-0 cursor-pointer overflow-hidden relative block"
                          style={{ backgroundColor: customHexInput }}
                        >
                          <input
                            id="customColorPicker"
                            type="color"
                            value={customHexInput.startsWith("#") ? customHexInput : "#18181b"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomHexInput(val);
                              setCustomHex(val);
                            }}
                            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                          />
                        </label>
                        <span className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <Paintbrush className="w-3.5 h-3.5 text-zinc-400" />
                          Personalizzato
                        </span>
                      </div>
                      {paletteId === "custom" && (
                        <span 
                          className="w-5 h-5 rounded-full text-white flex items-center justify-center text-xs shrink-0"
                          style={{ backgroundColor: customHexInput }}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Scegli qualsiasi colore HEX conforme alla tua brand identity aziendale.
                    </p>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <input
                        type="text"
                        value={customHexInput}
                        maxLength={7}
                        placeholder="#18181b"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomHexInput(val);
                          if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setCustomHex(val);
                          }
                        }}
                        className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ANTEPRIMA LIVE IN TEMPO REALE */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Anteprima Live Componenti Brand</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ecco come appariranno i tuoi pulsanti, badge e accenti con la combinazione attuale:
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Bottone Primario Brand */}
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-default"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pulsante Primario &bull; Prenota</span>
                    </button>

                    {/* Badge Pill Brand */}
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-subtle text-brand border border-brand flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      Trattamento Top Salone
                    </span>

                    {/* Badge Stato */}
                    <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-l-4 border-brand shadow-2xs">
                      Stato Appuntamento: Confermato
                    </span>

                    {/* Prezzo di Esempio */}
                    <div className="flex items-baseline gap-1 px-3 py-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-xs text-zinc-400">Da</span>
                      <span className="text-base font-black text-brand">€ 48,00</span>
                    </div>
                  </div>

                  {/* Mockup Pagina Vetrina Pubblica */}
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                          {salonName || "Atelier Bellezza & Barber"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white">
                          Vetrina Pubblica
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Questo colore guiderà i tuoi clienti dal Marketplace fino alla conferma dell&apos;appuntamento.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        Prenota Subito
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pulsante Salva in fondo per comodità */}
              <div className="pt-4 border-t border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Le modifiche al tema vengono applicate istantaneamente a tutti i dispositivi del salone.
                </p>
                <button
                  type="button"
                  onClick={handleSaveBrand}
                  disabled={savingBrand}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Salva Configurazione</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: ORARI SALONE & GIORNI DI CHIUSURA */}
          {activeTab === "orari" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Orari di Apertura & Giorni di Chiusura
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                    Imposta gli orari e i giorni di lavoro. I giorni chiusi saranno automaticamente disabilitati nel wizard di prenotazione online.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWorkingHours((prev) =>
                      prev.map((d) =>
                        d.isOpen
                          ? { ...d, openTime: "09:00", closeTime: "19:30", hasBreak: true, breakStart: "13:00", breakEnd: "14:00" }
                          : d
                      )
                    );
                  }}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg transition shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  ⚡ Orario Standard (09:00 - 19:30)
                </button>
              </div>

              {/* Elenco 7 Giorni della Settimana */}
              <div className="space-y-3">
                {workingHours.map((schedule, idx) => {
                  return (
                    <div
                      key={schedule.dayOfWeek}
                      className={`p-4 rounded-xl border transition-all ${
                        schedule.isOpen
                          ? "bg-white border-zinc-200 shadow-2xs"
                          : "bg-zinc-50/70 border-zinc-200/50 opacity-75"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Nome Giorno & Toggle Apertura */}
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...workingHours];
                              updated[idx] = { ...schedule, isOpen: !schedule.isOpen };
                              setWorkingHours(updated);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              schedule.isOpen
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-zinc-200 text-zinc-600 border border-zinc-300"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${schedule.isOpen ? "bg-emerald-600" : "bg-zinc-400"}`} />
                            {schedule.isOpen ? "Aperto" : "Chiuso"}
                          </button>
                          <span className={`text-sm font-bold ${schedule.isOpen ? "text-zinc-900" : "text-zinc-400 line-through"}`}>
                            {schedule.dayName}
                          </span>
                        </div>

                        {/* Configurazione Orari (se aperto) */}
                        {schedule.isOpen ? (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-400 font-medium">Orario:</span>
                              <input
                                type="time"
                                value={schedule.openTime}
                                onChange={(e) => {
                                  const updated = [...workingHours];
                                  updated[idx] = { ...schedule, openTime: e.target.value };
                                  setWorkingHours(updated);
                                }}
                                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-zinc-800 font-semibold focus:outline-none focus:border-zinc-900"
                              />
                              <span>-</span>
                              <input
                                type="time"
                                value={schedule.closeTime}
                                onChange={(e) => {
                                  const updated = [...workingHours];
                                  updated[idx] = { ...schedule, closeTime: e.target.value };
                                  setWorkingHours(updated);
                                }}
                                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-zinc-800 font-semibold focus:outline-none focus:border-zinc-900"
                              />
                            </div>

                            {/* Pausa Pranzo */}
                            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(schedule.hasBreak)}
                                  onChange={(e) => {
                                    const updated = [...workingHours];
                                    updated[idx] = {
                                      ...schedule,
                                      hasBreak: e.target.checked,
                                      breakStart: schedule.breakStart || "13:00",
                                      breakEnd: schedule.breakEnd || "14:00"
                                    };
                                    setWorkingHours(updated);
                                  }}
                                  className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
                                />
                                <span className="font-medium text-zinc-500">Pausa pranzo</span>
                              </label>

                              {schedule.hasBreak && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={schedule.breakStart || "13:00"}
                                    onChange={(e) => {
                                      const updated = [...workingHours];
                                      updated[idx] = { ...schedule, breakStart: e.target.value };
                                      setWorkingHours(updated);
                                    }}
                                    className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-xs text-zinc-800"
                                  />
                                  <span>-</span>
                                  <input
                                    type="time"
                                    value={schedule.breakEnd || "14:00"}
                                    onChange={(e) => {
                                      const updated = [...workingHours];
                                      updated[idx] = { ...schedule, breakEnd: e.target.value };
                                      setWorkingHours(updated);
                                    }}
                                    className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-xs text-zinc-800"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-400 italic">
                            Chiusura settimanale (nessun appuntamento prenotabile)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pulsante Salvataggio Orari */}
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                {hoursSaveMessage ? (
                  <span className={`text-xs font-semibold ${hoursSaveMessage.includes("Errore") ? "text-rose-600" : "text-emerald-600"}`}>
                    {hoursSaveMessage}
                  </span>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveWorkingHours}
                  disabled={savingHours}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Salva Orari di Lavoro</span>
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


          {/* TAB: NOTIFICHE PUSH & FIREBASE CLOUD MESSAGING (FCM) */}
          {activeTab === "notifiche" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-indigo-600" />
                    Notifiche Push & Firebase Cloud Messaging (FCM)
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Notifiche push istantanee per clienti e collaboratori, governate dall&apos;infrastruttura Google Firebase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveNotifSettings}
                  disabled={savingNotifSettings}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors shadow-xs cursor-pointer self-start sm:self-auto disabled:opacity-50"
                >
                  {savingNotifSettings ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Salva Modifiche
                </button>
              </div>

              {notifSaveMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{notifSaveMsg}</span>
                </div>
              )}

              {/* Banner Governatore Firebase Cloud Messaging */}
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 mb-0.5">
                        Infrastruttura Attiva • Google Firebase FCM
                      </span>
                      <h4 className="text-base font-bold text-zinc-900">
                        Governato da Firebase Cloud Messaging
                      </h4>
                    </div>
                  </div>

                  <a
                    href="https://console.firebase.google.com/project/gestionale-saloni/notification/compose"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <span>Apri Console Firebase FCM</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  Tutte le notifiche vengono inoltrate tramite il protocollo <strong>FCM di Google</strong> direttamente su smartphone, tablet e browser desktop dei clienti e dello staff. Puoi inviare comunicazioni massive, annunci e promozioni con titolo, testo e immagini sia da questa dashboard sia direttamente dal pannello <em>Cloud Messaging</em> della console Firebase.
                </p>
              </div>

              {/* Box Stato Notifiche Push del Dispositivo Attuale */}
              <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-zinc-700" />
                    Ricezione Notifiche Push su questo Dispositivo
                  </p>
                  <p className="text-xs text-zinc-500">
                    Stato autorizzazione browser:{" "}
                    <span className={`font-semibold ${pushPermission === "granted" ? "text-emerald-600" : pushPermission === "denied" ? "text-rose-600" : "text-amber-600"}`}>
                      {pushPermission === "granted" ? "Attivo & Autorizzato ✅" : pushPermission === "denied" ? "Bloccato dal browser ❌" : "In attesa di attivazione ⚠️"}
                    </span>
                  </p>
                </div>

                {pushPermission !== "granted" && (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={isEnablingPush}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isEnablingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                    Attiva Notifiche Push
                  </button>
                )}
              </div>

              {/* Canali di Notifica Abilitati */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-3">
                  Canali Firebase Abilitati
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Push Notifications FCM */}
                  <div className={`p-4 rounded-xl border transition-all ${notifSettings.enabledChannels.pushFcm ? "bg-indigo-50/40 border-indigo-300" : "bg-zinc-50 border-zinc-200"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          <BellRing className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Notifiche Push FCM</p>
                          <p className="text-xs text-zinc-500">Istantanee su smartphone, tablet e PC</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifSettings.enabledChannels.pushFcm}
                          onChange={(e) => setNotifSettings({
                            ...notifSettings,
                            enabledChannels: { ...notifSettings.enabledChannels, pushFcm: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Notifiche In-App */}
                  <div className={`p-4 rounded-xl border transition-all ${notifSettings.enabledChannels.inApp ? "bg-emerald-50/40 border-emerald-300" : "bg-zinc-50 border-zinc-200"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Centro Notifiche In-App</p>
                          <p className="text-xs text-zinc-500">Badge e avvisi nel gestionale</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifSettings.enabledChannels.inApp}
                          onChange={(e) => setNotifSettings({
                            ...notifSettings,
                            enabledChannels: { ...notifSettings.enabledChannels, inApp: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Eventi & Automazioni */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-3">
                  Automazioni & Eventi
                </h4>
                <div className="divide-y divide-zinc-200/60 border border-zinc-200/60 rounded-xl overflow-hidden bg-white">
                  {/* Conferma Prenotazione */}
                  <div className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        Conferma Immediata Prenotazione
                      </p>
                      <p className="text-xs text-zinc-500">
                        Invia notifica al cliente subito dopo la registrazione dell&apos;appuntamento (online o da agenda).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={notifSettings.sendConfirmation}
                        onChange={(e) => setNotifSettings({ ...notifSettings, sendConfirmation: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-900"></div>
                    </label>
                  </div>

                  {/* Promemoria 24h prima */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Promemoria Automatico Appuntamento
                      </p>
                      <p className="text-xs text-zinc-500">
                        Ricorda l&apos;appuntamento per azzerare i no-show dei clienti.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <select
                        value={notifSettings.reminderHoursBefore}
                        onChange={(e) => setNotifSettings({ ...notifSettings, reminderHoursBefore: Number(e.target.value) })}
                        className="text-xs font-medium border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 outline-none"
                      >
                        <option value={12}>12 ore prima</option>
                        <option value={24}>24 ore prima (Consigliato)</option>
                        <option value={48}>48 ore prima</option>
                      </select>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={notifSettings.sendReminder}
                          onChange={(e) => setNotifSettings({ ...notifSettings, sendReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-900"></div>
                      </label>
                    </div>
                  </div>

                  {/* Avviso di Cancellazione */}
                  <div className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <X className="w-4 h-4 text-rose-600" />
                        Avviso di Cancellazione / Riprogrammazione
                      </p>
                      <p className="text-xs text-zinc-500">
                        Notifica il cliente con link diretto per riprenotare se un appuntamento viene disdetto.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={notifSettings.sendCancellation}
                        onChange={(e) => setNotifSettings({ ...notifSettings, sendCancellation: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-900"></div>
                    </label>
                  </div>

                  {/* Richiesta Recensione a 5 Stelle */}
                  <div className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Richiesta Recensione 5 Stelle
                      </p>
                      <p className="text-xs text-zinc-500">
                        Invia un messaggio di ringraziamento e invito a recensire al termine del servizio completato.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={notifSettings.sendReviewRequest}
                        onChange={(e) => setNotifSettings({ ...notifSettings, sendReviewRequest: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-900"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Personalizzazione Testi Notifiche Push */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Testi Notifiche Push Personalizzati
                </h4>
                <div className="border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="flex border-b border-zinc-100 bg-zinc-50/70 overflow-x-auto">
                    {[
                      { key: "confirmation", label: "Conferma" },
                      { key: "reminder", label: "Promemoria" },
                      { key: "cancellation", label: "Cancellazione" },
                      { key: "reviewRequest", label: "Recensione" },
                      { key: "marketing", label: "Novità / Promo" }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSelectedTemplateTab(tab.key as any)}
                        className={`px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap border-b-2 ${
                          selectedTemplateTab === tab.key
                            ? "border-zinc-900 text-zinc-900 bg-white"
                            : "border-transparent text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 space-y-3">
                    <textarea
                      rows={3}
                      value={notifSettings.customTemplates[selectedTemplateTab] || DEFAULT_NOTIFICATION_TEMPLATES[selectedTemplateTab === "confirmation" ? "CONFIRMATION" : selectedTemplateTab === "reminder" ? "REMINDER" : selectedTemplateTab === "cancellation" ? "CANCELLATION" : selectedTemplateTab === "reviewRequest" ? "REVIEW_REQUEST" : "MARKETING"]}
                      onChange={(e) => setNotifSettings({
                        ...notifSettings,
                        customTemplates: {
                          ...notifSettings.customTemplates,
                          [selectedTemplateTab]: e.target.value
                        }
                      })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
                      <span>Variabili dinamiche:</span>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{cliente}"}</code>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{salone}"}</code>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{servizio}"}</code>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{operatore}"}</code>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{data}"}</code>
                      <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">{"{ora}"}</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box di Prova / Test Notifica Push Firebase */}
              <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-zinc-700" />
                  <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                    Invia una Notifica Push di Prova via FCM
                  </h4>
                </div>
                <p className="text-xs text-zinc-500">
                  Verifica subito l&apos;invio e la ricezione immediata tramite Firebase Cloud Messaging.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={testPushTitle}
                    onChange={(e) => setTestPushTitle(e.target.value)}
                    placeholder="Titolo notifica (es: 🔔 Nuovo Annuncio)"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={testPushBody}
                      onChange={(e) => setTestPushBody(e.target.value)}
                      placeholder="Testo del messaggio push"
                      className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button
                      type="button"
                      disabled={isSendingTest}
                      onClick={handleSendTestNotification}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Invia Push FCM
                    </button>
                  </div>
                </div>

                {testResultMsg && (
                  <div className={`p-2.5 rounded-lg text-xs font-medium ${testResultMsg.success ? "bg-emerald-100/70 text-emerald-800 border border-emerald-200" : "bg-rose-100/70 text-rose-800 border border-rose-200"}`}>
                    {testResultMsg.text}
                  </div>
                )}
              </div>

              {/* Registro Notifiche Recenti (FCM) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    Registro Invii Firebase Cloud Messaging
                  </h4>
                  <span className="text-[11px] text-zinc-400">Ultimi {notifLogs.length} eventi registrati</span>
                </div>

                {notifLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                    Nessuna notifica inviata di recente. Gli eventi e gli avvisi push compariranno qui in tempo reale.
                  </div>
                ) : (
                  <div className="border border-zinc-200/70 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200/60 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Data & Ora</th>
                            <th className="px-4 py-2.5">Destinatario / Topic</th>
                            <th className="px-4 py-2.5">Canale</th>
                            <th className="px-4 py-2.5">Tipo Evento</th>
                            <th className="px-4 py-2.5">Stato FCM</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {notifLogs.slice(0, 15).map((log) => {
                            const date = new Date(log.sentAt);
                            const dateStr = date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
                            const timeStr = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

                            return (
                              <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                                <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                                  {dateStr} • {timeStr}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-zinc-900 whitespace-nowrap">
                                  {log.customerName}
                                  {log.customerPhone && (
                                    <span className="block text-[11px] text-zinc-400 font-normal">{log.customerPhone}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                    PUSH FCM
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap">
                                  {log.type === "CONFIRMATION" ? "Conferma" : log.type === "REMINDER" ? "Promemoria" : log.type === "CANCELLATION" ? "Cancellazione" : log.type === "REVIEW_REQUEST" ? "Recensione" : "Test Push"}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${log.status === "SENT" || log.status === "DELIVERED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : log.status === "SIMULATED" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                                    {log.status === "SIMULATED" ? "FCM Registrato" : log.status === "SENT" ? "Inviato FCM" : log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* TAB: FIDELITY & PACCHETTI (MODULO B7) */}
          {activeTab === "fidelity" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Header Tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/60 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                      <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </span>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                      Fidelity Club & Pacchetti Trattamenti
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Definisci il valore economico dei punti fedeltà, le soglie minime di riscatto al POS e gestisci i carnet prepagati (5+1, Barba Ritual).
                  </p>
                </div>

                <button
                  onClick={handleSaveFidelitySettings}
                  disabled={savingFidelity}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
                >
                  {savingFidelity ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Salva Regole Fidelity
                    </>
                  )}
                </button>
              </div>

              {fidelitySaveMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {fidelitySaveMsg}
                </div>
              )}

              {/* CARD 1: Configurazione Motore Punti & Riscatto */}
              <div className="bg-zinc-50/70 dark:bg-zinc-800/40 p-5 sm:p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-500" />
                      Regole di Raccolta & Riscatto Punti al Checkout POS
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      I punti vengono calcolati automaticamente durante ogni incasso al banco cassa e accreditati al cliente.
                    </p>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {loyaltySettings.enabled ? "Fidelity Attivo" : "Fidelity Disattivato"}
                    </span>
                    <input
                      type="checkbox"
                      checked={loyaltySettings.enabled}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-zinc-900 accent-zinc-900 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Rapporto Punti per Euro */}
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Accredito Punti per Spesa
                    </label>
                    <select
                      value={String(loyaltySettings.pointsPerEuro)}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointsPerEuro: Number(e.target.value) })}
                      className="w-full text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="0.05">1 punto ogni 20€ spesi (0.05 pt/€)</option>
                      <option value="0.1">1 punto ogni 10€ spesi (0.1 pt/€ - Standard)</option>
                      <option value="0.2">2 punti ogni 10€ spesi (0.2 pt/€)</option>
                      <option value="0.5">1 punto ogni 2€ spesi (0.5 pt/€)</option>
                      <option value="1">1 punto per ogni 1€ speso (1.0 pt/€)</option>
                    </select>
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      Calcolato sull&apos;importo netto pagato in cassa (esclusi sconti).
                    </p>
                  </div>

                  {/* Valore in Euro di 1 Punto */}
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Valore Sconto per Punto (€)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="10"
                        value={loyaltySettings.euroValuePerPoint}
                        onChange={(e) => setLoyaltySettings({ ...loyaltySettings, euroValuePerPoint: Math.max(0.01, Number(e.target.value) || 0.10) })}
                        className="w-full pl-7 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      Es. €0.10 significa che 50 punti valgono €5.00 di sconto immediato.
                    </p>
                  </div>

                  {/* Soglia Minima di Riscatto */}
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Soglia Minima Riscatto
                    </label>
                    <input
                      type="number"
                      step="5"
                      min="10"
                      max="1000"
                      value={loyaltySettings.minPointsToRedeem}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, minPointsToRedeem: Math.max(10, Number(e.target.value) || 50) })}
                      className="w-full text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      Punti minimi che il cliente deve accumulare prima di poterli spendere.
                    </p>
                  </div>
                </div>

                {/* Simulatore di Anteprima Calcolo */}
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Anteprima calcolo cliente:
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-300 mt-0.5">
                        Spesa di <strong>100€</strong> al POS ➔ Accredita <strong>{Math.floor(100 * loyaltySettings.pointsPerEuro)} punti</strong>.
                        Riscatto di <strong>{loyaltySettings.minPointsToRedeem} punti</strong> ➔ Sconto immediato di <strong>€{(loyaltySettings.minPointsToRedeem * loyaltySettings.euroValuePerPoint).toFixed(2)}</strong> al banco cassa.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                    100 pt = €{(100 * loyaltySettings.euroValuePerPoint).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* CARD 2: Catalogo Pacchetti & Carnet Prepagati (5+1) */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-indigo-600" />
                      Catalogo Carnet & Pacchetti Prepagati
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Crea pacchetti a sedute (es. <em>5 Piega + 1 Omaggio</em>) vendibili al POS o assegnabili direttamente dalla scheda anagrafica clienti.
                    </p>
                  </div>

                  <button
                    onClick={() => setNewPkgModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Pacchetto / Carnet
                  </button>
                </div>

                {treatmentPackages.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-700">
                    <Ticket className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Nessun pacchetto o carnet configurato
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Clicca su &quot;Nuovo Pacchetto / Carnet&quot; per iniziare a vendere trattamenti prepagati con sedute a scalare.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {treatmentPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800">
                              {pkg.totalSessions} Sedute
                            </span>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                              title="Elimina pacchetto dal catalogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                            {pkg.name}
                          </h5>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Trattamento: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pkg.serviceName}</span>
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-200/70 dark:border-zinc-700/70 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-400 block uppercase">Prezzo Vendita</span>
                            <span className="font-extrabold text-sm text-zinc-900 dark:text-white font-mono">
                              €{Number(pkg.price).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-400 block uppercase">Validità</span>
                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                              {pkg.validityDays} giorni
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MODAL CREAZIONE NUOVO PACCHETTO / CARNET */}
              {newPkgModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-indigo-600" />
                        <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                          Nuovo Pacchetto / Carnet
                        </h4>
                      </div>
                      <button
                        onClick={() => setNewPkgModalOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Nome Pacchetto *
                        </label>
                        <input
                          type="text"
                          placeholder="es. Carnet Piega 5 + 1 Omaggio"
                          value={newPkgName}
                          onChange={(e) => setNewPkgName(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 dark:text-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Nome Trattamento / Servizio Collegato *
                        </label>
                        <input
                          type="text"
                          placeholder="es. Piega & Styling Glamour, Taglio Uomo, Barba..."
                          value={newPkgServiceName}
                          onChange={(e) => setNewPkgServiceName(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 dark:text-white font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                            Sedute Totali
                          </label>
                          <input
                            type="number"
                            min="2"
                            max="50"
                            value={newPkgSessions}
                            onChange={(e) => setNewPkgSessions(Number(e.target.value))}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 outline-none text-zinc-900 dark:text-white font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                            Prezzo (€)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={newPkgPrice}
                            onChange={(e) => setNewPkgPrice(Number(e.target.value))}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 outline-none text-zinc-900 dark:text-white font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                            Validità (gg)
                          </label>
                          <input
                            type="number"
                            min="30"
                            step="30"
                            value={newPkgValidityDays}
                            onChange={(e) => setNewPkgValidityDays(Number(e.target.value))}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 outline-none text-zinc-900 dark:text-white font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setNewPkgModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={handleCreatePackage}
                        disabled={isSavingPkg || !newPkgName.trim() || !newPkgServiceName.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                      >
                        {isSavingPkg ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Crea Pacchetto
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.share && lastInviteUrl) {
                            navigator.share({
                              title: `Invito Team - ${userProfile?.salonName || salonName || "Trimmy"}`,
                              text: `Ciao! Ti ho aggiunto al team del salone "${userProfile?.salonName || salonName || "Trimmy"}". Clicca qui per completare l'accesso:`,
                              url: lastInviteUrl
                            }).catch(() => {});
                          } else if (lastInviteUrl) {
                            navigator.clipboard.writeText(lastInviteUrl);
                            setCopiedInviteUrl(true);
                            setTimeout(() => setCopiedInviteUrl(false), 2500);
                          }
                        }}
                        className="px-3 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Condividi Link Invito
                      </button>
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
