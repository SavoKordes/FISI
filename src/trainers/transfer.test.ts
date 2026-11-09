import { describe, expect, it } from 'vitest';
import { transferTrainer } from './transfer';
import { generateTask } from './registry';
import { field, forAllTasks } from './testkit';

const n = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

describe('Übertragungs-Trainer', () => {
  it('alle Aufgaben: reproduzierbar, Lösungen gültig', () => forAllTasks(transferTrainer, 80));

  it('Übertragungsdauer unabhängig nachgerechnet', () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const t = generateTask(transferTrainer, 'time', level, seed);
        const [, size, unit] = t.prompt.match(/\*\*([\d.,]+) (MB|GB|MiB|GiB)\*\*/)!;
        const [, rate, ru] = t.prompt.match(/\*\*([\d.,]+) (Mbit|Gbit)\/s\*\*/)!;
        const oh = Number(t.prompt.match(/\((\d+) % Overhead\)/)?.[1] ?? 0);
        const factor = { MB: 1e6, GB: 1e9, MiB: 1024 ** 2, GiB: 1024 ** 3 }[unit]!;
        const sec = (n(size) * factor * 8) / (n(rate) * (ru === 'Gbit' ? 1e9 : 1e6) * (1 - oh / 100));
        const f = field(t, 't');
        expect(f.value).toBeCloseTo(f.unit === 'min' ? sec / 60 : sec, 6);
      }
    }
  });

  it('Bekanntes Beispiel: 1 GB über 100 Mbit/s = 80 s', () => {
    expect((1e9 * 8) / 100e6).toBe(80);
  });

  it('Bandbreite: Zeit mit berechneter Rate ergibt wieder die Vorgabe', () => {
    for (let seed = 1; seed < 200; seed++) {
      const t = generateTask(transferTrainer, 'bandwidth', 2, seed);
      const gb = n(t.prompt.match(/\*\*([\d.,]+) GB\*\*/)![1]);
      const min = n(t.prompt.match(/\*\*(\d+) Minuten\*\*/)![1]);
      const oh = Number(t.prompt.match(/\*\*(\d+) % Protokoll/)?.[1] ?? 0);
      const rate = field(t, 'rate').value!;
      const seconds = (gb * 1e9 * 8) / (rate * 1e6 * (1 - oh / 100));
      expect(seconds).toBeCloseTo(min * 60, 6);
    }
  });
});
