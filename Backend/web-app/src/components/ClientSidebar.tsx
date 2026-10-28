"use client";

import { useState } from "react";
import { 
  Scissors, 
  Calendar, 
  Heart, 
  MapPin, 
  User, 
  Compass, 
  LogOut, 
  Sparkles, 
  X,
  ChevronRight,
  ShieldCheck,
  Award
} from "lucide-react";
import { ClientAppointmentItem, SalonListing } from "@/lib/client-booking";
import { parseDateSafe } from "@/lib/date-utils";

export type ClientTabType = "marketplace" | "appuntamenti" | "preferiti" | "fidelity" | "profilo";

interface ClientSidebarProps {
  activeTab: ClientTabType;
  onTabChange: (tab: ClientTabType) => void;
  appointmentsCount?: number;
  favoritesCount?: number;
  nextAppointment?: ClientAppointmentItem | null;
  displayName?: string;
  email?: string;
  onLogout: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function ClientSidebar({
  activeTab,
  onTabChange,
  appointmentsCount = 0,
  favoritesCount = 0,
  nextAppointment,
  displayName = "Cliente",
  email = "",
  onLogout,
  onClose,
  isMobile = false
}: ClientSidebarProps) {
  
  const navItems = [
    {
      id: "marketplace" as ClientTabType,
      label: "Esplora Saloni",
      icon: Compass,
      badge: null
    },
    {
      id: "appuntamenti" as ClientTabType,
      label: "I Miei Appuntamenti",
      icon: Calendar,
      badge: appointmentsCount > 0 ? String(appointmentsCount) : null
    },
    {
      id: "preferiti" as ClientTabType,
      label: "Saloni Preferiti",
      icon: Heart,
      badge: favoritesCount > 0 ? String(favoritesCount) : null
    },
    {
      id: "fidelity" as ClientTabType,
      label: "Tessera & Fidelity",
      icon: Award,
      badge: "VIP"
    },
    {
      id: "profilo" as ClientTabType,
      label: "Scheda Personale",
      icon: User,
      badge: null
    }
  ];

  const handleSelectTab = (tab: ClientTabType) => {
    onTabChange(tab);
    if (onClose) onClose();
  };

  const userInitials = displayName
    ? displayName.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "CL";

  return (
    <aside 
      className={`${isMobile ? "w-72 sm:w-80 h-full" : "w-64 hidden md:flex"} bg-white flex flex-col border-r border-zinc-200/60 transition-all duration-300 relative shrink-0 select-none`}
      style={{ paddingBottom: isMobile ? "max(1rem, env(safe-area-inset-bottom, 0px))" : undefined }}
    >
      {/* 1. Header Sidebar con Brand & Badge Area Cliente */}
      <div className="h-16 px-5 border-b border-zinc-200/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-zinc-900">
                Trimmy.
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-bold uppercase tracking-wider border border-zinc-200">
                Client
              </span>
            </div>
          </div>
        </div>

        {isMobile && onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            title="Chiudi menu"
            aria-label="Chiudi menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Menu di Navigazione Principale */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
          Menu Cliente
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComp = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                isActive
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComp className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-400"}`} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive 
                    ? "bg-white/20 text-white" 
                    : item.badge === "Live"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* 3. Card Prossimo Appuntamento in Sidebar */}
        {nextAppointment && (
          <div className="pt-6 px-1">
            <div 
              onClick={() => handleSelectTab("appuntamenti")}
              className="cursor-pointer group p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-100/60 transition-all text-left shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Prossima Seduta
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs font-bold text-zinc-900 truncate">
                {nextAppointment.serviceName}
              </p>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                {nextAppointment.salonName}
              </p>
              <div className="mt-2 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                <span>{parseDateSafe(nextAppointment.startTime).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
                <span className="text-zinc-500 font-mono">
                  {parseDateSafe(nextAppointment.startTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* 4. Footer Sidebar con Profilo Utente e Logout */}
      <div className="p-3 border-t border-zinc-200/60 bg-zinc-50/60">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
          
          <div 
            onClick={() => handleSelectTab("profilo")}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Apri profilo cliente"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-zinc-500 truncate font-mono mt-0.5">
                {email || "cliente@trimmy"}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Disconnetti"
            aria-label="Disconnetti"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </div>

    </aside>
  );
}
