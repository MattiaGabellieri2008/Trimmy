"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-zinc-200/80 shadow-xs">
        
        {/* Header con back button */}
        <div className="mb-8 flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Torna alla Home
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Conforme GDPR (UE 2016/679)
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-zinc-950 text-white rounded-2xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">
              Informativa sulla Privacy
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ultimo aggiornamento: 28 Ottobre 2026 • Versione 1.2
            </p>
          </div>
        </div>

        <div className="prose prose-zinc prose-sm max-w-none space-y-6 text-zinc-700 leading-relaxed pt-6 border-t border-zinc-100">
          
          <section>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              1. Titolare del Trattamento
            </h2>
            <p className="text-sm">
              Il Titolare del trattamento dei dati per i servizi forniti attraverso la piattaforma <strong>Trimmy</strong> (web app e app mobile iOS/Android) è la società/gestione di Trimmy. Per qualsiasi informazione, esercizio dei diritti o chiarimento relativo alla privacy, è possibile contattare l&apos;indirizzo email dedicato: <a href="mailto:privacy@trimmy.it" className="text-zinc-900 font-semibold underline">privacy@trimmy.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              2. Dati Personali Raccolti
            </h2>
            <p className="text-sm">
              Trimmy raccoglie e tratta esclusivamente i dati necessari per l&apos;erogazione del servizio di gestione e prenotazione dei trattamenti di bellezza:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><strong>Dati Anagrafici e di Contatto:</strong> nome, cognome, indirizzo email e numero di telefono cellulare.</li>
              <li><strong>Dati di Posizione Geografica (GPS):</strong> raccolti solo previo esplicito consenso dell&apos;utente al solo fine di ordinare e mostrare i saloni di bellezza più vicini.</li>
              <li><strong>Dati di Prenotazione:</strong> servizi richiesti, data, orario, storico degli appuntamenti e operatore preferito.</li>
              <li><strong>Note Tecniche e di Bellezza:</strong> inserite dal salone per garantire la sicurezza del trattamento (es. cute sensibile, formule colore, controindicazioni).</li>
              <li><strong>Dati di Fatturazione e Pagamento:</strong> gestiti direttamente tramite il gateway crittografato Stripe Inc. Trimmy non memorizza né ha accesso ai numeri completi di carte di credito.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              3. Finalità e Base Giuridica del Trattamento
            </h2>
            <p className="text-sm">
              I dati personali sono trattati per:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><strong>Esecuzione del Contratto (art. 6.1.b GDPR):</strong> consentire la prenotazione degli appuntamenti, la notifica di promemoria tramite SMS/Push/Email e la sincronizzazione con l&apos;agenda del salone.</li>
              <li><strong>Consenso Esplicito (art. 6.1.a GDPR):</strong> localizzazione GPS runtime sul dispositivo mobile.</li>
              <li><strong>Obblighi di Legge (art. 6.1.c GDPR):</strong> conformità fiscale e contabile per gli abbonamenti SaaS dei saloni.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              4. Misure di Sicurezza e Conservazione dei Dati
            </h2>
            <p className="text-sm">
              Trimmy adotta misure di sicurezza avanzate di <em>Privacy by Design</em> e <em>Privacy by Default</em>:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Tutte le comunicazioni avvengono con crittografia end-to-end HTTPS/TLS.</li>
              <li>Autenticazione crittografica e database multi-tenant isolato su Google Cloud Platform / Firebase in regione europea (europe-west4).</li>
              <li>I dati degli appuntamenti e delle sessioni vengono conservati per il tempo strettamente necessario all&apos;erogazione del servizio o per la durata contrattuale con il salone.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              5. Diritti dell&apos;Utente e Cancellazione Account
            </h2>
            <p className="text-sm">
              In conformità agli articoli 15-22 del GDPR e alle linee guida Apple App Store & Google Play, l&apos;utente ha diritto in qualsiasi momento di:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Richiedere l&apos;accesso, la rettifica o la copia dei propri dati personali.</li>
              <li><strong>Diritto all&apos;Oblio / Cancellazione Totale:</strong> l&apos;utente può richiedere l&apos;eliminazione immediata e permanente del proprio account e di tutti i dati associati direttamente dall&apos;applicazione o inviando un&apos;email a <a href="mailto:privacy@trimmy.it" className="text-zinc-900 underline font-medium">privacy@trimmy.it</a>.</li>
              <li>Revocare in qualsiasi momento il consenso alla localizzazione GPS dalle impostazioni di sistema del dispositivo.</li>
            </ul>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-zinc-200 text-center text-xs text-zinc-400">
          © 2026 Trimmy • Tutti i diritti riservati • Conforme Regolamento Generale sulla Protezione dei Dati (GDPR)
        </div>

      </div>
    </div>
  );
}
