import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/db';
import { setSetting } from '../db/settings';
import { generateJson, streamChat, toAiError } from './aiClient';

function sse(events: object[]): Response {
  const body = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}

function textStream(parts: string[], stopReason = 'end_turn') {
  return sse([
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...parts.map((t) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

let calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];

function mockFetch(responder: () => Response) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });
    return responder();
  });
}

describe('KI-Client (SDK, gemockte API)', () => {
  beforeEach(async () => {
    calls = [];
    await db.settings.clear();
    await setSetting('aiEnabled', true);
    await setSetting('apiKey', 'sk-ant-test');
    await setSetting('aiModel', 'claude-sonnet-5-5');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('streamt Text, sendet Browser-Header, Key und serverseitigen Fallback', async () => {
    mockFetch(() => textStream(['Hallo ', 'Prüfling', '!']));
    const seen: string[] = [];
    const r = await streamChat({ system: 'S', messages: [{ role: 'user', content: 'Hi' }], onText: (t) => seen.push(t) });
    expect(r.text).toBe('Hallo Prüfling!');
    expect(seen.at(-1)).toBe('Hallo Prüfling!');
    expect(seen.length).toBe(3);
    const c = calls[0];
    expect(c.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    expect(c.headers.get('authorization')).toBe('Bearer sk-ant-test'); // SDK 1.x sendet den Key als Bearer
    expect(c.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(c.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(c.body).toMatchObject({ model: 'claude-sonnet-5-5', system: 'S', stream: true, fallbacks: 'default', output_config: { effort: 'low' } });
    expect(c.body).not.toHaveProperty('temperature');
  });

  it('ohne Fallback bei eigenem Proxy und anderem Modell', async () => {
    await setSetting('aiBaseUrl', 'https://proxy.example/claude');
    await setSetting('aiModel', 'claude-haiku-5-5');
    mockFetch(() => textStream(['ok']));
    await streamChat({ system: 'S', messages: [{ role: 'user', content: 'Hi' }] });
    expect(calls[0].url).toMatch(/^https:\/\/proxy\.example\/claude\/v1\/messages/);
    expect(calls[0].body).not.toHaveProperty('fallbacks');
    expect(calls[0].headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('Ablehnung (refusal) wird als verständlicher Fehler gemeldet', async () => {
    mockFetch(() => textStream([], 'refusal'));
    await expect(streamChat({ system: 'S', messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({ kind: 'refusal' });
  });

  it('ungültiger Key → deutsche Meldung, ohne Wiederholungen', async () => {
    mockFetch(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    await expect(streamChat({ system: 'S', messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({ kind: 'auth' });
    expect(calls.length).toBe(1);
  });

  it('KI ausgeschaltet → Konfigurationsfehler ohne Netzaufruf', async () => {
    await setSetting('aiEnabled', false);
    mockFetch(() => textStream(['x']));
    await expect(streamChat({ system: 'S', messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({ kind: 'config' });
    expect(calls.length).toBe(0);
  });

  it('strukturierte Ausgabe: JSON-Schema wird gesendet und geparst', async () => {
    mockFetch(() => textStream(['{"tasks":[{"front":"F","back":"B",', '"points":4,"difficulty":2,"choices":[],"correct":[]}]}']));
    const r = await generateJson<{ tasks: { front: string }[] }>({ system: 'S', messages: [{ role: 'user', content: 'x' }], schema: { type: 'object' } });
    expect(r.tasks[0].front).toBe('F');
    expect(calls[0].body).toMatchObject({ output_config: { effort: 'medium', format: { type: 'json_schema', schema: { type: 'object' } } } });
  });
});

describe('Fehlerabbildung', () => {
  const gen = (status: number, type: string) => Anthropic.APIError.generate(status, { type: 'error', error: { type, message: 'm' } }, 'm', new Headers());
  it('ordnet HTTP-Fehler den Kategorien zu', () => {
    expect(toAiError(gen(401, 'authentication_error')).kind).toBe('auth');
    expect(toAiError(gen(404, 'not_found_error')).kind).toBe('model');
    expect(toAiError(gen(429, 'rate_limit_error')).kind).toBe('rate');
    expect(toAiError(gen(529, 'overloaded_error')).kind).toBe('overloaded');
    expect(toAiError(gen(400, 'invalid_request_error')).message).toMatch(/Ungültige Anfrage/);
    expect(toAiError(new Anthropic.APIConnectionError({ message: 'x' })).kind).toBe('network');
    expect(toAiError(new Anthropic.APIUserAbortError()).kind).toBe('aborted');
  });
});
