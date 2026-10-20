"use client";

import { useState } from "react";
import { X, Copy, Check, QrCode, ExternalLink, Sparkles } from "lucide-react";
import { SalonListing } from "@/lib/client-booking";

interface SalonShareModalProps {
  salon: SalonListing;
  isOpen: boolean;
  onClose: () => void;
}

export default function SalonShareModal({ salon, isOpen, onClose }: SalonShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://trimmy.app";
  const directLink = `${currentOrigin}/prenota?salone=${salon.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(directLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/80 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-center text-zinc-900 ring-1 ring-zinc-900/5 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center">
              <QrCode className="w-3.5 h-3.5 text-zinc-800" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900">QR Code & Link Salone</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase tracking-wider">
              {salon.category}
            </span>
            <h4 className="font-bold text-lg text-zinc-900 mt-1.5 tracking-tight">{salon.name}</h4>
            <p className="text-xs text-zinc-500 mt-0.5">{salon.address}</p>
          </div>

          {/* QR Code Container con styling pulito */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl inline-block shadow-inner mx-auto">
            {/* SVG Visual Stylized QR Code */}
            <div className="w-44 h-44 bg-white p-2.5 rounded-xl flex flex-col justify-between items-center text-zinc-900 relative border border-zinc-200 shadow-xs">
              <div className="w-full flex justify-between">
                <div className="w-10 h-10 border-2 border-zinc-900 bg-zinc-900 rounded-md flex items-center justify-center shadow-xs">
                  <div className="w-4 h-4 bg-white rounded-xs" />
                </div>
                <div className="w-10 h-10 border-2 border-zinc-900 bg-zinc-900 rounded-md flex items-center justify-center shadow-xs">
                  <div className="w-4 h-4 bg-white rounded-xs" />
                </div>
              </div>
              
              <div className="text-center font-mono text-[9px] tracking-widest uppercase py-1.5 px-2 bg-zinc-100 border border-zinc-200 text-zinc-800 w-full rounded-md font-bold">
                TRIMMY • SCAN TO BOOK
              </div>

              <div className="w-full flex justify-between items-end">
                <div className="w-10 h-10 border-2 border-zinc-900 bg-zinc-900 rounded-md flex items-center justify-center shadow-xs">
                  <div className="w-4 h-4 bg-white rounded-xs" />
                </div>
                <div className="text-[10px] font-bold text-zinc-700 uppercase tracking-tighter flex items-center gap-1">
                  <span>✂️</span>
                  <span>{salon.name.slice(0, 10)}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Mostra o invia questo link ai tuoi clienti per farli prenotare direttamente senza code.
          </p>

          {/* Link Box */}
          <div className="flex items-center gap-1.5 p-1.5 bg-zinc-50 rounded-xl border border-zinc-200">
            <input
              type="text"
              readOnly
              value={directLink}
              className="text-xs bg-transparent flex-1 px-2.5 text-zinc-700 outline-hidden select-all font-mono"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-all shrink-0 shadow-xs cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiato!" : "Copia"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-center">
          <a
            href={directLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            Apri anteprima pagina prenotazione
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
}
