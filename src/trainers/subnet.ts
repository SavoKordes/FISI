import type { Field, Level, Trainer } from './types';
import type { Rng } from './lib/rng';
import { fmt, pow2 } from './lib/format';
import {
  broadcastInt,
  hostCount,
  intToIp,
  networkInt,
  prefixForHosts,
  prefixToMask,
  prefixToMaskInt,
  toBinaryOctets,
} from './lib/ipv4';

const octets = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** zufällige private Adresse passend zum Level */
function randomIp(rng: Rng, level: Level): number {
  const kind = level === 1 ? 2 : rng.int(0, 2);
  const o = [0, 0, rng.int(0, 255), rng.int(1, 254)];
  if (kind === 0) {
    o[0] = 10;
    o[1] = rng.int(0, 255);
  } else if (kind === 1) {
    o[0] = 172;
    o[1] = rng.int(16, 31);
  } else {
    o[0] = 192;
    o[1] = 168;
  }
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

/** Rechenweg „Blockgröße“ für Netz- und Broadcastadresse */
export function blockMethod(ip: number, prefix: number): string {
  const idx = Math.min(3, Math.floor(prefix / 8));
  const maskOct = octets(prefixToMaskInt(prefix))[idx];
  const block = 256 - maskOct;
  const val = octets(ip)[idx];
  const start = Math.floor(val / block) * block;
  const names = ['1.', '2.', '3.', '4.'];
  const net = networkInt(ip, prefix);
  const bc = broadcastInt(ip, prefix);
  return [
    `- Subnetzmaske /${prefix} = **${prefixToMask(prefix)}**`,
    `- „Interessantes“ Oktett: das **${names[idx]} Oktett** (Maskenwert ${maskOct}) → Blockgröße 256 − ${maskOct} = **${block}**`,
    `- ${val} ÷ ${block} = ${Math.floor(val / block)} Rest ${val % block} → Block beginnt bei ${Math.floor(val / block)} × ${block} = **${start}**, endet bei ${start} + ${block} − 1 = **${start + block - 1}**`,
    `- Oktette **links** davon bleiben wie in der IP, Oktette **rechts** davon: Netz = 0, Broadcast = 255`,
    `- Netzadresse **${intToIp(net)}**, Broadcast **${intToIp(bc)}**`,
  ].join('\n');
}

function binaryTable(ip: number, prefix: number): string {
  const mask = prefixToMaskInt(prefix);
  return [
    '```text',
    `IP-Adresse   ${toBinaryOctets(ip)}   ${intToIp(ip)}`,
    `Maske (/${String(prefix).padEnd(2)})  ${toBinaryOctets(mask)}   ${intToIp(mask)}`,
    `UND → Netz   ${toBinaryOctets(networkInt(ip, prefix))}   ${intToIp(networkInt(ip, prefix))}`,
    `Hostteil = 1 ${toBinaryOctets(broadcastInt(ip, prefix))}   ${intToIp(broadcastInt(ip, prefix))} (Broadcast)`,
    '```',
  ].join('\n');
}

const hostsLine = (prefix: number) =>
  `- Hostbits: 32 − ${prefix} = ${32 - prefix} → ${pow2(32 - prefix)} − 2 = **${fmt(hostCount(prefix), 0)}** nutzbare Hosts (Netz- und Broadcastadresse abziehen)`;

const num = (key: string, label: string, v: number, unit?: string): Field => ({
  key,
  label,
  kind: 'number',
  answer: String(v),
  value: v,
  tolerance: { abs: 0 },
  unit,
});
const ip4 = (key: string, label: string, v: number): Field => ({ key, label, kind: 'ipv4', answer: intToIp(v), placeholder: 'z. B. 192.168.1.0' });

export const subnetTrainer: Trainer = {
  id: 'subnetting',
  title: 'IPv4-Subnetting',
  short: 'Subnetting',
  description: 'Netz-/Broadcastadresse, Hostbereich, Maske ↔ CIDR, gleiche Subnetze, VLSM, „gleiches Netz?“',
  levels: { 1: 'Präfix /24–/30, 4. Oktett', 2: 'Präfix /16–/30', 3: 'Präfix /8–/30, Maske in Punktnotation' },
  types: [
    {
      id: 'host',
      label: 'Netz, Broadcast, Hostbereich',
      gen: (rng, level) => {
        const prefix = level === 1 ? rng.int(24, 30) : level === 2 ? rng.int(16, 30) : rng.int(8, 30);
        let ip = randomIp(rng, level);
        const net = networkInt(ip, prefix);
        const bc = broadcastInt(ip, prefix);
        // Host-Adresse darf nicht Netz- oder Broadcastadresse sein
        if (ip === net) ip = net + 1;
        if (ip === bc) ip = bc - 1;
        const given = level === 3 ? `${intToIp(ip)} mit der Subnetzmaske ${prefixToMask(prefix)}` : `${intToIp(ip)}/${prefix}`;
        return {
          title: 'Netz- und Hostbereich bestimmen',
          prompt: `Ein Rechner hat die Adresse **${given}**.\n\nBestimmen Sie Netzadresse, Broadcastadresse, ersten und letzten nutzbaren Host sowie die Anzahl der nutzbaren Hostadressen.`,
          fields: [
            ip4('net', 'Netzadresse', net),
            ip4('bc', 'Broadcastadresse', bc),
            ip4('first', 'Erster Host', net + 1),
            ip4('last', 'Letzter Host', bc - 1),
            num('hosts', 'Anzahl Hosts', hostCount(prefix)),
          ],
          solution: [
            '**Blockgrößen-Methode** (schnell auf Papier)',
            blockMethod(ip, prefix),
            `- Erster Host = Netz + 1 = **${intToIp(net + 1)}**, letzter Host = Broadcast − 1 = **${intToIp(bc - 1)}**`,
            hostsLine(prefix),
            '',
            '**Kontrolle binär** (UND-Verknüpfung von IP und Maske)',
            binaryTable(ip, prefix),
          ].join('\n'),
        };
      },
    },
    {
      id: 'mask',
      label: 'Maske ↔ CIDR ↔ Hosts',
      gen: (rng, level) => {
        if (level === 1) {
          const prefix = rng.int(8, 30);
          return {
            title: 'CIDR in Subnetzmaske umrechnen',
            prompt: `Geben Sie zum Präfix **/${prefix}** die Subnetzmaske in Punktnotation und die Anzahl nutzbarer Hosts an.`,
            fields: [ip4('mask', 'Subnetzmaske', prefixToMaskInt(prefix)), num('hosts', 'Anzahl Hosts', hostCount(prefix))],
            solution: maskSolution(prefix),
          };
        }
        if (level === 2) {
          const prefix = rng.int(8, 30);
          return {
            title: 'Subnetzmaske in CIDR umrechnen',
            prompt: `Geben Sie zur Subnetzmaske **${prefixToMask(prefix)}** die Präfixlänge (CIDR) und die Anzahl nutzbarer Hosts an.`,
            fields: [num('prefix', 'Präfixlänge', prefix, 'Bit'), num('hosts', 'Anzahl Hosts', hostCount(prefix))],
            solution: maskSolution(prefix),
          };
        }
        const hosts = rng.pick([rng.int(3, 60), rng.int(61, 500), rng.int(501, 4000), rng.int(4001, 60000)]);
        const prefix = prefixForHosts(hosts);
        return {
          title: 'Passende Maske für Hostbedarf',
          prompt: `Ein Subnetz muss **${fmt(hosts, 0)} Hosts** aufnehmen. Bestimmen Sie die **größtmögliche Präfixlänge** (kleinstes passendes Netz) und die zugehörige Subnetzmaske.`,
          fields: [num('prefix', 'Präfixlänge', prefix, 'Bit'), ip4('mask', 'Subnetzmaske', prefixToMaskInt(prefix))],
          solution: [
            `- Gesucht: kleinstes n mit 2ⁿ − 2 ≥ ${fmt(hosts, 0)}`,
            `- n = ${32 - prefix}: ${pow2(32 - prefix)} − 2 = ${fmt(hostCount(prefix), 0)} ≥ ${fmt(hosts, 0)} ✓` +
              (prefix < 30 ? `; n = ${31 - prefix} reicht nicht: ${pow2(31 - prefix)} − 2 = ${fmt(hostCount(prefix + 1), 0)}` : ''),
            `- Präfix = 32 − ${32 - prefix} = **/${prefix}**`,
            maskSolution(prefix),
          ].join('\n'),
        };
      },
    },
    {
      id: 'split',
      label: 'In n gleiche Subnetze teilen',
      gen: (rng, level) => {
        const base = level === 1 ? 24 : level === 2 ? rng.pick([16, 20, 22, 24]) : rng.pick([12, 16, 18, 20, 21]);
        const n = level === 1 ? rng.pick([2, 4, 8, 16]) : level === 2 ? rng.int(3, 16) : rng.int(5, 100);
        const bits = Math.ceil(Math.log2(n));
        const prefix = base + bits;
        const count = 2 ** bits;
        const baseIp = networkInt(randomIp(rng, level === 1 ? 1 : 2), base);
        const k = rng.int(1, Math.min(n, count));
        const size = 2 ** (32 - prefix);
        const kNet = (baseIp + (k - 1) * size) >>> 0;
        const kBc = (kNet + size - 1) >>> 0;
        return {
          title: 'Netz in gleich große Subnetze aufteilen',
          prompt: `Das Netz **${intToIp(baseIp)}/${base}** soll in **mindestens ${n} gleich große Subnetze** aufgeteilt werden.\n\nBestimmen Sie die neue Präfixlänge, die Anzahl entstehender Subnetze, die nutzbaren Hosts je Subnetz sowie Netz- und Broadcastadresse des **${k}. Subnetzes** (das 1. Subnetz beginnt bei ${intToIp(baseIp)}).`,
          fields: [
            num('prefix', 'Neue Präfixlänge', prefix, 'Bit'),
            num('count', 'Anzahl Subnetze', count),
            num('hosts', 'Hosts je Subnetz', hostCount(prefix)),
            ip4('net', `Netzadresse ${k}. Subnetz`, kNet),
            ip4('bc', `Broadcast ${k}. Subnetz`, kBc),
          ],
          solution: [
            `- Benötigte Subnetzbits: kleinstes s mit 2ˢ ≥ ${n} → s = **${bits}** (${pow2(bits)} = ${count})`,
            `- Neue Präfixlänge: ${base} + ${bits} = **/${prefix}** (Maske ${prefixToMask(prefix)})`,
            `- Es entstehen **${count} Subnetze**${count > n ? ` (${count - n} bleiben als Reserve)` : ''}`,
            hostsLine(prefix),
            `- Größe eines Subnetzes: ${pow2(32 - prefix)} = ${fmt(size, 0)} Adressen`,
            `- ${k}. Subnetz: Start = ${intToIp(baseIp)} + (${k} − 1) × ${fmt(size, 0)} = **${intToIp(kNet)}**`,
            `- Broadcast = nächstes Subnetz − 1 = **${intToIp(kBc)}**`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'vlsm',
      label: 'VLSM nach Hostbedarf',
      gen: (rng, level) => {
        const base = level === 1 ? 24 : level === 2 ? rng.pick([23, 24]) : rng.pick([21, 22]);
        const deptCount = level === 1 ? 3 : level === 2 ? 4 : 5;
        const names = rng.sample(['Vertrieb', 'Verwaltung', 'Entwicklung', 'Lager', 'Geschäftsleitung', 'Buchhaltung', 'Support', 'Produktion', 'Server', 'WLAN-Gäste', 'Marketing'], deptCount);
        const capacity = 2 ** (32 - base);
        let needs: number[] = [];
        for (let attempt = 0; attempt < 200; attempt++) {
          needs = names.map(() => {
            const maxHosts = Math.max(6, Math.floor(capacity / (deptCount - 0.5)));
            return rng.int(2, maxHosts);
          });
          const used = needs.reduce((s, h) => s + 2 ** (32 - prefixForHosts(h)), 0);
          if (used <= capacity && used >= capacity * 0.5) break;
        }
        if (needs.reduce((s, h) => s + 2 ** (32 - prefixForHosts(h)), 0) > capacity) needs = names.map((_, i) => 10 + i * 5);
        const baseIp = networkInt(randomIp(rng, 2), base);
        const order = names.map((name, i) => ({ name, need: needs[i], i })).sort((a, b) => b.need - a.need || a.i - b.i);
        let cursor = baseIp;
        const alloc = order.map((d) => {
          const p = prefixForHosts(d.need);
          const net = cursor;
          cursor = (cursor + 2 ** (32 - p)) >>> 0;
          return { ...d, prefix: p, net, bc: (net + 2 ** (32 - p) - 1) >>> 0 };
        });
        const byName = new Map(alloc.map((a) => [a.name, a]));
        return {
          title: 'Subnetze mit variabler Länge (VLSM)',
          prompt: [
            `Das Netz **${intToIp(baseIp)}/${base}** soll für folgende Abteilungen aufgeteilt werden:`,
            '',
            '| Abteilung | benötigte Hosts |',
            '|---|---|',
            ...names.map((n, i) => `| ${n} | ${needs[i]} |`),
            '',
            'Vergeben Sie die Subnetze **der Größe nach absteigend** (bei gleicher Größe in Tabellenreihenfolge), lückenlos ab der Netzadresse. Geben Sie je Abteilung das Subnetz in CIDR-Schreibweise an.',
          ].join('\n'),
          fields: names.map((n) => ({
            key: n,
            label: n,
            kind: 'cidr' as const,
            answer: `${intToIp(byName.get(n)!.net)}/${byName.get(n)!.prefix}`,
            placeholder: 'z. B. 10.0.0.0/26',
          })),
          solution: [
            '1. Abteilungen nach Hostbedarf **absteigend sortieren**.',
            '2. Je Abteilung kleinstes Netz mit 2ⁿ − 2 ≥ Bedarf wählen.',
            '3. Netze lückenlos hintereinander vergeben – nächstes Netz beginnt bei Broadcast + 1.',
            '',
            '| Abteilung | Bedarf | Hostbits | Größe | Netz | Hostbereich | Broadcast |',
            '|---|---|---|---|---|---|---|',
            ...alloc.map(
              (a) =>
                `| ${a.name} | ${a.need} | ${32 - a.prefix} (${hostCount(a.prefix)} Hosts) | ${2 ** (32 - a.prefix)} | **${intToIp(a.net)}/${a.prefix}** | ${intToIp(a.net + 1)} – ${intToIp(a.bc - 1)} | ${intToIp(a.bc)} |`,
            ),
            '',
            `Belegt: ${fmt(cursor - baseIp, 0)} von ${fmt(capacity, 0)} Adressen; frei ab ${cursor - baseIp < capacity ? intToIp(cursor) : '– (voll)'}.`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'same',
      label: 'Liegen zwei Hosts im selben Netz?',
      gen: (rng, level) => {
        const prefix = level === 1 ? rng.int(25, 29) : level === 2 ? rng.int(17, 29) : rng.int(9, 29);
        const a = randomIp(rng, level);
        const net = networkInt(a, prefix);
        const size = 2 ** (32 - prefix);
        const same = rng.chance(0.5);
        let b: number;
        if (same) {
          b = (net + rng.int(1, size - 2)) >>> 0;
        } else {
          // Nachbarnetz (knapp daneben) – der typische Prüfungsfall
          const sameHigh = (x: number) => x >>> 16 === net >>> 16 || prefix <= 16;
          const up = net + size;
          const down = net - size;
          const neighbour = (rng.chance(0.5) && sameHigh(up)) || !sameHigh(down) ? up : down;
          b = (neighbour + rng.int(1, size - 2)) >>> 0;
        }
        const netB = networkInt(b, prefix);
        const ans = netB === net ? 'ja' : 'nein';
        const maskStr = level === 3 ? `Subnetzmaske ${prefixToMask(prefix)}` : `/${prefix}`;
        return {
          title: 'Gleiches Netz?',
          prompt: `Host A hat **${intToIp(a)}**, Host B hat **${intToIp(b)}**, beide mit ${level === 3 ? 'der ' : 'Präfix '}**${maskStr}**.\n\nLiegen beide im selben Subnetz (direkte Kommunikation ohne Router)? Geben Sie zusätzlich die Netzadresse von B an.`,
          fields: [
            { key: 'same', label: 'Selbes Netz?', kind: 'choice', answer: ans, options: ['ja', 'nein'] },
            ip4('netb', 'Netzadresse von B', netB),
          ],
          solution: [
            `**Host A:**\n${blockMethod(a, prefix)}`,
            '',
            `**Host B:**\n${blockMethod(b, prefix)}`,
            '',
            netB === net
              ? `→ Beide Netzadressen sind gleich (**${intToIp(net)}**) → **ja**, gleiches Netz.`
              : `→ Netzadressen unterscheiden sich (${intToIp(net)} ≠ ${intToIp(netB)}) → **nein**, die Kommunikation läuft über einen Router.`,
          ].join('\n'),
        };
      },
    },
  ],
};

function maskSolution(prefix: number): string {
  const full = Math.floor(prefix / 8);
  const rest = prefix % 8;
  const partial = rest ? 256 - 2 ** (8 - rest) : 0;
  return [
    `- /${prefix} = ${prefix} Einsen von links: ${full} volle Oktette (255)` +
      (rest ? ` + ${rest} Bit im nächsten Oktett: ${Array.from({ length: rest }, (_, i) => 2 ** (7 - i)).join(' + ')} = ${partial}` : ''),
    `- Maske: **${prefixToMask(prefix)}** (binär ${toBinaryOctets(prefixToMaskInt(prefix))})`,
    hostsLine(prefix),
  ].join('\n');
}
