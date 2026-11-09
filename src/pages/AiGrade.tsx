import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Area, Card } from '../content/schema';
import { AREA_META } from '../content/meta';
import { useAllCards } from '../hooks/data';
import { useAiChat } from '../ai/useAiChat';
import { useAiReady } from '../ai/useAi';
import { gradePrompt, gradeUserMessage } from '../ai/prompts';
import { parsePoints } from '../ai/config';
import { gradeCard } from '../srs/actions';
import { CardMeta } from '../components/CardView';
import { Markdown } from '../components/Markdown';
import { AiErrorBox, ChatInput, ChatLog } from '../components/AiChat';
import { Button, Chip, PageTitle, Panel } from '../components/ui';
import { AiNotReady } from './Placeholder';

const OPEN_TYPES = new Set(['qa', 'compare']);
const AREAS: Area[] = ['KA', 'NET', 'PROJ'];

function pickRandom(cards: Card[], exclude?: string): Card | undefined {
  const pool = cards.filter((c) => c.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function Grader({ card, onNext }: { card: Card; onNext: () => void }) {
  const points = card.points ?? 4;
  const chat = useAiChat(gradePrompt(points), 'medium');
  const [answer, setAnswer] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [rated, setRated] = useState(false);
  const started = useRef(Date.now());
  const result = chat.messages.find((m) => m.role === 'assistant')?.content ?? '';
  const pts = parsePoints(result);
  const quote = pts ? pts.got / pts.max : null;
  const suggested = quote === null ? null : quote >= 0.85 ? 3 : quote >= 0.5 ? 2 : 1;

  return (
    <>
      <Panel className="mb-4 space-y-3">
        <CardMeta card={card} />
        <Markdown>{card.front}</Markdown>
        <p className="text-xs text-slate-500">{points} Punkte · Schreib so, wie du es in der Prüfung tun würdest (Stichpunkte sind erlaubt).</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={chat.messages.length > 0}
          rows={7}
          placeholder="Deine Antwort …"
          className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
        />
        {chat.messages.length === 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={answer.trim().length < 3} onClick={() => chat.send(gradeUserMessage(card, answer))}>
              Bewerten lassen
            </Button>
            <Button variant="secondary" onClick={onNext}>
              Andere Aufgabe
            </Button>
          </div>
        )}
      </Panel>

      {(chat.messages.length > 0 || chat.error) && (
        <Panel className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bewertung</h2>
            {pts && (
              <span
                className={`rounded-lg px-2 py-0.5 text-sm font-semibold ${
                  quote! >= 0.85 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : quote! >= 0.5 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                }`}
              >
                {String(pts.got).replace('.', ',')} / {pts.max} Punkte
              </span>
            )}
          </div>
          <ChatLog messages={chat.messages} partial={chat.partial} streaming={chat.status === 'streaming'} hideFirstUser aiLabel="Prüfer (KI)" />
          {chat.error && <AiErrorBox error={chat.error} onRetry={chat.retry} />}
          {chat.status === 'idle' && result && (
            <div className="mt-4 space-y-3">
              <ChatInput onSend={(t) => chat.send(t)} placeholder="Rückfrage an den Prüfer …" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setShowSolution(!showSolution)}>
                  {showSolution ? 'Musterlösung ausblenden' : 'Musterlösung der Karte zeigen'}
                </Button>
                {suggested && !rated && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await gradeCard(card, suggested as 1 | 2 | 3, Date.now() - started.current);
                      setRated(true);
                    }}
                  >
                    Im Lernplan als „{['', 'Nochmal', 'Schwer', 'Gut'][suggested]}“ werten
                  </Button>
                )}
                {rated && <span className="self-center text-sm text-emerald-600">✓ im Lernplan übernommen</span>}
                <Button onClick={onNext}>Nächste Aufgabe</Button>
              </div>
              {showSolution && (
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <Markdown>{card.back}</Markdown>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

export function AiGradePage() {
  const ready = useAiReady();
  const cards = useAllCards();
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState<Area | 'ALL'>('ALL');
  const pool = useMemo(() => cards.filter((c) => OPEN_TYPES.has(c.type) && c.area !== 'WISO' && (area === 'ALL' || c.area === area)), [cards, area]);
  const cardId = params.get('karte');
  const card = cards.find((c) => c.id === cardId);

  if (!ready) return <AiNotReady />;

  const next = () => {
    const c = pickRandom(pool, card?.id);
    if (c) setParams({ karte: c.id });
  };

  return (
    <>
      <div className="mb-1 text-sm">
        <Link to="/ki" className="text-sky-600 hover:underline dark:text-sky-400">← KI-Tutor</Link>
      </div>
      <PageTitle sub="Wie ein IHK-Prüfer: Punkte nach Musterlösung, fehlende Fachbegriffe, Verbesserungsvorschlag.">Offene Antwort bewerten</PageTitle>
      <Panel className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={area === 'ALL'} onClick={() => setArea('ALL')}>Alle</Chip>
        {AREAS.map((a) => (
          <Chip key={a} active={area === a} onClick={() => setArea(a)}>{AREA_META[a].short}</Chip>
        ))}
        <span className="text-xs text-slate-500">{pool.length} offene Aufgaben</span>
        <Button className="ml-auto" onClick={next}>
          {card ? 'Zufällige Aufgabe' : 'Aufgabe ziehen'}
        </Button>
      </Panel>
      {card ? (
        <Grader key={card.id} card={card} onNext={next} />
      ) : (
        <p className="text-center text-sm text-slate-500">
          Ziehe eine zufällige Aufgabe oder öffne unter „Karten“ eine Karte und wähle dort „Antwort bewerten lassen“.
        </p>
      )}
    </>
  );
}
