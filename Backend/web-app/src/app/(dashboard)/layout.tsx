"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { HeaderSearch } from "@/components/HeaderSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggleQuick } from "@/components/ThemeProvider";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile, fetchUserProfile, subscribeUserProfile } from "@/lib/user-profile";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (unsubProfile) unsubProfile();
        unsubProfile = subscribeUserProfile(user.uid, (p) => {
          if (p?.role === "cliente") {
            router.push("/cliente");
          } else if (p?.role === "salone" && p.planStatus === "PAYMENT_REQUIRED") {
            router.push("/abbonamento-pro");
          }
        });
      }
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [router]);

  return (
    <div className="flex h-screen h-[100dvh] bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden w-full transition-colors duration-200">
      {/* 1. Sidebar per Desktop & Tablet Orizzontale */}
      <Sidebar />

      {/* 2. Mobile Drawer con Backdrop Blur per Smartphone & Tablet Verticale */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Overlay scuro cliccabile */}
          <div 
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Contenitore drawer che scivola da sinistra */}
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar isMobile onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. Contenuto Principale con Header Adattivo */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa] dark:bg-zinc-900/60">
        
        {/* Header superiore: responsive per mobile, tablet e desktop */}
        <header className="h-14 sm:h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between px-2.5 sm:px-6 lg:px-8 z-20 shrink-0 gap-2 sm:gap-4 transition-colors">
          
          {/* Pulsante Hamburger + Logo su Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:hidden shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 sm:p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-200/70 dark:border-zinc-800 cursor-pointer"
              title="Menu di navigazione"
              aria-label="Apri menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-900 dark:text-white">
              Trimmy.
            </span>
          </div>

          {/* Barra di Ricerca Funzionante e Ridimensionabile */}
          <div className="flex-1 max-w-md min-w-0">
            <HeaderSearch />
          </div>

          {/* Azioni rapide a destra (Dark Mode Toggle + Notifiche) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggleQuick compact />
            <NotificationBell />
          </div>
        </header>
        
        {/* Contenuto Pagina allineato a max-w-7xl, con padding inferiore dinamico per non coprire il bottom nav mobile */}
        <main 
          className="flex-1 overflow-y-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-8 pb-28 md:pb-8"
          style={{ paddingBottom: "max(5.5rem, calc(4.75rem + env(safe-area-inset-bottom, 0px)))" }}
        >
          {children}
        </main>
      </div>

      {/* 4. Bottom Navigation Bar nativa per smartphone */}
      <MobileBottomNav />
    </div>
  );
}

