import { describe, expect, it } from 'vitest';
import { economicsTrainer, randomNetplan } from './economics';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';
import { Rng } from './lib/rng';
import { criticalPaths, schedule, type Activity } from './lib/netplan';

/** unabhängige Referenz: alle Pfade aufzählen (Brute Force) */
function allPaths(acts: Activity[]): { path: string[]; len: number }[] {
  const succ = new Map(acts.map((a) => [a.id, acts.filter((b) => b.preds.includes(a.id)).map((b) => b.id)]));
  const dur = new Map(acts.map((a) => [a.id, a.duration]));
  const out: { path: string[]; len: number }[] = [];
  const walk = (id: string, path: string[], len: number) => {
    const p = [...path, id];
    const l = len + dur.get(id)!;
    const s = succ.get(id)!;
    if (!s.length) out.push({ path: p, len: l });
    for (const n of s) walk(n, p, l);
  };
  for (const a of acts) if (!a.preds.length) walk(a.id, [], 0);
  return out;
}

describe('Netzplan', () => {
  it('Lehrbuchbeispiel', () => {
    const acts: Activity[] = [
      { id: 'A', duration: 3, preds: [] },
      { id: 'B', duration: 2, preds: ['A'] },
      { id: 'C', duration: 4, preds: ['A'] },
      { id: 'D', duration: 2, preds: ['B', 'C'] },
    ];
    const { rows, end } = schedule(acts);
    expect(end).toBe(9);
    const b = rows.find((r) => r.id === 'B')!;
    expect([b.faz, b.fez, b.saz, b.sez, b.gp, b.fp]).toEqual([3, 5, 5, 7, 2, 2]);
    expect(criticalPaths(rows, end)).toEqual([['A', 'C', 'D']]);
  });

  it('Zufallsnetzpläne: Dauer, Puffer und kritischer Pfad stimmen mit Pfad-Aufzählung überein', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const acts = randomNetplan(new Rng(seed), level);
        const { rows, end } = schedule(acts);
        const paths = allPaths(acts);
        const longest = Math.max(...paths.map((p) => p.len));
        expect(end).toBe(longest);
        const crit = paths.filter((p) => p.len === longest);
        expect(crit.length).toBe(1);
        expect(criticalPaths(rows, end)[0]).toEqual(crit[0].path);
        for (const r of rows) {
          // GP = Projektende − längster Pfad durch den Vorgang
          const through = Math.max(...paths.filter((p) => p.path.includes(r.id)).map((p) => p.len));
          expect(r.gp).toBe(longest - through);
          expect(r.fp).toBeGreaterThanOrEqual(0);
          expect(r.fp).toBeLessThanOrEqual(r.gp);
        }
      }
    }
  });
});

describe('Wirtschaftlichkeits-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(economicsTrainer, 60));

  it('Nutzwerte aus der Tabelle nachgerechnet', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(economicsTrainer, 'nwa', level, seed);
        const rows = t.prompt
          .split('\n')
          .filter((l) => /^\| [^-|K][^|]*\| \d/.test(l))
          .map((l) => l.split('|').slice(2, -1).map((c) => Number(c.replace('%', '').trim())));
        const sumW = rows.reduce((s, r) => s + r[0], 0);
        const opts = rows[0].length - 1;
        const vals = Array.from({ length: opts }, (_, j) => rows.reduce((s, r) => s + (r[0] / sumW) * r[j + 1], 0));
        vals.forEach((v, j) => expect(field(t, `nw${j}`).value).toBeCloseTo(v, 9));
        const best = vals.indexOf(Math.max(...vals));
        expect(field(t, 'best').answer).toBe(field(t, 'best').options![best]);
      }
    }
  });

  it('Stromkosten: 100 W 24/7 bei 30 ct = 262,80 €', () => {
    expect(0.1 * 8760 * 0.3).toBeCloseTo(262.8, 6);
    for (let seed = 1; seed < 100; seed++) {
      const t = generateTask(economicsTrainer, 'power', 1, seed);
      const w = Number(t.prompt.match(/\*\*(\d+) W\*\*/)![1]);
      const ct = Number(t.prompt.match(/\*\*(\d+) ct\/kWh\*\*/)![1]);
      expect(field(t, 'cost').value).toBeCloseTo((w / 1000) * 8760 * (ct / 100), 6);
    }
  });

  it('Kostenvergleich: Break-even = Investition ÷ Differenz', () => {
    for (let seed = 1; seed < 100; seed++) {
      const t = generateTask(economicsTrainer, 'cost', 2, seed);
      const euros = [...t.prompt.matchAll(/\*\*([\d.]+,\d\d) €\*\*/g)].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')));
      const [invest, runA, cloud] = euros;
      expect(field(t, 'be').value).toBeCloseTo(invest / (cloud - runA), 9);
    }
  });
});

describe('Netzplan-Generator', () => {
  it('enthält keine transitiv überflüssigen Vorgänger', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const acts = randomNetplan(new Rng(seed), level);
        const byId = new Map(acts.map((a) => [a.id, a]));
        const anc = (id: string, seen = new Set<string>()): Set<string> => {
          for (const p of byId.get(id)!.preds) if (!seen.has(p)) { seen.add(p); anc(p, seen); }
          return seen;
        };
        for (const a of acts) for (const p of a.preds) for (const q of a.preds) if (p !== q) expect(anc(q).has(p)).toBe(false);
      }
    }
  });
});
