import { useState } from 'react';
import { Link } from 'react-router';
import { useAiChat } from '../ai/useAiChat';
import { useAiReady } from '../ai/useAi';
import { COACH } from '../ai/prompts';
import { AiErrorBox, ChatInput, ChatLog } from '../components/AiChat';
import { Button, PageTitle, Panel } from '../components/ui';
import { Placeholder } from './Placeholder';

/** grobe Sprechzeit: ca. 130 Wörter pro Minute */
export function speakingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / 130;
}

export function AiCoachPage() {
  const ready = useAiReady();
  const [text, setText] = useState('');
  const chat = useAiChat(COACH, 'medium');
  if (!ready) return <Placeholder title="KI-Tutor nicht eingerichtet" />;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = speakingMinutes(text);

  return (
    <>
      <div className="mb-1 text-sm">
        <Link to="/ki" className="text-sky-600 hover:underline dark:text-sky-400">← KI-Tutor</Link>
      </div>
      <PageTitle sub="Foliengliederung und/oder Sprechtext einfügen – Feedback zu Struktur, Zeit (12–15 Min.) und Zielgruppe Prüfungsausschuss.">Präsentations-Coach</PageTitle>
      <Panel className="mb-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={chat.messages.length > 0}
          rows={12}
          placeholder={'Folie 1: Titel, Name, Ausbildungsbetrieb\nFolie 2: Ausgangssituation …\n\noder dein kompletter Sprechtext'}
          className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
        />
        <p className="text-xs text-slate-500">
          {words} Wörter{words > 200 && ` · als Sprechtext ca. ${minutes.toFixed(1).replace('.', ',')} Minuten (bei ca. 130 Wörtern/Minute)`}
        </p>
        {chat.messages.length === 0 ? (
          <Button className="w-full" disabled={words < 20} onClick={() => chat.restart(text)}>
            Feedback anfordern
          </Button>
        ) : (
          <Button variant="secondary" onClick={chat.reset}>Neuen Text prüfen</Button>
        )}
      </Panel>
      {(chat.messages.length > 0 || chat.error) && (
        <Panel>
          <ChatLog messages={chat.messages} partial={chat.partial} streaming={chat.status === 'streaming'} hideFirstUser aiLabel="Coach (KI)" />
          {chat.error && <AiErrorBox error={chat.error} onRetry={chat.retry} />}
          {chat.messages.length > 1 && (
            <div className="mt-3">
              <ChatInput onSend={(t) => chat.send(t)} disabled={chat.status === 'streaming'} streaming={chat.status === 'streaming'} onStop={chat.stop} placeholder="Rückfrage oder überarbeiteten Abschnitt einfügen …" />
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
