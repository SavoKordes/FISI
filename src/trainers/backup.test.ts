import { describe, expect, it } from 'vitest';
import { backupTrainer, weekStorage } from './backup';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';

const n = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

describe('Backup-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(backupTrainer, 80));

  it('Wochenvolumen per Simulation Tag für Tag', () => {
    for (const [full, d, days] of [[500, 20, 5], [1000, 50, 6], [300, 9, 6]]) {
      let incr = full;
      let diff = full;
      for (let day = 1; day <= days; day++) {
        incr += d; // nur Änderungen seit letzter Sicherung
        diff += day * d; // alle Änderungen seit Vollsicherung
      }
      expect(weekStorage(full, d, days)).toEqual({ incr, diff });
    }
  });

  it('Zeitaufgaben: Dauer = Datenmenge ÷ langsamste Komponente', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(backupTrainer, 'time', level, seed);
        const gb = n(t.prompt.match(/\*\*([\d.]+) GB\*\*/)![1]);
        const [w, r] = [...t.prompt.matchAll(/\*\*(\d+) MB\/s\*\*/g)].map((m) => Number(m[1]));
        const net = t.prompt.match(/\*\*([\d.]+) Mbit\/s\*\*/);
        const netMBs = net ? n(net[1]) / 8 : Infinity;
        expect(field(t, 'tb').value).toBeCloseTo((gb * 1000) / Math.min(w, netMBs) / 3600, 6);
        expect(field(t, 'tr').value).toBeCloseTo((gb * 1000) / Math.min(r, netMBs) / 3600, 6);
      }
    }
  });
});
