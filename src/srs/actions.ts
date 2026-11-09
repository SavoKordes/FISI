import type { Card } from '../content/schema';
import { db } from '../db/db';
import { review, type AppRating } from './fsrs';

export async function gradeCard(card: Card, rating: AppRating, durationMs: number, cram = false, now = Date.now()) {
  await db.transaction('rw', db.cardState, db.reviewLog, async () => {
    const prev = await db.cardState.get(card.id);
    const prevState = prev?.fsrs?.state ?? 0;
    if (!cram) {
      const fsrs = review(prev?.fsrs, rating, now);
      await db.cardState.put({ ...(prev ?? { id: card.id }), id: card.id, fsrs, updatedAt: now });
    }
    await db.reviewLog.add({
      cardId: card.id,
      area: card.area,
      topic: card.topic,
      rating,
      prevState,
      ts: now,
      durationMs: Math.min(durationMs, 5 * 60_000),
      ...(cram ? { cram: true } : {}),
    });
  });
}

export async function toggleStar(cardId: string) {
  const prev = await db.cardState.get(cardId);
  await db.cardState.put({ ...(prev ?? { id: cardId }), id: cardId, starred: !prev?.starred, updatedAt: Date.now() });
}

export async function saveNote(cardId: string, note: string) {
  const prev = await db.cardState.get(cardId);
  await db.cardState.put({ ...(prev ?? { id: cardId }), id: cardId, note: note.trim() || undefined, updatedAt: Date.now() });
}

export async function reportCard(cardId: string, text: string) {
  await db.reports.add({ cardId, text: text.trim(), ts: Date.now() });
}

/** Lernstand einer Karte zurücksetzen (Karte gilt wieder als neu) */
export async function resetCard(cardId: string) {
  const prev = await db.cardState.get(cardId);
  if (prev) await db.cardState.put({ ...prev, fsrs: undefined, updatedAt: Date.now() });
}
