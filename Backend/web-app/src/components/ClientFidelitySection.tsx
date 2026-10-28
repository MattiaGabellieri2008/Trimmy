"use client";

import { useEffect, useState } from "react";
import { 
  Award, 
  Sparkles, 
  QrCode, 
  Ticket, 
  CheckCircle2, 
  Clock, 
  Coins, 
  ShieldCheck, 
  ChevronRight, 
  Calendar, 
  ArrowUpRight, 
  Percent, 
  ShoppingBag,
  Info,
  Gift,
  Check
} from "lucide-react";
import { 
  CustomerLoyalty, 
  CustomerPackage, 
  LoyaltyPointMovement, 
  computeTier, 
  fetchCustomerLoyalty, 
  fetchCustomerPackages, 
  fetchSalonLoyaltySettings,
  LoyaltySettings,
  DEFAULT_LOYALTY_SETTINGS
} from "@/lib/fidelity-store";
import { ClientAppointmentItem, SalonListing } from "@/lib/client-booking";
import { parseDateSafe } from "@/lib/date-utils";

interface ClientFidelitySectionProps {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientUid?: string;
  appointments: ClientAppointmentItem[];
  salonsList: SalonListing[];
}

export default function ClientFidelitySection({
  clientName,
  clientEmail,
  clientPhone,
  clientUid,
  appointments,
  salonsList
}: ClientFidelitySectionProps) {
  // 1. Identifica i saloni con cui il cliente interagisce
  const salonOptions = salonsList.length > 0 ? salonsList : [
    { id: "salon-1", name: "Atelier Bellezza Duomo", city: "Milano" } as SalonListing
  ];

  // Seleziona come default il salone dell'ultimo appuntamento o il primo salone
  const defaultSalonId = appointments[0]?.salonId || salonOptions[0]?.id || "salon-1";
  const [selectedSalonId, setSelectedSalonId] = useState<string>(defaultSalonId);

  // Dati di fedeltà e carnet
  const [loyalty, setLoyalty] = useState<CustomerLoyalty | null>(null);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Identificatore univoco cliente nel salone
  const customerLookupId = clientUid || (clientPhone ? `phone-${clientPhone.replace(/\D/g, "")}` : "cliente-demo");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [loyaltyData, pkgData, salonSettings] = await Promise.all([
          fetchCustomerLoyalty(selectedSalonId, customerLookupId),
          fetchCustomerPackages(selectedSalonId, customerLookupId),
          fetchSalonLoyaltySettings(selectedSalonId)
        ]);

        if (isMounted) {
          // Se il cliente ha zero punti totali ma è un utente registrato, diamo un welcome tier gradevole
          setLoyalty(loyaltyData);
          setPackages(pkgData);
          setSettings(salonSettings);
        }
      } catch (err) {
        console.warn("Errore caricamento fidelity cliente:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedSalonId, customerLookupId]);

  const activeSalon = salonOptions.find((s) => s.id === selectedSalonId) || salonOptions[0];
  const tierInfo = computeTier(loyalty?.totalPointsEarned || 0);

  const pointsBalance = loyalty?.pointsBalance || 0;
  const euroDiscountValue = Number((pointsBalance * (settings?.euroValuePerPoint || 0.10)).toFixed(2));
  const activePackages = packages.filter((p) => p.status === "ACTIVE" && p.remainingSessions > 0);
  const expiredPackages = packages.filter((p) => p.status !== "ACTIVE" || p.remainingSessions === 0);

  const virtualCardCode = `TRM-${(customerLookupId.slice(-6) || "VIP001").toUpperCase()}`;

  const handleCopyCardCode = () => {
    navigator.clipboard.writeText(virtualCardCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Sezione & Selettore Salone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
              <Award className="w-5 h-5 text-amber-600" />
            </span>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
              Tessera Fedeltà & Carnet Trattamenti
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Accumula punti per ogni visita, riscatta sconti immediati e consulta i tuoi pacchetti prepagati.
          </p>
        </div>

        {salonOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">Salone:</span>
            <select
              value={selectedSalonId}
              onChange={(e) => setSelectedSalonId(e.target.value)}
              className="text-xs font-semibold bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {salonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Grid Principale: Digital Card & Statistiche Rapide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tessera Digitale VIP Pass (Card Style Apple Wallet / Luxury) */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white p-6 sm:p-8 shadow-xl border border-zinc-700/60">
            {/* Watermark stilizzato */}
            <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
              <Award className="w-64 h-64 text-amber-400" />
            </div>

            {/* Top Bar Tessera */}
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-widest text-xs uppercase text-zinc-400 font-mono">
                    TRIMMY VIP PASS
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                  {activeSalon?.name || "Atelier Bellezza"}
                </h3>
              </div>

              {/* VIP Tier Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-xs ${tierInfo.badgeClass}`}>
                {tierInfo.label}
              </div>
            </div>

            {/* Saldo Punti Grande */}
            <div className="my-8 relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                  Saldo Punti Disponibile
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
                    {pointsBalance}
                  </span>
                  <span className="text-sm font-bold text-amber-400 uppercase tracking-wide">
                    Punti Club
                  </span>
                </div>
              </div>

              {/* Valore Sconto */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-300 tracking-wider">
                    Sconto Spendibile
                  </p>
                  <p className="text-lg font-extrabold text-white">
                    €{euroDiscountValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Livello & Barra di Progresso al prossimo Tier */}
            <div className="relative z-10 pt-4 border-t border-zinc-700/60">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-400 font-medium">
                  {tierInfo.tier === "DIAMOND" ? (
                    "Hai raggiunto il livello massimo VIP!"
                  ) : (
                    <>
                      Progresso verso il prossimo livello (
                      <span className="text-white font-bold">{tierInfo.nextThreshold} pt</span>)
                    </>
                  )}
                </span>
                <span className="font-bold text-amber-400 font-mono">
                  {tierInfo.progress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700/80">
                <div 
                  className="h-full bg-linear-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${tierInfo.progress}%` }}
                />
              </div>
            </div>

            {/* Bottom Bar: Intestatario & Tasto Mostra QR */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Titolare Tessera
                </p>
                <p className="text-sm font-bold text-white tracking-tight">
                  {clientName || "Cliente Trimmy"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQrModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  Mostra QR in Cassa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card Vantaggi & Regolamento */}
        <div className="flex flex-col gap-4">
          <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm mb-3">
                <Gift className="w-4 h-4 text-indigo-600" />
                Come Funziona la Raccolta Punti
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Accumuli <strong>1 punto ogni 10€</strong> spesi su tutti i trattamenti e prodotti rivendita.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Ogni punto vale <strong>€0.10</strong> di sconto diretto (es. 50 pt = <strong>-€5.00</strong> al POS).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Soglia minima di riscatto: <strong>50 punti</strong> spendibili ad ogni cassa.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-4 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-[11px] text-zinc-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>I punti non scadono e possono essere usati anche per regalare sedute ai tuoi amici.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sezione Carnet Trattamenti Prepagati (es. 5+1) */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                I Tuoi Carnet & Pacchetti Prepagati
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Visualizza le sedute residue dei pacchetti acquistati presso il salone.
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 self-start sm:self-auto">
            {activePackages.length} attivi
          </span>
        </div>

        {activePackages.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-50/70 border border-dashed border-zinc-200 text-center">
            <Ticket className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-zinc-800">
              Nessun Carnet Attivo al Momento
            </h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              Chiedi al tuo salone i Carnet promozionali (es. <em>5 Piega + 1 Omaggio</em> o <em>Pacchetto Barba Ritual</em>) al momento del checkout per risparmiare fino al 20%.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePackages.map((pkg) => {
              const sessionsUsed = pkg.totalSessions - pkg.remainingSessions;
              const percentRemaining = Math.round((pkg.remainingSessions / pkg.totalSessions) * 100);

              return (
                <div 
                  key={pkg.id}
                  className="p-5 rounded-2xl bg-linear-to-b from-white to-zinc-50/70 border border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/50">
                          Carnet Trattamenti
                        </span>
                        <h4 className="text-sm font-bold text-zinc-900 mt-1.5">
                          {pkg.packageName}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Servizio: <strong className="text-zinc-700">{pkg.serviceName}</strong>
                        </p>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {pkg.remainingSessions} / {pkg.totalSessions} Sedute
                      </span>
                    </div>

                    {/* Indicatori Circolari delle Sedute */}
                    <div className="mt-4 pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                        <span>Sedute residue:</span>
                        <span className="font-bold text-zinc-800 font-mono">
                          {pkg.remainingSessions} su {pkg.totalSessions} rimaste
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.from({ length: pkg.totalSessions }).map((_, idx) => {
                          const isAvailable = idx < pkg.remainingSessions;
                          return (
                            <div
                              key={idx}
                              title={isAvailable ? "Seduta disponibile" : "Seduta già utilizzata"}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                                isAvailable
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "bg-zinc-200 text-zinc-400 line-through opacity-60"
                              }`}
                            >
                              {idx + 1}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      Scadenza: {new Date(pkg.expiryDate).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-zinc-700 font-semibold">
                      Scalabile al POS
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal QR Code per Check-in Rapido in Salone */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-zinc-200 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-zinc-900">
              Pass Fedeltà & Check-in
            </h3>
            <p className="text-xs text-zinc-500 mt-1 mb-6">
              Mostra questo codice in cassa o fallo scansionare all&apos;accoglienza del salone.
            </p>

            {/* Simulazione Visuale QR Code ad alta risoluzione */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 inline-block mb-4">
              <div className="w-48 h-48 bg-white p-3 rounded-xl border border-zinc-300/80 flex flex-col items-center justify-center shadow-inner relative group">
                <QrCode className="w-36 h-36 text-zinc-900" />
                <div className="absolute inset-0 bg-transparent flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-zinc-200">
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-100 rounded-xl p-2.5 flex items-center justify-between gap-2 mb-6">
              <span className="font-mono font-bold text-xs text-zinc-800 tracking-wider">
                {virtualCardCode}
              </span>
              <button
                onClick={handleCopyCardCode}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-2 py-1 rounded-md hover:bg-white transition-all cursor-pointer flex items-center gap-1"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copiato
                  </>
                ) : (
                  "Copia"
                )}
              </button>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

