import Dexie, { type EntityTable } from 'dexie';
import type { Area, Card } from '../content/schema';

/** FSRS-Kartenzustand, Datumswerte als Millisekunden (JSON-/Export-freundlich) */
export type FsrsData = {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: number;
};

export type CardStateRow = {
  id: string; // Karten-ID
  fsrs?: FsrsData;
  starred?: boolean;
  note?: string;
  updatedAt: number;
};

export type ReviewLogRow = {
  id?: number;
  cardId: string;
  area: Area;
  topic: string;
  rating: 1 | 2 | 3 | 4; // Nochmal / Schwer / Gut / Einfach
  prevState: number; // FSRS-State vor der Bewertung (0 = neu)
  ts: number;
  durationMs: number;
  cram?: boolean; // freies Üben ohne Planung
};

export type TrainerLogRow = {
  id?: number;
  trainer: string;
  task: string;
  level: number;
  seed: number;
  correct: boolean;
  ts: number;
  durationMs: number;
};

export type ReportRow = { id?: number; cardId: string; text: string; ts: number };

export type CustomCardRow = Card & { createdAt: number };

export type SettingRow = { key: string; value: unknown };

export type ChecklistRow = { id: string; done: boolean; ts: number };

export type ExamResultRow = {
  id?: number;
  kind: 'WISO' | 'KA' | 'NET';
  ts: number;
  points: number;
  maxPoints: number;
  durationMs: number;
  details?: unknown;
};

export class FisiDB extends Dexie {
  cardState!: EntityTable<CardStateRow, 'id'>;
  reviewLog!: EntityTable<ReviewLogRow, 'id'>;
  trainerLog!: EntityTable<TrainerLogRow, 'id'>;
  reports!: EntityTable<ReportRow, 'id'>;
  customCards!: EntityTable<CustomCardRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  checklist!: EntityTable<ChecklistRow, 'id'>;
  examResults!: EntityTable<ExamResultRow, 'id'>;

  constructor(name = 'fisi-trainer') {
    super(name);
    this.version(1).stores({
      cardState: 'id, updatedAt',
      reviewLog: '++id, cardId, ts, area, topic',
      trainerLog: '++id, trainer, ts',
      reports: '++id, cardId, ts',
      customCards: 'id, area, topic, createdAt',
      settings: 'key',
      checklist: 'id',
      examResults: '++id, kind, ts',
    });
  }
}

export const db = new FisiDB();

export const TABLES = [
  'cardState',
  'reviewLog',
  'trainerLog',
  'reports',
  'customCards',
  'settings',
  'checklist',
  'examResults',
] as const;
export type TableName = (typeof TABLES)[number];
