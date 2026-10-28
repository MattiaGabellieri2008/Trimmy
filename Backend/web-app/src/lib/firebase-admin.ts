import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Inizializza Firebase Admin SDK in modo singleton per le API Route Next.js.
 * Utilizza le credenziali dell'ambiente (GOOGLE_APPLICATION_CREDENTIALS o
 * le variabili FIREBASE_* per il deploy su App Hosting).
 *
 * In ambiente App Hosting / Cloud Run, le credenziali vengono rilevate
 * automaticamente tramite Application Default Credentials (ADC).
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Verifica se ci sono credenziali esplicite nel service account
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } catch {
      console.warn("[firebase-admin] Errore parsing FIREBASE_SERVICE_ACCOUNT_KEY, fallback ad ADC");
    }
  }

  // Fallback: Application Default Credentials (ADC)
  // Funziona automaticamente su Cloud Run, App Hosting, e localmente con `gcloud auth application-default login`
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "trimmy-saloni",
  });
}

const adminApp: App = getAdminApp();
const adminAuth: Auth = getAuth(adminApp);
const adminMessaging: Messaging = getMessaging(adminApp);
const adminDb: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminMessaging, adminDb };
