import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from '../db/settings';
import { DEFAULT_BASE_URL, useServerFallback } from './config';

/**
 * Kleine Abstraktion über die Claude API.
 * - Direktaufruf aus dem Browser mit eigenem API-Key (liegt nur lokal in IndexedDB)
 * - oder über einen eigenen Proxy: Basis-URL in den Einstellungen ändern, der Proxy setzt den Key
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Effort = 'low' | 'medium' | 'high';

export type StreamOptions = {
  system: string;
  messages: ChatMessage[];
  effort?: Effort;
  maxTokens?: number;
  onText?: (fullText: string) => void;
  signal?: AbortSignal;
};

export type StreamResult = { text: string; stopReason: string | null; model: string };

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: 'auth' | 'rate' | 'network' | 'overloaded' | 'model' | 'refusal' | 'aborted' | 'config' | 'other',
  ) {
    super(message);
  }
}

async function client() {
  const s = await getSettings();
  const baseURL = (s.aiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!s.aiEnabled) throw new AiError('Die KI-Funktionen sind ausgeschaltet (Einstellungen → KI-Tutor).', 'config');
  return {
    settings: s,
    sdk: new Anthropic({
      // Beim eigenen Proxy darf der Key leer sein; das SDK verlangt aber einen Wert.
      apiKey: s.apiKey.trim() || 'proxy',
      baseURL,
      dangerouslyAllowBrowser: true, // setzt den Header anthropic-dangerous-direct-browser-access
      maxRetries: 2,
      timeout: 120_000,
    }),
  };
}

/** SDK-Fehler in verständliche deutsche Meldungen übersetzen (spezifischste zuerst) */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new AiError('Abgebrochen.', 'aborted');
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError('Der API-Key ist ungültig oder abgelaufen. Bitte in den Einstellungen prüfen.', 'auth');
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError('Keine Berechtigung für diese Anfrage (Key/Workspace prüfen).', 'auth');
  if (err instanceof Anthropic.NotFoundError)
    return new AiError('Modell nicht gefunden – bitte die Modell-ID in den Einstellungen prüfen.', 'model');
  if (err instanceof Anthropic.RateLimitError)
    return new AiError('Rate-Limit erreicht. Bitte einen Moment warten und erneut versuchen.', 'rate');
  if (err instanceof Anthropic.InternalServerError)
    return new AiError('Die Claude API ist gerade überlastet oder gestört. Bitte später erneut versuchen.', 'overloaded');
  if (err instanceof Anthropic.APIConnectionError)
    return new AiError(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'Keine Internetverbindung – die KI-Funktionen brauchen Netz (der Rest der App funktioniert offline).'
        : 'Keine Verbindung zur Claude API (Netzwerk, Proxy oder Basis-URL prüfen).',
      'network',
    );
  if (err instanceof Anthropic.APIError) {
    if (err.status === 402 || err.type === 'billing_error')
      return new AiError('Abrechnungsproblem beim API-Konto (Guthaben/Zahlungsmethode prüfen).', 'auth');
    if (err.status === 400) return new AiError(`Ungültige Anfrage: ${err.message}`, 'other');
    return new AiError(`API-Fehler ${err.status ?? ''}: ${err.message}`, 'other');
  }
  return new AiError(err instanceof Error ? err.message : String(err), 'other');
}

/** Antwort streamen; onText erhält jeweils den bisherigen Gesamttext */
export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  try {
    const { settings, sdk } = await client();
    const model = settings.aiModel.trim();
    const fallback = useServerFallback(model, settings.aiBaseUrl);
    const stream = sdk.beta.messages.stream(
      {
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        messages: opts.messages,
        output_config: { effort: opts.effort ?? 'low' },
        // Bei einer Ablehnung durch Sicherheitsfilter weicht der Server auf ein Ersatzmodell aus
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal: opts.signal },
    );
    let text = '';
    stream.on('text', (delta) => {
      text += delta;
      opts.onText?.(text);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new AiError('Claude hat diese Anfrage abgelehnt. Bitte anders formulieren.', 'refusal');
    }
    return { text, stopReason: final.stop_reason, model: final.model };
  } catch (err) {
    throw toAiError(err);
  }
}

/** Antwort als JSON nach Schema (strukturierte Ausgabe) */
export async function generateJson<T>(opts: Omit<StreamOptions, 'onText'> & { schema: Record<string, unknown> }): Promise<T> {
  try {
    const { settings, sdk } = await client();
    const model = settings.aiModel.trim();
    const fallback = useServerFallback(model, settings.aiBaseUrl);
    const stream = sdk.beta.messages.stream(
      {
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        messages: opts.messages,
        output_config: { effort: opts.effort ?? 'medium', format: { type: 'json_schema', schema: opts.schema } },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal: opts.signal },
    );
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new AiError('Claude hat diese Anfrage abgelehnt.', 'refusal');
    if (final.stop_reason === 'max_tokens') throw new AiError('Die Antwort wurde abgeschnitten. Bitte erneut versuchen.', 'other');
    const text = final.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AiError('Die Antwort war kein gültiges JSON. Bitte erneut versuchen.', 'other');
    }
  } catch (err) {
    throw toAiError(err);
  }
}

/** Verbindungstest für die Einstellungen */
export async function testConnection(): Promise<string> {
  const r = await streamChat({
    system: 'Antworte sehr kurz auf Deutsch.',
    messages: [{ role: 'user', content: 'Antworte nur mit: Verbindung erfolgreich.' }],
    maxTokens: 2000,
  });
  return `${r.text.trim()} (Modell: ${r.model})`;
}
