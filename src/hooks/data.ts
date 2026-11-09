import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { BUILTIN_CARDS } from '../content';
import type { Card } from '../content/schema';
import { db, type CardStateRow, type ReviewLogRow } from '../db/db';

/** Alle Karten: eingebaute + eigene/KI-generierte */
export function useAllCards(): Card[] {
  const custom = useLiveQuery(() => db.customCards.toArray(), []);
  return useMemo(() => {
    if (!custom?.length) return BUILTIN_CARDS;
    const ids = new Set(BUILTIN_CARDS.map((c) => c.id));
    const extra = custom.filter((c) => !ids.has(c.id)).map(({ createdAt: _c, ...card }) => card as Card);
    return [...BUILTIN_CARDS, ...extra];
  }, [custom]);
}

export function useCardStates(): Map<string, CardStateRow> | undefined {
  const rows = useLiveQuery(() => db.cardState.toArray(), []);
  return useMemo(() => (rows ? new Map(rows.map((r) => [r.id, r])) : undefined), [rows]);
}

export function useReviewLogs(sinceTs = 0): ReviewLogRow[] | undefined {
  return useLiveQuery(() => db.reviewLog.where('ts').aboveOrEqual(sinceTs).toArray(), [sinceTs]);
}

export function useTopics(cards: Card[]) {
  return useMemo(() => {
    const m = new Map<string, { area: Card['area']; count: number }>();
    for (const c of cards) {
      const e = m.get(c.topic);
      if (e) e.count++;
      else m.set(c.topic, { area: c.area, count: 1 });
    }
    return [...m.entries()]
      .map(([topic, v]) => ({ topic, ...v }))
      .sort((a, b) => a.area.localeCompare(b.area) || a.topic.localeCompare(b.topic, 'de'));
  }, [cards]);
}
