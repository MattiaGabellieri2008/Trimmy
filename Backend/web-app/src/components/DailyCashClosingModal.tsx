"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Coins,
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
  Scissors,
  ShoppingBag,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import {
  CheckoutTransaction,
  DailyCashClosing,
  fetchCheckoutTransactions,
  calculateDailyCashClosing,
  saveDailyCashClosing,
  getDailyCashClosing
} from "@/lib/checkout-store";

interface DailyCashClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  salonName?: string;
}

export default function DailyCashClosingModal({
  isOpen,
  onClose,
  tenantId,
  salonName = "Trimmy Salone"
}: DailyCashClosingModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [transactions, setTransactions] = useState<CheckoutTransaction[]>([]);
  const [savedClosing, setSavedClosing] = useState<DailyCashClosing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false);
  const [closedByName, setClosedByName] = useState<string>("Titolare Salone");
  const [closingNotes, setClosingNotes] = useState<string>("");

  // Carica i dati per la data selezionata
  const loadData = async (date: string) => {
    setIsLoading(true);
    try {
      const [txs, closing] = await Promise.all([
        fetchCheckoutTransactions(tenantId, date),
        getDailyCashClosing(tenantId, date)
      ]);
      setTransactions(txs);
      setSavedClosing(closing);
    } catch (err) {
      console.error("Errore caricamento chiusura cassa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData(selectedDate);
      setShowConfirmClose(false);
    }
  }, [isOpen, selectedDate, tenantId]);

  // Calcolo aggregato live o salvato
  const currentSummary: DailyCashClosing = useMemo(() => {
    if (savedClosing) return savedClosing;
    return calculateDailyCashClosing(tenantId, selectedDate, transactions);
  }, [savedClosing, tenantId, selectedDate, transactions]);

  // Esecuzione e salvataggio sigillo chiusura cassa
  const handlePerformClosing = async () => {
    setIsSaving(true);
    try {
      const closingToSave: DailyCashClosing = {
        ...currentSummary,
        closedAt: new Date().toISOString(),
        closedBy: closedByName || "Titolare",
        notes: closingNotes || undefined
      };
      await saveDailyCashClosing(tenantId, closingToSave);
      setSavedClosing(closingToSave);
      setShowConfirmClose(false);
    } catch (err) {
      console.error("Errore salvataggio chiusura cassa:", err);
      alert("Si è verificato un errore durante la registrazione della chiusura.");
    } finally {
      setIsSaving(false);
    }
  };

  // Funzione di stampa Report Z
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const isClosed = Boolean(savedClosing);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Container Modale */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header modale */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Chiusura di Cassa Giornaliera</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Report Z
                </span>
              </div>
              <p className="text-xs text-zinc-400">Riepilogo fiscale, corrispettivi per metodo e quadratura contabile</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selettore Data */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={todayStr}
                className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => loadData(selectedDate)}
              disabled={isLoading}
              title="Ricarica dati"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
          isClosed 
            ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-300" 
            : "bg-amber-950/30 border-amber-800/40 text-amber-300"
        }`}>
          <div className="flex items-center gap-2">
            {isClosed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">CASSA CHIUSA E SIGILLATA</span>
                <span className="text-emerald-400/70">
                  — Chiusa il {new Date(savedClosing!.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {savedClosing?.closedBy ? ` da ${savedClosing.closedBy}` : ""}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="font-semibold">CASSA APERTA IN CORSO</span>
                <span className="text-amber-400/80">— Dati provvisori in tempo reale</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span>Salone: <strong className="text-white">{salonName}</strong></span>
          </div>
        </div>

        {/* Body Scrollabile */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Griglia KPI Primari */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* Totale Incassato */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-2 p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-900 border border-amber-500/30 relative overflow-hidden">
              <div className="text-xs uppercase font-semibold text-amber-400 tracking-wider">Totale Incassato</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-white">
                € {currentSummary.totalRevenue.toFixed(2)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentSummary.transactionsCount} scontrini emessi</span>
              </div>
              <div className="absolute top-3 right-3 opacity-20 text-amber-400">
                <TrendingUp className="w-12 h-12" />
              </div>
            </div>

            {/* Contanti */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Contanti</span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                € {currentSummary.cashTotal.toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-500">In cassa fisica</div>
            </div>

            {/* Carte / POS */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>POS / Carte</span>
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                € {currentSummary.cardTotal.toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-500">Bancario / Elettronico</div>
            </div>

            {/* Satispay / Altri */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Satispay & Vouch.</span>
                <Coins className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                € {(currentSummary.satispayTotal + currentSummary.voucherTotal).toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-500">
                {currentSummary.satispayTotal > 0 ? `Sat: €${currentSummary.satispayTotal.toFixed(2)} ` : ""}
                {currentSummary.voucherTotal > 0 ? `Vouch: €${currentSummary.voucherTotal.toFixed(2)}` : ""}
                {currentSummary.satispayTotal === 0 && currentSummary.voucherTotal === 0 ? "Nessun movimento" : ""}
              </div>
            </div>

            {/* Scontrino Medio */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Scontrino Medio</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-amber-300">
                € {currentSummary.averageTicket.toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-500">Per transazione</div>
            </div>
          </div>

          {/* Griglia a 2 colonne: Top Trattamenti e Ripartizione */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top Trattamenti & Prodotti */}
            <div className="lg:col-span-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  Top Servizi e Prodotti Oggi
                </h3>

                {currentSummary.topTreatments.length === 0 ? (
                  <div className="text-xs text-zinc-500 py-6 text-center">
                    Nessun articolo registrato per questa data.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentSummary.topTreatments.map((tr, idx) => {
                      const percentage = currentSummary.totalRevenue > 0
                        ? Math.round((tr.revenue / currentSummary.totalRevenue) * 100)
                        : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-zinc-200 truncate max-w-[180px]">
                              {tr.name} <span className="text-zinc-500">({tr.count}x)</span>
                            </span>
                            <span className="font-semibold text-amber-400">€{tr.revenue.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ripartizione Fiscale Scorporo IVA 22% */}
              <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Imponibile Netto (22%):</span>
                  <span className="font-mono text-zinc-300">
                    € {(currentSummary.totalRevenue / 1.22).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>IVA a debito stimata (22%):</span>
                  <span className="font-mono text-zinc-300">
                    € {(currentSummary.totalRevenue - (currentSummary.totalRevenue / 1.22)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Registro Scontrini della Giornata */}
            <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Registro Transazioni del Giorno ({transactions.length})
                </h3>
                <span className="text-xs text-zinc-500">Ordinamento cronologico</span>
              </div>

              {transactions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                  <Receipt className="w-10 h-10 mb-2 opacity-30 text-zinc-400" />
                  <p className="text-sm font-medium">Nessun incasso registrato in questa data.</p>
                  <p className="text-xs text-zinc-600 mt-1">Gli scontrini emessi dal punto cassa appariranno qui automaticamente.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1">
                  {transactions.map((tx) => {
                    const time = new Date(tx.issuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                            {time}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{tx.customerName}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">#{tx.receiptNumber}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-xs">
                              {tx.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Badge Metodo */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            tx.paymentMethod === "CASH"
                              ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                              : tx.paymentMethod === "CARD"
                              ? "bg-blue-950/50 text-blue-400 border-blue-800"
                              : tx.paymentMethod === "MIXED"
                              ? "bg-indigo-950/50 text-indigo-400 border-indigo-800"
                              : tx.paymentMethod === "SATISPAY"
                              ? "bg-red-950/50 text-red-400 border-red-800"
                              : "bg-purple-950/50 text-purple-400 border-purple-800"
                          }`}>
                            {tx.paymentMethod === "CASH" ? "Contanti" : tx.paymentMethod === "CARD" ? "POS" : tx.paymentMethod === "MIXED" ? "Misto" : tx.paymentMethod}
                          </span>

                          <div className="text-right">
                            <span className="text-xs font-bold text-white font-mono">€{tx.finalAmount.toFixed(2)}</span>
                            {tx.discountAmount ? (
                              <div className="text-[10px] text-amber-400">-€{tx.discountAmount.toFixed(2)}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Form di Chiusura / Conferma Sigillo */}
          {showConfirmClose && !isClosed && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Conferma Chiusura Cassa (Report Z) per il {selectedDate}</h4>
                    <p className="text-xs text-amber-300/80 mt-0.5">
                      La chiusura di cassa salverà lo stato contabile definitivo. Sarà generato il Report Z e la cassa per questa data verrà marcata come sigillata.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Operatore Responsabile</label>
                      <input
                        type="text"
                        value={closedByName}
                        onChange={(e) => setClosedByName(e.target.value)}
                        placeholder="Nome operatore..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Note Chiusura (Opzionale)</label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="es. Quadratura perfetta, fondo cassa invariato..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowConfirmClose(false)}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700 transition"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handlePerformClosing}
                      disabled={isSaving}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-zinc-950 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvataggio...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Sigilla e Registra Chiusura</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Azioni */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Stampa Report Z / PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Chiudi Finestra
            </button>

            {!isClosed ? (
              <button
                onClick={() => setShowConfirmClose(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-zinc-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <Lock className="w-4 h-4" />
                <span>Chiudi Cassa del Giorno</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-4 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span>Chiusura Già Sigillata</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sezione Nascosta Visibile SOLO alla Stampa per Report Z Cartaceo / PDF */}
      <div id="z-report-print" className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-8">
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #z-report-print, #z-report-print * {
              visibility: visible;
            }
            #z-report-print {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              color: black;
              font-family: monospace;
              padding: 20px;
            }
          }
        `}</style>
        
        <div className="max-w-md mx-auto text-center border-b pb-4 mb-4">
          <h1 className="text-xl font-bold uppercase">{salonName}</h1>
          <p className="text-xs">Trimmy Cloud POS - Punto Cassa Fiscale</p>
          <div className="mt-2 text-sm font-bold border-y py-1 tracking-wider">
            REPORT Z - CHIUSURA GIORNALIERA
          </div>
          <p className="text-xs mt-1">Data: {selectedDate} | Stampato alle: {new Date().toLocaleTimeString()}</p>
          {savedClosing?.closedBy && <p className="text-xs">Operatore: {savedClosing.closedBy}</p>}
        </div>

        <div className="max-w-md mx-auto space-y-3 text-xs">
          <div className="flex justify-between font-bold border-b pb-1 text-sm">
            <span>TOTALE GIORNALIERO:</span>
            <span>€ {currentSummary.totalRevenue.toFixed(2)}</span>
          </div>

          <div className="space-y-1 py-1">
            <div className="flex justify-between">
              <span>CONTANTI:</span>
              <span>€ {currentSummary.cashTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>POS / CARTE:</span>
              <span>€ {currentSummary.cardTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SATISPAY:</span>
              <span>€ {currentSummary.satispayTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>VOUCHER:</span>
              <span>€ {currentSummary.voucherTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between">
              <span>N. SCONTRINI:</span>
              <span>{currentSummary.transactionsCount}</span>
            </div>
            <div className="flex justify-between">
              <span>SCONTRINO MEDIO:</span>
              <span>€ {currentSummary.averageTicket.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IMPONIBILE NETTO (IVA 22%):</span>
              <span>€ {(currentSummary.totalRevenue / 1.22).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA AL 22%:</span>
              <span>€ {(currentSummary.totalRevenue - (currentSummary.totalRevenue / 1.22)).toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t pt-3 mt-4">
            <div className="font-bold mb-1">DETTAGLIO TRANSAZIONI:</div>
            {transactions.map((tx) => (
              <div key={tx.id} className="flex justify-between py-0.5 text-[11px]">
                <span>{new Date(tx.issuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} #{tx.receiptNumber} ({tx.paymentMethod})</span>
                <span>€{tx.finalAmount.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-8 mt-8 text-center text-[10px]">
            <p>Firma Responsabile di Cassa: ___________________________</p>
            <p className="mt-2 text-zinc-500">Documento gestionale valido per quadratura contabile</p>
          </div>
        </div>
      </div>

    </div>
  );
}
