"use client";

import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Scale } from "lucide-react";

export default function TerminiPage() {
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
            Termini di Servizio
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-zinc-950 text-white rounded-2xl">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">
              Termini e Condizioni Generali
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Condizioni d&apos;uso per Saloni Partner e Clienti Finali • Versione 1.2
            </p>
          </div>
        </div>

        <div className="prose prose-zinc prose-sm max-w-none space-y-6 text-zinc-700 leading-relaxed pt-6 border-t border-zinc-100">
          
          <section>
            <h2 className="text-lg font-bold text-zinc-900">
              1. Oggetto del Servizio
            </h2>
            <p className="text-sm">
              <strong>Trimmy</strong> fornisce una piattaforma tecnologica integrata che include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Un software gestionale SaaS cloud multi-tenant per saloni di acconciatura ed estetica (agenda digitale, anagrafica clienti, promozioni, fidelity card e controllo cassa gestionale).</li>
              <li>Un portale e un&apos;app mobile marketplace per consentire ai clienti finali di scoprire i saloni partner, consultare i listini e prenotare appuntamenti in tempo reale.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900">
              2. Piani di Abbonamento SaaS per i Saloni
            </h2>
            <p className="text-sm">
              L&apos;accesso alle funzionalità gestionali per i saloni partner è regolato da piani di abbonamento periodico (Medium o Pro), fatturati su base mensile o annuale tramite il gateway di pagamento Stripe. Il rinnovo avviene in modo automatico salvo disdetta dell&apos;utente, esercitabile in qualunque momento dal Portale Clienti Stripe integrato in Trimmy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900">
              3. Prenotazioni, Disdette e No-Show dei Clienti
            </h2>
            <p className="text-sm">
              Il cliente che prenota tramite l&apos;app si impegna a presentarsi all&apos;orario concordato. È possibile disdire o riprogrammare l&apos;appuntamento direttamente dall&apos;applicazione con un preavviso ragionevole consentito dal singolo salone (generalmente almeno 24 ore prima del trattamento).
            </p>
          </section>

          <section className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 my-6">
            <h2 className="text-base font-bold text-amber-950 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              4. Manleva Fiscale e Registratore Telematico (RT)
            </h2>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>IMPORTANTE NOTA NORMATIVA:</strong> Il modulo Punto Cassa POS, i riepiloghi incasso e le ricevute generate all&apos;interno di Trimmy costituiscono <strong>esclusivamente strumenti gestionali e di controllo interno aziendale</strong>. Trimmy non opera come registratore di cassa fiscale omologato e non effettua la trasmissione telematica dei corrispettivi all&apos;Agenzia delle Entrate ex art. 2 D.Lgs. 127/2015. Il Salone Partner resta unico ed esclusivo responsabile dell&apos;adempimento degli obblighi fiscali, contabili e dell&apos;emissione del documento commerciale valido ai sensi di legge tramite il proprio Registratore Telematico omologato.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900">
              5. Limitazione di Responsabilità
            </h2>
            <p className="text-sm">
              Trimmy si impegna a garantire la continuità e la sicurezza del servizio su infrastruttura Google Cloud ad alta disponibilità. Trimmy declina ogni responsabilità per eventuali cancellazioni, incomprensioni o esiti dei trattamenti estetici prestati dal salone al cliente, in quanto il rapporto di prestazione d&apos;opera intercorre esclusivamente e direttamente tra il cliente finale e il salone partner.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900">
              6. Legge Applicabile e Foro Competente
            </h2>
            <p className="text-sm">
              I presenti Termini e Condizioni sono regolati e interpretati secondo la <strong>legge italiana</strong>. Per ogni controversia derivante dall&apos;esecuzione o interpretazione del presente contratto tra Trimmy e i Saloni Partner, sarà competente in via esclusiva il Foro territorialmente competente per la sede legale di Trimmy.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-zinc-200 text-center text-xs text-zinc-400">
          © 2026 Trimmy • Piattaforma SaaS Gestionale Saloni • Tutti i diritti riservati
        </div>

      </div>
    </div>
  );
}
