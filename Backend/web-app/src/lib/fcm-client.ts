import { app, db } from "./firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";

let messagingInstance: any = null;

/**
 * Inizializza l'istanza client di Firebase Messaging in modo sicuro (solo browser/client-side)
 */
export async function getClientMessaging() {
  if (typeof window === "undefined") return null;
  if (messagingInstance) return messagingInstance;

  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn("[FCM Client] Firebase Messaging non supportato in questo browser:", err);
  }
  return null;
}

/**
 * Verifica lo stato dei permessi notifiche nel browser
 */
export function getPushPermissionStatus(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Richiede il permesso per le notifiche Push al browser e ottiene il token FCM
 */
export async function requestPushNotificationPermission(userId?: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { success: false, error: "Notifiche push non supportate da questo browser." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permesso notifiche negato dall'utente." };
    }

    const messaging = await getClientMessaging();
    if (!messaging) {
      return { success: false, error: "Impossibile avviare Firebase Messaging." };
    }

    // Registra o recupera il service worker FCM
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (swErr) {
        console.warn("[FCM] Registrazione Service Worker fallback:", swErr);
      }
    }

    const { getToken } = await import("firebase/messaging");
    
    // Genera il token FCM (utilizza la chiave VAPID pubblica se disponibile, altrimenti registrazione predefinita)
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration
    });

    if (token) {
      // Salva in cache locale
      localStorage.setItem("trimmy_fcm_token", token);
      localStorage.setItem("trimmy_fcm_permission", "granted");

      // Se l'utente è loggato, salva il token nel suo profilo Firestore
      if (userId) {
        try {
          const userDoc = doc(db, "users", userId);
          await setDoc(userDoc, {
            fcmToken: token,
            fcmPushEnabled: true,
            fcmUpdatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("[FCM] Errore salvataggio token su Firestore:", dbErr);
        }
      }

      return { success: true, token };
    } else {
      return { success: false, error: "Nessun token di registrazione FCM ricevuto." };
    }
  } catch (err: any) {
    console.error("[FCM] Errore richiesta token:", err);
    return { success: false, error: err.message || "Errore sconosciuto durante la richiesta token FCM." };
  }
}

/**
 * Ascolta i messaggi FCM ricevuti mentre l'app è aperta in primo piano (Foreground)
 */
export async function listenForegroundMessages(callback: (payload: any) => void): Promise<(() => void) | null> {
  const messaging = await getClientMessaging();
  if (!messaging) return null;

  try {
    const { onMessage } = await import("firebase/messaging");
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[FCM Foreground] Ricevuto messaggio:", payload);
      callback(payload);
    });
    return unsubscribe;
  } catch (err) {
    console.warn("[FCM] Errore ascolto foreground:", err);
    return null;
  }
}
