import type { Card } from '../content/schema';
import { db } from '../db/db';

/** Ergebnisse aus Tests/Simulationen als „freies Üben“ protokollieren (für Statistik, ohne FSRS-Planung) */
export async function logPractice(items: { card: Card; correct: boolean }[], durationMs: number) {
  const now = Date.now();
  const per = items.length ? Math.round(durationMs / items.length) : 0;
  await db.reviewLog.bulkAdd(
    items.map(({ card, correct }, i) => ({
      cardId: card.id,
      area: card.area,
      topic: card.topic,
      rating: (correct ? 3 : 1) as 1 | 3,
      prevState: 2,
      ts: now + i,
      durationMs: Math.min(per, 300_000),
      cram: true,
    })),
  );
}
