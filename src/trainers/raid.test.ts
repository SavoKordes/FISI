import { describe, expect, it } from 'vitest';
import { disksForCapacity, raidFaultTolerance, raidNet, raidTrainer } from './raid';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';

describe('RAID-Formeln', () => {
  it('bekannte Werte', () => {
    expect(raidNet(5, 4, 4)).toBe(12);
    expect(raidNet(6, 6, 4)).toBe(16);
    expect(raidNet(10, 6, 2)).toBe(6);
    expect(raidNet(1, 2, 8)).toBe(8);
    expect(raidNet(0, 3, 2)).toBe(6);
    expect(raidFaultTolerance(6, 8)).toBe(2);
    expect(raidFaultTolerance(10, 8)).toBe(1);
  });
  it('Plattenanzahl ist minimal und ausreichend (Brute Force)', () => {
    for (const level of [5, 6, 10] as const)
      for (const size of [2, 4, 8])
        for (let target = 1; target <= 60; target++) {
          const n = disksForCapacity(level, target, size);
          expect(raidNet(level, n, size)).toBeGreaterThanOrEqual(target);
          // es gibt keine kleinere gültige Anzahl
          for (let m = level === 5 ? 3 : 4; m < n; m++) {
            if (level === 10 && m % 2) continue;
            expect(raidNet(level, m, size)).toBeLessThan(target);
          }
        }
  });
});

describe('RAID-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(raidTrainer, 80));

  it('Kapazitätsaufgaben: unabhängige Nachrechnung aus dem Aufgabentext', () => {
    for (let seed = 1; seed < 400; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(raidTrainer, 'capacity', level, seed);
        const raid = Number(t.prompt.match(/RAID (\d+)/)![1]);
        const m = t.prompt.match(/(\d+) Festplatten à ([\d.,]+) (TB|GB)/)!;
        let n = Number(m[1]);
        const size = Number(m[2].replace('.', '').replace(',', '.'));
        let perDisk = size;
        if (level === 3) {
          n += 1;
          perDisk = size / 2;
        }
        const expected = raid === 0 ? n * perDisk : raid === 1 ? perDisk : raid === 5 ? (n - 1) * perDisk : raid === 6 ? (n - 2) * perDisk : (n / 2) * perDisk;
        expect(field(t, 'net').value).toBeCloseTo(expected, 6);
        if (raid === 10) expect(n % 2).toBe(0);
      }
    }
  });

  it('GiB-Umrechnung', () => {
    for (let seed = 1; seed < 50; seed++) {
      const t = generateTask(raidTrainer, 'units', 1, seed);
      const gb = Number(t.prompt.match(/\*\*(\d+) GB\*\*/)![1]);
      expect(field(t, 'gib').value).toBeCloseTo((gb * 1000 ** 3) / 1024 ** 3, 2);
    }
    const t = generateTask(raidTrainer, 'units', 2, 3);
    expect(field(t, 'loss').value).toBeCloseTo(9.05, 2);
  });
});
