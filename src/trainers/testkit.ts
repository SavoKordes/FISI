import { expect } from 'vitest';
import { checkField } from './check';
import { generateTask } from './registry';
import type { Level, Task, Trainer } from './types';

/** Allgemeine Eigenschaften, die jede generierte Aufgabe erfüllen muss */
export function forAllTasks(trainer: Trainer, seeds: number, verify?: (t: Task) => void) {
  for (const type of trainer.types) {
    for (const level of [1, 2, 3] as Level[]) {
      for (let seed = 1; seed <= seeds; seed++) {
        const t = generateTask(trainer, type.id, level, seed * 7919 + level);
        const again = generateTask(trainer, type.id, level, seed * 7919 + level);
        const ctx = `${trainer.id}/${type.id}/L${level}/seed ${t.seed}`;
        expect(again, ctx + ' nicht reproduzierbar').toEqual(t);
        expect(t.fields.length, ctx).toBeGreaterThan(0);
        expect(new Set(t.fields.map((f) => f.key)).size, ctx + ' doppelte Feld-Keys').toBe(t.fields.length);
        const text = t.prompt + t.solution + t.fields.map((f) => f.answer + f.label).join();
        expect(text, ctx).not.toMatch(/NaN|undefined|Infinity|\[object/);
        for (const f of t.fields) {
          expect(checkField(f, f.answer), `${ctx}: Feld ${f.key} akzeptiert eigene Lösung "${f.answer}" nicht`).toBe(true);
          if (f.kind === 'number') expect(Number.isFinite(f.value), ctx).toBe(true);
        }
        verify?.(t);
      }
    }
  }
}

export const field = (t: Task, key: string) => {
  const f = t.fields.find((x) => x.key === key);
  if (!f) throw new Error(`Feld ${key} fehlt in ${t.trainer}/${t.type}`);
  return f;
};
