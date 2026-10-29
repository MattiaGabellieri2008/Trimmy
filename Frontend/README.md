# 📱 Trimmy Mobile — App Nativa iOS & Android (Flutter)

> **Applicazione Mobile Unificata Multi-Ruolo** per clienti e saloni di bellezza.  
> Sviluppata in **Flutter & Dart** secondo l'architettura a livelli raccomandata da Google (MVVM + Repository Pattern) con design system Material 3, supporto Dark/Light theme e rendering fluido a 60/120fps.

---

## 🌟 Architettura & Stack Tecnologico

- **Framework**: [Flutter](https://flutter.dev) (Dart >= 3.3.0)
- **Backend & Cloud**: [Firebase](https://firebase.google.com) (Core, Auth, Firestore, Crashlytics) configurato per Android (`google-services.json`) e iOS (`GoogleService-Info.plist`)
- **Geolocalizzazione & Prossimità**: [geolocator](https://pub.dev/packages/geolocator) per permessi GPS a runtime, coordinate live e ordinamento saloni per distanza chilometrica reale (formula Haversine)
- **Design System**: Material 3 con Dark & Light Theme di lusso (Obsidian Black, Warm Gold, Botanic Emerald, Royal Indigo)
- **State Management**: [Provider](https://pub.dev/packages/provider) (ChangeNotifier & MVVM)
- **Persistenza & Offline Bridge**: [shared_preferences](https://pub.dev/packages/shared_preferences) e `ApiClient` integrato con retry e gestione token
- **QR Code Engine**: [qr_flutter](https://pub.dev/packages/qr_flutter) per rendering istantaneo dei pass check-in al desk cassa
- **Formattazione & Localizzazione**: [intl](https://pub.dev/packages/intl) con supporto completo alla lingua italiana (`it_IT`)

---

## 📂 Struttura del Progetto (`Frontend/lib`)

```text
lib/
├── main.dart                       # Entry point e MultiProvider container
├── firebase_options.dart           # Configurazione multipiattaforma Firebase CLI
├── core/
│   ├── network/
│   │   └── api_client.dart         # Client HTTP con retry, header tenant e token Bearer
│   ├── services/
│   │   └── location_service.dart   # Permessi GPS, coordinate utente e distanza Haversine
│   ├── theme/
│   │   ├── app_colors.dart         # Palette ufficiale di lusso (Obsidian, Gold, Emerald)
│   │   └── app_theme.dart          # Tema globale Material 3 Light/Dark
│   └── widgets/
│       └── trimmy_button.dart      # Componente pulsante riutilizzabile con spinner e feedback
├── data/
│   ├── models/
│   │   ├── user_model.dart         # Modello utente con ruoli (Client, Salon, Staff)
│   │   ├── salon_model.dart        # Anagrafica salone, rating, lookbook e servizi
│   │   ├── service_model.dart      # Trattamenti, prezzi e durata
│   │   ├── appointment_model.dart  # Appuntamenti, orari e stati (Confirmed, Completed, Cancelled)
│   │   └── fidelity_model.dart     # Punti fedeltà, tier VIP e carnet 5+1
│   └── repositories/
│       ├── auth_repository.dart    # Autenticazione, sessione persistente e switch rapido
│       ├── salon_repository.dart   # Ricerca saloni, filtri, calcolo prossimità e lookbook
│       ├── appointment_repository.dart # Prenotazioni live, outbox locale e storico
│       └── fidelity_repository.dart    # Saldo punti VIP, riscatto sconti e carnet prepagati
└── ui/
    ├── auth/
    │   └── login_screen.dart       # Login email/password con switch rapido demo cliente/salone
    ├── client/
    │   ├── client_main_screen.dart # Hub B2C con Bottom Navigation Bar
    │   ├── marketplace_screen.dart # Vetrina saloni Treatwell-style con distanze GPS e rating
    │   ├── booking_wizard_screen.dart # Wizard prenotazione in 4 step con slot orari live
    │   ├── appointments_screen.dart# Boarding pass appuntamenti e disdetta con 1 tocco
    │   └── fidelity_wallet_screen.dart# Tessera VIP Apple Wallet, saldo punti e QR cassa
    └── salon/
        ├── salon_main_screen.dart  # Hub B2B con Bottom Navigation Bar
        ├── agenda_screen.dart      # Agenda touch con bolle giorni e filtro staff
        ├── pos_checkout_screen.dart# Cassa POS mobile con carnet 5+1 e riscatto punti
        └── clients_crm_screen.dart # Anagrafica clienti, note tecniche di bellezza e tier
```

---

## 🚀 Funzionalità Principali

### 💎 Esperienza Cliente (B2C)
1. **Esplora Saloni (Marketplace)**: Ricerca in tempo reale per nome, città o categoria (Barber Shop, Hair Stylist Donna, Unisex, Centro Estetico) con calcolo distanza GPS in chilometri e ordinamento automatico dal più vicino.
2. **Wizard di Prenotazione in 4 Step**: Scelta del servizio, operatore preferito, calendario con slot orari liberi e riepilogo con stima punti VIP accumulati.
3. **VIP Boarding Pass**: Card elegante con data, orario, stylist, e possibilità di disdetta con rilascio immediato dello slot orario.
4. **Fidelity Wallet Digitale**: Tessera in stile Apple Wallet con saldo punti, livello VIP (Bronze, Silver, Gold, Diamond), barra di progresso, carnet prepagati (es. 5+1) con cerchietti delle sedute residue (es. 4/6 rimaste) e **QR Code per check-in rapido alla cassa**.

### 🏢 Esperienza Salone & Staff (B2B)
1. **Agenda Tascabile Touch**: Visualizzazione oraria giornaliera sincronizzata, bolle giorni a scorrimento orizzontale, filtri per operatore e marcatura immediata appuntamenti completati o annullati.
2. **Punto Cassa POS Mobile**: Selezione cliente, composizione scontrino, rilevamento automatico carnet attivo con pulsante ad un tocco (*"Usa 1 Seduta"*) e pill di riscatto sconti (-5€, -10€).
3. **Anagrafica & CRM Clienti**: Schede dettagliate con numero di telefono, storico visite, note tecniche di bellezza (formule colore, preferenze sfumatura) e carnet attivi.
4. **Switch Ruolo Istantaneo**: Tasto rapido galleggiante (`FAB`) per passare in tempo reale dalla vista Cliente alla vista Salone per testare e presentare l'app.

---

## 📲 Come Avviare l'App Localmente

Assicurati di avere installato il [Flutter SDK](https://docs.flutter.dev/get-started/install).

```bash
# 1. Spostati nella cartella mobile
cd Frontend

# 2. Scarica le dipendenze
flutter pub get

# 3. Avvia l'applicazione su dispositivo/emulatore Android, simulatore iOS o Chrome
flutter run
```

### Compilazione Build di Rilascio

```bash
# Android APK
flutter build apk --release

# Android App Bundle (Google Play)
flutter build appbundle --release

# iOS (richiede macOS con Xcode)
flutter build ipa --release
```
