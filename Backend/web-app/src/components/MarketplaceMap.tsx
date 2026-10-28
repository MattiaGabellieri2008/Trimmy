"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SalonListing } from "@/lib/client-booking";
import { useRouter } from "next/navigation";

interface MarketplaceMapProps {
  salons: SalonListing[];
  selectedSalonId?: string | null;
  hoveredSalonId?: string | null;
  onSelectSalon?: (salon: SalonListing) => void;
  onBookSalon?: (salon: SalonListing) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function MarketplaceMap({
  salons,
  selectedSalonId,
  hoveredSalonId,
  onSelectSalon,
  onBookSalon,
  userLocation
}: MarketplaceMapProps) {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Inizializzazione Mappa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centro iniziale: prima città o coordinate Italia centrale (Roma)
    const initialLat = userLocation?.lat || (salons.length > 0 && salons[0].lat) || 41.9028;
    const initialLng = userLocation?.lng || (salons.length > 0 && salons[0].lng) || 12.4964;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // Layer OpenStreetMap Vettoriale / Positron elegante e chiaro
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(map);

    // Controlli Zoom compatti in basso a destra
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Creazione e Aggiornamento Pin dei Saloni
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Rimuovi vecchi marker
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    salons.forEach((salon) => {
      if (!salon.lat || !salon.lng) return;

      const isSelected = salon.id === selectedSalonId;
      const isHovered = salon.id === hoveredSalonId;

      const markerHtml = `
        <div class="transition-all duration-200 cursor-pointer ${
          isSelected || isHovered
            ? "scale-115 z-50"
            : "scale-100 hover:scale-105"
        }">
          <div class="px-2.5 py-1 rounded-full text-xs font-black shadow-lg flex items-center gap-1 border ${
            isSelected || isHovered
              ? "bg-zinc-950 text-white border-zinc-900 ring-4 ring-zinc-900/15"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300"
          }">
            <span class="text-[10px] text-amber-500">★</span>
            <span>€${salon.minPrice}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: markerHtml,
        iconSize: [60, 28],
        iconAnchor: [30, 14]
      });

      const marker = L.marker([salon.lat, salon.lng], { icon: customIcon });

      // Popup personalizzato ricco in stile Trimmy
      const popupContent = document.createElement("div");
      popupContent.className = "p-2 min-w-[210px] font-sans text-zinc-900";
      popupContent.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
              ${salon.category}
            </span>
            <span class="text-[10px] font-bold text-amber-600 flex items-center">
              ★ ${salon.rating}
            </span>
          </div>
          <h4 class="font-extrabold text-xs text-zinc-900 leading-tight">${salon.name}</h4>
          <p class="text-[10px] text-zinc-500 truncate">${salon.address}</p>
          <div class="pt-2 flex items-center gap-1.5 border-t border-zinc-100">
            <button id="book-btn-${salon.id}" class="flex-1 py-1 px-2 bg-zinc-900 text-white rounded-lg text-[10px] font-bold hover:bg-zinc-800 transition-colors text-center cursor-pointer">
              Prenota (€${salon.minPrice})
            </button>
            <a href="/salone/${salon.id}" class="py-1 px-2 bg-zinc-100 text-zinc-800 rounded-lg text-[10px] font-semibold hover:bg-zinc-200 transition-colors text-center">
              Vedi Salone
            </a>
          </div>
        </div>
      `;

      // Event listener sul popup button
      popupContent.querySelector(`#book-btn-${salon.id}`)?.addEventListener("click", () => {
        if (onBookSalon) onBookSalon(salon);
      });

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -10],
        className: "trimmy-map-popup"
      });

      marker.on("click", () => {
        if (onSelectSalon) onSelectSalon(salon);
      });

      marker.addTo(map);
      markersRef.current.set(salon.id, marker);
      bounds.extend([salon.lat, salon.lng]);
    });

    // Includi anche la posizione utente nei bounds se presente
    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    // Se ci sono punti, adatta lo zoom con padding morbido
    if (salons.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [salons, selectedSalonId, hoveredSalonId]);

  // Gestione Marker Posizione Utente
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const userIcon = L.divIcon({
          className: "user-gps-marker",
          html: `
            <div class="relative flex items-center justify-center">
              <span class="animate-ping absolute w-6 h-6 rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .bindTooltip("La tua posizione attuale", { permanent: false, direction: "top" })
          .addTo(map);

        userMarkerRef.current = marker;
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  // Centra dolcemente sul salone selezionato o hovered
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const targetId = hoveredSalonId || selectedSalonId;
    if (targetId) {
      const salon = salons.find((s) => s.id === targetId);
      if (salon && salon.lat && salon.lng) {
        map.panTo([salon.lat, salon.lng], { animate: true, duration: 0.5 });
        const marker = markersRef.current.get(salon.id);
        if (marker && selectedSalonId === salon.id) {
          marker.openPopup();
        }
      }
    }
  }, [hoveredSalonId, selectedSalonId, salons]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border border-zinc-200/90 shadow-sm bg-zinc-100">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Badge Mappa Interattiva */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none">
        <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[10px] font-bold text-zinc-800 border border-zinc-200 shadow-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {salons.length} saloni su mappa OpenStreetMap
        </span>
      </div>
    </div>
  );
}
