"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  Calendar, 
  Users, 
  Clock, 
  Sparkles, 
  Check, 
  X, 
  Trash2, 
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Scissors
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  NotificationItem, 
  fetchEffectiveSalonNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  clearNotification, 
  clearAllNotifications 
} from "@/lib/salon-notifications";

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Conteggio notifiche non lette
  const unreadCount = notifications.filter(n => !n.read).length;

  // Caricamento notifiche autentiche ed effettive
  const loadNotifications = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      const realItems = await fetchEffectiveSalonNotifications(uid);
      setNotifications(realItems);
    } catch (err) {
      console.warn("Errore caricamento notifiche salone:", err);
    }
  }, []);

  // Monitora l'utente autenticato e ascolta aggiornamenti in tempo reale
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid);
        loadNotifications(user.uid);
      } else {
        setUserUid(null);
        setNotifications([]);
      }
    });

    const handleDataUpdated = () => {
      if (auth.currentUser) {
        loadNotifications(auth.currentUser.uid);
      }
    };

    window.addEventListener("trimmy-data-updated", handleDataUpdated);

    return () => {
      unsub();
      window.removeEventListener("trimmy-data-updated", handleDataUpdated);
    };
  }, [loadNotifications]);

  // Chiudi cliccando fuori dal menu a tendina
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Segna tutte le notifiche come lette
  const handleMarkAllAsRead = () => {
    if (!userUid) return;
    const allIds = notifications.map(n => n.id);
    markAllNotificationsAsRead(userUid, allIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Click su una notifica
  const handleNotificationClick = (item: NotificationItem) => {
    if (userUid && !item.read) {
      markNotificationAsRead(userUid, item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  // Rimuovi singola notifica
  const handleClearNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userUid) {
      clearNotification(userUid, id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Cancella tutte le notifiche
  const handleClearAll = () => {
    if (userUid) {
      const allIds = notifications.map(n => n.id);
      clearAllNotifications(userUid, allIds);
    }
    setNotifications([]);
    setIsOpen(false);
  };

  // Icona semantica
  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "appointment":
        return <Calendar className="w-3.5 h-3.5 text-zinc-900" />;
      case "customer":
        return <Users className="w-3.5 h-3.5 text-amber-600" />;
      case "system":
        return <Sparkles className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      
      {/* Pulsante Notifiche Salone */}
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && userUid) {
            loadNotifications(userUid);
          }
        }}
        className={`relative flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer border shadow-2xs ${
          isOpen
            ? "bg-zinc-100 text-zinc-900 border-zinc-300"
            : "bg-white text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 border-zinc-200/80 hover:border-zinc-300"
        }`}
        title="Centro Notifiche Salone"
        aria-label="Centro Notifiche Salone"
      >
        <Bell className="w-4 h-4 text-zinc-700" strokeWidth={2.2} />
        
        {/* Badge conteggio effettivo (mostrato SOLO se ci sono reali notifiche non lette) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-zinc-900 rounded-full ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu Notifiche */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[min(24rem,calc(100vw-1.5rem))] bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Header del Centro Notifiche */}
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">Notifiche Salone</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Sincronizzato in tempo reale" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {unreadCount > 0 
                  ? `${unreadCount} ${unreadCount === 1 ? "notifica effettiva da leggere" : "notifiche effettive da leggere"}` 
                  : "Tutto aggiornato • Nessun avviso pendente"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                Segna lette
              </button>
            )}
          </div>

          {/* Lista Notifiche Autentiche */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-zinc-50/80 ${
                    !item.read ? "bg-zinc-50/40" : "bg-white"
                  }`}
                >
                  {/* Icona Notifica */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                    !item.read ? "bg-white border-zinc-200 shadow-2xs" : "bg-zinc-100 border-transparent"
                  }`}>
                    {getIcon(item.type)}
                  </div>

                  {/* Testo Notifica */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${!item.read ? "font-bold text-zinc-950" : "font-medium text-zinc-700"}`}>
                        {item.title}
                      </p>
                      {!item.read && (
                        <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1">
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-zinc-300" />
                        {item.time}
                      </span>
                      <button
                        onClick={(e) => handleClearNotification(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-all cursor-pointer"
                        title="Rimuovi notifica"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 text-zinc-500" />
                </div>
                <p className="text-xs font-semibold text-zinc-800">Nessuna notifica</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 max-w-[200px] mx-auto leading-relaxed">
                  Tutto aggiornato! Ti avviseremo quando ci saranno nuove prenotazioni o promemoria per il tuo salone.
                </p>
              </div>
            )}
          </div>

          {/* Footer del Centro Notifiche */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-zinc-50/60 border-t border-zinc-100 text-center">
              <button 
                onClick={handleClearAll}
                className="text-[11px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                Cancella tutte le notifiche
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
