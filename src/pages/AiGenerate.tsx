import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AREAS } from '../content/constants';
import type { Area, Card } from '../content/schema';
import { AREA_META } from '../content/meta';
import { db } from '../db/db';
import { useAllCards, useTopics } from '../hooks/data';
import { useAiReady } from '../ai/useAi';
import { GENERATE, GENERATE_SCHEMA, generateUserMessage } from '../ai/prompts';
import type { AiError } from '../ai/aiClient';
import { AiErrorBox } from '../components/AiChat';
import { CardMeta } from '../components/CardView';
import { Markdown } from '../components/Markdown';
import { Button, Chip, PageTitle, Panel } from '../components/ui';
import { AiNotReady } from './Placeholder';

type RawTask = { front: string; back: string; points: number; difficulty: number; choices: string[]; correct: number[] };

/** KI-Ausgabe in eine gültige Karte überführen (defensiv) */
export function toCard(t: RawTask, area: Area, topic: string, idx: number, now = Date.now()): Card {
  const difficulty = (Math.min(3, Math.max(1, Math.round(t.difficulty || 2))) as 1 | 2 | 3);
  const choices = (t.choices ?? []).map((c) => String(c).trim()).filter(Boolean);
  const correct = [...new Set((t.correct ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < choices.length))];
  const isMc = choices.length >= 2 && correct.length >= 1;
  const card: Card = {
    id: `${area.toLowerCase()}-ki-${now.toString(36)}-${String(idx + 1).padStart(2, '0')}`,
    area,
    topic,
    type: isMc ? 'mc' : 'qa',
    front: String(t.front).trim(),
    back: String(t.back).trim(),
    difficulty,
    examRelevance: 'mittel',
    tags: ['ki-generiert'],
    source: 'ai',
  };
  if (isMc) {
    card.choices = choices;
    card.correct = correct;
  }
  const pts = Math.round(t.points);
  if (pts >= 1 && pts <= 30) card.points = pts;
  return card;
}

function GeneratedCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Panel className="space-y-3">
      <CardMeta card={card} />
      <Markdown>{card.front}</Markdown>
      {card.choices && (
        <ol className="list-[lower-alpha] space-y-1 pl-6 text-sm">
          {card.choices.map((c, i) => (
            <li key={i} className={open && card.correct?.includes(i) ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}>{c}</li>
          ))}
        </ol>
      )}
      {card.points && <p className="text-xs text-slate-500">{card.points} Punkte</p>}
      {open && (
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <Markdown>{card.back}</Markdown>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Lösung ausblenden' : 'Lösung zeigen'}</Button>
        <Button
          disabled={saved}
          onClick={async () => {
            await db.customCards.put({ ...card, createdAt: Date.now() });
            setSaved(true);
          }}
        >
          {saved ? '✓ Als Karte gespeichert' : 'Als Karte speichern'}
        </Button>
      </div>
    </Panel>
  );
}

export function AiGeneratePage() {
  const ready = useAiReady();
  const all = useAllCards();
  const topics = useTopics(all);
  const [area, setArea] = useState<Area>('NET');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [mc, setMc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [result, setResult] = useState<Card[]>([]);
  const areaTopics = useMemo(() => topics.filter((t) => t.area === area).map((t) => t.topic), [topics, area]);

  if (!ready) return <AiNotReady />;

  const generate = async () => {
    const t = topic.trim() || areaTopics[0];
    setBusy(true);
    setError(null);
    setResult([]);
    try {
      const { generateJson } = await import('../ai/aiClient');
      const r = await generateJson<{ tasks: RawTask[] }>({
        system: GENERATE,
        messages: [{ role: 'user', content: generateUserMessage({ areaLabel: AREA_META[area].label, topic: t, count, difficulty, mc }) }],
        schema: GENERATE_SCHEMA as unknown as Record<string, unknown>,
        effort: 'medium',
      });
      const now = Date.now();
      setResult((r.tasks ?? []).filter((x) => x?.front && x?.back).map((x, i) => toCard(x, area, t, i, now)));
    } catch (e) {
      setError(e as AiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-1 text-sm">
        <Link to="/ki" className="text-sky-600 hover:underline dark:text-sky-400">← KI-Tutor</Link>
      </div>
      <PageTitle sub="Situative Aufgaben im IHK-Stil mit Punkten und Musterlösung – speicherbar als Karte mit Kennzeichnung „KI-generiert“.">Neue Übungsaufgaben</PageTitle>
      <Panel className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <Chip key={a} active={area === a} onClick={() => { setArea(a); setTopic(''); setMc(a === 'WISO'); }}>{AREA_META[a].short}</Chip>
          ))}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="gen-topic">Thema</label>
          <input
            id="gen-topic"
            list="gen-topics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={areaTopics[0] ?? 'z. B. VLAN'}
            className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
          />
          <datalist id="gen-topics">{areaTopics.map((t) => <option key={t} value={t} />)}</datalist>
          <p className="mt-1 text-xs text-slate-500">Vorschläge aus dem Kartenpool oder eigenes Thema (z. B. „IPv6-Subnetting für Filialen“).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Anzahl</span>
          {[1, 3, 5].map((n) => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}
          <span className="ml-2 text-xs text-slate-500">Schwierigkeit</span>
          {([1, 2, 3] as const).map((d) => <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{'●'.repeat(d)}</Chip>)}
          <Chip active={mc} onClick={() => setMc(!mc)}>Multiple Choice</Chip>
        </div>
        <Button onClick={generate} disabled={busy} className="w-full">
          {busy ? 'Claude erstellt Aufgaben …' : 'Aufgaben erstellen'}
        </Button>
      </Panel>
      {error && <div className="mb-4"><AiErrorBox error={error} onRetry={generate} /></div>}
      <div className="space-y-3">
        {result.map((c) => <GeneratedCard key={c.id} card={c} />)}
      </div>
      {result.length > 0 && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Gespeicherte Karten erscheinen unter „Karten“ und im Lernplan. Bitte inhaltlich prüfen – KI-Aufgaben können Fehler enthalten.
        </p>
      )}
    </>
  );
}
