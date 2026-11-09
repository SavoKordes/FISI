import type { Card, CardFile } from './schema';

// Inhalte werden zur Build-Zeit gebündelt (und vom Service Worker offline gecacht).
// Die Validierung gegen das Zod-Schema läuft in scripts/validate-content.ts und in den Tests.
const files = import.meta.glob<CardFile>('./**/*.json', { eager: true, import: 'default' });

export function flattenFiles(fileList: CardFile[]): Card[] {
  return fileList.flatMap((f) =>
    f.cards.map((c) => ({ ...c, area: f.area, topic: f.topic, source: 'builtin' as const })),
  );
}

export const BUILTIN_CARDS: Card[] = flattenFiles(Object.values(files)).sort((a, b) =>
  a.id.localeCompare(b.id),
);
