"use client";

import { useState, useEffect } from "react";
import { 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  CloudOff,
  CloudLightning,
  Sparkles
} from "lucide-react";
import { 
  getSyncStatus, 
  processOutboxQueue, 
  reconcileTriSourceData,
  initOnlineSyncListener 
} from "@/lib/outbox-sync";

interface SyncBannerProps {
  tenantId: string;
}

export default function SyncBanner({ tenantId }: SyncBannerProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    // Inizializza stato attuale
    const status = getSyncStatus(tenantId);
    setIsOnline(status.isOnline);
    setPendingCount(status.pendingCount);

    // Registra listener per cambi di connessione e aggiornamenti outbox
    const unsubscribe = initOnlineSyncListener(tenantId);

    const handleSyncStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setIsOnline(customEvent.detail.isOnline);
        setPendingCount(customEvent.detail.pendingCount);
      }
    };

    window.addEventListener("trimmy-sync-status-changed", handleSyncStatusChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("trimmy-sync-status-changed", handleSyncStatusChanged);
    };
  }, [tenantId]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await processOutboxQueue(tenantId);
      if (res.remaining === 0) {
        setSuccessToast(`Sincronizzazione completata con successo (${res.processed} elementi allineati)!`);
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err) {
      console.error("Errore sincronizzazione manuale:", err);
    } finally {
      setIsSyncing(false);
      const updated = getSyncStatus(tenantId);
      setIsOnline(updated.isOnline);
      setPendingCount(updated.pendingCount);
    }
  };

  const handleFullReconciliation = async () => {
    setIsSyncing(true);
    try {
      const res = await reconcileTriSourceData(tenantId);
      setSuccessToast(`Riconciliazione Tri-Source completata: ${res.syncedCount} record verificati, ${res.fixedDrift} disallineamenti sanati.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error("Errore riconciliazione:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Se online e non ci sono operazioni pendenti (né toast attivo), il banner scompare completamente (0 pixel)
  if (isOnline && pendingCount === 0 && !successToast) {
    return null;
  }

  return (
    <div className="w-full mb-3 animate-in slide-in-from-top-2 duration-200">
      {/* Toast di successo momentaneo */}
      {successToast && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Offline */}
      {!isOnline && (
        <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-900 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-600">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <strong className="font-bold">Modalità Offline Attiva:</strong>
              <span className="ml-1 text-red-800">
                Connessione assente. Puoi continuare a usare l'agenda e la cassa: tutte le modifiche vengono salvate in locale e saranno allineate al ritorno della rete.
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[11px] font-mono font-bold shrink-0 self-end sm:self-auto">
            {pendingCount} in coda
          </span>
        </div>
      )}

      {/* Banner Sincronizzazione in corso / Operazioni in coda quando di nuovo Online */}
      {isOnline && pendingCount > 0 && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-950 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-amber-600" : ""}`} />
            </div>
            <div>
              <strong className="font-bold">Sincronizzazione in sospeso:</strong>
              <span className="ml-1 text-amber-900">
                {pendingCount} modifiche locali in attesa di caricamento su Cloud SQL e Firestore.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Sincronizzo..." : "Sincronizza Ora"}</span>
            </button>

            <button
              onClick={handleFullReconciliation}
              disabled={isSyncing}
              title="Riconciliazione approfondita Last-Write-Wins"
              className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-semibold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Riconcilia</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
