import { describe, expect, it } from 'vitest';
import { availabilityTrainer, parallel, series } from './availability';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';

describe('Verfügbarkeits-Formeln', () => {
  it('bekannte Werte', () => {
    expect(((100 - 99.9) / 100) * 8760).toBeCloseTo(8.76, 6);
    expect(series([0.99, 0.99])).toBeCloseTo(0.9801, 10);
    expect(parallel([0.99, 0.99])).toBeCloseTo(0.9999, 10);
    expect(parallel([0.9, 0.9, 0.9])).toBeCloseTo(0.999, 10);
  });
  it('Monte-Carlo bestätigt Reihe/Parallel', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const a = [0.9, 0.8];
    let s = 0;
    let p = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const up = a.map((x) => rnd() < x);
      if (up.every(Boolean)) s++;
      if (up.some(Boolean)) p++;
    }
    expect(s / N).toBeCloseTo(series(a), 2);
    expect(p / N).toBeCloseTo(parallel(a), 2);
  });
});

describe('Verfügbarkeits-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(availabilityTrainer, 80));

  it('Ausfallzeit aus SLA nachgerechnet', () => {
    for (let seed = 1; seed < 200; seed++) {
      const t = generateTask(availabilityTrainer, 'downtime', 1, seed);
      const a = Number(t.prompt.match(/\*\*([\d,]+) %\*\*/)![1].replace(',', '.'));
      expect(field(t, 'year').value).toBeCloseTo((1 - a / 100) * 365 * 24, 6);
      expect(field(t, 'month').value).toBeCloseTo((1 - a / 100) * 30 * 24 * 60, 6);
    }
  });

  it('USV: S = P / cos φ', () => {
    for (let seed = 1; seed < 100; seed++) {
      const t = generateTask(availabilityTrainer, 'ups', 1, seed);
      const w = Number(t.prompt.match(/\*\*(\d+) W\*\*/)![1]);
      const cos = Number(t.prompt.match(/cos φ = ([\d,]+)/)![1].replace(',', '.'));
      expect(field(t, 'va').value).toBeCloseTo(w / cos, 6);
    }
  });
});

describe('Kombiniertes System', () => {
  it('schwächstes Glied ist das Minimum im Reihenpfad', () => {
    for (let seed = 1; seed < 300; seed++) {
      const t = generateTask(availabilityTrainer, 'system', 3, seed);
      const [fw, net, srv] = [...t.prompt.matchAll(/([\d,]+) %/g)].map((m) => Number(m[1].replace(',', '.')) / 100);
      const par = parallel([srv, srv]);
      const all = { Firewall: fw, 'Core-Switch': net, Webserver: par };
      const min = Math.min(fw, net, par);
      expect(all[field(t, 'weak').answer as keyof typeof all]).toBe(min);
      expect(field(t, 'a').value).toBeCloseTo(fw * net * par * 100, 8);
    }
  });
});
