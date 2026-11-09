import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { setSetting, useSettings } from '../db/settings';
import { useAiChat } from '../ai/useAiChat';
import { useAiReady } from '../ai/useAi';
import { EXAM_FINISH, EXAM_START, examinerPrompt } from '../ai/prompts';
import { downloadText } from '../lib/download';
import { AiErrorBox, ChatInput, ChatLog } from '../components/AiChat';
import { Button, PageTitle, Panel } from '../components/ui';
import { IconClock } from '../components/icons';
import { Placeholder } from './Placeholder';

const DURATION = 15 * 60;

function Timer({ start, running }: { start: number; running: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const elapsed = Math.floor((now - start) / 1000);
  const left = DURATION - elapsed;
  const over = left < 0;
  const mm = String(Math.floor(Math.abs(left) / 60)).padStart(2, '0');
  const ss = String(Math.abs(left) % 60).padStart(2, '0');
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums ${over ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' : left < 120 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
      <IconClock className="h-4 w-4" />
      {over ? '+' : ''}
      {mm}:{ss}
    </span>
  );
}

export function AiExamPage() {
  const ready = useAiReady();
  const settings = useSettings();
  const [summary, setSummary] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const text = summary ?? settings?.projectSummary ?? '';
  const system = useMemo(() => examinerPrompt(text), [text]);
  const chat = useAiChat(system, 'medium');

  if (!ready) return <Placeholder title="KI-Tutor nicht eingerichtet" />;

  const start = async () => {
    await setSetting('projectSummary', text);
    setStartedAt(Date.now());
    setFinished(false);
    chat.restart(EXAM_START);
  };

  const finish = () => {
    setFinished(true);
    chat.send(EXAM_FINISH);
  };

  const transcript = () =>
    chat.messages.map((m) => `**${m.role === 'user' ? 'Prüfling' : 'Prüfungsausschuss'}:**\n\n${m.content}`).join('\n\n---\n\n');

  return (
    <>
      <div className="mb-1 text-sm">
        <Link to="/ki" className="text-sky-600 hover:underline dark:text-sky-400">← KI-Tutor</Link>
      </div>
      <PageTitle sub="Claude spielt den Prüfungsausschuss: eine Frage nach der anderen, Nachfragen bei schwachen Antworten, am Ende Feedback mit Notentendenz.">
        Fachgespräch-Simulator
      </PageTitle>

      {!startedAt ? (
        <Panel className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="proj">Kurzbeschreibung deines Projekts</label>
          <textarea
            id="proj"
            value={text}
            onChange={(e) => setSummary(e.target.value)}
            rows={10}
            placeholder={'Ausgangssituation, Ziel, gewählte Lösung, betrachtete Alternativen und Entscheidungsgründe, eingesetzte Technik, Kosten/Zeit, Tests, Probleme, Ergebnis …\n\nBeispiel: „Einführung einer zentralen Backup-Lösung (Veeam) für 5 Server in einem KMU mit 40 Mitarbeitern; Alternativen: Windows Server Backup, Acronis, Cloud-BaaS; Entscheidung per Nutzwertanalyse …“'}
            className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
          />
          <p className="text-xs text-slate-500">
            Wird lokal gespeichert. Keine personenbezogenen oder vertraulichen Firmendaten eintragen – die Beschreibung wird an die Claude API gesendet.
          </p>
          <Button className="w-full" disabled={text.trim().length < 40} onClick={start}>
            Fachgespräch starten (ca. 15 Minuten)
          </Button>
        </Panel>
      ) : (
        <>
          <div className="sticky top-14 z-10 -mx-4 mb-3 flex items-center gap-2 bg-slate-50/95 px-4 py-2 backdrop-blur lg:top-0 dark:bg-slate-950/95">
            <Timer start={startedAt} running={!finished} />
            <span className="flex-1 text-xs text-slate-500">{finished ? 'Gespräch beendet' : 'Antworte wie im echten Gespräch – ausführlich, mit Begründungen.'}</span>
            {!finished && (
              <Button variant="secondary" className="min-h-9 py-1" disabled={chat.status === 'streaming' || chat.messages.length < 2} onClick={finish}>
                Beenden & Feedback
              </Button>
            )}
          </div>
          <Panel>
            <ChatLog messages={chat.messages} partial={chat.partial} streaming={chat.status === 'streaming'} hideFirstUser userLabel="Du (Prüfling)" aiLabel="Prüfungsausschuss (KI)" />
            {chat.error && <AiErrorBox error={chat.error} onRetry={chat.retry} />}
            {!finished && (
              <div className="mt-3">
                <ChatInput
                  onSend={(t) => chat.send(t)}
                  disabled={chat.status === 'streaming'}
                  streaming={chat.status === 'streaming'}
                  onStop={chat.stop}
                  placeholder="Deine Antwort … (Enter = senden, Shift+Enter = neue Zeile)"
                />
              </div>
            )}
            {finished && chat.status === 'idle' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => downloadText(transcript(), `fachgespraech-${new Date().toISOString().slice(0, 10)}.md`)}>
                  Protokoll herunterladen
                </Button>
                <Button onClick={() => setStartedAt(null)}>Neues Gespräch</Button>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
