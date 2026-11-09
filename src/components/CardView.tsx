import { useMemo, useState, type ReactNode } from 'react';
import { hashString, seededShuffle } from '../lib/random';
import type { Card } from '../content/schema';
import { AREA_META } from '../content/meta';
import { clozeToMarkdown, Markdown } from './Markdown';
import { Badge, Button } from './ui';
import { IconCheck, IconX } from './icons';

export function CardMeta({ card }: { card: Card }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`rounded-md px-1.5 py-0.5 font-semibold text-white ${AREA_META[card.area].color}`}>{AREA_META[card.area].short}</span>
      <Badge>{card.topic}</Badge>
      <Badge>{'●'.repeat(card.difficulty)}{'○'.repeat(3 - card.difficulty)}</Badge>
      {card.examRelevance === 'hoch' && <Badge className="bg-rose-100! text-rose-700! dark:bg-rose-900/40! dark:text-rose-200!">prüfungsrelevant</Badge>}
      {card.tags?.includes('jahreswert') && <Badge className="bg-amber-100! text-amber-800! dark:bg-amber-900/40! dark:text-amber-200!">Stand {card.asOf}</Badge>}
      {card.source === 'ai' && <Badge className="bg-violet-100! text-violet-700! dark:bg-violet-900/40! dark:text-violet-200!">KI-generiert</Badge>}
    </div>
  );
}

type Props = {
  card: Card;
  revealed: boolean;
  onReveal: () => void;
  /** Ergebnis bei mc/order (für Bewertungsvorschlag) */
  onChecked?: (correct: boolean) => void;
  sessionSeed?: number;
  /** Werkzeuge (Stern, Notiz …) rechts neben den Metadaten */
  actions?: ReactNode;
};

export function CardView({ card, revealed, onReveal, onChecked, sessionSeed = 1, actions }: Props) {
  const [picked, setPicked] = useState<number[]>([]);
  const options = useMemo(
    () => (card.choices ? seededShuffle(card.choices.map((item, idx) => ({ item, idx })), hashString(card.id, sessionSeed)) : []),
    [card.choices, card.id, sessionSeed],
  );

  const check = () => {
    let ok = false;
    if (card.type === 'mc') {
      const want = [...(card.correct ?? [])].sort().join(',');
      ok = [...picked].sort().join(',') === want;
    } else if (card.type === 'order') {
      ok = picked.length === card.choices!.length && picked.every((v, i) => v === i);
    }
    onChecked?.(ok);
    onReveal();
  };

  const multi = card.type === 'mc' && (card.correct?.length ?? 0) > 1;
  const front = card.type === 'cloze' ? clozeToMarkdown(card.front, revealed) : card.front;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <CardMeta card={card} />
        {actions && <div className="-mt-1 -mr-1 shrink-0">{actions}</div>}
      </div>
      <Markdown className="text-[1.05rem]">{front}</Markdown>

      {card.type === 'mc' && (
        <div className="space-y-2">
          {multi && !revealed && <p className="text-xs text-slate-500">Mehrere Antworten richtig.</p>}
          {options.map(({ item, idx }, n) => {
            const sel = picked.includes(idx);
            const right = card.correct!.includes(idx);
            let cls = sel ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-300 dark:border-slate-700';
            if (revealed) {
              cls = right
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                : sel
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-slate-200 opacity-60 dark:border-slate-800';
            }
            return (
              <button
                key={idx}
                type="button"
                disabled={revealed}
                onClick={() =>
                  setPicked((p) => (multi ? (p.includes(idx) ? p.filter((x) => x !== idx) : [...p, idx]) : [idx]))
                }
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left text-sm transition-colors ${cls}`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                  {revealed ? right ? <IconCheck className="h-3.5 w-3.5" /> : sel ? <IconX className="h-3.5 w-3.5" /> : String.fromCharCode(97 + n) : String.fromCharCode(97 + n)}
                </span>
                <Markdown className="text-sm [&_p]:my-0">{item}</Markdown>
              </button>
            );
          })}
          {!revealed && (
            <Button className="w-full" onClick={check} disabled={!picked.length}>
              Antwort prüfen
            </Button>
          )}
        </div>
      )}

      {card.type === 'order' && (
        <div className="space-y-2">
          {!revealed && (
            <>
              <p className="text-xs text-slate-500">Tippe die Schritte in der richtigen Reihenfolge an.</p>
              {options.map(({ item, idx }) => {
                const pos = picked.indexOf(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPicked((p) => (p.includes(idx) ? p.filter((x) => x !== idx) : [...p, idx]))}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-sm ${pos >= 0 ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold dark:bg-slate-800">
                      {pos >= 0 ? pos + 1 : ''}
                    </span>
                    {item}
                  </button>
                );
              })}
              <Button className="w-full" onClick={check} disabled={picked.length !== options.length}>
                Reihenfolge prüfen
              </Button>
            </>
          )}
          {revealed && (
            <ol className="space-y-1.5">
              {card.choices!.map((c, i) => {
                const ok = picked[i] === i;
                return (
                  <li key={i} className={`flex items-center gap-3 rounded-lg p-2 text-sm ${picked.length ? (ok ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40') : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <span className="w-5 text-right font-bold">{i + 1}.</span> {c}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {!revealed && card.type !== 'mc' && card.type !== 'order' && (
        <Button className="w-full" onClick={onReveal}>
          Antwort aufdecken <kbd className="hidden rounded bg-white/20 px-1.5 text-xs sm:inline">Leertaste</kbd>
        </Button>
      )}

      {revealed && (
        <div className="border-t border-dashed border-slate-300 pt-4 dark:border-slate-700">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {card.type === 'mc' ? 'Erklärung' : 'Musterlösung'}
          </div>
          {card.explanation && <Markdown>{card.explanation}</Markdown>}
          {!(card.type === 'mc' && card.explanation && card.back === card.explanation) && <Markdown>{card.back}</Markdown>}
          {card.points && <p className="mt-2 text-xs text-slate-500">Bewertung in der Prüfung: {card.points} Punkte</p>}
        </div>
      )}
    </div>
  );
}
