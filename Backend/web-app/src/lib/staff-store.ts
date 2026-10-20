import { auth, db, dataConnect } from "./firebase";
import { sendSignInLinkToEmail } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { listStaff, upsertUser, ListStaffData } from "../dataconnect-generated";
import { PlanType } from "./user-profile";

export interface StaffMemberItem {
  id: string;
  tenantId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: string; // "Titolare" | "Staff" | "Manager"
  status: "ATTIVO" | "INVITATO";
  invitedAt?: string;
  rating?: number;
}

const STORAGE_PREFIX = "trimmy_staff_";

/**
 * Limiti massimi di staff per piano SaaS
 */
export const PLAN_STAFF_LIMITS: Record<PlanType, number> = {
  FREE: 1,      // Solo 1 postazione (il titolare)
  MEDIUM: 3,    // Fino a 3 persone
  PRO: 999999   // Illimitato
};

/**
 * Verifica se il piano permette di aggiungere un nuovo membro dello staff
 */
export function canAddStaffMember(
  planType: PlanType | undefined,
  currentStaffCount: number
): { allowed: boolean; maxAllowed: number; currentCount: number; message?: string } {
  const plan = planType || "FREE";
  const maxAllowed = PLAN_STAFF_LIMITS[plan] || 1;

  if (currentStaffCount >= maxAllowed) {
    let message = "";
    if (plan === "FREE") {
      message = "Il tuo piano Starter (Gratuito) include solo 1 collaboratore (il titolare). Per aggiungere altri collaboratori al tuo team, effettua l'upgrade al Piano Medium (fino a 3 collaboratori a €11,99/m) o al Piano Pro (collaboratori illimitati).";
    } else if (plan === "MEDIUM") {
      message = "Hai raggiunto il limite massimo di 3 collaboratori previsto dal tuo piano Medium. Per aggiungere altri membri del team senza limiti, passa al Piano Pro (collaboratori illimitati a €39/mese).";
    }
    return { allowed: false, maxAllowed, currentCount: currentStaffCount, message };
  }

  return { allowed: true, maxAllowed, currentCount: currentStaffCount };
}

/**
 * Lettura sincrona dello staff da cache locale per il singolo salone
 */
export function getSalonStaffSync(tenantId: string): StaffMemberItem[] {
  if (typeof window === "undefined" || !tenantId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tenantId}`);
    if (!raw) return [];
    return JSON.parse(raw) as StaffMemberItem[];
  } catch (e) {
    console.error("Errore lettura staff locale:", e);
    return [];
  }
}

export function setSalonStaffSync(tenantId: string, staff: StaffMemberItem[]): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(staff));
  } catch (e) {
    console.error("Errore scrittura staff locale:", e);
  }
}

/**
 * Recupero asincrono dello staff del salone (Cloud SQL + Firestore + LocalStorage)
 */
export async function fetchSalonStaff(
  tenantId: string,
  ownerInfo?: { uid: string; displayName: string; email: string }
): Promise<StaffMemberItem[]> {
  if (!tenantId) return [];

  const staffMap: Map<string, StaffMemberItem> = new Map();

  // 1. Assicura sempre il titolare come primo membro
  if (ownerInfo) {
    staffMap.set(ownerInfo.uid, {
      id: ownerInfo.uid,
      tenantId,
      fullName: ownerInfo.displayName || "Titolare",
      email: ownerInfo.email,
      role: "Titolare",
      status: "ATTIVO"
    });
  }

  // 2. Prova lettura da Cloud SQL DataConnect
  try {
    const res = await listStaff(dataConnect, { tenantId });
    if (res.data?.users && res.data.users.length > 0) {
      res.data.users.forEach((u) => {
        staffMap.set(u.id, {
          id: u.id,
          tenantId,
          fullName: u.fullName,
          role: u.role,
          phone: u.phone || null,
          status: "ATTIVO"
        });
      });
    }
  } catch (dcErr) {
    console.warn("Nota lettura staff DataConnect:", dcErr);
  }

  // 3. Prova lettura da Cloud Firestore (/saloni/{tenantId}/staff)
  try {
    const colRef = collection(db, "saloni", tenantId, "staff");
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data() as StaffMemberItem;
      if (data && data.fullName) {
        staffMap.set(d.id, { ...data, id: d.id, tenantId });
      }
    });
  } catch (fsErr) {
    console.warn("Nota lettura staff Firestore:", fsErr);
  }

  // 4. Fallback locale
  const localList = getSalonStaffSync(tenantId);
  localList.forEach((st) => {
    if (!staffMap.has(st.id)) {
      staffMap.set(st.id, st);
    }
  });

  const list = Array.from(staffMap.values());
  setSalonStaffSync(tenantId, list);
  return list;
}

/**
 * Invia un'email reale di invito allo staff tramite Firebase Authentication
 * e registra il collaboratore nel salone
 */
export async function inviteStaffMemberWithFirebase(
  tenantId: string,
  salonName: string,
  inviterName: string,
  planType: PlanType,
  member: {
    fullName: string;
    email: string;
    role: string;
  }
): Promise<{ 
  success: boolean; 
  member?: StaffMemberItem; 
  emailSentSuccessfully?: boolean; 
  inviteUrl?: string; 
  error?: string 
}> {
  if (!tenantId) return { success: false, error: "ID Salone non valido" };

  const cleanEmail = member.email.trim().toLowerCase();
  const cleanName = member.fullName.trim();

  // 1. Controllo Limiti Piano
  const currentStaff = getSalonStaffSync(tenantId);
  const limitCheck = canAddStaffMember(planType, currentStaff.length);
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.message || "Limite collaboratori raggiunto per il tuo piano." };
  }

  // 2. Controllo duplicati email
  if (currentStaff.some((st) => st.email?.toLowerCase() === cleanEmail)) {
    return { success: false, error: "Un collaboratore con questo indirizzo email è già presente nel team." };
  }

  const staffId = `staff-${Date.now()}`;
  const newStaffItem: StaffMemberItem = {
    id: staffId,
    tenantId,
    fullName: cleanName,
    email: cleanEmail,
    role: member.role || "Staff",
    status: "INVITATO",
    invitedAt: new Date().toISOString()
  };

  // 3. Invio Email Reale tramite Firebase Authentication
  let emailSentSuccessfully = false;
  let emailErrorMessage = "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://trimmy--gestionale-saloni.europe-west4.hosted.app";
  const inviteUrl = `${origin}/login?inviteSalonId=${encodeURIComponent(tenantId)}&inviteEmail=${encodeURIComponent(cleanEmail)}`;

  try {
    // Configurazione ActionCodeSettings di Firebase
    const actionCodeSettings = {
      url: inviteUrl,
      handleCodeInApp: true
    };

    // Chiama Firebase Auth per inviare l'email reale al destinatario
    await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
    emailSentSuccessfully = true;

    // Salva l'email in localStorage per completamento rapido all'apertura del link
    if (typeof window !== "undefined") {
      window.localStorage.setItem("emailForSignIn", cleanEmail);
    }
  } catch (authErr: any) {
    console.warn("Avviso invio Firebase Auth email link:", authErr);
    emailErrorMessage = authErr.message || "Errore invio email Firebase";
  }

  // 4. Salva il record di invito in Cloud Firestore (/saloni/{tenantId}/inviti)
  try {
    const inviteRef = doc(db, "saloni", tenantId, "inviti", staffId);
    await setDoc(inviteRef, {
      ...newStaffItem,
      salonName,
      inviterName,
      emailSentSuccessfully,
      createdAt: new Date().toISOString()
    });
  } catch (fsErr) {
    console.warn("Nota salvataggio invito Firestore:", fsErr);
  }

  // 5. Salva anche nella collezione 'mail' per l'estensione Firebase Trigger Email (se configurata nel progetto)
  try {
    const mailRef = doc(db, "mail", `invite-${staffId}`);
    await setDoc(mailRef, {
      to: cleanEmail,
      message: {
        subject: `Invito a unirti al team di ${salonName} su Trimmy`,
        text: `Ciao ${cleanName},\n\nSei stato invitato da ${inviterName} a far parte dello staff di "${salonName}" sul gestionale Trimmy con il ruolo di ${member.role}.\n\nAccedi alla piattaforma per visualizzare la tua agenda e i tuoi turni: https://trimmy--gestionale-saloni.europe-west4.hosted.app/login\n\nA presto,\nIl Team di Trimmy`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 20px; font-weight: bold; color: #18181b;">Trimmy.</span>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #18181b; margin-bottom: 12px;">Sei stato invitato a unirti a ${salonName}!</h2>
            <p style="font-size: 14px; color: #52525b; line-height: 1.6; margin-bottom: 20px;">
              Ciao <strong>${cleanName}</strong>,<br>
              <strong>${inviterName}</strong> ti ha aggiunto al team del salone <strong>${salonName}</strong> su Trimmy con il ruolo di <strong>${member.role}</strong>.
            </p>
            <div style="margin: 28px 0;">
              <a href="https://trimmy--gestionale-saloni.europe-west4.hosted.app/login" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; display: inline-block;">
                Accedi a Trimmy & Visualizza Agenda
              </a>
            </div>
            <p style="font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; padding-top: 16px;">
              Questo messaggio è stato inviato automaticamente da Trimmy Gestionale Saloni per conto di ${salonName}.
            </p>
          </div>
        `
      }
    });
  } catch (extErr) {
    console.warn("Nota trigger email extension:", extErr);
  }

  // 6. Sincronizza lo staff su Cloud SQL DataConnect
  try {
    await upsertUser(dataConnect, {
      id: staffId,
      tenantId,
      fullName: cleanName,
      role: member.role || "Staff",
      phone: null
    });
  } catch (dcErr) {
    console.warn("Nota sync staff DataConnect:", dcErr);
  }

  // 7. Salva nella collezione staff del salone su Firestore
  try {
    const staffDocRef = doc(db, "saloni", tenantId, "staff", staffId);
    await setDoc(staffDocRef, newStaffItem, { merge: true });
  } catch (fsStaffErr) {
    console.warn("Nota salvataggio staff Firestore:", fsStaffErr);
  }

  // 8. Aggiorna la cache locale
  const updatedStaff = [...currentStaff, newStaffItem];
  setSalonStaffSync(tenantId, updatedStaff);

  return {
    success: true,
    member: newStaffItem,
    emailSentSuccessfully,
    inviteUrl,
    error: emailSentSuccessfully ? undefined : (emailErrorMessage ? `Email non recapitata: ${emailErrorMessage}` : undefined)
  };
}

/**
 * Rimuove un collaboratore dal salone
 */
export async function removeStaffMember(tenantId: string, staffId: string): Promise<StaffMemberItem[]> {
  if (!tenantId || !staffId) return [];

  // 1. Rimuovi da Firestore
  try {
    const docRef = doc(db, "saloni", tenantId, "staff", staffId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn("Nota rimozione staff Firestore:", e);
  }

  // 2. Rimuovi da LocalStorage
  const current = getSalonStaffSync(tenantId);
  const updated = current.filter((s) => s.id !== staffId);
  setSalonStaffSync(tenantId, updated);

  return updated;
}
