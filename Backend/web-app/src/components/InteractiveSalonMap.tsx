"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { SalonListing, calculateDistanceKm, formatDistance } from "@/lib/client-booking";
import { 
  Scissors, 
  MapPin, 
  Navigation, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  Star,
  Phone,
  CalendarPlus,
  Compass,
  Layers,
  Map as MapIcon,
  Check
} from "lucide-react";

interface InteractiveSalonMapProps {
  salons: SalonListing[];
  selectedSalon: SalonListing | null;
  onSelectSalon: (salon: SalonListing) => void;
  onBookSalon?: (salon: SalonListing) => void;
  heightClass?: string;
  userLocation?: { lat: number; lng: number } | null;
}

export default function InteractiveSalonMap({
  salons,
  selectedSalon,
  onSelectSalon,
  onBookSalon,
  heightClass = "h-[560px]",
  userLocation = null
}: InteractiveSalonMapProps) {
  // Modalità mappa: "google" (Live Google Maps) | "radar" (Mappa con Pin interattivi dei saloni)
  const [mapMode, setMapMode] = useState<"google" | "radar">("google");

  // Tipo di visualizzazione Google Maps: "roadmap" (Stradale classica - DEFAULT) | "satellite" (Alta Risoluzione Satellite HD)
  const [viewStyle, setViewStyle] = useState<"roadmap" | "satellite">("roadmap");
  
  // Salone correntemente in focus
  const activeSalon = selectedSalon || (salons.length > 0 ? salons[0] : null);

  // Coordinate di riferimento
  const mapCenter = useMemo(() => {
    if (activeSalon && activeSalon.lat && activeSalon.lng) {
      return { lat: activeSalon.lat, lng: activeSalon.lng };
    }
    return { lat: 45.4642, lng: 9.1900 }; // Milano Centro
  }, [activeSalon]);

  // Zoom e pan per la modalità Radar Cartografico
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom quando cambia il salone selezionato
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, [selectedSalon?.id]);

  // Calcola distanza dall'utente (se disponibile)
  const activeSalonDistance = useMemo(() => {
    if (!userLocation || !activeSalon || !activeSalon.lat || !activeSalon.lng) return null;
    const km = calculateDistanceKm(userLocation.lat, userLocation.lng, activeSalon.lat, activeSalon.lng);
    return formatDistance(km);
  }, [userLocation, activeSalon]);

  // URL Google Maps ufficiale per l'iframe live senza necessità di API key con billing
  // t=m: Mappa Stradale classica (default) | t=k: Satellite ad alta risoluzione
  const googleMapsIframeUrl = useMemo(() => {
    const tParam = viewStyle === "satellite" ? "k" : "m";
    if (activeSalon) {
      const queryParam = encodeURIComponent(`${activeSalon.name}, ${activeSalon.address}, ${activeSalon.city}`);
      return `https://maps.google.com/maps?q=${queryParam}&t=${tParam}&z=15&ie=UTF8&iwloc=&output=embed`;
    }
    const defaultQuery = encodeURIComponent("Saloni da parrucchiere e barbieri, Milano");
    return `https://maps.google.com/maps?q=${defaultQuery}&t=${tParam}&z=13&ie=UTF8&iwloc=&output=embed`;
  }, [activeSalon, viewStyle]);

  // Coordinate bounding box per il radar cartografico
  const bounds = {
    minLat: 36.5,
    maxLat: 47.1,
    minLng: 6.6,
    maxLng: 18.5
  };

  const getMarkerCoords = (lat: number, lng: number) => {
    const latClamped = Math.max(bounds.minLat, Math.min(bounds.maxLat, lat));
    const lngClamped = Math.max(bounds.minLng, Math.min(bounds.maxLng, lng));

    const yPercent = 100 - ((latClamped - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    const xPercent = ((lngClamped - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;

    return { top: `${yPercent.toFixed(2)}%`, left: `${xPercent.toFixed(2)}%` };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className={`w-full ${heightClass} rounded-3xl overflow-hidden relative border border-zinc-200/80 bg-zinc-950 shadow-xl select-none flex flex-col`}>
      
      {/* ================= BARRA SUPERIORE CONTROLLI MAPPA ================= */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Badge Stato & Saloni Attivi */}
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-2.5 shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mappa Saloni ({salons.length} attivi)</span>
          {activeSalon && (
            <span className="hidden sm:inline-block text-[11px] text-zinc-400 border-l border-zinc-700 pl-2">
              📍 {activeSalon.city} ({activeSalon.zone})
            </span>
          )}
          {activeSalonDistance && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {activeSalonDistance} da te
            </span>
          )}
        </div>

        {/* Gruppo Controlli Switch Vista (Stradale / Satellite) & Modalità (Google vs Radar) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          
          {/* Switch Stradale (Default) vs Satellite HD (Alta Risoluzione) */}
          {mapMode === "google" && (
            <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center gap-1 shadow-lg">
              <button
                onClick={() => setViewStyle("roadmap")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewStyle === "roadmap"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Visualizzazione Stradale classica (Default)"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Stradale</span>
              </button>
              <button
                onClick={() => setViewStyle("satellite")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewStyle === "satellite"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Visualizzazione Satellite HD ad alta risoluzione"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Satellite HD</span>
              </button>
            </div>
          )}

          {/* Selettore Modalità Mappa (Google Maps Live vs Radar Pin) */}
          <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center gap-1 shadow-lg">
            <button
              onClick={() => setMapMode("google")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                mapMode === "google"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </button>
            <button
              onClick={() => setMapMode("radar")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                mapMode === "radar"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pin Saloni ({salons.length})</span>
            </button>
          </div>

        </div>

      </div>

      {/* ================= CONTROLLI ZOOM PER MODALITÀ RADAR ================= */}
      {mapMode === "radar" && (
        <div className="absolute top-16 right-3.5 z-30 flex flex-col gap-1.5 bg-zinc-900/90 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-xl">
          <button 
            onClick={() => setZoomLevel((z) => Math.min(2.4, z + 0.3))}
            className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Ingrandisci"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.3))}
            className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Riduci"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
            className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Ripristina Vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= CONTENITORE MAPPA ================= */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        
        {/* MODALITÀ 1: GOOGLE MAPS UFFICIALE EMBED LIVE (GARANTITO SENZA ERRORI) */}
        {mapMode === "google" && (
          <div className="w-full h-full relative">
            <iframe
              title="Google Maps Saloni"
              src={googleMapsIframeUrl}
              className="w-full h-full border-0 filter saturate-110 contrast-105"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        {/* MODALITÀ 2: RADAR CARTOGRAFICO CON PIN INTERATTIVI */}
        {mapMode === "radar" && (
          <div 
            className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden bg-[#0c0e12]"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Griglia e Texture Cartografica Luxury Dark */}
            <div 
              className="absolute inset-0 transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: "center center"
              }}
            >
              <div 
                className="w-full h-full absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
                  backgroundSize: "28px 28px"
                }}
              />

              {/* Raggi radar e cerchi concentrici attorno al centro */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.04] pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full border border-white/[0.07] pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/[0.1] pointer-events-none" />

              {/* Pin posizione Utente "Tu sei qui" se geolocalizzato */}
              {userLocation && (
                <div
                  style={getMarkerCoords(userLocation.lat, userLocation.lng)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                >
                  <span className="absolute -inset-3 rounded-full bg-blue-500/40 animate-ping" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-lg border border-white">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Tu sei qui</span>
                  </div>
                </div>
              )}

              {/* Pin di tutti i saloni */}
              {salons.map((salon, idx) => {
                const pos = salon.lat && salon.lng 
                  ? getMarkerCoords(salon.lat, salon.lng)
                  : { top: `${35 + (idx * 12)}%`, left: `${40 + (idx * 14)}%` };

                const isSelected = activeSalon?.id === salon.id;

                return (
                  <div
                    key={salon.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSalon(salon);
                    }}
                    style={{ top: pos.top, left: pos.left }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
                  >
                    {/* Pulsazione marker selezionato */}
                    {isSelected && (
                      <span className="absolute -inset-2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                    )}

                    {/* Bottone Pin Marker */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-xl border ${
                      isSelected
                        ? "bg-white text-zinc-950 border-white scale-110 ring-4 ring-emerald-400/40"
                        : "bg-zinc-900/90 text-white border-white/20 hover:border-white/60 hover:scale-105"
                    }`}>
                      <Scissors className={`w-3.5 h-3.5 ${isSelected ? "text-zinc-900" : "text-emerald-400"}`} />
                      <span className="whitespace-nowrap max-w-[120px] truncate">{salon.name}</span>
                      <span className="text-[10px] text-amber-400 flex items-center">
                        ★{salon.rating}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ================= CARD INFORMATIVA IN BASSO PER IL SALONE ATTIVO ================= */}
      {activeSalon && (
        <div className="absolute bottom-3 left-3 right-3 z-30 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
          
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Scissors className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white truncate">
                  {activeSalon.name}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {activeSalon.category}
                </span>
                {activeSalonDistance && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                    📍 {activeSalonDistance}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-zinc-500" />
                  {activeSalon.address}, {activeSalon.city}
                </span>
                <span>•</span>
                <span className="flex items-center text-amber-400 font-semibold gap-0.5">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {activeSalon.rating} ({activeSalon.reviewCount})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-t-0">
            {/* Pulsante Naviga con Google Maps Ufficiale */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${activeSalon.name}, ${activeSalon.address}, ${activeSalon.city}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center border border-white/10"
              title="Apri indicazioni stradali su Google Maps"
            >
              <Navigation className="w-4 h-4" />
            </a>

            {/* Pulsante Prenota Ora */}
            <button
              onClick={() => onBookSalon ? onBookSalon(activeSalon) : onSelectSalon(activeSalon)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white text-zinc-950 hover:bg-zinc-100 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Prenota in questo salone</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
