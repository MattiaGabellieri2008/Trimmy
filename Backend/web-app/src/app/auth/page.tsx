"use client";

import { useState } from "react";
import { ArrowRight, Mail, Lock, Loader2, Scissors } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<"staff" | "cliente" | null>(null);

  // FINTA LOGICA: Determina il tipo di utente dall'email
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    
    setIsLoading(true);
    
    // Simuliamo un controllo a DB di 1 secondo
    setTimeout(() => {
      // Regola finta: se l'email finisce con "salone.it" o "staff.it", sei staff, altrimenti cliente
      if (email.endsWith("salone.it") || email.endsWith("staff.it")) {
        setUserType("staff");
      } else {
        setUserType("cliente");
      }
      setStep("password");
      setIsLoading(false);
    }, 800);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) return;

    setIsLoading(true);
    
    // Simuliamo il login
    setTimeout(() => {
      setIsLoading(false);
      // Redirezione basata sul tipo di utente
      if (userType === "staff") {
        router.push("/"); // Dashboard
      } else {
        router.push("/prenota"); // Finta area clienti
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center">
            <Scissors className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          {step === "email" ? "Accedi o Registrati" : `Bentornato, ${userType === "staff" ? "Staff" : "Cliente"}!`}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {step === "email" 
            ? "Inserisci la tua email e ti porteremo alla tua area dedicata." 
            : "Inserisci la tua password per continuare."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px]">
        <div className="bg-white py-8 px-4 sm:px-10">
          
          {step === "email" && (
            <form className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" onSubmit={handleEmailSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Indirizzo Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-5 h-5 text-zinc-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@esempio.it"
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200/80 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Continua <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === "password" && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500" onSubmit={handlePasswordSubmit}>
              
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200/60 rounded-lg">
                <span className="text-sm text-zinc-700 truncate">{email}</span>
                <button 
                  type="button" 
                  onClick={() => setStep("email")}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Modifica
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                    Password
                  </label>
                  <a href="#" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                    Password dimenticata?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-5 h-5 text-zinc-400" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200/80 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Accedi"
                )}
              </button>
            </form>
          )}

        </div>
      </div>

      <div className="mt-auto pb-8 pt-12 flex justify-center">
        <Link href="/" className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
          Torna alla home
        </Link>
      </div>

    </div>
  );
}
