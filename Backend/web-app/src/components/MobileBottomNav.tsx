"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Users, Sparkles, BarChart2 } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Agenda", href: "/", icon: Calendar },
    { name: "Clienti", href: "/clienti", icon: Users },
    { name: "Servizi", href: "/trattamenti", icon: Sparkles },
    { name: "Statistiche", href: "/statistiche", icon: BarChart2 },
  ];

  return (
    <nav 
      aria-label="Navigazione Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 px-2 py-1 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive 
                ? "text-zinc-950 font-semibold" 
                : "text-zinc-400 hover:text-zinc-600 font-medium"
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${isActive ? "bg-zinc-100" : ""}`}>
              <item.icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
