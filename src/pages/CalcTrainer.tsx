import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { db } from '../db/db';
import { checkField } from '../trainers/check';
import { generateTask, getTrainer } from '../trainers/registry';
import { randomSeed } from '../trainers/lib/rng';
import type { Field, Level } from '../trainers/types';
import { Markdown } from '../components/Markdown';
import { Button, Chip, PageTitle, Panel } from '../components/ui';
import { IconCheck, IconX } from '../components/icons';
import { Placeholder } from './Placeholder';
import { ExplainButton } from '../components/ExplainButton';

const LEVEL_KEY = (id: string) => `fisi-trainer-level-${id}`;

function readLevel(id: string): Level {
  try {
    const v = Number(localStorage.getItem(LEVEL_KEY(id)));
    return v === 2 || v === 3 ? v : 1;
  } catch {
    return 1;
  }
}

function FieldInput({
  field,
  value,
  onChange,
  result,
  disabled,
  autoFocus,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  result?: boolean;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const border = result === undefined ? 'border-slate-300 dark:border-slate-700' : result ? 'border-emerald-500' : 'border-rose-500';
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={`f-${field.key}`}>
        {field.label}
      </label>
      {field.kind === 'choice' ? (
        <div className="flex flex-wrap gap-2">
          {field.options!.map((o) => (
            <Chip key={o} active={value === o} onClick={() => !disabled && onChange(o)}>
              {o}
            </Chip>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id={`f-${field.key}`}
            autoFocus={autoFocus}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={field.kind === 'number' ? 'decimal' : field.kind === 'ipv4' || field.kind === 'cidr' ? 'decimal' : field.kind === 'bin' ? 'numeric' : 'text'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={field.placeholder}
            className={`min-h-11 w-full rounded-xl border-2 bg-transparent px-3 py-2 font-mono text-sm ${border}`}
          />
          {field.unit && <span className="shrink-0 text-sm text-slate-500">{field.unit}</span>}
        </div>
      )}
      {result !== undefined && (
        <div className={`mt-1 flex items-center gap-1 text-sm ${result ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {result ? <IconCheck className="h-4 w-4" /> : <IconX className="h-4 w-4" />}
          {result ? 'richtig' : <>richtig wäre: <code className="font-semibold">{field.answer}{field.unit ? ` ${field.unit}` : ''}</code></>}
        </div>
      )}
    </div>
  );
}

export function CalcTrainerPage() {
  const { id = '' } = useParams();
  const trainer = getTrainer(id);
  const [params, setParams] = useSearchParams();
  const [level, setLevel] = useState<Level>(() => readLevel(id));
  const typeId = params.get('typ') ?? 'mix';
  const seed = Number(params.get('seed')) || 0;
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState({ n: 0, ok: 0 });
  const started = useRef(Date.now());

  // Sitzungszähler gilt pro Trainer
  useEffect(() => setSession({ n: 0, ok: 0 }), [id]);

  // ohne Seed in der URL: neuen Seed setzen (Aufgabe bleibt beim Neuladen gleich)
  useEffect(() => {
    if (!seed) setParams((p) => ({ ...Object.fromEntries(p), seed: String(randomSeed()) }), { replace: true });
  }, [seed, setParams]);

  const task = useMemo(() => (trainer && seed ? generateTask(trainer, typeId, level, seed) : null), [trainer, typeId, level, seed]);

  useEffect(() => {
    setValues({});
    setResults(null);
    setRevealed(false);
    started.current = Date.now();
  }, [task]);

  if (!trainer) return <Placeholder title="Trainer nicht gefunden" />;

  const next = () => setParams((p) => ({ ...Object.fromEntries(p), seed: String(randomSeed()) }));
  const setType = (t: string) => setParams({ typ: t, seed: String(randomSeed()) });
  const changeLevel = (l: Level) => {
    setLevel(l);
    try {
      localStorage.setItem(LEVEL_KEY(id), String(l));
    } catch {
      /* egal */
    }
    next();
  };

  const finish = async (res: Record<string, boolean>, gaveUp: boolean) => {
    if (!task || results) return;
    const correct = !gaveUp && Object.values(res).every(Boolean);
    setResults(res);
    setRevealed(true);
    setSession((s) => ({ n: s.n + 1, ok: s.ok + (correct ? 1 : 0) }));
    await db.trainerLog.add({
      trainer: trainer.id,
      task: task.type,
      level: task.level,
      seed: task.seed,
      correct,
      ts: Date.now(),
      durationMs: Math.min(Date.now() - started.current, 30 * 60_000),
    });
  };

  const check = () => {
    if (!task) return;
    const res: Record<string, boolean> = {};
    for (const f of task.fields) res[f.key] = checkField(f, values[f.key] ?? '');
    finish(res, false);
  };

  const giveUp = () => {
    if (!task) return;
    const res: Record<string, boolean> = {};
    for (const f of task.fields) res[f.key] = checkField(f, values[f.key] ?? '');
    finish(res, true);
  };

  const allFilled = task?.fields.every((f) => (values[f.key] ?? '').trim()) ?? false;

  return (
    <>
      <div className="mb-1 text-sm">
        <Link to="/rechnen" className="text-sky-600 hover:underline dark:text-sky-400">
          ← Rechen-Trainer
        </Link>
      </div>
      <PageTitle sub={session.n ? `Diese Sitzung: ${session.ok} von ${session.n} richtig` : trainer.description}>{trainer.title}</PageTitle>

      <Panel className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={typeId === 'mix'} onClick={() => setType('mix')}>
            Gemischt
          </Chip>
          {trainer.types.map((t) => (
            <Chip key={t.id} active={typeId === t.id} onClick={() => setType(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Stufe</span>
          {([1, 2, 3] as Level[]).map((l) => (
            <Chip key={l} active={level === l} onClick={() => changeLevel(l)}>
              {l}
            </Chip>
          ))}
          <span className="text-xs text-slate-500">{trainer.levels[level]}</span>
        </div>
      </Panel>

      {task && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (results) next();
            else if (allFilled) check();
          }}
        >
          <Panel className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wide">{task.title}</span>
              <span title="Mit dieser Nummer lässt sich die Aufgabe reproduzieren">#{task.seed}</span>
            </div>
            <Markdown>{task.prompt}</Markdown>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {task.fields.map((f, i) => (
                <FieldInput
                  key={`${task.seed}-${f.key}`}
                  field={f}
                  value={values[f.key] ?? ''}
                  onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  result={results?.[f.key]}
                  disabled={!!results}
                  autoFocus={i === 0 && window.matchMedia('(pointer: fine)').matches}
                />
              ))}
            </div>
            {task.fields.some((f) => f.kind === 'number') && !results && (
              <p className="mt-3 text-xs text-slate-500">Dezimalkomma oder -punkt möglich; kleine Rundungsabweichungen werden akzeptiert.</p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {!results ? (
                <>
                  <Button type="submit" className="flex-1" disabled={!allFilled}>
                    Prüfen
                  </Button>
                  <Button variant="secondary" onClick={giveUp}>
                    Lösung zeigen
                  </Button>
                </>
              ) : (
                <Button type="submit" className="flex-1">
                  Nächste Aufgabe <kbd className="hidden rounded bg-white/20 px-1.5 text-xs sm:inline">Enter</kbd>
                </Button>
              )}
            </div>
          </Panel>
        </form>
      )}

      {task && revealed && (
        <Panel className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Rechenweg</h2>
            {results && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                  Object.values(results).every(Boolean)
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                }`}
              >
                {Object.values(results).filter(Boolean).length}/{task.fields.length} richtig
              </span>
            )}
          </div>
          <Markdown>{task.solution}</Markdown>
          {task.note && <p className="mt-2 text-xs text-slate-500">{task.note}</p>}
          <div className="mt-3">
            <ExplainButton
              kind="calc"
              getContext={() =>
                `Trainer: ${trainer.title} (Stufe ${task.level})\n\nAufgabe:\n${task.prompt}\n\nRichtige Ergebnisse:\n${task.fields
                  .map((f) => `- ${f.label}: ${f.answer}${f.unit ? ' ' + f.unit : ''}${results && !results[f.key] ? ` (Prüfling hat „${values[f.key] ?? ''}“ eingegeben)` : ''}`)
                  .join('\n')}\n\nRechenweg:\n${task.solution}`
              }
            />
          </div>
        </Panel>
      )}
    </>
  );
}
