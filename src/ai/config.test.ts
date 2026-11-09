import { describe, expect, it } from 'vitest';
import { aiReady, isDirectAnthropic, parsePoints, useServerFallback } from './config';

describe('KI-Konfiguration', () => {
  it('erkennt direkte Anthropic-API vs. Proxy', () => {
    expect(isDirectAnthropic('https://api.anthropic.com')).toBe(true);
    expect(isDirectAnthropic('')).toBe(true);
    expect(isDirectAnthropic('https://ki.meinefirma.de/claude')).toBe(false);
    expect(isDirectAnthropic('kein url')).toBe(false);
  });
  it('serverseitiger Fallback nur für unterstützte Modelle direkt bei Anthropic', () => {
    expect(useServerFallback('claude-sonnet-5-5', 'https://api.anthropic.com')).toBe(true);
    expect(useServerFallback('claude-opus-5-5', '')).toBe(true);
    expect(useServerFallback('claude-haiku-5-5', 'https://api.anthropic.com')).toBe(false);
    expect(useServerFallback('claude-sonnet-5-5', 'https://proxy.example')).toBe(false);
  });
  it('KI bereit nur mit Key (oder Proxy) und eingeschaltet', () => {
    const base = { aiEnabled: true, apiKey: 'sk-ant-x', aiModel: 'claude-sonnet-5-5', aiBaseUrl: 'https://api.anthropic.com' };
    expect(aiReady(base)).toBe(true);
    expect(aiReady({ ...base, aiEnabled: false })).toBe(false);
    expect(aiReady({ ...base, apiKey: '' })).toBe(false);
    expect(aiReady({ ...base, apiKey: '', aiBaseUrl: 'https://proxy.example' })).toBe(true);
    expect(aiReady({ ...base, aiModel: ' ' })).toBe(false);
    expect(aiReady(undefined)).toBe(false);
  });
  it('liest die Punktzahl aus der Bewertung', () => {
    expect(parsePoints('**Punkte: 3 von 4**\n\nBewertung …')).toEqual({ got: 3, max: 4 });
    expect(parsePoints('Punkte: 2,5 von 6')).toEqual({ got: 2.5, max: 6 });
    expect(parsePoints('Punkte: **4** / **4**')).toEqual({ got: 4, max: 4 });
    expect(parsePoints('keine Angabe')).toBeNull();
    expect(parsePoints('Punkte: 7 von 4')).toBeNull();
  });
});
