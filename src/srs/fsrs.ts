import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FCard,
  type Grade,
} from 'ts-fsrs';
import type { FsrsData } from '../db/db';

/** Bewertungen in der App: 1 Nochmal, 2 Schwer, 3 Gut, 4 Einfach */
export type AppRating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<AppRating, string> = {
  1: 'Nochmal',
  2: 'Schwer',
  3: 'Gut',
  4: 'Einfach',
};

export const STATE_LABELS = ['Neu', 'Lernen', 'Wiederholen', 'Neu lernen'] as const;

const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});
const scheduler = fsrs(params);

const toGrade = (r: AppRating): Grade => [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy][r - 1] as Grade;

export function toFsrsCard(d: FsrsData): FCard {
  return {
    ...d,
    state: d.state as State,
    due: new Date(d.due),
    last_review: d.last_review !== undefined ? new Date(d.last_review) : undefined,
  };
}

export function fromFsrsCard(c: FCard): FsrsData {
  const d: FsrsData = {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
  };
  if (c.last_review) d.last_review = c.last_review.getTime();
  return d;
}

export function newCardData(now: number = Date.now()): FsrsData {
  return fromFsrsCard(createEmptyCard(new Date(now)));
}

/** Bewertet eine Karte und liefert den neuen Zustand */
export function review(current: FsrsData | undefined, rating: AppRating, now: number = Date.now()): FsrsData {
  const card = toFsrsCard(current ?? newCardData(now));
  const { card: next } = scheduler.next(card, new Date(now), toGrade(rating));
  return fromFsrsCard(next);
}

/** Vorschau der nächsten Fälligkeit je Bewertung (für die Buttons) */
export function previewIntervals(current: FsrsData | undefined, now: number = Date.now()): Record<AppRating, number> {
  const card = toFsrsCard(current ?? newCardData(now));
  const p = scheduler.repeat(card, new Date(now));
  const out = {} as Record<AppRating, number>;
  for (const r of [1, 2, 3, 4] as AppRating[]) out[r] = p[toGrade(r)].card.due.getTime() - now;
  return out;
}

/** Abrufwahrscheinlichkeit (0..1); neue Karten → 0 */
export function retrievability(d: FsrsData | undefined, now: number = Date.now()): number {
  if (!d || d.state === State.New) return 0;
  return scheduler.get_retrievability(toFsrsCard(d), new Date(now), false);
}

export function isDue(d: FsrsData | undefined, now: number = Date.now()): boolean {
  return !!d && d.state !== State.New && d.due <= now;
}

export function isNew(d: FsrsData | undefined): boolean {
  return !d || d.state === State.New;
}

/** "Schwach": schon einmal vergessen oder hohe FSRS-Schwierigkeit */
export function isWeak(d: FsrsData | undefined): boolean {
  return !!d && d.state !== State.New && (d.lapses > 0 || d.difficulty >= 7);
}

export function formatInterval(ms: number): string {
  if (ms < 60000) return '<1 Min';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} Std`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} T`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} Mon`;
  return `${(d / 365).toFixed(1).replace('.', ',')} J`;
}
