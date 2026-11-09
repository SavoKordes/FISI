import type { Level, Trainer } from './types';
import type { Rng } from './lib/rng';
import { fmt, pow2 } from './lib/format';
import { bigIntToGroups, compressIPv6, eui64FromMac, expandIPv6, groupsToBigInt, networkOf } from './lib/ipv6';

const hex4 = (v: number) => v.toString(16).padStart(4, '0');

/** Dokumentationspräfix 2001:db8::/32 oder ULA fd.. mit zufälliger Site */
function sitePrefix(rng: Rng): number[] {
  if (rng.chance(0.7)) return [0x2001, 0x0db8, rng.int(0, 0xffff)];
  return [0xfd00 | rng.int(0, 0xff), rng.int(0, 0xffff), rng.int(0, 0xffff)];
}

/** Gruppenwert mit „interessanten“ Nullen */
function groupValue(rng: Rng, level: Level): number {
  const r = rng.float();
  if (level >= 2 && r < 0.25) return rng.int(1, 0xff); // führende Nullen (00xx)
  if (level >= 2 && r < 0.4) return rng.int(1, 0xf) << 8; // 0x00 → z. B. 0a00
  if (r < 0.55) return rng.int(1, 0xfff); // 0xxx
  return rng.int(0x1000, 0xffff);
}

/** Adresse mit Null-Läufen für Kürzen/Expandieren */
function addressWithZeros(rng: Rng, level: Level): number[] {
  const g = [...sitePrefix(rng), ...Array.from({ length: 5 }, () => groupValue(rng, level))];
  const zero = (from: number, len: number) => {
    for (let i = from; i < from + len && i < 8; i++) g[i] = 0;
  };
  if (level === 1) {
    zero(rng.int(3, 6), rng.int(2, 3));
  } else if (level === 2) {
    zero(rng.int(2, 4), rng.int(2, 4));
    if (rng.chance(0.5)) g[7] = 0;
  } else {
    // zwei gleich lange oder fast gleich lange Läufe + einzelne Nullgruppe
    const len = rng.int(2, 2);
    zero(2, len);
    zero(5, len + (rng.chance(0.5) ? 1 : 0));
    if (g[7] !== 0 && rng.chance(0.3)) g[4] = 0;
  }
  if (g.every((v, i) => i < 3 || v === 0)) g[7] = 1;
  return g;
}

const shortenSteps = (g: number[]) => {
  const noLead = g.map((v) => v.toString(16)).join(':');
  const runs: string[] = [];
  for (let i = 0; i < 8; ) {
    if (g[i] === 0) {
      let j = i;
      while (j < 8 && g[j] === 0) j++;
      if (j - i >= 1) runs.push(`Gruppen ${i + 1}–${j} (${j - i}×)`);
      i = j;
    } else i++;
  }
  return [
    `1. **Führende Nullen** in jeder Gruppe weglassen (nur führende, nie Nullen am Ende!):\n   \`${noLead}\``,
    `2. Null-Gruppen: ${runs.length ? runs.join(', ') : 'keine'}.`,
    '3. Die **längste** Folge von Null-Gruppen (mind. 2) durch `::` ersetzen – `::` darf nur **einmal** vorkommen. Bei gleich langen Folgen die **erste** (RFC 5952). Eine einzelne `0`-Gruppe bleibt `0`.',
    `4. Ergebnis: **${compressIPv6(g)}**`,
  ].join('\n');
};

const randomMac = (rng: Rng) =>
  Array.from({ length: 6 }, (_, i) => {
    let b = rng.int(0, 255);
    if (i === 0) b = b & 0xfc; // Unicast, global eindeutig (U/L = 0)
    return b.toString(16).padStart(2, '0');
  }).join(rng.chance(0.5) ? ':' : '-');

export const ipv6Trainer: Trainer = {
  id: 'ipv6',
  title: 'IPv6',
  short: 'IPv6',
  description: 'Kürzen und Expandieren, Präfix und Subnetz-ID, Anzahl Subnetze, n-tes Subnetz, EUI-64',
  levels: { 1: 'Grundlagen, /48 → /64', 2: 'mehr Nullfallen, Hex-Umrechnung', 3: 'Präfixe außerhalb der Nibble-Grenzen, Sonderfälle' },
  types: [
    {
      id: 'shorten',
      label: 'Adresse kürzen',
      gen: (rng, level) => {
        const g = addressWithZeros(rng, level);
        return {
          title: 'IPv6-Adresse kürzen',
          prompt: `Kürzen Sie die IPv6-Adresse so weit wie möglich:\n\n\`${expandIPv6(g)}\``,
          fields: [{ key: 'short', label: 'Gekürzte Adresse', kind: 'ipv6short', answer: compressIPv6(g), placeholder: 'z. B. 2001:db8::1' }],
          solution: shortenSteps(g),
        };
      },
    },
    {
      id: 'expand',
      label: 'Adresse vollständig ausschreiben',
      gen: (rng, level) => {
        const g = addressWithZeros(rng, level);
        const short = compressIPv6(g);
        const parts = short.split('::');
        const known = parts.length === 2 ? (parts[0] ? parts[0].split(':').length : 0) + (parts[1] ? parts[1].split(':').length : 0) : 8;
        return {
          title: 'IPv6-Adresse expandieren',
          prompt: `Schreiben Sie die Adresse **vollständig** aus (8 Gruppen à 4 Hex-Ziffern):\n\n\`${short}\``,
          fields: [{ key: 'full', label: 'Vollständige Adresse', kind: 'ipv6full', answer: expandIPv6(g), placeholder: '8 × 4 Ziffern, mit Doppelpunkt getrennt' }],
          solution: [
            `1. Vorhandene Gruppen zählen: **${known}** → \`::\` steht für 8 − ${known} = **${8 - known}** Null-Gruppen.`,
            `2. Ausgefüllt: \`${g.map((v) => v.toString(16)).join(':')}\``,
            `3. Jede Gruppe links mit Nullen auf 4 Stellen auffüllen:\n   **${expandIPv6(g)}**`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'prefix',
      label: 'Präfix und Subnetz-ID',
      gen: (rng, level) => {
        const site = sitePrefix(rng);
        const sitelen = level === 1 ? 48 : level === 2 ? 48 : rng.pick([56, 52, 60]);
        const subnetBits = 64 - sitelen;
        const subnetId = rng.int(1, 2 ** subnetBits - 1);
        const sub = groupsToBigInt([...site, 0, 0, 0, 0, 0]) & (((1n << 128n) - 1n) << 80n); // /48
        let net = sub | (BigInt(subnetId) << 64n);
        if (sitelen > 48) {
          // Site-Präfix-Bits in Gruppe 4 zufällig, Subnetz-ID in den restlichen Bits
          const siteBitsInG4 = sitelen - 48;
          const siteVal = rng.int(0, 2 ** siteBitsInG4 - 1);
          net = sub | (BigInt((siteVal << subnetBits) | subnetId) << 64n);
        }
        const iid = BigInt(rng.int(1, 0xffff)) | (BigInt(rng.int(0, 0xffff)) << 48n);
        const addr = net | iid;
        const g = bigIntToGroups(addr);
        const net64 = compressIPv6(bigIntToGroups(networkOf(addr, 64))) + '/64';
        const siteNet = compressIPv6(bigIntToGroups(networkOf(addr, sitelen))) + `/${sitelen}`;
        const idHex = subnetId.toString(16);
        const fields = [
          { key: 'net64', label: 'Subnetz-Präfix (/64)', kind: 'ipv6prefix' as const, answer: net64, placeholder: 'z. B. 2001:db8:1:2::/64' },
          { key: 'site', label: `Site-Präfix (/${sitelen})`, kind: 'ipv6prefix' as const, answer: siteNet },
          { key: 'sid', label: `Subnetz-ID (hex, ${subnetBits} Bit)`, kind: 'hex' as const, answer: idHex },
          { key: 'iid', label: 'Interface-ID', kind: 'hexgroups' as const, answer: g.slice(4).map((v) => v.toString(16)).join(':') },
        ];
        return {
          title: 'Präfix, Subnetz-ID, Interface-ID',
          prompt: `Ein Server hat die Adresse **${compressIPv6(g)}/64**. Der Provider hat dem Unternehmen ein **/${sitelen}** zugewiesen.\n\nBestimmen Sie Subnetz-Präfix, Site-Präfix, Subnetz-ID und Interface-ID.`,
          fields: level === 1 ? fields.filter((f) => f.key !== 'sid') : fields,
          solution: [
            `1. Vollständig ausschreiben: \`${expandIPv6(g)}\``,
            '2. Jede Gruppe = 16 Bit. Die ersten **64 Bit (4 Gruppen)** sind das Subnetz-Präfix, die letzten 64 Bit die **Interface-ID**.',
            `   - Subnetz-Präfix: **${net64}**`,
            `   - Interface-ID: **${g.slice(4).map(hex4).join(':')}**`,
            sitelen === 48
              ? `3. /48 = **3 Gruppen** → Site-Präfix **${siteNet}**; die **4. Gruppe** (16 Bit) ist die Subnetz-ID: **${hex4(g[3])}** = ${idHex}`
              : `3. /${sitelen}: 48 Bit (3 Gruppen) + ${sitelen - 48} Bit der 4. Gruppe = Site-Präfix **${siteNet}**. Die restlichen ${subnetBits} Bit der 4. Gruppe (${hex4(g[3])} = binär ${g[3].toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()}) bilden die Subnetz-ID: **${idHex}** (hex).`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'count',
      label: 'Anzahl Subnetze',
      gen: (rng, level) => {
        const pairs: [number, number][] =
          level === 1 ? [[48, 64], [56, 64], [60, 64]] : level === 2 ? [[32, 48], [40, 48], [48, 56], [44, 64], [52, 64]] : [[29, 48], [36, 52], [42, 60], [46, 62], [40, 64]];
        const [a, b] = rng.pick(pairs);
        const n = 2 ** (b - a);
        return {
          title: 'Anzahl der Subnetze',
          prompt: `Ein Unternehmen erhält das Präfix **/${a}** und bildet daraus Subnetze mit dem Präfix **/${b}**. Wie viele Subnetze sind möglich und wie viele Bit hat die Subnetz-ID?`,
          fields: [
            { key: 'bits', label: 'Bits für Subnetz-ID', kind: 'number', answer: String(b - a), value: b - a, tolerance: { abs: 0 } },
            { key: 'n', label: 'Anzahl Subnetze', kind: 'number', answer: String(n), value: n, tolerance: { abs: 0 } },
          ],
          solution: [
            `- Subnetz-Bits: ${b} − ${a} = **${b - a}**`,
            `- Anzahl Subnetze: ${pow2(b - a)} = **${fmt(n, 0)}**`,
            b === 64 ? `- Jedes /64 bietet ${pow2(64)} ≈ 1,8 · 10¹⁹ Adressen – in IPv6 werden keine Netz-/Broadcastadressen abgezogen.` : '',
            '- Merkhilfe: /48 → /64 = 65.536 Subnetze, /56 → /64 = 256 Subnetze, /60 → /64 = 16 Subnetze.',
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
    {
      id: 'nth',
      label: 'n-tes Subnetz berechnen',
      gen: (rng, level) => {
        const sitelen = level === 3 ? rng.pick([52, 56]) : 48;
        const bits = 64 - sitelen;
        const n = level === 1 ? rng.int(2, 16) : level === 2 ? rng.int(17, 600) : rng.int(2, 2 ** bits);
        const site = sitePrefix(rng);
        let base = groupsToBigInt([...site, 0, 0, 0, 0, 0]);
        if (sitelen > 48) base |= BigInt(rng.int(0, 2 ** (sitelen - 48) - 1) << bits) << 64n;
        const id = n - 1;
        const net = base | (BigInt(id) << 64n);
        const g = bigIntToGroups(net);
        const baseStr = compressIPv6(bigIntToGroups(base)) + `/${sitelen}`;
        const ans = compressIPv6(g) + '/64';
        return {
          title: 'n-tes /64-Subnetz',
          prompt: `Aus dem Präfix **${baseStr}** werden /64-Subnetze gebildet. Das **1. Subnetz** hat die Subnetz-ID 0.\n\nBestimmen Sie das Präfix des **${n}. Subnetzes**.`,
          fields: [
            { key: 'id', label: 'Subnetz-ID (hex)', kind: 'hex', answer: id.toString(16) },
            { key: 'net', label: `${n}. Subnetz`, kind: 'ipv6prefix', answer: ans, placeholder: 'z. B. 2001:db8:1:a::/64' },
          ],
          solution: [
            `- Das ${n}. Subnetz hat die Subnetz-ID ${n} − 1 = **${id}** (dezimal)`,
            `- Umrechnung in Hex: ${hexSteps(id)} → **${id.toString(16)}**`,
            sitelen === 48
              ? `- Die Subnetz-ID bildet die **4. Gruppe**: ${hex4(id)}`
              : `- Die Subnetz-ID belegt die letzten ${bits} Bit der 4. Gruppe: ${hex4(Number(groupsToBigInt(bigIntToGroups(base)) >> 64n) & 0xffff)} + ${id.toString(16)} = ${hex4(g[3])}`,
            `- Ergebnis: **${ans}** (ausgeschrieben ${expandIPv6(g).split(':').slice(0, 4).join(':')}::/64)`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'eui64',
      label: 'EUI-64 aus MAC-Adresse',
      gen: (rng, level) => {
        const mac = randomMac(rng);
        const iid = eui64FromMac(mac);
        const bytes = mac.split(/[:-]/);
        const first = parseInt(bytes[0], 16);
        const flipped = first ^ 2;
        const iidStr = iid.map(hex4).join(':');
        const prefix = [0x2001, 0x0db8, rng.int(0, 0xffff), rng.int(0, 0xffff)];
        const fields =
          level === 1
            ? [{ key: 'iid', label: 'Interface-ID', kind: 'hexgroups' as const, answer: iidStr, placeholder: 'xxxx:xxxx:xxxx:xxxx' }]
            : level === 2
              ? [
                  { key: 'iid', label: 'Interface-ID', kind: 'hexgroups' as const, answer: iidStr },
                  { key: 'll', label: 'Link-Local-Adresse', kind: 'ipv6' as const, answer: compressIPv6([0xfe80, 0, 0, 0, ...iid]) },
                ]
              : [
                  { key: 'iid', label: 'Interface-ID', kind: 'hexgroups' as const, answer: iidStr },
                  { key: 'gua', label: 'Globale Adresse', kind: 'ipv6' as const, answer: compressIPv6([...prefix, ...iid]) },
                ];
        return {
          title: 'EUI-64-Interface-ID',
          prompt:
            `Ein Client mit der MAC-Adresse **${mac}** bildet seine Interface-ID nach **EUI-64** (modifiziert).` +
            (level === 2 ? ' Geben Sie außerdem die Link-Local-Adresse an.' : level === 3 ? ` Per SLAAC erhält er das Präfix **${compressIPv6([...prefix, 0, 0, 0, 0])}/64**. Geben Sie auch die globale Adresse an.` : ''),
          fields,
          solution: [
            `1. MAC in der Mitte teilen: ${bytes.slice(0, 3).join(':')} | ${bytes.slice(3).join(':')}`,
            `2. **FF:FE** einfügen: ${bytes.slice(0, 3).join(':')}:ff:fe:${bytes.slice(3).join(':')}`,
            `3. Im 1. Byte das **7. Bit (U/L-Bit) umkehren**: ${bytes[0]} = ${first.toString(2).padStart(8, '0')} → ${flipped.toString(2).padStart(8, '0')} = **${flipped.toString(16).padStart(2, '0')}**`,
            `4. In 16-Bit-Gruppen schreiben: **${iidStr}**`,
            ...(level === 2 ? [`5. Link-Local = fe80::/64 + Interface-ID → **${compressIPv6([0xfe80, 0, 0, 0, ...iid])}**`] : []),
            ...(level === 3 ? [`5. Präfix + Interface-ID → **${compressIPv6([...prefix, ...iid])}**`] : []),
            '',
            'Hinweis: Wegen des Datenschutzes nutzen Clients heute meist zufällige Interface-IDs (Privacy Extensions, RFC 8981) statt EUI-64.',
          ].join('\n'),
        };
      },
    },
  ],
};

function hexSteps(n: number): string {
  if (n < 16) return `${n} < 16`;
  const steps: string[] = [];
  let x = n;
  while (x > 0) {
    steps.push(`${x} ÷ 16 = ${Math.floor(x / 16)} Rest ${x % 16}${x % 16 > 9 ? ` (${(x % 16).toString(16)})` : ''}`);
    x = Math.floor(x / 16);
  }
  return steps.join('; ') + ' → Reste von unten nach oben lesen';
}
