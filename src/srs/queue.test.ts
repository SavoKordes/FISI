import { describe, expect, it } from 'vitest';
import type { Card } from '../content/schema';
import type { CardStateRow, ReviewLogRow } from '../db/db';
import { review } from './fsrs';
import { buildQueue, endspurt, estimateMinutes, matchesFilter, newIntroducedToday, streak, topicFailRates, dayKey, DAY_MS } from './queue';

const now = new Date(2026, 3, 10, 12, 0, 0).getTime();

const mk = (id: string, area: Card['area'], rel: Card['examRelevance'] = 'mittel', topic = 'T'): Card => ({
  id, area, topic, type: 'qa', front: 'Frage ' + id, back: 'Antwort', difficulty: 2, examRelevance: rel, source: 'builtin',
});

describe('Warteschlange', () => {
  const cards = [
    mk('ka-a-01', 'KA', 'hoch'), mk('ka-a-02', 'KA', 'niedrig'), mk('ka-a-03', 'KA'),
    mk('net-a-01', 'NET', 'hoch'), mk('net-a-02', 'NET'), mk('wiso-a-01', 'WISO'),
  ];

  it('neue Karten: Limit, Interleaving nach Bereich, Relevanz zuerst', () => {
    const q = buildQueue({ cards, states: new Map(), newLimit: 4, now });
    expect(q.fresh.map((c) => c.id)).toEqual(['ka-a-01', 'net-a-01', 'wiso-a-01', 'ka-a-03']);
    expect(q.due).toEqual([]);
  });

  it('fällige Karten werden nach Fälligkeit sortiert, nicht fällige ausgelassen', () => {
    const states = new Map<string, CardStateRow>();
    const base = review(undefined, 4, now - 30 * DAY_MS);
    const old = { ...base, due: now - 10 * DAY_MS }; // seit Tagen fällig
    const recent = { ...base, due: now - DAY_MS };
    const future = { ...base, due: now + DAY_MS };
    states.set('ka-a-03', { id: 'ka-a-03', fsrs: recent, updatedAt: 0 });
    states.set('net-a-02', { id: 'net-a-02', fsrs: old, updatedAt: 0 });
    states.set('wiso-a-01', { id: 'wiso-a-01', fsrs: future, updatedAt: 0 });
    const q = buildQueue({ cards, states, newLimit: 0, now });
    expect(q.due.map((c) => c.id)).toEqual(['net-a-02', 'ka-a-03']);
  });

  it('Filter nach Bereich, Relevanz, Stern, Suche', () => {
    const st: CardStateRow = { id: 'net-a-01', starred: true, updatedAt: 0 };
    expect(matchesFilter(cards[3], st, { areas: ['NET'], relevance: ['hoch'], starredOnly: true })).toBe(true);
    expect(matchesFilter(cards[3], undefined, { starredOnly: true })).toBe(false);
    expect(matchesFilter(cards[0], undefined, { areas: ['NET'] })).toBe(false);
    expect(matchesFilter(cards[0], undefined, { search: 'FRAGE ka-a' })).toBe(true);
    expect(matchesFilter(cards[0], undefined, { weakOnly: true })).toBe(false);
  });

  it('Endspurt: aktiv ≤ 60 Tage, Intensität steigt', () => {
    const iso = (d: number) => dayKey(now + d * DAY_MS);
    expect(endspurt(null, now).active).toBe(false);
    expect(endspurt(iso(90), now).active).toBe(false);
    const e30 = endspurt(iso(30), now);
    const e5 = endspurt(iso(5), now);
    expect(e30.active).toBe(true);
    expect(e5.intensity).toBeGreaterThan(e30.intensity);
    expect(endspurt(iso(-1), now).active).toBe(false);
  });

  it('Endspurt (≤ 14 Tage) lässt neue Karten mit niedriger Relevanz weg und priorisiert schwache Themen', () => {
    const cs = [mk('ka-x-01', 'KA', 'niedrig', 'Leicht'), mk('ka-y-01', 'KA', 'mittel', 'Schwach'), mk('ka-z-01', 'KA', 'mittel', 'Gut')];
    const failRates = new Map([['Schwach', 0.8], ['Gut', 0.05]]);
    const q = buildQueue({ cards: cs, states: new Map(), newLimit: 10, now, examDate: dayKey(now + 7 * DAY_MS), failRates });
    expect(q.endspurt.active).toBe(true);
    expect(q.fresh.map((c) => c.id)).toEqual(['ka-y-01', 'ka-z-01']);
  });

  it('Endspurt (≤ 21 Tage) zieht wichtige Karten mit sinkender Abrufwahrscheinlichkeit vor', () => {
    const cs = [mk('net-h-01', 'NET', 'hoch')];
    const f = review(undefined, 4, now - 20 * DAY_MS); // Review-Karte, fällig etwa jetzt
    // Fälligkeit künstlich in die Zukunft, Abrufwahrscheinlichkeit aber schon gesunken
    const states = new Map<string, CardStateRow>([['net-h-01', { id: 'net-h-01', fsrs: { ...f, due: now + DAY_MS }, updatedAt: 0 }]]);
    const q = buildQueue({ cards: cs, states, newLimit: 0, now, examDate: dayKey(now + 10 * DAY_MS) });
    expect(q.early.map((c) => c.id)).toEqual(['net-h-01']);
  });
});

describe('Statistik-Helfer', () => {
  const log = (cardId: string, ts: number, rating: 1 | 2 | 3 | 4, prevState = 0, topic = 'T'): ReviewLogRow => ({
    cardId, ts, rating, prevState, area: 'KA', topic, durationMs: 1000,
  });

  it('zählt heute eingeführte neue Karten einmalig', () => {
    const logs = [log('a', now - 1000, 1), log('a', now - 500, 3, 1), log('b', now - 100, 3), log('c', now - 2 * DAY_MS, 3)];
    expect(newIntroducedToday(logs, now)).toBe(2);
  });

  it('Fehlerquote je Thema', () => {
    const logs = [log('a', 0, 1, 2, 'X'), log('b', 0, 1, 2, 'X'), log('c', 0, 3, 2, 'Y'), log('d', 0, 4, 2, 'Y')];
    const r = topicFailRates(logs);
    expect(r.get('X')!).toBeGreaterThan(r.get('Y')!);
  });

  it('Streak zählt zusammenhängende Tage bis heute bzw. gestern', () => {
    const k = (d: number) => dayKey(now - d * DAY_MS);
    expect(streak([k(0), k(1), k(2), k(4)], now)).toBe(3);
    expect(streak([k(1), k(2)], now)).toBe(2);
    expect(streak([k(2)], now)).toBe(0);
    expect(streak([], now)).toBe(0);
  });

  it('Lernzeit-Schätzung', () => {
    expect(estimateMinutes(0, 0)).toBe(0);
    expect(estimateMinutes(12, 20)).toBe(11);
  });
});
