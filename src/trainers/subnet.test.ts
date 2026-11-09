import { describe, expect, it } from 'vitest';
import { subnetTrainer } from './subnet';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';
import { ipToInt, maskToPrefix, parseCidr, prefixForHosts } from './lib/ipv4';

/** unabhängige Referenz: Netz/Broadcast über Oktett-Arithmetik statt Bitmasken */
function reference(ip: string, prefix: number) {
  const o = ip.split('.').map(Number);
  const net: number[] = [];
  const bc: number[] = [];
  for (let i = 0; i < 4; i++) {
    const bits = Math.max(0, Math.min(8, prefix - i * 8));
    const block = 2 ** (8 - bits);
    net.push(Math.floor(o[i] / block) * block);
    bc.push(Math.floor(o[i] / block) * block + block - 1);
  }
  return { net: net.join('.'), bc: bc.join('.'), hosts: 2 ** (32 - prefix) - 2 };
}

const ipFromPrompt = (p: string) => p.match(/\*\*(\d+\.\d+\.\d+\.\d+)/)![1];

describe('Subnetting-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(subnetTrainer, 60));

  it('Netz/Broadcast/Hosts stimmen mit Referenzrechnung überein', () => {
    for (let seed = 1; seed < 500; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(subnetTrainer, 'host', level, seed);
        const ip = ipFromPrompt(t.prompt);
        const prefix = level === 3 ? maskToPrefix(t.prompt.match(/Subnetzmaske (\d+\.\d+\.\d+\.\d+)/)![1])! : Number(t.prompt.match(/\/(\d+)/)![1]);
        const r = reference(ip, prefix);
        expect(field(t, 'net').answer).toBe(r.net);
        expect(field(t, 'bc').answer).toBe(r.bc);
        expect(field(t, 'hosts').value).toBe(r.hosts);
        expect(ipToInt(field(t, 'first').answer)).toBe(ipToInt(r.net)! + 1);
        expect(ipToInt(field(t, 'last').answer)).toBe(ipToInt(r.bc)! - 1);
        // gegebene Adresse ist ein Host (nicht Netz/Broadcast)
        expect(ip).not.toBe(r.net);
        expect(ip).not.toBe(r.bc);
      }
    }
  });

  it('Beispiel aus dem Unterricht: 192.168.10.77/27', () => {
    expect(reference('192.168.10.77', 27)).toEqual({ net: '192.168.10.64', bc: '192.168.10.95', hosts: 30 });
  });

  it('VLSM: Netze überlappen nicht, liegen im Basisnetz, reichen für den Bedarf, sind absteigend vergeben', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(subnetTrainer, 'vlsm', level, seed);
        const base = parseCidr(t.prompt.match(/\*\*([\d.]+\/\d+)\*\*/)![1])!;
        const baseEnd = base.ip + 2 ** (32 - base.prefix);
        const rows = [...t.prompt.matchAll(/\| ([^|]+) \| (\d+) \|/g)].map((m) => ({ name: m[1], need: Number(m[2]) }));
        expect(rows.length).toBe(t.fields.length);
        const nets = rows.map((r) => ({ ...r, ...parseCidr(field(t, r.name).answer)! }));
        for (const n of nets) {
          expect(2 ** (32 - n.prefix) - 2).toBeGreaterThanOrEqual(n.need);
          expect(n.prefix).toBe(prefixForHosts(n.need));
          expect(n.ip % 2 ** (32 - n.prefix)).toBe(0); // Netzgrenze
          expect(n.ip).toBeGreaterThanOrEqual(base.ip);
          expect(n.ip + 2 ** (32 - n.prefix)).toBeLessThanOrEqual(baseEnd);
        }
        const sorted = [...nets].sort((a, b) => a.ip - b.ip);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].ip).toBe(sorted[i - 1].ip + 2 ** (32 - sorted[i - 1].prefix)); // lückenlos
          expect(sorted[i].need).toBeLessThanOrEqual(sorted[i - 1].need); // absteigend
        }
        expect(sorted[0].ip).toBe(base.ip);
      }
    }
  });

  it('gleiche Subnetze: Präfix, Anzahl und k-tes Subnetz', () => {
    for (let seed = 1; seed < 300; seed++) {
      const t = generateTask(subnetTrainer, 'split', ((seed % 3) + 1) as 1 | 2 | 3, seed);
      const [, baseStr, n, k] = t.prompt.match(/\*\*([\d.]+\/\d+)\*\* soll in \*\*mindestens (\d+) .*?\*\*(\d+)\. Subnetzes/s)!;
      const base = parseCidr(baseStr)!;
      const prefix = field(t, 'prefix').value!;
      expect(2 ** (prefix - base.prefix)).toBeGreaterThanOrEqual(Number(n));
      expect(2 ** (prefix - 1 - base.prefix)).toBeLessThan(Number(n));
      expect(field(t, 'count').value).toBe(2 ** (prefix - base.prefix));
      expect(ipToInt(field(t, 'net').answer)).toBe(base.ip + (Number(k) - 1) * 2 ** (32 - prefix));
    }
  });

  it('gleiches Netz: Antwort passt zur Referenz', () => {
    for (let seed = 1; seed < 300; seed++) {
      const t = generateTask(subnetTrainer, 'same', 2, seed);
      const [a, b] = [...t.prompt.matchAll(/\*\*(\d+\.\d+\.\d+\.\d+)\*\*/g)].map((m) => m[1]);
      const prefix = Number(t.prompt.match(/\/(\d+)/)![1]);
      const same = reference(a, prefix).net === reference(b, prefix).net;
      expect(field(t, 'same').answer).toBe(same ? 'ja' : 'nein');
      expect(field(t, 'netb').answer).toBe(reference(b, prefix).net);
    }
  });

  it('Maske für Hostbedarf', () => {
    expect(prefixForHosts(30)).toBe(27);
    expect(prefixForHosts(31)).toBe(26);
    expect(prefixForHosts(254)).toBe(24);
    expect(prefixForHosts(255)).toBe(23);
    expect(prefixForHosts(2)).toBe(30);
  });
});
