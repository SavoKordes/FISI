import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { setSetting, useSettings } from '../db/settings';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, isDirectAnthropic, MODEL_SUGGESTIONS } from '../ai/config';
import { Button, Panel } from './ui';

const input = 'w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700';

export function AiSettings() {
  const s = useSettings();
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [params] = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);
  const loaded = !!s;
  useEffect(() => {
    if (loaded && params.get('ki')) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loaded, params]);
  if (!s) return null;
  const direct = isDirectAnthropic(s.aiBaseUrl);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const { testConnection } = await import('../ai/aiClient');
      setTest({ ok: true, text: await testConnection() });
    } catch (e) {
      setTest({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div ref={ref} className="scroll-mt-20">
    <Panel className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">KI-Tutor (Claude API)</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5 accent-sky-600" checked={s.aiEnabled} onChange={(e) => setSetting('aiEnabled', e.target.checked)} />
          {s.aiEnabled ? 'an' : 'aus'}
        </label>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Optional: Erklärungen, Bewertung offener Antworten, neue Übungsaufgaben, Fachgespräch-Simulator und Präsentations-Coach. Die App funktioniert ohne KI vollständig.
      </p>

      {s.aiEnabled && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <b>Hinweis zum API-Key:</b> Der Key wird <b>nur auf diesem Gerät</b> im Browser gespeichert (IndexedDB), nie im Code oder im Backup-Export. Die App ruft die Claude API <b>direkt aus dem Browser</b> auf. Nutze einen eigenen Key mit Ausgabenlimit (console.anthropic.com) und gib das Gerät nicht unbeaufsichtigt weiter. Anfragen kosten Geld je nach Modell und Länge.
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ai-key">
              Anthropic-API-Key {direct ? '' : '(beim eigenen Proxy optional)'}
            </label>
            <div className="flex gap-2">
              <input
                id="ai-key"
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={s.apiKey}
                onChange={(e) => setSetting('apiKey', e.target.value.trim())}
                placeholder="sk-ant-…"
                className={`${input} font-mono`}
              />
              <Button variant="secondary" onClick={() => setShow(!show)}>
                {show ? 'Verbergen' : 'Zeigen'}
              </Button>
            </div>
            {s.apiKey && (
              <button type="button" className="mt-1 text-xs text-rose-600 hover:underline" onClick={() => confirm('API-Key von diesem Gerät löschen?') && setSetting('apiKey', '')}>
                Key von diesem Gerät löschen
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ai-model">
              Modell
            </label>
            <input id="ai-model" list="ai-models" value={s.aiModel} onChange={(e) => setSetting('aiModel', e.target.value)} placeholder={DEFAULT_MODEL} className={`${input} font-mono`} />
            <datalist id="ai-models">
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">
              Standard: <code>{DEFAULT_MODEL}</code>. Beliebige Modell-ID der Claude API möglich.{' '}
              {s.aiModel !== DEFAULT_MODEL && (
                <button type="button" className="text-sky-600 hover:underline dark:text-sky-400" onClick={() => setSetting('aiModel', DEFAULT_MODEL)}>
                  Zurücksetzen
                </button>
              )}
            </p>
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">Erweitert: eigener Proxy-Server</summary>
            <div className="mt-2">
              <label className="mb-1 block text-sm" htmlFor="ai-base">
                Basis-URL
              </label>
              <input id="ai-base" value={s.aiBaseUrl} onChange={(e) => setSetting('aiBaseUrl', e.target.value.trim())} placeholder={DEFAULT_BASE_URL} className={`${input} font-mono`} />
              <p className="mt-1 text-xs text-slate-500">
                Ein eigener Proxy (mit derselben Messages-API) kann den Key serverseitig setzen – dann muss im Browser kein Key liegen.
              </p>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runTest} disabled={testing}>
              {testing ? 'Teste …' : 'Verbindung testen'}
            </Button>
            {test && <span className={`text-sm ${test.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{test.text}</span>}
          </div>
        </div>
      )}
    </Panel>
    </div>
  );
}
