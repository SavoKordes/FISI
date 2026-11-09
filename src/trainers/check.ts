import type { Field } from './types';
import { ipToInt, parseCidr } from './lib/ipv4';
import { compressIPv6, groupsToBigInt, parseIPv6, parsePrefix, networkOf } from './lib/ipv6';

/**
 * Zahl aus deutscher oder englischer Eingabe lesen.
 * - mit Komma: deutsch ("1.234,5" → 1234.5)
 * - ohne Komma, genau ein Punkt: Dezimalpunkt ("8.76" → 8.76)
 * - ohne Komma, mehrere Punkte: Tausenderpunkte ("1.048.576" → 1048576)
 * Einheiten/Leerzeichen am Ende werden ignoriert ("8,76 h", "25 %").
 */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/\s+/g, '').replace(/[^\d,.\-+eE]+$/u, '').replace(/^[^\d,.\-+]+/u, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function withinTolerance(got: number, want: number, tol: Field['tolerance']): boolean {
  const abs = tol?.abs ?? 0;
  const rel = tol?.rel ?? (tol?.abs !== undefined ? 0 : 0.005);
  const allowed = Math.max(abs, Math.abs(want) * rel, 1e-9);
  return Math.abs(got - want) <= allowed + 1e-12;
}

const normPath = (s: string) =>
  s
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .join('-');

export function checkField(field: Field, input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  switch (field.kind) {
    case 'number': {
      const n = parseNumber(raw);
      const want = field.value ?? parseNumber(field.answer);
      return n !== null && want !== null && withinTolerance(n, want, field.tolerance);
    }
    case 'ipv4': {
      const a = ipToInt(raw);
      return a !== null && a === ipToInt(field.answer);
    }
    case 'cidr': {
      const a = parseCidr(raw);
      const b = parseCidr(field.answer);
      return !!a && !!b && a.ip === b.ip && a.prefix === b.prefix;
    }
    case 'ipv6': {
      const a = parseIPv6(raw);
      const b = parseIPv6(field.answer);
      return !!a && !!b && groupsToBigInt(a) === groupsToBigInt(b);
    }
    case 'ipv6short': {
      // gleiche Adresse UND so kurz wie die kanonische Form (RFC 5952); keine führenden Nullen
      const a = parseIPv6(raw);
      const b = parseIPv6(field.answer);
      if (!a || !b || groupsToBigInt(a) !== groupsToBigInt(b)) return false;
      if (raw.split(/:+/).some((g) => g.length > 1 && g.startsWith('0'))) return false;
      return raw.length <= compressIPv6(b).length;
    }
    case 'ipv6full': {
      return raw.toLowerCase() === field.answer.toLowerCase();
    }
    case 'ipv6prefix': {
      const a = parsePrefix(raw);
      const b = parsePrefix(field.answer);
      if (!a || !b || a.prefix !== b.prefix) return false;
      const na = groupsToBigInt(a.groups);
      // Host-Bits müssen 0 sein (Präfix sauber angegeben)
      return na === networkOf(na, a.prefix) && na === groupsToBigInt(b.groups);
    }
    case 'hexgroups': {
      const parse = (s: string) => s.trim().toLowerCase().split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
      const a = parse(raw);
      const b = parse(field.answer);
      return a.length === b.length && a.every((v, i) => !Number.isNaN(v) && v === b[i]);
    }
    case 'bin': {
      const s = raw.replace(/[\s_.]/g, '').replace(/^0b/i, '');
      if (!/^[01]+$/.test(s)) return false;
      return BigInt('0b' + s) === BigInt('0b' + field.answer.replace(/\s/g, ''));
    }
    case 'hex': {
      const s = raw.replace(/\s/g, '').replace(/^0x/i, '').replace(/h$/i, '');
      if (!/^[0-9a-f]+$/i.test(s)) return false;
      return BigInt('0x' + s) === BigInt('0x' + field.answer.replace(/\s/g, ''));
    }
    case 'choice':
      return raw === field.answer;
    case 'path':
      return normPath(raw) === normPath(field.answer);
  }
}
