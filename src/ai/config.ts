/** Reine Konfigurationslogik (ohne SDK-Import) – testbar und klein */

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_BASE_URL = 'https://api.anthropic.com';

export const MODEL_SUGGESTIONS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 – Standard, gutes Preis-Leistungs-Verhältnis' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 – gründlicher, teurer' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 – sehr schnell und günstig' },
];

/** Modelle, für die der Server bei Ablehnung (refusal) automatisch auf ein Ersatzmodell ausweicht */
const SERVER_FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

export function isDirectAnthropic(baseUrl: string): boolean {
  try {
    return new URL(baseUrl || DEFAULT_BASE_URL).hostname === 'api.anthropic.com';
  } catch {
    return false;
  }
}

/** Server-seitiger Fallback nur direkt bei Anthropic und nur für Modelle, die ihn unterstützen */
export function useServerFallback(model: string, baseUrl: string): boolean {
  return isDirectAnthropic(baseUrl) && SERVER_FALLBACK_MODELS.has(model.trim());
}

export type AiSettingsLike = { aiEnabled: boolean; apiKey: string; aiModel: string; aiBaseUrl: string };

/** KI nutzbar? Mit eigenem Proxy (andere Basis-URL) ist kein Key im Browser nötig. */
export function aiReady(s: AiSettingsLike | undefined): boolean {
  if (!s?.aiEnabled || !s.aiModel.trim()) return false;
  return !!s.apiKey.trim() || !isDirectAnthropic(s.aiBaseUrl);
}

/** Punkte aus der Bewertung lesen: erwartet eine Zeile „Punkte: 3 von 4“ */
export function parsePoints(text: string): { got: number; max: number } | null {
  const m = text.match(/Punkte:\s*\**\s*(\d+(?:[.,]\d+)?)\s*\**\s*(?:von|\/)\s*\**\s*(\d+)/i);
  if (!m) return null;
  const got = Number(m[1].replace(',', '.'));
  const max = Number(m[2]);
  if (!Number.isFinite(got) || !max || got > max) return null;
  return { got, max };
}
