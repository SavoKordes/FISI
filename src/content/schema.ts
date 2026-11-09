import { z } from 'zod';

/**
 * Inhalts-Schema. Eine JSON-Datei pro Thema:
 *   { "area": "NET", "topic": "IPv6", "cards": [ ... ] }
 * area/topic stehen einmal pro Datei und werden in jede Karte übernommen.
 *
 * Kartentypen:
 *  - qa      Frage → Musterlösung
 *  - cloze   Lückentext: Lücken in `front` als {{Lösung}} schreiben
 *  - mc      Multiple Choice: `choices` + `correct` (0-basierte Indizes), optional `explanation`
 *  - order   Reihenfolge: `choices` stehen in der RICHTIGEN Reihenfolge, die App mischt sie
 *  - compare Vergleich A vs. B, Musterlösung meist als Markdown-Tabelle
 */

import { AREAS, CARD_TYPES, RELEVANCE } from './constants';

export { AREAS, CARD_TYPES, RELEVANCE };

export const areaSchema = z.enum(AREAS);

const idPattern = /^(ka|net|wiso|proj)-[a-z0-9]+(-[a-z0-9]+)*-\d{2,3}$/;

export const cardBodySchema = z
  .object({
    id: z.string().regex(idPattern, 'ID muss wie "net-ipv6-slaac-01" aufgebaut sein'),
    type: z.enum(CARD_TYPES),
    front: z.string().min(5),
    back: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).optional(),
    correct: z.array(z.number().int().min(0)).min(1).optional(),
    explanation: z.string().optional(),
    points: z.number().int().min(1).max(30).optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(z.string().min(1)).optional(),
    asOf: z.string().regex(/^\d{4}(-\d{2})?$/).optional(),
    examRelevance: z.enum(RELEVANCE),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.type === 'mc') {
      if (!c.choices || !c.correct) {
        ctx.addIssue({ code: 'custom', message: 'mc-Karten brauchen choices und correct' });
      } else if (c.correct.some((i) => i >= c.choices!.length)) {
        ctx.addIssue({ code: 'custom', message: 'correct verweist auf nicht vorhandene Antwort' });
      }
    }
    if (c.type === 'order' && (!c.choices || c.choices.length < 3)) {
      ctx.addIssue({ code: 'custom', message: 'order-Karten brauchen mind. 3 choices (in richtiger Reihenfolge)' });
    }
    if (c.type === 'cloze' && !/\{\{[^}]+\}\}/.test(c.front)) {
      ctx.addIssue({ code: 'custom', message: 'cloze-Karten brauchen mind. eine {{Lücke}} in front' });
    }
    if (c.tags?.includes('jahreswert') && !c.asOf) {
      ctx.addIssue({ code: 'custom', message: 'Karten mit Tag "jahreswert" brauchen asOf (Stand)' });
    }
  });

export const cardFileSchema = z
  .object({
    area: areaSchema,
    topic: z.string().min(2),
    cards: z.array(cardBodySchema).min(1),
  })
  .strict();

export type Area = z.infer<typeof areaSchema>;
export type CardType = (typeof CARD_TYPES)[number];
export type Relevance = (typeof RELEVANCE)[number];
export type CardBody = z.infer<typeof cardBodySchema>;
export type CardFile = z.infer<typeof cardFileSchema>;

export type CardSource = 'builtin' | 'ai' | 'user';

/** Karte, wie sie in der App verwendet wird */
export type Card = CardBody & {
  area: Area;
  topic: string;
  source: CardSource;
};
