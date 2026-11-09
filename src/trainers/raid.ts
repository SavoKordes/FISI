import type { Field, Trainer } from './types';
import { fmt, fmtPlain, round } from './lib/format';

export type RaidLevel = 0 | 1 | 5 | 6 | 10;

export const RAID_INFO: Record<RaidLevel, { min: number; formula: string; tolerance: string }> = {
  0: { min: 2, formula: 'n × Plattengröße (keine Redundanz)', tolerance: '0 – jeder Plattenausfall zerstört den Verbund' },
  1: { min: 2, formula: '1 × Plattengröße (Spiegelung)', tolerance: 'n − 1 Platten' },
  5: { min: 3, formula: '(n − 1) × Plattengröße', tolerance: '1 Platte' },
  6: { min: 4, formula: '(n − 2) × Plattengröße', tolerance: '2 Platten' },
  10: { min: 4, formula: 'n ÷ 2 × Plattengröße', tolerance: 'garantiert 1 Platte; bis n/2, wenn je Spiegel nur eine ausfällt' },
};

export function raidNet(level: RaidLevel, n: number, size: number): number {
  switch (level) {
    case 0:
      return n * size;
    case 1:
      return size;
    case 5:
      return (n - 1) * size;
    case 6:
      return (n - 2) * size;
    case 10:
      return (n / 2) * size;
  }
}

/** garantiert tolerierte Plattenausfälle */
export function raidFaultTolerance(level: RaidLevel, n: number): number {
  return level === 0 ? 0 : level === 1 ? n - 1 : level === 5 ? 1 : level === 6 ? 2 : 1;
}

/** Mindestanzahl Platten im Verbund für Zielkapazität */
export function disksForCapacity(level: 5 | 6 | 10, target: number, size: number): number {
  const data = Math.ceil(target / size - 1e-9);
  if (level === 5) return Math.max(3, data + 1);
  if (level === 6) return Math.max(4, data + 2);
  return Math.max(4, data * 2);
}

const num = (key: string, label: string, v: number, unit?: string, tol: Field['tolerance'] = { abs: 0.01 }): Field => ({
  key,
  label,
  kind: 'number',
  answer: fmtPlain(v, 2),
  value: v,
  unit,
  tolerance: tol,
});

export const raidTrainer: Trainer = {
  id: 'raid',
  title: 'RAID & Speicher',
  short: 'RAID',
  description: 'Nettokapazität RAID 0/1/5/6/10, Hot Spare, gemischte Platten, Plattenanzahl, GB vs. GiB',
  levels: { 1: 'RAID 0/1/5, gleiche Platten', 2: 'RAID 6/10, Hot Spare', 3: 'gemischte Plattengrößen, Nutzungsgrad' },
  types: [
    {
      id: 'capacity',
      label: 'Nettokapazität',
      gen: (rng, level) => {
        const raid: RaidLevel = level === 1 ? rng.pick([0, 1, 5] as const) : rng.pick([5, 6, 10] as const);
        const unit = rng.chance(0.75) ? 'TB' : 'GB';
        const size = unit === 'TB' ? rng.pick([1, 2, 4, 6, 8, 10, 12, 16, 18, 20]) : rng.pick([240, 480, 500, 960, 1000, 1920]);
        let n = raid === 1 ? 2 : raid === 10 ? 2 * rng.int(2, 4) : rng.int(RAID_INFO[raid].min, 8);
        if (raid === 0) n = rng.int(2, 4);
        const spares = level >= 2 && raid !== 0 ? rng.int(0, 1) + (level === 3 ? rng.int(0, 1) : 0) : 0;
        // Level 3: eine kleinere Platte im Verbund
        const small = level === 3 ? size / 2 : size;
        const eff = small; // kleinste Platte bestimmt die nutzbare Größe je Platte
        const net = raidNet(raid, n, eff);
        const gross = (level === 3 ? (n - 1) * size + small : n * size) + spares * size;
        const util = (net / gross) * 100;
        const diskText =
          level === 3
            ? `${n - 1} Festplatten à ${fmt(size)} ${unit} und **eine** Festplatte mit ${fmt(small)} ${unit}`
            : `${n} Festplatten à ${fmt(size)} ${unit}`;
        const fields: Field[] = [num('net', 'Nettokapazität', net, unit), num('ft', 'Garantiert tolerierte Plattenausfälle', raidFaultTolerance(raid, n), 'Platte(n)', { abs: 0 })];
        if (level === 3) fields.push(num('util', 'Nutzungsgrad (bezogen auf alle Platten)', round(util, 2), '%', { abs: 0.1 }));
        return {
          title: `RAID ${raid}: Nettokapazität`,
          prompt:
            `Ein Server erhält ein **RAID ${raid}** aus ${diskText}.` +
            (spares ? ` Zusätzlich ${spares === 1 ? 'wird **eine** weitere Platte' : `werden **${spares}** weitere Platten`} à ${fmt(size)} ${unit} als **Hot Spare** eingebaut.` : '') +
            `\n\nBerechnen Sie die Nettokapazität und geben Sie an, wie viele Plattenausfälle der Verbund garantiert verkraftet.` +
            (level === 3 ? ' Berechnen Sie außerdem den Nutzungsgrad (Netto ÷ Brutto aller eingebauten Platten).' : ''),
          fields,
          solution: [
            `- Formel RAID ${raid}: **${RAID_INFO[raid].formula}**`,
            level === 3 ? `- Bei unterschiedlichen Platten zählt **jede Platte nur so groß wie die kleinste**: ${fmt(small)} ${unit} (${fmt((n - 1) * (size - small))} ${unit} bleiben ungenutzt)` : '',
            spares ? `- Hot-Spare-Platten gehören **nicht** zum Verbund und zählen nicht zur Nettokapazität.` : '',
            `- n = ${n}: ${netCalc(raid, n, eff)} = **${fmt(net)} ${unit}**`,
            `- Ausfallsicherheit: **${RAID_INFO[raid].tolerance}**` + (raid === 1 ? ` → hier ${n - 1}` : ''),
            level === 3 ? `- Brutto: ${n - 1} × ${fmt(size)} + ${fmt(small)}${spares ? ` + ${spares} × ${fmt(size)} (Hot Spare)` : ''} = ${fmt(gross)} ${unit} → Nutzungsgrad ${fmt(net)} ÷ ${fmt(gross)} = **${fmt(util, 2)} %**` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
    {
      id: 'disks',
      label: 'Plattenanzahl für Zielkapazität',
      gen: (rng, level) => {
        const raid = level === 1 ? 5 : rng.pick([5, 6, 10] as const);
        const size = rng.pick([2, 4, 8, 12, 16]);
        const target = rng.int(2, level === 3 ? 14 : 8) * size - (level >= 2 && rng.chance(0.5) ? rng.int(1, size - 1) : 0);
        const spare = level >= 2 && rng.chance(0.5) ? 1 : 0;
        const n = disksForCapacity(raid, target, size);
        const net = raidNet(raid, n, size);
        return {
          title: `RAID ${raid}: Plattenanzahl`,
          prompt:
            `Für einen Fileserver werden mindestens **${fmt(target)} TB** Nettokapazität benötigt. Es stehen Festplatten à **${size} TB** zur Verfügung, geplant ist **RAID ${raid}**` +
            (spare ? ' mit **einer Hot-Spare-Platte**' : '') +
            '.\n\nWie viele Festplatten müssen insgesamt beschafft werden und welche Nettokapazität ergibt sich?',
          fields: [num('n', 'Anzahl Festplatten (gesamt)', n + spare, 'Stück', { abs: 0 }), num('net', 'Nettokapazität', net, 'TB')],
          solution: [
            `- Datenplatten: ${fmt(target)} TB ÷ ${size} TB = ${fmt(target / size, 2)} → aufrunden auf **${Math.ceil(target / size - 1e-9)}**`,
            raid === 5 ? `- RAID 5: + 1 Platte für Parität → ${n}` : raid === 6 ? `- RAID 6: + 2 Platten für Parität → ${n}` : `- RAID 10: Datenplatten × 2 (Spiegelung) → ${n}`,
            n > (raid === 10 ? 2 : 1) * Math.ceil(target / size - 1e-9) + (raid === 5 ? 1 : raid === 6 ? 2 : 0) ? `- Mindestanzahl für RAID ${raid} beachten: **${RAID_INFO[raid].min} Platten**` : '',
            spare ? `- + 1 Hot Spare → **${n + 1} Platten**` : `- → **${n} Platten**`,
            `- Nettokapazität: ${netCalc(raid, n, size)} = **${fmt(net)} TB** (≥ ${fmt(target)} TB ✓)`,
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
    {
      id: 'units',
      label: 'GB vs. GiB (SI vs. IEC)',
      gen: (rng, level) => {
        if (level === 1) {
          const gb = rng.pick([120, 250, 256, 480, 500, 512, 960, 1000]);
          const gib = (gb * 1e9) / 2 ** 30;
          return {
            title: 'Herstellerangabe vs. Betriebssystem',
            prompt: `Eine SSD wird mit **${gb} GB** verkauft. Das Betriebssystem rechnet binär (GiB). Welche Größe in **GiB** zeigt es an? (2 Nachkommastellen)`,
            fields: [num('gib', 'Größe', round(gib, 2), 'GiB')],
            solution: `- Hersteller (SI): 1 GB = 10⁹ Byte → ${gb} GB = ${fmt(gb * 1e9, 0)} Byte\n- Betriebssystem (IEC): 1 GiB = 2³⁰ Byte = 1.073.741.824 Byte\n- ${fmt(gb * 1e9, 0)} ÷ 1.073.741.824 = **${fmt(gib, 2)} GiB**`,
          };
        }
        if (level === 2) {
          const tb = rng.pick([1, 2, 4, 8, 12, 16, 20]);
          const tib = (tb * 1e12) / 2 ** 40;
          const loss = (1 - 1e12 / 2 ** 40) * 100;
          return {
            title: 'TB in TiB',
            prompt: `Eine Festplatte hat laut Hersteller **${tb} TB**. Wie viel **TiB** zeigt das Betriebssystem an und wie groß ist die scheinbare „Differenz“ in Prozent? (2 Nachkommastellen)`,
            fields: [num('tib', 'Größe', round(tib, 2), 'TiB'), num('loss', 'Differenz', round(loss, 2), '%', { abs: 0.05 })],
            solution: `- 1 TB = 10¹² Byte, 1 TiB = 2⁴⁰ Byte = 1.099.511.627.776 Byte\n- ${tb} × 10¹² ÷ 2⁴⁰ = **${fmt(tib, 2)} TiB**\n- Differenz: 1 − 10¹² ÷ 2⁴⁰ = **${fmt(loss, 2)} %** (unabhängig von der Plattengröße)`,
          };
        }
        const n = rng.int(4, 8);
        const size = rng.pick([4, 8, 10, 12, 16]);
        const net = raidNet(5, n, size);
        const tib = (net * 1e12) / 2 ** 40;
        return {
          title: 'RAID-Kapazität in TiB',
          prompt: `Ein RAID 5 besteht aus **${n} × ${size} TB**. Wie viel Speicher (in **TiB**) meldet das Betriebssystem für das Volume (ohne Dateisystem-Overhead)? (2 Nachkommastellen)`,
          fields: [num('net', 'Nettokapazität', net, 'TB'), num('tib', 'Angezeigt', round(tib, 2), 'TiB')],
          solution: `- RAID 5: (${n} − 1) × ${size} TB = **${fmt(net)} TB**\n- ${fmt(net)} × 10¹² Byte ÷ 2⁴⁰ = **${fmt(tib, 2)} TiB**`,
        };
      },
    },
  ],
};

function netCalc(level: RaidLevel, n: number, size: number): string {
  const s = fmt(size);
  switch (level) {
    case 0:
      return `${n} × ${s}`;
    case 1:
      return `1 × ${s}`;
    case 5:
      return `(${n} − 1) × ${s}`;
    case 6:
      return `(${n} − 2) × ${s}`;
    case 10:
      return `${n} ÷ 2 × ${s}`;
  }
}
