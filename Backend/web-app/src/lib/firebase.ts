import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDataConnect, connectDataConnectEmulator } from "firebase/data-connect";
import { connectorConfig } from "../dataconnect-generated"; // Assicurati che questo percorso sia corretto in base alla tua struttura

// 1. INSERISCI QUI I DATI DEL TUO PROGETTO FIREBASE
// Li trovi su: Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAdfL_QFoUFLqCK-H1rdkAdzCLworsZfOY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gestionale-saloni.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gestionale-saloni",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gestionale-saloni.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "274369523001",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:274369523001:web:9c1fece3391c222977cce8",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Z91SBT0022"
};

// Inizializza l'app Firebase solo se non è già stata inizializzata
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inizializza Auth, Provider Google e Cloud Firestore Database
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

// Inizializza Data Connect (con supporto Emulatore in locale)
const dataConnect = getDataConnect(app, connectorConfig);

// Connetti all'emulatore SOLO se esplicitamente richiesto
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  try {
    connectDataConnectEmulator(dataConnect, "127.0.0.1", 9399);
    console.log("Connesso all'emulatore Firebase Data Connect");
  } catch (e) {
    // Evita crash se l'emulatore è già stato connesso (HMR di Next.js)
  }
}

export { app, auth, googleProvider, dataConnect, db };
