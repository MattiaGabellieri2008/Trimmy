"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Users, Sparkles, BarChart2, Package, LogOut, Settings, CreditCard, Shield, ChevronUp, X, Palette } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { clearUserProfileCache } from "@/lib/user-profile";

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      if (currentUser?.uid) {
        clearUserProfileCache(currentUser.uid);
      }
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Errore logout:", error);
    }
  };

  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Utente";
  const userInitials = currentUser?.displayName
    ? currentUser.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : currentUser?.email?.slice(0, 2).toUpperCase() || "US";

  const navItems = [
    { name: "Agenda", href: "/", icon: Calendar },
    { name: "Clienti", href: "/clienti", icon: Users },
    { name: "Trattamenti", href: "/trattamenti", icon: Sparkles },
    { name: "Magazzino", href: "/magazzino", icon: Package },
    { name: "Statistiche", href: "/statistiche", icon: BarChart2 },
  ];

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside 
      className={`${isMobile ? "w-72 sm:w-80 h-full" : "w-64 hidden md:flex"} bg-white dark:bg-zinc-900 flex flex-col border-r border-zinc-200/60 dark:border-zinc-800 transition-all duration-300 relative shrink-0`}
      style={{ paddingBottom: isMobile ? "max(1rem, env(safe-area-inset-bottom, 0px))" : undefined }}
    >
      <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Trimmy.
        </h1>
        {isMobile && onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Chiudi menu"
            aria-label="Chiudi menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name}
              href={item.href} 
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${
                isActive 
                  ? "bg-zinc-100/90 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border-l-2 border-brand" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50 focus:bg-zinc-100/50 dark:focus:bg-zinc-800"
              }`}
            >
              <item.icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>


      {/* Dropdown Menu Account */}
      {isDropdownOpen && (
        <>
          {/* Overlay invisibile per chiudere cliccando fuori */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-lg z-50 p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="px-2 py-1.5 mb-1 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{displayName}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{currentUser?.email || "Account"}</p>
            </div>
            <Link 
              href="/impostazioni?tab=profilo"
              onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
            >
              <Settings className="w-4 h-4" />
              Impostazioni Profilo
            </Link>
            <Link 
              href="/impostazioni?tab=brand"
              onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
            >
              <Palette className="w-4 h-4 text-brand" />
              Brand & Aspetto Salone
            </Link>
            <Link 
              href="/impostazioni?tab=team"
              onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
            >
              <Shield className="w-4 h-4" />
              Gestione Team
            </Link>
            <Link 
              href="/impostazioni?tab=abbonamento"
              onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
            >
              <CreditCard className="w-4 h-4" />
              Abbonamento SaaS
            </Link>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              Esci
            </button>
          </div>
        </>
      )}

      {/* User Profile Trigger */}
      <div 
        className="p-4 mx-4 mb-4 border border-zinc-200/60 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer flex items-center justify-between group"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 text-xs font-semibold shrink-0 overflow-hidden">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              userInitials
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{displayName}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{currentUser?.email || "Amministratore"}</p>
          </div>
        </div>
        <ChevronUp className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : 'group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
      </div>
    </aside>
  );
}
