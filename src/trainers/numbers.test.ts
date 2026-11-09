import { describe, expect, it } from 'vitest';
import { numbersTrainer } from './numbers';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';

describe('Zahlensysteme-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(numbersTrainer, 80));

  it('Ergebnisse stimmen mit parseInt/toString überein', () => {
    for (let seed = 1; seed < 400; seed++) {
      for (const level of [1, 2, 3] as const) {
        for (const type of numbersTrainer.types) {
          const t = generateTask(numbersTrainer, type.id, level, seed);
          const given = t.prompt.match(/\*\*([0-9A-F. ]+)\*\*/)![1];
          const from = type.id.slice(0, 3);
          const n = from === 'dec' ? Number(given.replace(/\./g, '')) : parseInt(given.replace(/ /g, ''), from === 'bin' ? 2 : 16);
          const to = type.id.slice(4);
          const ans = field(t, 'out').answer;
          const got = to === 'dec' ? Number(ans) : parseInt(ans, to === 'bin' ? 2 : 16);
          expect(got).toBe(n);
          const max = level === 1 ? 255 : level === 2 ? 65535 : 16_777_215;
          expect(n).toBeLessThanOrEqual(max);
          // Rechenweg nennt das Ergebnis
          expect(t.solution).toContain(to === 'dec' ? n.toLocaleString('de-DE') : to === 'hex' ? ans : ans.slice(-4));
        }
      }
    }
  });
});
