import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
  newPerDay: number;
  examDate: string | null; // ISO-Datum (YYYY-MM-DD) der schriftlichen AP2
  theme: Theme;
  aiEnabled: boolean;
  apiKey: string;
  aiModel: string;
  aiBaseUrl: string; // für späteren eigenen Proxy
  projectSummary: string;
};

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  examDate: null,
  theme: 'system',
  aiEnabled: false,
  apiKey: '',
  aiModel: 'claude-sonnet-5-5',
  aiBaseUrl: 'https://api.anthropic.com',
  projectSummary: '',
};

/** Diese Schlüssel werden beim Export NICHT mitgesichert */
export const PRIVATE_SETTING_KEYS: (keyof Settings)[] = ['apiKey'];

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  return s as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value });
  if (key === 'theme') applyTheme(value as Theme);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem('fisi-theme', theme);
  } catch {
    /* privat-Modus */
  }
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  // Farbe der Browser-/Statusleiste passend zum Theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#f8fafc');
}
