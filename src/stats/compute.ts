import type { Area, Card } from '../content/schema';
import type { CardStateRow, ReviewLogRow, TrainerLogRow } from '../db/db';
import { isNew } from '../srs/fsrs';
import { dayKey, startOfDay } from '../srs/queue';

export type Quote = { n: number; ok: number; rate: number };
const quote = (n: number, ok: number): Quote => ({ n, ok, rate: n ? ok / n : 0 });
/** „Gut“ oder „Einfach“ zählt als gewusst */
const good = (l: ReviewLogRow) => l.rating >= 3;

export function quoteBy<K extends string>(logs: ReviewLogRow[], key: (l: ReviewLogRow) => K): Map<K, Quote> {
  const m = new Map<K, { n: number; ok: number }>();
  for (const l of logs) {
    const k = key(l);
    const e = m.get(k) ?? { n: 0, ok: 0 };
    e.n++;
    if (good(l)) e.ok++;
    m.set(k, e);
  }
  return new Map([...m].map(([k, v]) => [k, quote(v.n, v.ok)]));
}

export type TopicRow = { topic: string; area: Area; total: number; learned: number; q: Quote };

export function topicRows(cards: Card[], states: Map<string, CardStateRow>, logs: ReviewLogRow[]): TopicRow[] {
  const q = quoteBy(logs, (l) => l.topic);
  const m = new Map<string, TopicRow>();
  for (const c of cards) {
    const r = m.get(c.topic) ?? { topic: c.topic, area: c.area, total: 0, learned: 0, q: q.get(c.topic) ?? quote(0, 0) };
    r.total++;
    if (!isNew(states.get(c.id)?.fsrs)) r.learned++;
    m.set(c.topic, r);
  }
  return [...m.values()];
}

/** schwächste Themen: mindestens minN Bewertungen, nach Quote aufsteigend */
export function weakestTopics(rows: TopicRow[], minN = 3, limit = 10): TopicRow[] {
  return rows
    .filter((r) => r.q.n >= minN)
    .sort((a, b) => a.q.rate - b.q.rate || b.q.n - a.q.n)
    .slice(0, limit);
}

/** Aktivität je Tag (Kartenbewertungen + Rechenaufgaben) */
export function activityByDay(logs: ReviewLogRow[], trainer: TrainerLogRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) m.set(dayKey(l.ts), (m.get(dayKey(l.ts)) ?? 0) + 1);
  for (const t of trainer) m.set(dayKey(t.ts), (m.get(dayKey(t.ts)) ?? 0) + 1);
  return m;
}

/** Heatmap-Raster: Spalten = Wochen (Mo–So), endet mit der aktuellen Woche */
export function heatmapWeeks(weeks: number, now: number): { key: string; ts: number; future: boolean }[][] {
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7; // Mo = 0
  const monday = new Date(today);
  monday.setDate(monday.getDate() - dow - (weeks - 1) * 7);
  const cols: { key: string; ts: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      // über Datumsobjekt statt Millisekunden addieren (Sommer-/Winterzeit)
      const date = new Date(monday);
      date.setDate(date.getDate() + w * 7 + d);
      const ts = date.getTime();
      col.push({ key: dayKey(ts), ts, future: ts > today });
    }
    cols.push(col);
  }
  return cols;
}

/** Intensitätsstufe 0–4 */
export function level(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 25) return 2;
  if (count < 50) return 3;
  return 4;
}

