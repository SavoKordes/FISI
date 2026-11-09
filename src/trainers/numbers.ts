import type { Level, Trainer } from './types';
import type { Rng } from './lib/rng';
import { fmt } from './lib/format';

const group4 = (bin: string) => bin.padStart(Math.ceil(bin.length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1 ');
const HEX = '0123456789ABCDEF';

function value(rng: Rng, level: Level): number {
  if (level === 1) return rng.int(1, 255);
  if (level === 2) return rng.int(256, 65535);
  return rng.int(65536, 16_777_215);
}

function divisionTable(n: number, base: 2 | 16): string {
  const rows: string[] = ['| Rechnung | Ergebnis | Rest |', '|---|---|---|'];
  let x = n;
  while (x > 0) {
    const r = x % base;
    rows.push(`| ${fmt(x, 0)} ÷ ${base} | ${fmt(Math.floor(x / base), 0)} | **${base === 16 ? `${r}${r > 9 ? ` = ${HEX[r]}` : ''}` : r}** |`);
    x = Math.floor(x / base);
  }
  return rows.join('\n') + '\n\nReste **von unten nach oben** lesen.';
}

function positionSum(digits: string, base: 2 | 16): string {
  const terms: string[] = [];
  const vals: number[] = [];
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    const d = parseInt(digits[i], base);
    if (d === 0) continue;
    const p = len - 1 - i;
    const w = base ** p;
    terms.push(base === 2 ? `${fmt(w, 0)}` : `${d} × ${fmt(w, 0)}`);
    vals.push(d * w);
  }
  const head = base === 2 ? 'Stellenwerte der 1-Bits addieren' : 'Jede Ziffer mit ihrem Stellenwert (16ⁿ) multiplizieren';
  const table =
    base === 16
      ? `\n\n| Ziffer | ${digits.split('').map((c) => c).join(' | ')} |\n|---|${digits.split('').map(() => '---').join('|')}|\n| Stellenwert | ${digits.split('').map((_, i) => `16^${len - 1 - i} = ${fmt(16 ** (len - 1 - i), 0)}`).join(' | ')} |`
      : '';
  return `${head}:${table}\n\n${terms.join(' + ')} = **${fmt(vals.reduce((a, b) => a + b, 0), 0)}**`;
}

function nibbleTable(bin: string): string {
  const groups = group4(bin).split(' ');
  return `| ${groups.join(' | ')} |\n|${groups.map(() => '---').join('|')}|\n| ${groups.map((g) => `${parseInt(g, 2)}${parseInt(g, 2) > 9 ? ` = ${HEX[parseInt(g, 2)]}` : ''}`).join(' | ')} |`;
}

type Conv = { id: string; label: string; from: string; to: string };
const CONV: Conv[] = [
  { id: 'dec2bin', label: 'Dezimal → Binär', from: 'Dezimalzahl', to: 'Binärzahl' },
  { id: 'bin2dec', label: 'Binär → Dezimal', from: 'Binärzahl', to: 'Dezimalzahl' },
  { id: 'dec2hex', label: 'Dezimal → Hexadezimal', from: 'Dezimalzahl', to: 'Hexadezimalzahl' },
  { id: 'hex2dec', label: 'Hexadezimal → Dezimal', from: 'Hexadezimalzahl', to: 'Dezimalzahl' },
  { id: 'bin2hex', label: 'Binär → Hexadezimal', from: 'Binärzahl', to: 'Hexadezimalzahl' },
  { id: 'hex2bin', label: 'Hexadezimal → Binär', from: 'Hexadezimalzahl', to: 'Binärzahl' },
];

export const numbersTrainer: Trainer = {
  id: 'zahlensysteme',
  title: 'Zahlensysteme',
  short: 'Zahlensysteme',
  description: 'Dezimal ↔ Binär ↔ Hexadezimal mit Restwert- und Stellenwertmethode',
  levels: { 1: '8 Bit (bis 255)', 2: '16 Bit (bis 65.535)', 3: '24 Bit (bis 16.777.215)' },
  types: CONV.map((c) => ({
    id: c.id,
    label: c.label,
    gen: (rng, level) => {
      const n = value(rng, level);
      const bin = n.toString(2);
      const hex = n.toString(16).toUpperCase();
      const dec = String(n);
      const shown = c.from === 'Dezimalzahl' ? fmt(n, 0) : c.from === 'Binärzahl' ? group4(bin) : hex;
      const answer = c.to === 'Dezimalzahl' ? dec : c.to === 'Binärzahl' ? bin : hex;
      const kind = c.to === 'Dezimalzahl' ? ('number' as const) : c.to === 'Binärzahl' ? ('bin' as const) : ('hex' as const);
      let solution: string;
      switch (c.id) {
        case 'dec2bin':
          solution = `**Restwertmethode** (fortlaufend durch 2 teilen):\n\n${divisionTable(n, 2)}\n\nErgebnis: **${group4(bin)}**\n\nKontrolle: ${positionSum(bin, 2)}`;
          break;
        case 'bin2dec':
          solution = positionSum(bin, 2);
          break;
        case 'dec2hex':
          solution = `**Restwertmethode** (fortlaufend durch 16 teilen):\n\n${divisionTable(n, 16)}\n\nErgebnis: **${hex}**\n\nAlternativ: erst binär, dann 4er-Gruppen (Nibbles) bilden.`;
          break;
        case 'hex2dec':
          solution = positionSum(hex, 16);
          break;
        case 'bin2hex':
          solution = `Von **rechts** in 4er-Gruppen (Nibbles) teilen, links mit Nullen auffüllen, jede Gruppe in eine Hex-Ziffer umwandeln (8-4-2-1):\n\n${nibbleTable(bin)}\n\nErgebnis: **${hex}**`;
          break;
        default:
          solution = `Jede Hex-Ziffer in **4 Bit** umwandeln (8-4-2-1):\n\n| ${hex.split('').join(' | ')} |\n|${hex.split('').map(() => '---').join('|')}|\n| ${hex
            .split('')
            .map((h) => parseInt(h, 16).toString(2).padStart(4, '0'))
            .join(' | ')} |\n\nErgebnis: **${group4(bin)}** (führende Nullen dürfen entfallen)`;
      }
      return {
        title: c.label,
        prompt: `Wandeln Sie die ${c.from} **${shown}** in eine ${c.to} um.`,
        fields: [{ key: 'out', label: c.to, kind, answer, value: kind === 'number' ? n : undefined, tolerance: { abs: 0 }, placeholder: kind === 'bin' ? 'z. B. 1011 0010' : kind === 'hex' ? 'z. B. 3F' : undefined }],
        solution,
      };
    },
  })),
};
