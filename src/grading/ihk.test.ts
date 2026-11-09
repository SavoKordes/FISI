import { describe, expect, it } from 'vitest';
import { ap2Points, combinedSupplement, evaluate, gradeFromPoints, projectPoints, supplementOptions, totalPoints, type Scores } from './ihk';

const base: Scores = { ap1: 70, doku: 80, praesentation: 80, fachgespraech: 80, ka: 70, net: 70, wiso: 70 };

describe('IHK-Notenschlüssel', () => {
  it('Grenzwerte', () => {
    expect([100, 92, 91.99, 81, 80.99, 67, 66.99, 50, 49.99, 30, 29.99, 0].map(gradeFromPoints)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
});

describe('Gewichtung', () => {
  it('Gewichte ergeben 100 % (gleiche Punkte überall → gleiches Gesamtergebnis)', () => {
    const s: Scores = { ap1: 73, doku: 73, praesentation: 73, fachgespraech: 73, ka: 73, net: 73, wiso: 73 };
    expect(totalPoints(s)).toBeCloseTo(73, 10);
    expect(ap2Points(s)).toBeCloseTo(73, 10);
  });
  it('Projekt = Doku 50 %, Präsentation 25 %, Fachgespräch 25 %', () => {
    expect(projectPoints({ doku: 80, praesentation: 60, fachgespraech: 100 })).toBeCloseTo(80, 10);
  });
  it('Beispielrechnung von Hand', () => {
    const s: Scores = { ap1: 60, doku: 90, praesentation: 70, fachgespraech: 50, ka: 55, net: 65, wiso: 80 };
    // Gesamt = 0,2·60 + 0,25·90 + 0,125·70 + 0,125·50 + 0,1·(55+65+80) = 12 + 22,5 + 8,75 + 6,25 + 20 = 69,5
    expect(totalPoints(s)).toBeCloseTo(69.5, 10);
    // Teil 2 = (69,5 − 12) / 0,8 = 71,875
    expect(ap2Points(s)).toBeCloseTo(71.875, 10);
  });
});

describe('Bestehensregeln', () => {
  it('besteht im Normalfall', () => {
    const e = evaluate(base);
    expect(e.passed).toBe(true);
    expect(e.total).toBeCloseTo(75, 10); // 0,2·70 + 0,5·80 + 0,3·70
    expect(e.grade).toBe(3);
  });
  it('ein Bereich unter 30 → durchgefallen, auch bei gutem Schnitt', () => {
    const e = evaluate({ ...base, wiso: 25 });
    expect(e.total).toBeGreaterThan(50);
    expect(e.passed).toBe(false);
    expect(e.checks.find((c) => c.id === 'none30')!.ok).toBe(false);
  });
  it('nur 2 Bereiche ≥ 50 → durchgefallen', () => {
    const e = evaluate({ ...base, ka: 45, net: 40 });
    expect(e.checks.find((c) => c.id === 'three')!.ok).toBe(false);
    expect(e.passed).toBe(false);
  });
  it('ein Bereich unter 50 (aber ≥ 30) ist erlaubt', () => {
    expect(evaluate({ ...base, ka: 40 }).passed).toBe(true);
  });
  it('Teil 2 unter 50 → durchgefallen, auch wenn AP1 sehr gut ist', () => {
    const s: Scores = { ap1: 100, doku: 48, praesentation: 48, fachgespraech: 48, ka: 50, net: 50, wiso: 50 };
    const e = evaluate(s);
    expect(e.ap2).toBeLessThan(50);
    expect(e.passed).toBe(false);
  });
});

describe('Mündliche Ergänzungsprüfung', () => {
  it('Gewichtung 2:1', () => {
    expect(combinedSupplement(40, 70)).toBe(50);
  });
  it('liefert die minimal nötigen Punkte und den sinnvollsten Bereich zuerst', () => {
    const s: Scores = { ...base, ka: 45, net: 40 };
    const opts = supplementOptions(s);
    expect(opts.map((o) => o.area)).toEqual(['ka', 'net']);
    // KA: (2·45 + x)/3 ≥ 50 → x ≥ 60
    expect(opts[0].needed).toBe(60);
    // Probe: mit 60 bestanden, mit 59 nicht
    expect(evaluate({ ...s, ka: combinedSupplement(45, 60) }).passed).toBe(true);
    expect(evaluate({ ...s, ka: combinedSupplement(45, 59) }).passed).toBe(false);
  });
  it('keine Optionen, wenn bereits bestanden; nicht erreichbar bei zu großer Lücke', () => {
    expect(supplementOptions(base)).toEqual([]);
    const hopeless: Scores = { ap1: 30, doku: 30, praesentation: 30, fachgespraech: 30, ka: 10, net: 10, wiso: 10 };
    expect(supplementOptions(hopeless).every((o) => o.needed === null)).toBe(true);
  });
});
