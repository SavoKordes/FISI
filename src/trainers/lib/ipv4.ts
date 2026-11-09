/** IPv4-Hilfen auf Basis vorzeichenloser 32-Bit-Zahlen */

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  n = n >>> 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function prefixToMaskInt(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function prefixToMask(prefix: number): string {
  return intToIp(prefixToMaskInt(prefix));
}

export function maskToPrefix(mask: string): number | null {
  const n = ipToInt(mask);
  if (n === null) return null;
  const bits = n.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bits)) return null;
  return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
}

export function networkInt(ip: number, prefix: number): number {
  return (ip & prefixToMaskInt(prefix)) >>> 0;
}

export function broadcastInt(ip: number, prefix: number): number {
  return (networkInt(ip, prefix) | (~prefixToMaskInt(prefix) >>> 0)) >>> 0;
}

/** nutzbare Hosts (für /31 und /32 hier 0 – in der Prüfung wird 2^n − 2 gerechnet) */
export function hostCount(prefix: number): number {
  return prefix >= 31 ? 0 : 2 ** (32 - prefix) - 2;
}

/** kleinstes Präfix, das mindestens `hosts` nutzbare Adressen bietet */
export function prefixForHosts(hosts: number): number {
  for (let p = 30; p >= 0; p--) if (hostCount(p) >= hosts) return p;
  return 0;
}

export function toBinaryOctets(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((o) => o.toString(2).padStart(8, '0')).join('.');
}

export function parseCidr(s: string): { ip: number; prefix: number } | null {
  const m = s.trim().match(/^([\d.]+)\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  const ip = ipToInt(m[1]);
  const prefix = Number(m[2]);
  if (ip === null || prefix > 32) return null;
  return { ip, prefix };
}
