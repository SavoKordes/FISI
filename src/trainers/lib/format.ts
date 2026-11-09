/** Zahl deutsch formatieren: Dezimalkomma, Tausenderpunkt; überflüssige Nullen weg */
export function fmt(n: number, maxDecimals = 2, minDecimals = 0): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString('de-DE', { maximumFractionDigits: maxDecimals, minimumFractionDigits: minDecimals, useGrouping: true });
}

/** ohne Tausenderpunkt (für Eingabefelder/kanonische Antworten) */
export function fmtPlain(n: number, maxDecimals = 2): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: maxDecimals, useGrouping: false });
}

export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Euro-Betrag */
export function eur(n: number): string {
  return fmt(n, 2, 2) + ' €';
}

/** Prozent mit Komma */
export function pct(n: number, decimals = 2): string {
  return fmt(n, decimals) + ' %';
}

/** Sekunden → "1 h 23 min 45 s" */
export function duration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m || h) parts.push(`${m} min`);
  parts.push(`${sec} s`);
  return parts.join(' ');
}

/** Hochzahl-Darstellung 2^n */
export const pow2 = (n: number) => `2${String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')}`;
