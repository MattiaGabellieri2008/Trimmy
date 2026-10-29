"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Users, Sparkles, Package, BarChart2 } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Agenda", href: "/", icon: Calendar },
    { name: "Clienti", href: "/clienti", icon: Users },
    { name: "Servizi", href: "/trattamenti", icon: Sparkles },
    { name: "Magazzino", href: "/magazzino", icon: Package },
    { name: "Statistiche", href: "/statistiche", icon: BarChart2 },
  ];

  return (
    <nav 
      aria-label="Navigazione Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 px-1 py-1 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.5)] select-none"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              isActive 
                ? "text-zinc-950 dark:text-white font-semibold" 
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium"
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${isActive ? "bg-zinc-100 dark:bg-zinc-800 text-brand" : ""}`}>
              <item.icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
