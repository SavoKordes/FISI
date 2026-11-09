import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Card } from '../content/schema';
import { AREA_META } from '../content/meta';
import { db } from '../db/db';
import { useAllCards } from '../hooks/data';
import { GRADE_LABEL, gradeFromPoints } from '../grading/ihk';
import { checkField } from '../trainers/check';
import { generateTask, getTrainer } from '../trainers/registry';
import { randomSeed } from '../trainers/lib/rng';
import type { Task } from '../trainers/types';
import { logPractice } from '../lib/examLog';
import { seededShuffle } from '../lib/random';
import { useAiReady } from '../ai/useAi';
import { gradePrompt, gradeUserMessage } from '../ai/prompts';
import { parsePoints } from '../ai/config';
import type { AiError } from '../ai/aiClient';
import { Markdown } from '../components/Markdown';
import { AiErrorBox } from '../components/AiChat';
import { CardMeta } from '../components/CardView';
import { Button, Chip, PageTitle, Panel, Stat } from '../components/ui';
import { IconClock } from '../components/icons';

type SimArea = 'KA' | 'NET';
const CALC_TRAINERS: Record<SimArea, string[]> = { KA: ['raid', 'backup', 'verfuegbarkeit'], NET: ['subnetting', 'ipv6', 'uebertragung'] };
const CALC_POINTS = 12;
const DRAFT_KEY = 'fisi-simulation-entwurf';

type CalcRef = { trainer: string; seed: number };
type Draft = {
  area: SimArea;
  minutes: number;
  startedAt: number;
  openIds: string[];
  calcs: CalcRef[];
  answers: Record<string, string>; // openId → Text, `${i}:${fieldKey}` → Rechenfeld
  phase: 'exam' | 'review' | 'done';
  scores: Record<string, number>; // openId → Punkte (Selbst-/KI-Bewertung)
  aiFeedback: Record<string, string>;
  submittedAt?: number;
  saved?: boolean;
};

const loadDraft = (): Draft | null => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    return null;
  }
};
const saveDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* privat-Modus */
  }
};

const calcTask = (c: CalcRef): Task => generateTask(getTrainer(c.trainer)!, 'mix', 2, c.seed);
const pts = (c: Card) => c.points ?? 4;
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

function Timer({ end, onEnd }: { end: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, end - now);
  useEffect(() => {
    if (left === 0) onEnd();
  }, [left, onEnd]);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums ${left < 10 * 60000 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
      <IconClock className="h-4 w-4" />
      {h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function AiGradeButton({ card, answer, onResult }: { card: Card; answer: string; onResult: (points: number, feedback: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AiError | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { streamChat } = await import('../ai/aiClient');
      const r = await streamChat({ system: gradePrompt(pts(card)), messages: [{ role: 'user', content: gradeUserMessage(card, answer || '(keine Antwort)') }], effort: 'medium' });
      const p = parsePoints(r.text);
      onResult(p ? p.got : 0, r.text);
    } catch (e) {
      setErr(e as AiError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" className="min-h-9 py-1 text-violet-700 dark:text-violet-300" disabled={busy} onClick={run}>
        {busy ? 'KI bewertet …' : 'Von der KI bewerten lassen'}
      </Button>
      {err && <AiErrorBox error={err} onRetry={run} />}
    </>
  );
}

export function SimulationPage() {
  const all = useAllCards();
  const ai = useAiReady();
  const [draft, setDraftState] = useState<Draft | null>(loadDraft);
  const history = useLiveQuery(() => db.examResults.where('kind').anyOf('KA', 'NET').reverse().sortBy('ts'), []);
  const setDraft = (d: Draft | null) => {
    setDraftState(d);
    saveDraft(d);
  };
  const update = (patch: Partial<Draft>) => setDraft({ ...draft!, ...patch });

  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const openCards = draft ? draft.openIds.map((id) => byId.get(id)).filter((c): c is Card => !!c) : [];
  const calcKey = JSON.stringify(draft?.calcs ?? []);
  const calcs = useMemo(() => (JSON.parse(calcKey) as CalcRef[]).map(calcTask), [calcKey]);

  const start = (area: SimArea, minutes: number) => {
    const seed = randomSeed();
    const target = minutes >= 90 ? 76 : 38;
    const pool = seededShuffle(
      all.filter((c) => c.area === area && (c.type === 'qa' || c.type === 'compare') && c.examRelevance !== 'niedrig'),
      seed,
    );
    const chosen: string[] = [];
    let sum = 0;
    const topics = new Set<string>();
    for (const c of pool) {
      if (sum >= target) break;
      if (topics.has(c.topic) && pool.length > 30) continue; // Themen streuen
      chosen.push(c.id);
      topics.add(c.topic);
      sum += pts(c);
    }
    const nCalc = minutes >= 90 ? 2 : 1;
    const calcRefs = seededShuffle(CALC_TRAINERS[area], seed).slice(0, nCalc).map((trainer, i) => ({ trainer, seed: seed + i + 1 }));
    setDraft({ area, minutes, startedAt: Date.now(), openIds: chosen, calcs: calcRefs, answers: {}, phase: 'exam', scores: {}, aiFeedback: {} });
    window.scrollTo(0, 0);
  };

  // ---------- Start ----------
  if (!draft) {
    return (
      <>
        <PageTitle sub="Zufällige Zusammenstellung offener Aufgaben und Rechenaufgaben mit Timer. Danach Selbstbewertung nach Musterlösung (oder KI-Bewertung) – Ergebnis in Punkten und IHK-Note.">
          Prüfungssimulation
        </PageTitle>
        {(['KA', 'NET'] as SimArea[]).map((a) => (
          <Panel key={a} className="mb-4">
            <h2 className="font-semibold">{AREA_META[a].label}</h2>
            <p className="mt-1 text-sm text-slate-500">Schriftlich, offene Aufgaben – in der Prüfung 90 Minuten, 10 % des Gesamtergebnisses.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => start(a, 90)}>Volle Simulation (90 Min.)</Button>
              <Button variant="secondary" className="flex-1" onClick={() => start(a, 45)}>Kurz (45 Min.)</Button>
            </div>
          </Panel>
        ))}
        {history && history.length > 0 && (
          <Panel>
            <h2 className="mb-2 font-semibold">Bisherige Simulationen</h2>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {history.slice(0, 10).map((r) => {
                const p = (r.points / r.maxPoints) * 100;
                return (
                  <li key={r.id} className="flex justify-between py-2">
                    <span>{r.kind} · {new Date(r.ts).toLocaleDateString('de-DE')}</span>
                    <span className="tabular-nums">{fmt(p)} Punkte · Note {gradeFromPoints(p)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </>
    );
  }

  const calcScore = (i: number) => {
    const t = calcs[i];
    const ok = t.fields.filter((f) => checkField(f, draft.answers[`${i}:${f.key}`] ?? '')).length;
    return (ok / t.fields.length) * CALC_POINTS;
  };
  const maxPoints = openCards.reduce((s, c) => s + pts(c), 0) + calcs.length * CALC_POINTS;
  const earned = openCards.reduce((s, c) => s + (draft.scores[c.id] ?? 0), 0) + calcs.reduce((s, _, i) => s + calcScore(i), 0);
  const percent = maxPoints ? (earned / maxPoints) * 100 : 0;
  const allRated = openCards.every((c) => draft.scores[c.id] !== undefined);
  const review = draft.phase !== 'exam';

  const submit = () => {
    if (draft.phase === 'exam') update({ phase: 'review', submittedAt: Date.now() });
    window.scrollTo(0, 0);
  };

  const saveResult = async () => {
    const ms = (draft.submittedAt ?? Date.now()) - draft.startedAt;
    await db.examResults.add({ kind: draft.area, ts: Date.now(), points: Math.round(earned * 10) / 10, maxPoints, durationMs: ms, details: { openIds: draft.openIds, calcs: draft.calcs, scores: draft.scores } });
    await logPractice(openCards.map((c) => ({ card: c, correct: (draft.scores[c.id] ?? 0) >= pts(c) / 2 })), ms);
    update({ phase: 'done', saved: true });
  };

  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex items-center gap-2 bg-slate-50/95 px-4 py-2 backdrop-blur lg:top-0 dark:bg-slate-950/95">
        <span className="flex-1 truncate text-sm font-semibold">Simulation {draft.area} · {draft.minutes} Min. · {fmt(maxPoints)} Punkte</span>
        {!review && <Timer end={draft.startedAt + draft.minutes * 60000} onEnd={submit} />}
        {review && <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-semibold tabular-nums dark:bg-slate-800">{fmt(earned)} / {fmt(maxPoints)}</span>}
      </div>

      {review && (
        <Panel className="mb-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Punkte" value={fmt(percent)} hint="von 100" />
            <Stat label="Note" value={gradeFromPoints(percent)} hint={GRADE_LABEL[gradeFromPoints(percent)]} />
            <Stat label="Zeit" value={`${Math.round(((draft.submittedAt ?? Date.now()) - draft.startedAt) / 60000)}′`} hint={`von ${draft.minutes}′`} />
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {allRated ? 'Alle Aufgaben bewertet.' : 'Bewerte jede offene Aufgabe anhand der Musterlösung (oder lass die KI bewerten). Rechenaufgaben werden automatisch bewertet.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.phase === 'review' && <Button disabled={!allRated} onClick={saveResult}>Ergebnis speichern</Button>}
            {draft.saved && <span className="self-center text-sm text-emerald-600">✓ gespeichert – fließt in die Statistik ein</span>}
            <Button variant={draft.saved ? 'primary' : 'ghost'} onClick={() => (draft.saved || confirm('Simulation verwerfen?')) && setDraft(null)}>
              {draft.saved ? 'Neue Simulation' : 'Verwerfen'}
            </Button>
          </div>
        </Panel>
      )}

      <div className="space-y-4">
        {openCards.map((c, i) => (
          <Panel key={c.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">Aufgabe {i + 1} · {pts(c)} Punkte</span>
              {review && draft.scores[c.id] !== undefined && <span className="text-xs font-semibold text-emerald-600">{fmt(draft.scores[c.id])} / {pts(c)} P.</span>}
            </div>
            <CardMeta card={c} />
            <Markdown>{c.front}</Markdown>
            <textarea
              value={draft.answers[c.id] ?? ''}
              onChange={(e) => update({ answers: { ...draft.answers, [c.id]: e.target.value } })}
              readOnly={review}
              rows={5}
              placeholder="Deine Antwort …"
              className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
            />
            {review && (
              <>
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Musterlösung</div>
                  <Markdown>{c.back}</Markdown>
                </div>
                {draft.aiFeedback[c.id] && (
                  <details className="rounded-xl bg-violet-50 p-3 text-sm dark:bg-violet-950/30">
                    <summary className="cursor-pointer font-semibold text-violet-700 dark:text-violet-300">KI-Bewertung</summary>
                    <Markdown className="text-sm">{draft.aiFeedback[c.id]}</Markdown>
                  </details>
                )}
                {draft.phase === 'review' && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Deine Bewertung</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: pts(c) * 2 + 1 }, (_, k) => k / 2).map((v) => (
                        <Chip key={v} active={draft.scores[c.id] === v} onClick={() => update({ scores: { ...draft.scores, [c.id]: v } })}>
                          {fmt(v)}
                        </Chip>
                      ))}
                    </div>
                    {ai && (
                      <AiGradeButton
                        card={c}
                        answer={draft.answers[c.id] ?? ''}
                        onResult={(p, fb) => {
                          const d = loadDraft() ?? draft;
                          setDraft({ ...d, scores: { ...d.scores, [c.id]: Math.min(p, pts(c)) }, aiFeedback: { ...d.aiFeedback, [c.id]: fb } });
                        }}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </Panel>
        ))}

        {calcs.map((t, i) => (
          <Panel key={`calc-${i}`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">Rechenaufgabe {i + 1} · {CALC_POINTS} Punkte · {getTrainer(t.trainer)?.title}</span>
              {review && <span className="text-xs font-semibold text-emerald-600">{fmt(calcScore(i))} / {CALC_POINTS} P.</span>}
            </div>
            <Markdown>{t.prompt}</Markdown>
            <div className="grid gap-3 sm:grid-cols-2">
              {t.fields.map((f) => {
                const key = `${i}:${f.key}`;
                const v = draft.answers[key] ?? '';
                const ok = review ? checkField(f, v) : undefined;
                return (
                  <div key={key}>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`sim-${key}`}>{f.label}</label>
                    {f.kind === 'choice' ? (
                      <div className="flex flex-wrap gap-2">
                        {f.options!.map((o) => <Chip key={o} active={v === o} onClick={() => !review && update({ answers: { ...draft.answers, [key]: o } })}>{o}</Chip>)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          id={`sim-${key}`}
                          value={v}
                          readOnly={review}
                          onChange={(e) => update({ answers: { ...draft.answers, [key]: e.target.value } })}
                          inputMode={f.kind === 'number' ? 'decimal' : 'text'}
                          autoCapitalize="off"
                          spellCheck={false}
                          className={`min-h-11 w-full rounded-xl border-2 bg-transparent px-3 py-2 font-mono text-sm ${ok === undefined ? 'border-slate-300 dark:border-slate-700' : ok ? 'border-emerald-500' : 'border-rose-500'}`}
                        />
                        {f.unit && <span className="shrink-0 text-sm text-slate-500">{f.unit}</span>}
                      </div>
                    )}
                    {review && !ok && <div className="mt-1 text-sm text-rose-600">richtig: <code>{f.answer}</code></div>}
                  </div>
                );
              })}
            </div>
            {review && (
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Rechenweg</summary>
                <Markdown>{t.solution}</Markdown>
              </details>
            )}
          </Panel>
        ))}
      </div>

      {!review && (
        <div className="mt-4">
          <Button className="w-full" onClick={() => confirm('Prüfung jetzt abgeben?') && submit()}>Abgeben</Button>
        </div>
      )}
    </>
  );
}
