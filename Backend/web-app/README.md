# ✂️ Trimmy Web App (Next.js 16)

> **Portale Gestionale B2B & Marketplace Clienti B2C**  
> Applicazione web full-stack cloud-native realizzata con **Next.js 16 (App Router)**, **Turbopack**, **Tailwind CSS**, **Recharts** e integrata con l'ecosistema **Firebase** e **Google Cloud Platform**.

---

## 📌 Documentazione Generale

Per una panoramica completa dell'infrastruttura globale, degli schemi di database relazionali e dell'app mobile Flutter, fai riferimento al [README principale del progetto](../../README.md).

---

## 🚀 Avvio Rapido

```bash
# 1. Spostati nella cartella web-app
cd Backend/web-app

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente (.env.local)
cp .env.example .env.local # oppure inserisci le tue credenziali Firebase

# 4. Avvia il server di sviluppo con Turbopack (porta 3000)
npm run dev

# 5. Verifica tipi e compila la build di produzione
npm run build
```

L'applicazione risponderà all'indirizzo `http://localhost:3000`.

---

## 🛠️ Stack Tecnologico & Librerie

- **Core Framework**: [Next.js 16](https://nextjs.org) (App Router con Turbopack & React 19)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com), [Lucide React](https://lucide.dev)
- **Data Visualization**: [Recharts](https://recharts.org) per grafici di fatturato e scontrino medio
- **Autenticazione**: [Firebase Authentication](https://firebase.google.com/docs/auth) (Google Provider & Email/Password con routing basato sui ruoli)
- **Database NoSQL & Real-Time**: [Cloud Firestore](https://firebase.google.com/docs/firestore) con listener `onSnapshot` reattivi
- **Database Relazionale Cloud**: [Firebase Data Connect](https://firebase.google.com/docs/data-connect) con [Google Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- **Gateway Notifiche**: Twilio (SMS & WhatsApp Business API) con Sandbox Simulator integrato
- **Hosting & Serverless**: [Firebase App Hosting](https://firebase.google.com/docs/app-hosting) su Google Cloud Run (`europe-west4`)

---

## 🏢 Moduli del Gestionale Salone (B2B)

### 1. 📅 Agenda Multivista Sincronizzata (`/`)
* **4 Viste Intercambiabili**: Giornaliera (slot 08:00 - 20:00), Settimanale, Mensile e Vista Staff (colonne per collaboratore).
* **Gestione Pause & Orari**: Rispetto degli orari di apertura del salone, blocco giorni festivi/chiusura e gestione pause/ferie del personale.
* **WhatsApp Click-to-Chat**: Pulsante istantaneo per contattare il cliente su WhatsApp direttamente dalla card appuntamento.
* **Auto-Provisioning**: Creazione automatica dell'anagrafica cliente in CRM all'inserimento manuale in agenda.

### 2. 👥 CRM Clienti Multi-Tenant (`/clienti`)
* Schede anagrafiche complete con note tecniche di bellezza (colore, preferenze, sensibilità/allergie).
* Storico appuntamenti completati, disdetti e futuri.
* Ricerca rapida per nome, cognome o cellulare con normalizzazione prefisso internazionale (+39).

### 3. ✂️ Catalogo Trattamenti & Servizi (`/trattamenti`)
* Catalogazione per categorie (Taglio, Colore, Trattamenti, Estetica).
* Gestione prezzi, durata stimata e descrizioni tecniche con persistenza ibrida sincrona.

### 4. 📦 Magazzino & Inventario (`/magazzino`)
* Tracciamento giacenze prodotti (retail e uso professionale/tecnico).
* Decremento automatico scorte al checkout cassa / completamento servizio.
* **Audit Log Movimenti**: Registrazione di carichi, scarichi, rettifiche inventariali con data e operatore.
* **Alert Scorte Basse**: Notifica visiva immediata quando un prodotto scende sotto la soglia minima di sicurezza.

### 5. 💎 Sistema Fedeltà & Carnet Trattamenti
* Accumulo punti fedeltà ad ogni spesa e categorizzazione in Tier VIP (Bronze, Silver, Gold, Diamond).
* Gestione pacchetti e carnet prepagati (es. formula 5+1 con tracciamento sedute residue).
* Riscatto coupon sconto al checkout.

### 6. 🎨 Personalizzazione Brand & Dark Mode (`/impostazioni?tab=brand`)
* **Dark Mode Nativo**: Modalità Chiara, Scura o Automatica (sistema) con script inline SSR zero-flicker e toggle rapido nell'header.
* **Palette Cromatiche Salone**: Selezione tra temi esclusivi (Obsidian Black, Warm Gold, Botanic Emerald, Royal Indigo, Sunset Coral, Rose Velvet).

### 7. 📊 Statistiche & Analytics (`/statistiche`)
* KPI in tempo reale: fatturato totale, scontrino medio, numero clienti attivi, percentuale cancellazioni.
* Grafici interattivi (*AreaChart*, *BarChart*) filtrabili per Oggi, Ultimi 7 giorni, 30 giorni e Anno.

### 8. ⚖️ Pagine Legali & Fiscali GDPR-Ready
* **Privacy Policy (`/privacy`)**: Informativa sul trattamento dati conforme al Regolamento UE 2016/679 (GDPR).
* **Termini di Servizio (`/termini`)**: Condizioni generali d'uso della piattaforma con disclaimer esplicito di esonero da responsabilità fiscale (obblighi registratore telematico e scontrini fiscali a carico del salone).

---

## ⚡ API Routes & Endpoint Serverless

| Endpoint | Metodo | Descrizione |
| :--- | :---: | :--- |
| `/api/notifications/send` | `POST` | Invio transazionale SMS o WhatsApp (Twilio reale o Sandbox Simulator). |
| `/api/notifications/cron` | `GET` | Job periodico protetto da Bearer token per promemoria appuntamenti (24h/12h prima) e richieste recensioni. |
| `/api/sync/reconcile` | `POST` | Endpoint di riconciliazione Tri-Source per riallineare Firestore, PostgreSQL e Outbox locale in caso di conflitti Last-Write-Wins. |

---

## 🔒 Sicurezza & Scalabilità Multi-Tenant

* **Distributed Rate Limiter**: Rate limiter multi-tenant distribuito per Cloud Run implementato tramite transazioni atomiche Firestore e fallback memory fail-open (protezione da DoS e brute force).
* **Isolamento Rigoroso**: Nessun salone può accedere a dati o clienti di altri saloni; ogni richiesta API convalida il token Firebase Auth e il relativo `tenantId`.
* **Regole di Sicurezza Firestore**: Granulari e testate in `firestore.rules`.
