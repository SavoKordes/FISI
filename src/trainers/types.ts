import type { Rng } from './lib/rng';

export type Level = 1 | 2 | 3;

export type FieldKind =
  | 'number' // Zahl mit Toleranz (Dezimalkomma erlaubt)
  | 'ipv4' // IPv4-Adresse
  | 'cidr' // IPv4-Netz mit Präfix, z. B. 192.168.1.0/26
  | 'ipv6' // IPv6-Adresse, jede gültige Schreibweise
  | 'ipv6short' // IPv6 maximal gekürzt (jede maximal kurze Schreibweise)
  | 'ipv6full' // IPv6 vollständig ausgeschrieben (8 × 4 Hex-Ziffern)
  | 'ipv6prefix' // IPv6-Präfix mit Länge, z. B. 2001:db8:1::/64
  | 'hexgroups' // Hex-Gruppen mit Doppelpunkt, führende Nullen egal (Interface-ID)
  | 'bin' // Binärzahl (Leerzeichen/führende Nullen egal)
  | 'hex' // Hexadezimalzahl (0x/h, Groß-/Kleinschreibung egal)
  | 'choice' // Auswahl aus options
  | 'path'; // Folge von Bezeichnern, z. B. A-C-E

export type Tolerance = { abs?: number; rel?: number };

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  /** kanonische richtige Antwort (Anzeige) */
  answer: string;
  /** Zahlwert bei kind=number */
  value?: number;
  tolerance?: Tolerance;
  unit?: string;
  options?: string[];
  placeholder?: string;
};

export type Task = {
  trainer: string;
  type: string;
  level: Level;
  seed: number;
  title: string;
  /** Aufgabenstellung (Markdown) */
  prompt: string;
  fields: Field[];
  /** ausführlicher Rechenweg (Markdown) */
  solution: string;
  /** optionale Hinweise zur Rundung/Toleranz */
  note?: string;
};

export type TaskType = {
  id: string;
  label: string;
  gen: (rng: Rng, level: Level) => Omit<Task, 'trainer' | 'type' | 'level' | 'seed'>;
};

export type Trainer = {
  id: string;
  title: string;
  short: string;
  description: string;
  levels: Record<Level, string>;
  types: TaskType[];
};
