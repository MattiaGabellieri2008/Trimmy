"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getSalonTenantId } from "@/lib/tenant-helper";
import { 
  ProductItem, 
  ProductCategory, 
  StockMovement,
  fetchSalonProducts, 
  saveSalonProduct, 
  deleteSalonProduct, 
  adjustProductStock, 
  fetchStockMovements, 
  computeInventoryStats 
} from "@/lib/inventory-store";
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Sparkles, 
  Barcode, 
  DollarSign, 
  Boxes, 
  AlertCircle, 
  Filter, 
  X, 
  RotateCcw,
  Loader2,
  TrendingUp,
  Tag
} from "lucide-react";

type FilterTab = "ALL" | "RIVENDITA" | "USO_INTERNO" | "LOW_STOCK";

export default function MagazzinoPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [salonTenantId, setSalonTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Prodotti & Movimenti
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);

  // Filtri & Ricerca
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  // Modale Nuovo / Modifica Prodotto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formCategory, setFormCategory] = useState<ProductCategory>("RIVENDITA");
  const [formSubCategory, setFormSubCategory] = useState("Shampoo & Care");
  const [formBarcode, setFormBarcode] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("8.50");
  const [formRetailPrice, setFormRetailPrice] = useState("22.00");
  const [formStockQuantity, setFormStockQuantity] = useState("10");
  const [formMinThreshold, setFormMinThreshold] = useState("3");
  const [formUnit, setFormUnit] = useState("pz");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modale Carico / Scarico Rapido
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetProductId, setAdjustTargetProductId] = useState("");
  const [adjustType, setAdjustType] = useState<"CARICO_FORNITORE" | "CONSUMO_INTERNO" | "RETTIFICA_MANUALE" | "RESO_CLIENTE">("CARICO_FORNITORE");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Caricamento Dati
  const loadData = async (tid: string) => {
    setLoading(true);
    try {
      const [prods, movs] = await Promise.all([
        fetchSalonProducts(tid),
        fetchStockMovements(tid)
      ]);
      setProducts(prods);
      setMovements(movs);
    } catch (err) {
      console.warn("Errore caricamento magazzino:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const tid = getSalonTenantId(user.uid);
        setSalonTenantId(tid);
        loadData(tid);
      } else {
        router.push("/login");
      }
    });

    const handleDataUpdated = () => {
      if (auth.currentUser) {
        loadData(getSalonTenantId(auth.currentUser.uid));
      }
    };
    window.addEventListener("trimmy-data-updated", handleDataUpdated);

    return () => {
      unsub();
      window.removeEventListener("trimmy-data-updated", handleDataUpdated);
    };
  }, [router]);

  // Statistiche inventario
  const stats = useMemo(() => {
    return computeInventoryStats(products);
  }, [products]);

  // Filtraggio prodotti
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filtro Tab
      if (activeTab === "RIVENDITA" && p.category !== "RIVENDITA") return false;
      if (activeTab === "USO_INTERNO" && p.category !== "USO_INTERNO") return false;
      if (activeTab === "LOW_STOCK" && p.stockQuantity > p.minStockThreshold) return false;

      // Ricerca testo
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBrand = p.brand.toLowerCase().includes(q);
        const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const matchesSub = p.subCategory ? p.subCategory.toLowerCase().includes(q) : false;
        return matchesName || matchesBrand || matchesBarcode || matchesSub;
      }

      return true;
    });
  }, [products, activeTab, searchQuery]);

  // Apertura modale nuovo prodotto
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormBrand("");
    setFormCategory("RIVENDITA");
    setFormSubCategory("Shampoo & Care");
    setFormBarcode("");
    setFormCostPrice("8.50");
    setFormRetailPrice("22.00");
    setFormStockQuantity("10");
    setFormMinThreshold("3");
    setFormUnit("pz");
    setFormNotes("");
    setIsProductModalOpen(true);
  };

  // Apertura modale modifica
  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBrand(p.brand);
    setFormCategory(p.category);
    setFormSubCategory(p.subCategory || "Generale");
    setFormBarcode(p.barcode || "");
    setFormCostPrice(p.costPrice.toString());
    setFormRetailPrice(p.retailPrice.toString());
    setFormStockQuantity(p.stockQuantity.toString());
    setFormMinThreshold(p.minStockThreshold.toString());
    setFormUnit(p.unit || "pz");
    setFormNotes(p.notes || "");
    setIsProductModalOpen(true);
  };

  // Salvataggio Prodotto
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBrand.trim()) {
      alert("Nome prodotto e Brand sono obbligatori!");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveSalonProduct(salonTenantId, {
        id: editingProduct?.id,
        name: formName,
        brand: formBrand,
        category: formCategory,
        subCategory: formSubCategory,
        barcode: formBarcode,
        costPrice: parseFloat(formCostPrice) || 0,
        retailPrice: formCategory === "USO_INTERNO" ? 0 : parseFloat(formRetailPrice) || 0,
        stockQuantity: parseInt(formStockQuantity, 10) || 0,
        minStockThreshold: parseInt(formMinThreshold, 10) || 3,
        unit: formUnit,
        notes: formNotes
      });

      setIsProductModalOpen(false);
      showToast(editingProduct ? "Prodotto aggiornato con successo!" : "Nuovo prodotto aggiunto al magazzino!");
      await loadData(salonTenantId);
    } catch (err: any) {
      alert("Errore salvataggio prodotto: " + (err.message || "Errore sconosciuto"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminazione Prodotto
  const handleDeleteProduct = async (p: ProductItem) => {
    if (!confirm(`Sei sicuro di voler eliminare "${p.brand} - ${p.name}" dal magazzino?`)) return;
    try {
      await deleteSalonProduct(salonTenantId, p.id);
      showToast(`Prodotto "${p.name}" eliminato.`);
      await loadData(salonTenantId);
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  // Apertura modale Carico / Scarico Rapido
  const handleOpenAdjustModal = (productId?: string) => {
    setAdjustTargetProductId(productId || (products[0]?.id || ""));
    setAdjustType("CARICO_FORNITORE");
    setAdjustQuantity("6");
    setAdjustReason("");
    setIsAdjustModalOpen(true);
  };

  // Esecuzione Rettifica / Carico
  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetProductId) {
      alert("Seleziona un prodotto!");
      return;
    }

    const qty = parseInt(adjustQuantity, 10);
    if (!qty || qty <= 0) {
      alert("Inserisci una quantità valida maggiore di 0!");
      return;
    }

    setIsAdjusting(true);
    try {
      // Determina il delta in base all'operazione
      let delta = qty;
      if (adjustType === "CONSUMO_INTERNO") {
        delta = -qty;
      }

      await adjustProductStock(
        salonTenantId,
        adjustTargetProductId,
        delta,
        adjustType,
        adjustReason || undefined,
        currentUser?.displayName || "Staff Salone"
      );

      setIsAdjustModalOpen(false);
      showToast("Movimento di magazzino registrato con successo!");
      await loadData(salonTenantId);
    } catch (err: any) {
      alert("Errore registrazione movimento: " + err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* ─── HEADER & AZIONI PRINCIPALI ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                Magazzino & Inventario
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Monitoraggio giacenze scorte, scarico automatico al POS e alert di riordino.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Pulsante Storico Movimenti */}
          <button
            onClick={() => setIsMovementsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Visualizza registro cronologico movimenti"
          >
            <History className="w-4 h-4 text-zinc-600" />
            <span className="hidden sm:inline">Storico</span> Movimenti
          </button>

          {/* Pulsante Carico / Scarico Rapido */}
          <button
            onClick={() => handleOpenAdjustModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="Carico merci o rettifica inventario"
          >
            <Boxes className="w-4 h-4 text-amber-700" />
            Carico / Scarico
          </button>

          {/* Pulsante Nuovo Prodotto */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuovo Prodotto
          </button>
        </div>
      </div>

      {/* ─── 4 TOP METRIC CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Valore Totale a Costo */}
        <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Valore Magazzino (Costo)</span>
            <DollarSign className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            € {stats.totalCostValue.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-zinc-500">
            Investimento totale in giacenza
          </p>
        </div>

        {/* Valore Potenziale Rivendita */}
        <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Potenziale Incasso POS</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
            € {stats.totalRetailValue.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-700/80 font-medium">
            Margine potenziale: +€ {Math.max(0, stats.potentialGrossMargin).toFixed(2)}
          </p>
        </div>

        {/* Unità in Giacenza */}
        <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Scorte Totali</span>
            <Boxes className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            {stats.totalUnits} <span className="text-xs font-semibold text-zinc-500 uppercase">pezzi</span>
          </p>
          <p className="text-[11px] text-zinc-500">
            Su {stats.totalProductsCount} referenze a catalogo
          </p>
        </div>

        {/* Alert Sottoscorta */}
        <div className={`p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 border ${
          stats.lowStockCount > 0 
            ? "bg-amber-50/80 border-amber-300 text-amber-950" 
            : "bg-white border-zinc-200/80 text-zinc-900"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">Alert Sottoscorta</span>
            <AlertTriangle className={`w-4 h-4 ${stats.lowStockCount > 0 ? "text-amber-600 animate-pulse" : "text-zinc-400"}`} />
          </div>
          <p className="text-xl sm:text-2xl font-black tracking-tight">
            {stats.lowStockCount} <span className="text-xs font-semibold uppercase">da ordinare</span>
          </p>
          <p className="text-[11px] text-amber-800">
            {stats.outOfStockCount > 0 
              ? `${stats.outOfStockCount} articoli esauriti (0 pz)` 
              : stats.lowStockCount > 0 ? "Scorte sotto la soglia minima" : "Nessun prodotto sotto soglia"}
          </p>
        </div>
      </div>

      {/* ─── FILTRI, TAB & BARRA DI RICERCA ─── */}
      <div className="bg-white border border-zinc-200/80 p-3 sm:p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab di Navigazione Categorie */}
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "ALL" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Tutti ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("RIVENDITA")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "RIVENDITA" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Rivendita Clienti ({products.filter((p) => p.category === "RIVENDITA").length})
          </button>
          <button
            onClick={() => setActiveTab("USO_INTERNO")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "USO_INTERNO" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Uso Interno / Tecnico ({products.filter((p) => p.category === "USO_INTERNO").length})
          </button>
          <button
            onClick={() => setActiveTab("LOW_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              activeTab === "LOW_STOCK" 
                ? "bg-amber-500 text-zinc-950 shadow-xs" 
                : "text-amber-800 hover:text-amber-950"
            }`}
          >
            ⚠️ Sottoscorta ({stats.lowStockCount})
          </button>
        </div>

        {/* Input Ricerca */}
        <div className="relative min-w-[240px] lg:min-w-[320px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cerca per nome, brand, EAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── TABELLA PRODOTTI ─── */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200/60">
              <tr>
                <th className="py-3 px-4">Prodotto & Brand</th>
                <th className="py-3 px-4">Destinazione</th>
                <th className="py-3 px-4 text-right">Costo Fornitore</th>
                <th className="py-3 px-4 text-right">Prezzo POS</th>
                <th className="py-3 px-4 text-center">Giacenza</th>
                <th className="py-3 px-4 text-center">Soglia Minima</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-900" />
                    Caricamento magazzino salone in corso...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    Nessun prodotto trovato per i filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow = p.stockQuantity <= p.minStockThreshold && !isOut;
                  const marginPercent = p.retailPrice > 0 && p.costPrice > 0
                    ? (((p.retailPrice - p.costPrice) / p.retailPrice) * 100).toFixed(0)
                    : null;

                  return (
                    <tr 
                      key={p.id}
                      className={`hover:bg-zinc-50/70 transition-colors ${
                        isOut ? "bg-red-50/20" : isLow ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Prodotto & Brand */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-900 text-sm">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-zinc-500">
                          <span className="font-semibold text-zinc-700">{p.brand}</span>
                          {p.subCategory && (
                            <>
                              <span>•</span>
                              <span>{p.subCategory}</span>
                            </>
                          )}
                          {p.barcode && (
                            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.2 rounded">
                              {p.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Destinazione / Categoria */}
                      <td className="py-3.5 px-4">
                        {p.category === "RIVENDITA" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Tag className="w-3 h-3 text-emerald-600" />
                            Rivendita Cliente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            <Boxes className="w-3 h-3 text-indigo-600" />
                            Uso Interno Salone
                          </span>
                        )}
                      </td>

                      {/* Prezzo Acquisto */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-zinc-600">
                        € {p.costPrice.toFixed(2)}
                      </td>

                      {/* Prezzo POS */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                        {p.category === "RIVENDITA" ? (
                          <div>
                            <span>€ {p.retailPrice.toFixed(2)}</span>
                            {marginPercent && (
                              <span className="block text-[10px] text-emerald-600 font-medium">
                                +{marginPercent}% marg.
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 font-normal italic">N/A (Tecnico)</span>
                        )}
                      </td>

                      {/* Giacenza */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isOut
                            ? "bg-red-50 text-red-700 border-red-200"
                            : isLow
                            ? "bg-amber-50 text-amber-900 border-amber-300"
                            : "bg-zinc-100 text-zinc-800 border-zinc-200"
                        }`}>
                          {isOut ? "⛔ Esaurito" : `${p.stockQuantity} ${p.unit}`}
                        </span>
                      </td>

                      {/* Soglia Minima */}
                      <td className="py-3.5 px-4 text-center font-mono text-zinc-500">
                        {p.minStockThreshold} {p.unit}
                      </td>

                      {/* Azioni */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAdjustModal(p.id)}
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            title="Carico o scarico rapido per questo prodotto"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                            title="Modifica scheda prodotto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Elimina prodotto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODALE NUOVO / MODIFICA PRODOTTO ─── */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-900">
                {editingProduct ? "Modifica Scheda Prodotto" : "Nuovo Articolo a Magazzino"}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Nome Prodotto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Shampoo Ristrutturante"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Brand / Marchio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Kérastase"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Destinazione / Canale *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="RIVENDITA">Rivendita al Cliente (POS)</option>
                    <option value="USO_INTERNO">Uso Interno Salone (Tecnico)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Sottocategoria
                  </label>
                  <select
                    value={formSubCategory}
                    onChange={(e) => setFormSubCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="Shampoo & Care">Shampoo & Care</option>
                    <option value="Maschere & Balsami">Maschere & Balsami</option>
                    <option value="Styling & Finish">Styling & Finish</option>
                    <option value="Oli & Trattamenti">Oli & Trattamenti</option>
                    <option value="Colorazione & Decolorazione">Colorazione & Decolorazione</option>
                    <option value="Barber Care">Barber Care</option>
                    <option value="Monouso & Igiene">Monouso & Igiene</option>
                    <option value="Generale">Generale</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Prezzo Costo (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Es. 8.50"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Prezzo POS (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={formCategory === "USO_INTERNO"}
                    placeholder={formCategory === "USO_INTERNO" ? "0.00" : "Es. 22.00"}
                    value={formCategory === "USO_INTERNO" ? "0" : formRetailPrice}
                    onChange={(e) => setFormRetailPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Barcode / EAN
                  </label>
                  <input
                    type="text"
                    placeholder="Opzionale"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Giacenza Iniziale
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Soglia Minima
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 uppercase mb-1">
                    Unità
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="pz">Pezzi (pz)</option>
                    <option value="flacone">Flacone</option>
                    <option value="tubo">Tubo</option>
                    <option value="barattolo">Barattolo</option>
                    <option value="ml">Millilitri (ml)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 uppercase mb-1">
                  Note Interne (Opzionali)
                </label>
                <textarea
                  rows={2}
                  placeholder="Es. Fornitore principale Beauty Group SRL, codice catalogo..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salva Scheda Prodotto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODALE CARICO / SCARICO RAPIDO ─── */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-zinc-900">
                  Carico / Scarico Magazzino
                </h3>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjust} className="p-6 space-y-4 text-xs">
              {/* Selezione Prodotto */}
              <div>
                <label className="block font-semibold text-zinc-700 uppercase mb-1">
                  Seleziona Prodotto *
                </label>
                <select
                  value={adjustTargetProductId}
                  onChange={(e) => setAdjustTargetProductId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} - {p.name} (Giacenza: {p.stockQuantity} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo di Movimento */}
              <div>
                <label className="block font-semibold text-zinc-700 uppercase mb-1">
                  Tipo Operazione *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("CARICO_FORNITORE")}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      adjustType === "CARICO_FORNITORE"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    + Carico Fornitore
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("CONSUMO_INTERNO")}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      adjustType === "CONSUMO_INTERNO"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    - Consumo Tecnico
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("RETTIFICA_MANUALE")}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      adjustType === "RETTIFICA_MANUALE"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                        : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Rettifica Inventario
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("RESO_CLIENTE")}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      adjustType === "RESO_CLIENTE"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    + Reso Cliente
                  </button>
                </div>
              </div>

              {/* Quantità */}
              <div>
                <label className="block font-semibold text-zinc-700 uppercase mb-1">
                  Quantità Pezzi *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {[1, 6, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAdjustQuantity(num.toString())}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-xs font-semibold"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note / Causale */}
              <div>
                <label className="block font-semibold text-zinc-700 uppercase mb-1">
                  Note / Numero DDT / Fornitore
                </label>
                <input
                  type="text"
                  placeholder="Es. DDT n. 458/2026, fattura fornitore..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isAdjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Conferma Movimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODALE STORICO MOVIMENTI DI MAGAZZINO ─── */}
      {isMovementsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-800" />
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Registro Cronologico Movimenti di Magazzino
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Audit trail completo delle vendite POS, carichi da fornitore e consumi tecnici
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsMovementsOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {movements.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  Nessun movimento registrato finora.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-3">Data & Ora</th>
                      <th className="py-2.5 px-3">Prodotto</th>
                      <th className="py-2.5 px-3">Operazione</th>
                      <th className="py-2.5 px-3 text-center">Delta</th>
                      <th className="py-2.5 px-3 text-center">Giacenza</th>
                      <th className="py-2.5 px-3">Operatore</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {movements.map((m) => {
                      const isPositive = m.delta > 0;
                      return (
                        <tr key={m.id} className="hover:bg-zinc-50/70">
                          <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">
                            {new Date(m.timestamp).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}{" "}
                            {new Date(m.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-900">
                            {m.productName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] text-zinc-600 block">{m.reason}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] ${
                              isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}>
                              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {isPositive ? `+${m.delta}` : m.delta}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-zinc-600">
                            {m.previousStock} ➔ <strong>{m.newStock}</strong>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                            {m.operatorName || "Staff"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setIsMovementsOpen(false)}
                className="px-4 py-2 bg-white border border-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold hover:bg-zinc-100"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST FEEDBACK FLUTTUANTE ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
