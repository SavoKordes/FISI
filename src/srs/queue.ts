import type { Area, Card, Relevance } from '../content/schema';
import type { CardStateRow, ReviewLogRow } from '../db/db';
import { isDue, isNew, isWeak, retrievability } from './fsrs';

export const DAY_MS = 86_400_000;

export type CardFilter = {
  areas?: Area[];
  topics?: string[];
  difficulty?: (1 | 2 | 3)[];
  relevance?: Relevance[];
  weakOnly?: boolean;
  starredOnly?: boolean;
  search?: string;
};

export function matchesFilter(card: Card, state: CardStateRow | undefined, f: CardFilter): boolean {
  if (f.areas?.length && !f.areas.includes(card.area)) return false;
  if (f.topics?.length && !f.topics.includes(card.topic)) return false;
  if (f.difficulty?.length && !f.difficulty.includes(card.difficulty)) return false;
  if (f.relevance?.length && !f.relevance.includes(card.examRelevance)) return false;
  if (f.weakOnly && !isWeak(state?.fsrs)) return false;
  if (f.starredOnly && !state?.starred) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${card.front}\n${card.back}\n${card.topic}\n${card.tags?.join(' ') ?? ''}\n${card.id}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Fehlerquote je Thema (Anteil "Nochmal"/"Schwer" an den Bewertungen), geglättet */
export function topicFailRates(logs: ReviewLogRow[]): Map<string, number> {
  const agg = new Map<string, { bad: number; n: number }>();
  for (const l of logs) {
    const a = agg.get(l.topic) ?? { bad: 0, n: 0 };
    a.n++;
    if (l.rating === 1) a.bad += 1;
    else if (l.rating === 2) a.bad += 0.5;
    agg.set(l.topic, a);
  }
  const out = new Map<string, number>();
  // Bayes-Glättung: 2 Pseudo-Bewertungen mit Quote 0,2
  for (const [t, a] of agg) out.set(t, (a.bad + 0.4) / (a.n + 2));
  return out;
}

export type Endspurt = { active: boolean; daysLeft: number; intensity: number };

/** Prüfungsendspurt: aktiv in den letzten 60 Tagen vor dem Prüfungstermin */
export function endspurt(examDate: string | null, now: number): Endspurt {
  if (!examDate) return { active: false, daysLeft: Infinity, intensity: 0 };
  const exam = new Date(examDate + 'T08:00:00').getTime();
  const daysLeft = Math.ceil((exam - now) / DAY_MS);
  if (daysLeft < 0 || daysLeft > 60) return { active: false, daysLeft, intensity: 0 };
  return { active: true, daysLeft, intensity: Math.min(1, Math.max(0, 1 - daysLeft / 60)) };
}

const REL_WEIGHT: Record<Relevance, number> = { hoch: 3, mittel: 2, niedrig: 1 };

/** Priorität im Endspurt: hohe Relevanz und schwache Themen nach vorn */
export function priority(card: Card, failRate: number, e: Endspurt): number {
  const rel = Math.pow(REL_WEIGHT[card.examRelevance], 0.5 + e.intensity);
  return rel * (1 + 3 * e.intensity * failRate);
}

export type QueueInput = {
  cards: Card[];
  states: Map<string, CardStateRow>;
  filter?: CardFilter;
  newLimit: number;
  now: number;
  examDate?: string | null;
  failRates?: Map<string, number>;
};

export type Queue = { due: Card[]; fresh: Card[]; early: Card[]; endspurt: Endspurt };

/** Neue Karten nach Bereich abwechselnd mischen (Interleaving), innerhalb nach Relevanz */
function interleave(cards: Card[], score: (c: Card) => number): Card[] {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const g = groups.get(c.area) ?? [];
    g.push(c);
    groups.set(c.area, g);
  }
  for (const g of groups.values())
    g.sort((a, b) => score(b) - score(a) || a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  const lists = [...groups.values()];
  const out: Card[] = [];
  for (let i = 0; out.length < cards.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export function buildQueue(input: QueueInput): Queue {
  const { cards, states, filter = {}, newLimit, now, failRates = new Map() } = input;
  const e = endspurt(input.examDate ?? null, now);
  const rate = (c: Card) => failRates.get(c.topic) ?? 0.2;
  const score = (c: Card) => (e.active ? priority(c, rate(c), e) : REL_WEIGHT[c.examRelevance]);

  const pool = cards.filter((c) => matchesFilter(c, states.get(c.id), filter));

  const due = pool.filter((c) => isDue(states.get(c.id)?.fsrs, now));
  if (e.active) {
    due.sort((a, b) => score(b) - score(a) || states.get(a.id)!.fsrs!.due - states.get(b.id)!.fsrs!.due);
  } else {
    due.sort((a, b) => states.get(a.id)!.fsrs!.due - states.get(b.id)!.fsrs!.due);
  }

  let freshPool = pool.filter((c) => isNew(states.get(c.id)?.fsrs));
  if (e.active && e.daysLeft <= 14) {
    const important = freshPool.filter((c) => c.examRelevance !== 'niedrig');
    if (important.length) freshPool = important;
  }
  const fresh = interleave(freshPool, score).slice(0, Math.max(0, newLimit));

  // Endspurt: wichtige Karten mit sinkender Abrufwahrscheinlichkeit vorziehen
  let early: Card[] = [];
  if (e.active && e.daysLeft <= 21) {
    early = pool
      .filter((c) => {
        const f = states.get(c.id)?.fsrs;
        return c.examRelevance === 'hoch' && f && !isNew(f) && !isDue(f, now) && retrievability(f, now) < 0.85;
      })
      .sort((a, b) => retrievability(states.get(a.id)!.fsrs, now) - retrievability(states.get(b.id)!.fsrs, now))
      .slice(0, 15);
  }

  return { due, fresh, early, endspurt: e };
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Anzahl heute eingeführter neuer Karten */
export function newIntroducedToday(logs: ReviewLogRow[], now: number): number {
  const sod = startOfDay(now);
  return new Set(logs.filter((l) => l.ts >= sod && l.prevState === 0 && !l.cram).map((l) => l.cardId)).size;
}

/** Lern-Serie: aufeinanderfolgende Tage mit mind. einer Bewertung (heute oder gestern endend) */
export function streak(activityDays: Iterable<string>, now: number): number {
  const days = new Set(activityDays);
  let d = new Date(startOfDay(now));
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d.getTime()))) {
    n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return n;
}

/** Grobe Lernzeit in Minuten: Wiederholung ~10 s, neue Karte ~25 s */
export function estimateMinutes(dueCount: number, newCount: number): number {
  return Math.ceil((dueCount * 10 + newCount * 25) / 60);
}
