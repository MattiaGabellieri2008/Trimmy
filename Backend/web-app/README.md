# ✂️ Trimmy Web App (Next.js 16)

Applicazione web frontend & backend di Trimmy, realizzata con **Next.js 16 (App Router)**, **Turbopack**, **Tailwind CSS** e integrata con **Firebase**.

## 📌 Documentazione Completa

Per la panoramica dell'architettura completa, schemi di database e piani di abbonamento, consulta il [README principale del progetto](../../README.md).

## 🚀 Avvio Rapido

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo (porta 3000)
npm run dev

# Compila la build di produzione
npm run build
```

## 🛠️ Stack Tecnologico

- **Framework**: Next.js 16 (App Router + Turbopack)
- **UI & Icone**: Tailwind CSS + Lucide React
- **Autenticazione**: Firebase Authentication (Google Provider & Email/Password)
- **Database Utenti & Piani**: Cloud Firestore (`users/{uid}`)
- **Database Agenda & CRM**: Firebase SQL Connect / Cloud SQL PostgreSQL 18
- **Hosting**: Firebase App Hosting (`europe-west4`)
