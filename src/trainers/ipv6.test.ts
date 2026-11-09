import { describe, expect, it } from 'vitest';
import { ipv6Trainer } from './ipv6';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';
import { compressIPv6, eui64FromMac, expandIPv6, groupsToBigInt, parseIPv6, parsePrefix } from './lib/ipv6';

/** unabhängige Referenz: WHATWG-URL-Parser (Node) kürzt nach RFC 5952 */
const urlCanonical = (addr: string) => new URL(`http://[${addr}]/`).hostname.slice(1, -1);

describe('IPv6-Hilfen', () => {
  it('Kürzen entspricht dem URL-Parser (RFC 5952)', () => {
    for (const a of ['2001:0db8:0000:0000:0a00:0000:0000:0001', '2001:db8:0:0:1:0:0:0', '0:0:0:0:0:0:0:1', 'fe80:0:0:0:1:0:0:0', '2001:db8:0:1:0:0:0:0', 'ff02:0:0:0:0:0:0:2', '2001:db8:1:0:1:0:1:0']) {
      expect(compressIPv6(parseIPv6(a)!)).toBe(urlCanonical(a));
    }
  });
  it('EUI-64 bekanntes Beispiel', () => {
    expect(eui64FromMac('00:1a:2b:3c:4d:5e').map((v) => v.toString(16).padStart(4, '0')).join(':')).toBe('021a:2bff:fe3c:4d5e');
    expect(eui64FromMac('02-00-00-00-00-01').map((v) => v.toString(16)).join(':')).toBe('0:ff:fe00:1');
  });
  it('Parser lehnt ungültige Adressen ab', () => {
    for (const bad of ['2001:db8::1::1', '2001:db8:::1', '1:2:3:4:5:6:7:8:9', '12345::1', 'g::1', '1:2:3:4:5:6:7']) expect(parseIPv6(bad)).toBeNull();
    expect(parseIPv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('IPv6-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(ipv6Trainer, 60));

  it('Kürzen/Expandieren stimmen mit dem URL-Parser überein', () => {
    for (let seed = 1; seed < 400; seed++) {
      for (const level of [1, 2, 3] as const) {
        const s = generateTask(ipv6Trainer, 'shorten', level, seed);
        const full = s.prompt.match(/`([0-9a-f:]+)`/)![1];
        expect(full).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
        expect(field(s, 'short').answer).toBe(urlCanonical(full));
        const e = generateTask(ipv6Trainer, 'expand', level, seed);
        const short = e.prompt.match(/`([0-9a-f:]+)`/)![1];
        expect(expandIPv6(parseIPv6(urlCanonical(short))!)).toBe(field(e, 'full').answer);
      }
    }
  });

  it('n-tes Subnetz: Präfix = Basis + (n − 1)', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(ipv6Trainer, 'nth', level, seed);
        const base = parsePrefix(t.prompt.match(/\*\*([0-9a-f:]+\/\d+)\*\*/)![1])!;
        const n = Number(t.prompt.match(/\*\*(\d+)\. Subnetzes/)![1]);
        const got = parsePrefix(field(t, 'net').answer)!;
        expect(got.prefix).toBe(64);
        const diff = (groupsToBigInt(got.groups) - groupsToBigInt(base.groups)) >> 64n;
        expect(Number(diff)).toBe(n - 1);
        expect(n - 1).toBeLessThan(2 ** (64 - base.prefix));
        expect(parseInt(field(t, 'id').answer, 16)).toBe(n - 1);
      }
    }
  });

  it('Präfix-Aufgabe: Site-Präfix enthält das /64, Subnetz-ID passt', () => {
    for (let seed = 1; seed < 300; seed++) {
      const t = generateTask(ipv6Trainer, 'prefix', 3, seed);
      const site = parsePrefix(field(t, 'site').answer)!;
      const net = parsePrefix(field(t, 'net64').answer)!;
      const s = groupsToBigInt(site.groups);
      const n = groupsToBigInt(net.groups);
      const hostBits = BigInt(128 - site.prefix);
      expect(n >> hostBits).toBe(s >> hostBits);
      const sid = (n >> 64n) & ((1n << BigInt(64 - site.prefix)) - 1n);
      expect(sid.toString(16)).toBe(field(t, 'sid').answer);
    }
  });

  it('Anzahl Subnetze = 2^(b − a)', () => {
    for (let seed = 1; seed < 100; seed++) {
      const t = generateTask(ipv6Trainer, 'count', ((seed % 3) + 1) as 1 | 2 | 3, seed);
      const [a, b] = [...t.prompt.matchAll(/\*\*\/(\d+)\*\*/g)].map((m) => Number(m[1]));
      expect(field(t, 'n').value).toBe(2 ** (b - a));
    }
  });

  it('EUI-64: Link-Local/Global = Präfix + Interface-ID', () => {
    for (let seed = 1; seed < 100; seed++) {
      const t = generateTask(ipv6Trainer, 'eui64', 2, seed);
      const mac = t.prompt.match(/\*\*([0-9a-f:-]{17})\*\*/)![1];
      const iid = eui64FromMac(mac);
      expect(field(t, 'll').answer).toBe(urlCanonical(['fe80', '0', '0', '0', ...iid.map((v) => v.toString(16))].join(':')));
    }
  });
});
