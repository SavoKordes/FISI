import { describe, expect, it } from 'vitest';
import { formatInterval, isDue, isNew, isWeak, newCardData, previewIntervals, retrievability, review } from './fsrs';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 5, 8, 0, 0);

describe('FSRS-Wrapper', () => {
  it('neue Karte ist neu und nicht fällig', () => {
    const c = newCardData(t0);
    expect(isNew(c)).toBe(true);
    expect(isNew(undefined)).toBe(true);
    expect(isDue(c, t0)).toBe(false);
    expect(retrievability(c, t0)).toBe(0);
  });

  it('Vorschau ist monoton: Nochmal ≤ Schwer ≤ Gut ≤ Einfach', () => {
    for (const start of [undefined, review(undefined, 3, t0)]) {
      const now = start ? start.due : t0;
      const p = previewIntervals(start, now);
      expect(p[1]).toBeLessThanOrEqual(p[2]);
      expect(p[2]).toBeLessThanOrEqual(p[3]);
      expect(p[3]).toBeLessThanOrEqual(p[4]);
      expect(p[1]).toBeGreaterThan(0);
    }
  });

  it('"Nochmal" bei neuer Karte → Lernschritt in Minuten', () => {
    const c = review(undefined, 1, t0);
    expect(c.state).toBe(1); // Learning
    expect(c.due - t0).toBeLessThan(15 * 60_000);
    expect(c.reps).toBe(1);
  });

  it('"Einfach" bei neuer Karte → direkt in Wiederholung mit Tagen Abstand', () => {
    const c = review(undefined, 4, t0);
    expect(c.state).toBe(2); // Review
    expect(c.due - t0).toBeGreaterThanOrEqual(DAY);
  });

  it('wiederholtes "Gut" verlängert die Intervalle', () => {
    let c = review(undefined, 4, t0);
    let lastInterval = c.due - t0;
    for (let i = 0; i < 4; i++) {
      const now = c.due;
      c = review(c, 3, now);
      const interval = c.due - now;
      expect(interval).toBeGreaterThan(lastInterval * 0.9); // Fuzz erlaubt kleine Schwankung
      lastInterval = interval;
    }
    expect(lastInterval).toBeGreaterThan(10 * DAY);
  });

  it('Vergessen einer Wiederholungskarte zählt einen Lapse und macht sie schwach', () => {
    let c = review(undefined, 4, t0);
    c = review(c, 1, c.due);
    expect(c.lapses).toBe(1);
    expect(c.state).toBe(3); // Relearning
    expect(isWeak(c)).toBe(true);
  });

  it('Fälligkeit und Abrufwahrscheinlichkeit', () => {
    const c = review(undefined, 4, t0);
    expect(isDue(c, t0)).toBe(false);
    expect(isDue(c, c.due)).toBe(true);
    const rNow = retrievability(c, t0 + 1000);
    const rLater = retrievability(c, c.due + 30 * DAY);
    expect(rNow).toBeGreaterThan(0.95);
    expect(rLater).toBeLessThan(rNow);
  });

  it('Daten bleiben JSON-serialisierbar (Export)', () => {
    const c = review(review(undefined, 3, t0), 3, t0 + 10 * 60_000);
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  it('formatiert Intervalle deutsch', () => {
    expect(formatInterval(30_000)).toBe('<1 Min');
    expect(formatInterval(10 * 60_000)).toBe('10 Min');
    expect(formatInterval(3 * 3600_000)).toBe('3 Std');
    expect(formatInterval(4 * DAY)).toBe('4 T');
    expect(formatInterval(90 * DAY)).toBe('3 Mon');
    expect(formatInterval(400 * DAY)).toBe('1,1 J');
  });
});
