"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  X, 
  CreditCard, 
  Banknote, 
  Coins, 
  Receipt, 
  Plus, 
  Trash2, 
  Percent, 
  Check, 
  Sparkles, 
  Printer, 
  MessageSquare, 
  ShoppingBag, 
  User, 
  Scissors, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { 
  CheckoutItem, 
  CheckoutTransaction, 
  PaymentMethod, 
  DEFAULT_RETAIL_PRODUCTS, 
  saveCheckoutTransaction 
} from "@/lib/checkout-store";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  salonRawId?: string;
  salonName?: string;
  appointmentId?: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  initialItems?: CheckoutItem[];
  availableStaff?: { id: string; fullName: string; role?: string }[];
  onTransactionCompleted?: (tx: CheckoutTransaction) => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  tenantId,
  salonRawId,
  salonName = "Trimmy Salone",
  appointmentId,
  initialCustomerName = "Cliente al Banco",
  initialCustomerPhone = "",
  initialItems = [],
  availableStaff = [],
  onTransactionCompleted
}: CheckoutModalProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [discountEuro, setDiscountEuro] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CARD");
  
  // Dettagli Contanti & Resto
  const [cashGiven, setCashGiven] = useState<number>(0);

  // Dettagli Pagamento Misto
  const [mixedCashAmount, setMixedCashAmount] = useState<number>(0);

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");

  const [operatorName, setOperatorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTx, setCompletedTx] = useState<CheckoutTransaction | null>(null);

  // Inizializza articoli
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      if (initialItems[0].operatorName) {
        setOperatorName(initialItems[0].operatorName);
      }
    } else {
      setItems([
        { id: "item-base", type: "SERVICE", name: "Trattamento Personalizzato", price: 25.0, quantity: 1 }
      ]);
    }
    setCustomerName(initialCustomerName || "Cliente al Banco");
    setCustomerPhone(initialCustomerPhone || "");
    setDiscountEuro(0);
    setSelectedMethod("CARD");
    setCompletedTx(null);
  }, [isOpen, initialCustomerName, initialCustomerPhone, initialItems]);

  // Calcolo Totali
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  }, [items]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountEuro);
  }, [subtotal, discountEuro]);

  // Calcolo resto contanti
  const changeGiven = useMemo(() => {
    if (selectedMethod === "CASH") {
      return Math.max(0, cashGiven - finalTotal);
    }
    return 0;
  }, [selectedMethod, cashGiven, finalTotal]);

  // Quota carta rimanente in pagamento misto
  const mixedCardRemaining = useMemo(() => {
    return Math.max(0, finalTotal - mixedCashAmount);
  }, [finalTotal, mixedCashAmount]);

  useEffect(() => {
    if (finalTotal > 0 && cashGiven < finalTotal) {
      setCashGiven(finalTotal);
    }
    if (finalTotal > 0 && mixedCashAmount === 0) {
      setMixedCashAmount(Math.round(finalTotal / 2));
    }
  }, [finalTotal]);

  if (!isOpen) return null;

  const handleAddItem = (preset: CheckoutItem) => {
    const existingIndex = items.findIndex((i) => i.name === preset.name);
    if (existingIndex >= 0) {
      const copy = [...items];
      copy[existingIndex].quantity += 1;
      setItems(copy);
    } else {
      setItems([...items, { ...preset, id: `item-${Date.now()}` }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleFinalCheckout = async () => {
    if (items.length === 0 || finalTotal <= 0) {
      alert("Aggiungi almeno un articolo al carrello con importo valido.");
      return;
    }

    setIsSubmitting(true);
    const receiptNum = `CORR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const tx: CheckoutTransaction = {
      id: `tx-${Date.now()}`,
      tenantId,
      salonRawId,
      appointmentId,
      customerName: customerName.trim() || "Cliente al Banco",
      customerPhone: customerPhone.trim() || undefined,
      items,
      totalAmount: subtotal,
      discountAmount: discountEuro > 0 ? discountEuro : undefined,
      finalAmount: finalTotal,
      paymentMethod: selectedMethod,
      paymentDetails: {
        ...(selectedMethod === "CASH" ? { cashGiven, changeGiven } : {}),
        ...(selectedMethod === "MIXED" ? { cashAmount: mixedCashAmount, cardAmount: mixedCardRemaining } : {}),
        ...(selectedMethod === "VOUCHER" ? { voucherCode } : {})
      },
      receiptNumber: receiptNum,
      taxRate: 22,
      operatorName: operatorName || (availableStaff[0]?.fullName) || "Staff Salone",
      issuedAt: new Date().toISOString()
    };

    try {
      await saveCheckoutTransaction(tenantId, tx);
      setCompletedTx(tx);
      if (onTransactionCompleted) {
        onTransactionCompleted(tx);
      }
    } catch (e: any) {
      alert("Errore registrazione incasso: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] text-zinc-900">
        
        {/* Header Cassa POS */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight leading-tight">
                Punto Cassa & Registratore Incasso
              </h2>
              <p className="text-xs text-zinc-400">
                {salonName} • {appointmentId ? "Saldo da Agenda" : "Incasso al Banco Walk-in"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white">
          
          {/* Se transazione appena completata: Schermata Ricevuta */}
          {completedTx ? (
            <div className="py-4 space-y-6 animate-in zoom-in-95 duration-200 text-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  Pagamento Confermato & Registrato
                </span>
                <h3 className="text-2xl font-black text-zinc-900 mt-2">
                  Incasso di €{completedTx.finalAmount.toFixed(2)} Saldato!
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Scontrino #{completedTx.receiptNumber} registrato nella chiusura cassa giornaliera.
                </p>
              </div>

              {/* Scontrino Virtuale Ristretto */}
              <div className="max-w-sm mx-auto bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left text-xs space-y-3 font-mono shadow-inner">
                <div className="text-center pb-2 border-b border-dashed border-zinc-300">
                  <h4 className="font-bold text-sm text-zinc-900 uppercase font-sans">{salonName}</h4>
                  <p className="text-[10px] text-zinc-500">DOCUMENTO COMMERCIALE DI CORTESIA</p>
                  <p className="text-[10px] text-zinc-400">N. {completedTx.receiptNumber}</p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {completedTx.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate pr-2">{it.quantity}x {it.name}</span>
                      <strong className="text-zinc-900 shrink-0">€{(it.price * it.quantity).toFixed(2)}</strong>
                    </div>
                  ))}
                  {completedTx.discountAmount && (
                    <div className="flex justify-between text-rose-600">
                      <span>SCONTO APPLICATO</span>
                      <strong>-€{completedTx.discountAmount.toFixed(2)}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-dashed border-zinc-300 space-y-1">
                  <div className="flex justify-between text-sm font-black text-zinc-900">
                    <span>TOTALE COMPLESSIVO:</span>
                    <span>€{completedTx.finalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Metodo: {completedTx.paymentMethod}</span>
                    {completedTx.paymentDetails?.changeGiven !== undefined && completedTx.paymentDetails.changeGiven > 0 && (
                      <span className="text-emerald-700 font-bold">Resto Dato: €{completedTx.paymentDetails.changeGiven.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 pt-1">
                    <span>Cliente: {completedTx.customerName}</span>
                    <span>Op: {completedTx.operatorName}</span>
                  </div>
                </div>
              </div>

              {/* Azioni Rapide Stampa & WhatsApp */}
              <div className="max-w-sm mx-auto flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-zinc-600" />
                  <span>Stampa Ricevuta / Scontrino POS</span>
                </button>

                {completedTx.customerPhone && (
                  <a
                    href={`https://wa.me/${completedTx.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Gentile ${completedTx.customerName}, grazie per la visita presso ${salonName}! Ecco la ricevuta del tuo appuntamento: Totale €${completedTx.finalAmount.toFixed(2)} (Scontrino #${completedTx.receiptNumber}). A presto!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Invia Ricevuta WhatsApp a {completedTx.customerName}</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-sm cursor-pointer mt-1"
                >
                  Chiudi e Torna all&apos;Agenda
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Intestazione Cliente & Operatore */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                    Cliente Salone
                  </label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nome e cognome cliente"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                    Cellulare per Ricevuta WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Es. 340 1234567"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Elenco Articoli al Banco (Servizi + Prodotti) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Articoli da Incassare ({items.length})
                  </h4>
                  <span className="text-[11px] text-zinc-400">Modifica quantità o prezzo al volo</span>
                </div>

                <div className="space-y-2 border border-zinc-200/70 rounded-2xl p-2.5 bg-zinc-50/40">
                  {items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-zinc-200/80 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                            item.type === "SERVICE" ? "bg-zinc-900 text-white" : "bg-amber-100 text-amber-800"
                          }`}>
                            {item.type === "SERVICE" ? "Servizio" : "Prodotto"}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-zinc-900 truncate">{item.name}</span>
                        </div>
                        {item.operatorName && (
                          <span className="text-[11px] text-zinc-400 block mt-0.5">Staff: {item.operatorName}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-zinc-500">Qta:</span>
                          <input 
                            type="number"
                            min="1"
                            max="20"
                            value={item.quantity}
                            onChange={(e) => {
                              const copy = [...items];
                              copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                              setItems(copy);
                            }}
                            className="w-12 text-center py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold"
                          />
                        </div>

                        <div className="text-right min-w-[70px]">
                          <strong className="text-sm font-black text-zinc-900 block">
                            €{(item.price * item.quantity).toFixed(2)}
                          </strong>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Rimuovi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aggiunta Rapida Prodotti da Banco */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    + Aggiungi Vendita Prodotto da Banco:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_RETAIL_PRODUCTS.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddItem(prod)}
                        className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-zinc-500" />
                        <span>{prod.name}</span>
                        <strong className="text-zinc-900 font-bold">€{prod.price}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sconto & Totale Cassa */}
              <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-300 border-b border-zinc-800 pb-2.5">
                  <span>Subtotale Servizi & Prodotti:</span>
                  <strong className="text-sm text-white">€{subtotal.toFixed(2)}</strong>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <Percent className="w-3.5 h-3.5 text-amber-400" /> Sconto Cassa (€):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => setDiscountEuro(0)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountEuro === 0 ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      0€
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDiscountEuro(5)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountEuro === 5 ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      -5€
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDiscountEuro(10)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountEuro === 10 ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      -10€
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discountEuro}
                      onChange={(e) => setDiscountEuro(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-right font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-zinc-800">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-amber-400">
                    Totale da Incassare:
                  </span>
                  <span className="text-3xl font-black text-white tracking-tight">
                    €{finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* SELETTORE METODO DI PAGAMENTO */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 block">
                  Metodo di Pagamento del Cliente:
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {/* Carta POS */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("CARD")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod === "CARD"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold">POS / Carta</span>
                  </button>

                  {/* Contanti */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("CASH")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod === "CASH"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold">Contanti</span>
                  </button>

                  {/* Pagamento Misto */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("MIXED")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod === "MIXED"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span className="font-bold">Misto</span>
                  </button>

                  {/* Satispay */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("SATISPAY")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod === "SATISPAY"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center">S</span>
                    <span className="font-bold">Satispay</span>
                  </button>

                  {/* Voucher */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("VOUCHER")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod === "VOUCHER"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="font-bold">Voucher</span>
                  </button>
                </div>

                {/* Dettaglio Contanti: Calcolo Resto Automatico */}
                {selectedMethod === "CASH" && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950">
                        Importo Ricevuto dal Cliente:
                      </span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-sm font-bold text-emerald-950">€</span>
                        <input
                          type="number"
                          step="0.5"
                          value={cashGiven}
                          onChange={(e) => setCashGiven(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-sm font-black text-right text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Quick Cash Chips */}
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setCashGiven(finalTotal)}
                        className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-lg font-bold text-emerald-900 text-[11px]"
                      >
                        Esatto (€{finalTotal.toFixed(2)})
                      </button>
                      {[20, 50, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashGiven(val)}
                          className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-lg font-bold text-emerald-900 text-[11px]"
                        >
                          €{val}
                        </button>
                      ))}
                    </div>

                    {/* Resto da dare in evidenza */}
                    <div className="flex items-baseline justify-between pt-2 border-t border-emerald-200/80">
                      <span className="text-xs font-bold text-emerald-900 uppercase">
                        Resto da Restituire:
                      </span>
                      <span className="text-2xl font-black text-emerald-800">
                        €{changeGiven.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dettaglio Pagamento Misto */}
                {selectedMethod === "MIXED" && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-200 text-xs">
                    <span className="font-bold text-amber-950 block">Ripartizione Incasso Misto:</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-amber-900 font-semibold block mb-1">Quota Contanti (€)</label>
                        <input
                          type="number"
                          step="1"
                          max={finalTotal}
                          value={mixedCashAmount}
                          onChange={(e) => setMixedCashAmount(Math.min(finalTotal, parseFloat(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-bold text-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-amber-900 font-semibold block mb-1">Quota Carta/POS (€)</label>
                        <div className="px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg font-black text-zinc-900">
                          €{mixedCardRemaining.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dettaglio Voucher */}
                {selectedMethod === "VOUCHER" && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2 animate-in fade-in duration-200 text-xs">
                    <label className="font-bold text-purple-950 block">Codice Buono / Gift Card:</label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="ES. GIFT-TRIMMY-50"
                      className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-mono font-bold text-zinc-900 uppercase"
                    />
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer Actions */}
        {!completedTx && (
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              Totale da saldare: <strong className="text-zinc-900 font-black text-base ml-1">€{finalTotal.toFixed(2)}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handleFinalCheckout}
                disabled={isSubmitting || finalTotal <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>{isSubmitting ? "Registrazione..." : "Salda & Emetti Ricevuta"}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
