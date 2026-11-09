/** IPv6-Hilfen auf Basis von BigInt (128 Bit) */

const MAX = (1n << 128n) - 1n;

/** parst jede gültige Schreibweise (ohne Zonen-ID, ohne eingebettetes IPv4) → 8 Gruppen oder null */
export function parseIPv6(input: string): number[] | null {
  const s = input.trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(s) || s.includes(':::')) return null;
  const dbl = s.split('::');
  if (dbl.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':'));
  const head = toGroups(dbl[0]);
  const tail = dbl.length === 2 ? toGroups(dbl[1]) : [];
  if ([...head, ...tail].some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  let groups: string[];
  if (dbl.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  return groups.map((g) => parseInt(g, 16));
}

export function groupsToBigInt(g: number[]): bigint {
  return g.reduce((acc, v) => (acc << 16n) | BigInt(v), 0n);
}

export function bigIntToGroups(n: bigint): number[] {
  const out: number[] = [];
  for (let i = 7; i >= 0; i--) out.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  return out;
}

export function expandIPv6(g: number[]): string {
  return g.map((v) => v.toString(16).padStart(4, '0')).join(':');
}

/** kanonische Kurzform nach RFC 5952 */
export function compressIPv6(g: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] === 0) {
      let j = i;
      while (j < 8 && g[j] === 0) j++;
      if (j - i > bestLen) {
        bestStart = i;
        bestLen = j - i;
      }
      i = j;
    } else i++;
  }
  const hex = g.map((v) => v.toString(16));
  if (bestLen < 2) return hex.join(':');
  const left = hex.slice(0, bestStart).join(':');
  const right = hex.slice(bestStart + bestLen).join(':');
  return `${left}::${right}`;
}

export function prefixMask(prefix: number): bigint {
  return prefix === 0 ? 0n : (MAX << BigInt(128 - prefix)) & MAX;
}

export function networkOf(addr: bigint, prefix: number): bigint {
  return addr & prefixMask(prefix);
}

export function parsePrefix(s: string): { groups: number[]; prefix: number } | null {
  const m = s.trim().match(/^(.+)\/(\d{1,3})$/);
  if (!m) return null;
  const groups = parseIPv6(m[1]);
  const prefix = Number(m[2]);
  if (!groups || prefix > 128) return null;
  return { groups, prefix };
}

/** EUI-64-Interface-ID aus MAC: FFFE einfügen, 7. Bit (U/L) umkehren */
export function eui64FromMac(mac: string): number[] {
  const bytes = mac.split(/[:-]/).map((b) => parseInt(b, 16));
  const b = [bytes[0] ^ 0x02, bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]];
  return [(b[0] << 8) | b[1], (b[2] << 8) | b[3], (b[4] << 8) | b[5], (b[6] << 8) | b[7]];
}
