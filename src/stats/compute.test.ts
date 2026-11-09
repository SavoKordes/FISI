import { describe, expect, it } from 'vitest';
import type { Card } from '../content/schema';
import type { ReviewLogRow } from '../db/db';
import { activityByDay, heatmapWeeks, level, quoteBy, topicRows, weakestTopics } from './compute';
import { dayKey } from '../srs/queue';

const log = (topic: string, rating: 1 | 2 | 3 | 4, ts = 0): ReviewLogRow => ({ cardId: 'x', area: 'KA', topic, rating, prevState: 2, ts, durationMs: 1 });

describe('Statistik', () => {
  it('Quote: Gut/Einfach zählen als gewusst', () => {
    const q = quoteBy([log('A', 3), log('A', 4), log('A', 2), log('A', 1)], (l) => l.topic).get('A')!;
    expect(q).toEqual({ n: 4, ok: 2, rate: 0.5 });
  });

  it('schwächste Themen mit Mindestanzahl', () => {
    const cards: Card[] = ['A', 'B', 'C'].map((t) => ({ id: t, area: 'KA', topic: t, type: 'qa', front: 'x', back: 'y', difficulty: 1, examRelevance: 'mittel', source: 'builtin' }));
    const logs = [log('A', 1), log('A', 1), log('A', 3), log('B', 3), log('B', 3), log('B', 1), log('C', 1)];
    const rows = topicRows(cards, new Map(), logs);
    expect(weakestTopics(rows).map((r) => r.topic)).toEqual(['A', 'B']); // C hat zu wenige Bewertungen
  });

  it('Heatmap: Wochen beginnen montags, letzte Spalte enthält heute, lückenlos über die Zeitumstellung', () => {
    const now = new Date(2026, 10, 11, 15).getTime(); // Mittwoch, 11.11.2026
    const w = heatmapWeeks(4, now);
    expect(w.length).toBe(4);
    expect(w.every((c) => c.length === 7)).toBe(true);
    expect(new Date(w[0][0].ts).getDay()).toBe(1);
    expect(w[3][2].key).toBe(dayKey(now));
    expect(w[3][3].future).toBe(true);
    expect(w[3][2].future).toBe(false);
    const keys = w.flat().map((d) => d.key);
    expect(new Set(keys).size).toBe(28); // umfasst den 25.10.2026 (Zeitumstellung)
    expect(keys).toContain('2026-10-25');
  });

  it('Aktivität und Stufen', () => {
    const t = new Date(2026, 0, 5, 10).getTime();
    const a = activityByDay([log('A', 3, t), log('A', 1, t + 1000)], [{ trainer: 'x', task: 'y', level: 1, seed: 1, correct: true, ts: t, durationMs: 1 }]);
    expect(a.get(dayKey(t))).toBe(3);
    expect([0, 1, 9, 10, 24, 25, 49, 50].map(level)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});
