import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Card } from '../content/schema';
import { db } from '../db/db';
import { useAllCards } from '../hooks/data';
import { GRADE_LABEL, gradeFromPoints } from '../grading/ihk';
import { logPractice } from '../lib/examLog';
import { seededShuffle } from '../lib/random';
import { toggleStar } from '../srs/actions';
import { Markdown } from '../components/Markdown';
import { Button, Chip, PageTitle, Panel, Stat } from '../components/ui';
import { IconCheck, IconClock, IconX } from '../components/icons';

type Mode = 'sofort' | 'gesammelt';
type Run = { questions: Card[]; mode: Mode; limitMs: number | null; startedAt: number; seed: number };

const isCorrect = (c: Card, picked: number[]) => [...picked].sort().join(',') === [...(c.correct ?? [])].sort().join(',');

function Countdown({ end, onEnd }: { end: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, end - now);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onEnd();
    }
  }, [left, onEnd]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums ${left < 5 * 60000 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
      <IconClock className="h-4 w-4" />
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function Question({ card, picked, onPick, reveal, seed }: { card: Card; picked: number[]; onPick: (p: number[]) => void; reveal: boolean; seed: number }) {
  const multi = (card.correct?.length ?? 0) > 1;
  const order = useMemo(() => seededShuffle(card.choices!.map((c, i) => ({ c, i })), seed), [card, seed]);
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">{card.topic}{multi && ' · mehrere Antworten richtig'}</div>
      <Markdown className="text-[1.05rem]">{card.front}</Markdown>
      <div className="space-y-2">
        {order.map(({ c, i }, n) => {
          const sel = picked.includes(i);
          const right = card.correct!.includes(i);
          let cls = sel ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-300 dark:border-slate-700';
          if (reveal) cls = right ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : sel ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 opacity-60 dark:border-slate-800';
          return (
            <button
              key={i}
              type="button"
              disabled={reveal}
              onClick={() => onPick(multi ? (sel ? picked.filter((x) => x !== i) : [...picked, i]) : [i])}
              className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left text-sm ${cls}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs">{String.fromCharCode(97 + n)}</span>
              <Markdown className="text-sm [&_p]:my-0">{c}</Markdown>
            </button>
          );
        })}
      </div>
      {reveal && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/60">
          <div className={`mb-1 flex items-center gap-1 font-semibold ${isCorrect(card, picked) ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isCorrect(card, picked) ? <IconCheck className="h-4 w-4" /> : <IconX className="h-4 w-4" />}
            {isCorrect(card, picked) ? 'Richtig' : 'Leider falsch'}
          </div>
          <Markdown className="text-sm">{card.back}</Markdown>
          {card.explanation && <Markdown className="text-sm">{card.explanation}</Markdown>}
        </div>
      )}
    </div>
  );
}

export function WisoPage() {
  const cards = useAllCards();
  const pool = useMemo(() => cards.filter((c) => c.area === 'WISO' && c.type === 'mc' && c.choices && c.correct), [cards]);
  const results = useLiveQuery(() => db.examResults.where('kind').equals('WISO').reverse().sortBy('ts'), []);
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<Mode>('sofort');
  const [run, setRun] = useState<Run | null>(null);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<null | { correct: number; ms: number }>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);

  const start = (n: number, m: Mode, limitMin: number | null) => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const qs = seededShuffle(pool, seed).slice(0, Math.min(n, pool.length));
    setRun({ questions: qs, mode: m, limitMs: limitMin ? limitMin * 60000 : null, startedAt: Date.now(), seed });
    setAnswers(qs.map(() => []));
    setPos(0);
    setChecked(false);
    setDone(null);
  };

  const finish = async () => {
    if (!run || done) return;
    const ms = Date.now() - run.startedAt;
    const items = run.questions.map((card, i) => ({ card, correct: isCorrect(card, answers[i] ?? []) }));
    const correct = items.filter((x) => x.correct).length;
    setDone({ correct, ms });
    await db.examResults.add({ kind: 'WISO', ts: Date.now(), points: correct, maxPoints: items.length, durationMs: ms, details: { ids: run.questions.map((q) => q.id), answers } });
    await logPractice(items, ms);
  };

  // --- Auswahl ---
  if (!run) {
    return (
      <>
        <PageTitle sub={`Multiple-Choice-Runden aus ${pool.length} WiSo-Fragen. In der Prüfung: gebundene Aufgaben, 60 Minuten, 10 % des Gesamtergebnisses.`}>WiSo-Test</PageTitle>
        <Panel className="mb-4 space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium">Anzahl Fragen</div>
            <div className="flex gap-2">{[10, 20, 30].map((n) => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Auswertung</div>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === 'sofort'} onClick={() => setMode('sofort')}>sofort nach jeder Frage</Chip>
              <Chip active={mode === 'gesammelt'} onClick={() => setMode('gesammelt')}>gesammelt am Ende</Chip>
            </div>
          </div>
          <Button className="w-full" onClick={() => start(count, mode, null)} disabled={pool.length === 0}>Runde starten</Button>
        </Panel>
        <Panel className="mb-4">
          <h2 className="font-semibold">Prüfungssimulation</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">30 Fragen, 60 Minuten, Auswertung erst am Ende – wie in der echten Prüfung. Danach Ergebnis in Punkten und IHK-Note.</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => start(30, 'gesammelt', 60)}>Simulation starten (60 Min.)</Button>
        </Panel>
        {results && results.length > 0 && (
          <Panel>
            <h2 className="mb-2 font-semibold">Letzte Ergebnisse</h2>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {results.slice(0, 8).map((r) => {
                const p = (r.points / r.maxPoints) * 100;
                return (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span>{new Date(r.ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · {r.points}/{r.maxPoints} richtig</span>
                    <span className="tabular-nums">{Math.round(p)} % · Note {gradeFromPoints(p)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </>
    );
  }

  const total = run.questions.length;

  // --- Ergebnis ---
  if (done) {
    const p = (done.correct / total) * 100;
    const g = gradeFromPoints(p);
    return (
      <>
        <PageTitle>WiSo – Ergebnis</PageTitle>
        <Panel className="mb-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Richtig" value={`${done.correct}/${total}`} />
            <Stat label="Punkte" value={Math.round(p)} hint="von 100" />
            <Stat label="Note" value={g} hint={GRADE_LABEL[g]} />
          </div>
          <p className="mt-3 text-sm text-slate-500">Zeit: {Math.round(done.ms / 60000)} Min. · Die Antworten fließen in die Statistik ein (ohne den Lernplan zu ändern).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setRun(null)}>Neue Runde</Button>
            <Chip active={onlyWrong} onClick={() => setOnlyWrong(!onlyWrong)}>nur falsche anzeigen</Chip>
            <Button
              variant="secondary"
              onClick={async () => {
                for (const [i, q] of run.questions.entries()) if (!isCorrect(q, answers[i])) {
                  const st = await db.cardState.get(q.id);
                  if (!st?.starred) await toggleStar(q.id);
                }
              }}
            >
              Falsche Fragen markieren (★)
            </Button>
          </div>
        </Panel>
        <div className="space-y-3">
          {run.questions.map((q, i) =>
            onlyWrong && isCorrect(q, answers[i]) ? null : (
              <Panel key={q.id}>
                <div className="mb-2 text-xs font-semibold text-slate-500">Frage {i + 1}</div>
                <Question card={q} picked={answers[i]} onPick={() => {}} reveal seed={run.seed + i} />
              </Panel>
            ),
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/karten?area=WISO" className="text-sky-600 hover:underline dark:text-sky-400">WiSo-Karten im Kartenbrowser ansehen</Link>
        </p>
      </>
    );
  }

  // --- Frage ---
  const card = run.questions[pos];
  const picked = answers[pos] ?? [];
  const setPicked = (p: number[]) => setAnswers((a) => a.map((x, i) => (i === pos ? p : x)));
  const answered = answers.filter((a) => a.length).length;
  const last = pos === total - 1;

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => confirm('Runde abbrechen?') && setRun(null)} aria-label="Abbrechen" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
          <IconX className="h-5 w-5" />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${((pos + (checked ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-slate-500">{pos + 1}/{total}</span>
        {run.limitMs && <Countdown end={run.startedAt + run.limitMs} onEnd={finish} />}
      </div>
      <Panel>
        <Question key={card.id} card={card} picked={picked} onPick={setPicked} reveal={run.mode === 'sofort' && checked} seed={run.seed + pos} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {run.mode === 'sofort' ? (
            !checked ? (
              <Button className="flex-1" disabled={!picked.length} onClick={() => setChecked(true)}>Antwort prüfen</Button>
            ) : (
              <Button className="flex-1" onClick={() => (last ? finish() : (setPos(pos + 1), setChecked(false)))}>{last ? 'Auswertung' : 'Nächste Frage'}</Button>
            )
          ) : (
            <>
              <Button variant="secondary" disabled={pos === 0} onClick={() => setPos(pos - 1)}>Zurück</Button>
              {!last ? (
                <Button className="flex-1" onClick={() => setPos(pos + 1)}>Weiter</Button>
              ) : (
                <Button className="flex-1" onClick={() => (answered < total ? confirm(`${total - answered} Frage(n) unbeantwortet. Trotzdem abgeben?`) && finish() : finish())}>Abgeben</Button>
              )}
            </>
          )}
        </div>
        {run.mode === 'gesammelt' && (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Fragenübersicht">
            {run.questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setPos(i)}
                className={`h-8 w-8 rounded-lg text-xs font-semibold tabular-nums ${i === pos ? 'ring-2 ring-sky-500' : ''} ${answers[i]?.length ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
