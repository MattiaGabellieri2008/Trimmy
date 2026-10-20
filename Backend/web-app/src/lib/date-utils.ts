/**
 * Utility per la gestione sicura e cross-browser delle date (Chrome, Safari, Firefox, Edge, iOS Safari).
 * Risolve i noti problemi di Safari con formati non-ISO, timezone shift UTC su date 'YYYY-MM-DD',
 * e separatori spazio anziché 'T'.
 */

export function parseDateSafe(input: string | number | Date | null | undefined): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;

  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const str = String(input).trim();
  if (!str) return new Date();

  // 1. Formato solo data 'YYYY-MM-DD' -> Safari interpreta come UTC mezzanotte,
  // causando spesso lo shift al giorno precedente nei fusi orari locali.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  // 2. Formato 'YYYY-MM-DD HH:mm' o 'YYYY-MM-DD HH:mm:ss' (con spazio al posto di T)
  // Safari restituisce 'Invalid Date' su stringhe con spazio.
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(str)) {
    const isoLike = str.replace(" ", "T");
    const d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Formato standard ISO o RFC
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback per Safari su formati con barre 'YYYY/MM/DD'
  const slashReplaced = str.replace(/\//g, "-");
  const fallback = new Date(slashReplaced);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

/**
 * Formatta un orario 'HH:mm' in modo compatibile con tutti i browser
 */
export function formatTimeSafe(dateInput: string | number | Date): string {
  const d = parseDateSafe(dateInput);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formatta una data in italiano es. '15 Ottobre 2026'
 */
export function formatDateSafe(dateInput: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = parseDateSafe(dateInput);
  return d.toLocaleDateString("it-IT", options || {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
