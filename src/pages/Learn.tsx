import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Card } from '../content/schema';
import { getSettings } from '../db/settings';
import { db } from '../db/db';
import { useAllCards, useCardStates } from '../hooks/data';
import { formatInterval, previewIntervals, RATING_LABELS, type AppRating } from '../srs/fsrs';
import { paramsToFilter } from '../srs/filterParams';
import { buildQueue, matchesFilter, newIntroducedToday, startOfDay, topicFailRates } from '../srs/queue';
import { CardView } from '../components/CardView';
import { CardTools } from '../components/CardTools';
import { Markdown } from '../components/Markdown';
import { seededShuffle } from '../lib/random';
import { gradeCard, toggleStar } from '../srs/actions';
import { Button, LinkButton, Panel } from '../components/ui';
import { IconX } from '../components/icons';

const RATING_STYLE: Record<AppRating, string> = {
  1: 'bg-rose-600 hover:bg-rose-700',
  2: 'bg-amber-600 hover:bg-amber-700',
  3: 'bg-emerald-600 hover:bg-emerald-700',
  4: 'bg-sky-600 hover:bg-sky-700',
};

/** Karten, die innerhalb dieser Zeit wieder fällig werden, kommen in derselben Sitzung erneut dran */
const RELEARN_WINDOW_MS = 20 * 60_000;

export function LearnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cards = useAllCards();
  const states = useCardStates();
  const cram = params.get('cram') === '1';
  const extra = Number(params.get('extra') ?? 0);
  const filter = useMemo(() => paramsToFilter(params), [params]);

  const [queue, setQueue] = useState<Card[] | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suggest, setSuggest] = useState<AppRating | null>(null);
  const [done, setDone] = useState({ count: 0, again: 0, ms: 0 });
  const shownAt = useRef(Date.now());
  const sessionSeed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [drag, setDrag] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Warteschlange einmal beim Start bilden
  useEffect(() => {
    if (queue || !states) return;
    (async () => {
      const settings = await getSettings();
      const now = Date.now();
      const logs = await db.reviewLog.where('ts').aboveOrEqual(startOfDay(now) - 60 * 86_400_000).toArray();
      if (cram) {
        const pool = cards.filter((c) => matchesFilter(c, states.get(c.id), filter));
        setQueue(seededShuffle(pool, sessionSeed.current).slice(0, 100));
        return;
      }
      const remaining = Math.max(0, settings.newPerDay - newIntroducedToday(logs, now)) + extra;
      const q = buildQueue({ cards, states, filter, newLimit: remaining, now, examDate: settings.examDate, failRates: topicFailRates(logs) });
      // Wiederholungen und neue Karten mischen: nach je 3 Wiederholungen eine neue Karte
      const reviews = [...q.due, ...q.early];
      const mixed: Card[] = [];
      let r = 0;
      let n = 0;
      while (r < reviews.length || n < q.fresh.length) {
        for (let k = 0; k < 3 && r < reviews.length; k++) mixed.push(reviews[r++]);
        if (n < q.fresh.length) mixed.push(q.fresh[n++]);
      }
      setQueue(mixed);
    })();
  }, [queue, states, cards, filter, cram, extra]);

  const card = queue?.[pos];
  const state = card ? states?.get(card.id) : undefined;
  const intervals = useMemo(() => (card && !cram ? previewIntervals(state?.fsrs) : null), [card, state?.fsrs, cram]);

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback(
    async (rating: AppRating) => {
      if (!card || !revealed || !queue) return;
      const now = Date.now();
      const dur = now - shownAt.current;
      await gradeCard(card, rating, dur, cram, now);
      let requeue = false;
      if (cram) requeue = rating === 1;
      else {
        const next = await db.cardState.get(card.id);
        requeue = !!next?.fsrs && next.fsrs.due - now < RELEARN_WINDOW_MS;
      }
      setQueue((q) => (q && requeue ? [...q, card] : q));
      setDone((d) => ({ count: d.count + 1, again: d.again + (rating === 1 ? 1 : 0), ms: d.ms + Math.min(dur, 300_000) }));
      setPos((p) => p + 1);
      setRevealed(false);
      setSuggest(null);
      setDrag(0);
      shownAt.current = Date.now();
    },
    [card, revealed, queue, cram],
  );

  // Tastenkürzel: Leertaste/Enter = aufdecken, 1–4 = bewerten
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('textarea, input, [role="dialog"]')) return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed && card && card.type !== 'mc' && card.type !== 'order') {
        e.preventDefault();
        reveal();
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key) as AppRating);
      } else if (revealed && e.key === ' ' && suggest) {
        e.preventDefault();
        rate(suggest);
      } else if (e.key === 's' && card) toggleStar(card.id);
      else if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, card, rate, reveal, suggest, navigate]);

  // Wischgesten (nach dem Aufdecken): links = Nochmal, rechts = Gut
  const onTouchStart = (e: React.TouchEvent) => {
    if (!revealed) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.touches[0].clientX - touch.current.x;
    const dy = e.touches[0].clientY - touch.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setDrag(dx);
  };
  const onTouchEnd = () => {
    if (!touch.current) return;
    touch.current = null;
    if (drag > 90) rate(3);
    else if (drag < -90) rate(1);
    else setDrag(0);
  };

  if (!queue) return <div className="p-8 text-center text-slate-500">Lade …</div>;

  const header = (
    <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-3 bg-slate-50/90 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 dark:bg-slate-950/90 lg:dark:bg-transparent">
      <button type="button" onClick={() => navigate(-1)} aria-label="Sitzung beenden" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
        <IconX className="h-5 w-5" />
      </button>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${queue.length ? (pos / queue.length) * 100 : 100}%` }} />
      </div>
      <span className="text-sm tabular-nums text-slate-500">{Math.min(pos, queue.length)}/{queue.length}</span>
      {cram && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">Freies Üben</span>}
    </div>
  );

  if (!card) {
    return (
      <>
        {header}
        <Panel className="text-center">
          <div className="text-4xl">{done.count ? '🎉' : '✅'}</div>
          <h2 className="mt-2 text-xl font-bold">{done.count ? 'Sitzung geschafft!' : 'Keine Karten in dieser Auswahl fällig.'}</h2>
          {done.count > 0 && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {done.count} Bewertungen in {Math.max(1, Math.round(done.ms / 60000))} Min · Quote {Math.round(((done.count - done.again) / done.count) * 100)} %
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <LinkButton to="/">Zur Startseite</LinkButton>
            <LinkButton to="/karten" variant="secondary">Karten durchsuchen</LinkButton>
          </div>
        </Panel>
      </>
    );
  }

  const swipeHint = drag > 40 ? 'Gut →' : drag < -40 ? '← Nochmal' : null;

  return (
    <>
      {header}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 40}deg)` : undefined, transition: drag ? 'none' : 'transform .2s' }}
      >
        <Panel className={`relative ${drag > 40 ? 'border-emerald-500' : drag < -40 ? 'border-rose-500' : ''}`}>
          {swipeHint && <div className={`absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-bold text-white ${drag > 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>{swipeHint}</div>}
          <div
            onClick={() => !revealed && card.type !== 'mc' && card.type !== 'order' && reveal()}
            className={!revealed && card.type !== 'mc' && card.type !== 'order' ? 'cursor-pointer' : ''}
          >
            <CardView
              key={`${card.id}-${pos}`}
              card={card}
              revealed={revealed}
              onReveal={reveal}
              onChecked={(ok) => setSuggest(ok ? 3 : 1)}
              sessionSeed={sessionSeed.current}
              actions={<div onClick={(e) => e.stopPropagation()}><CardTools card={card} state={state} /></div>}
            />
          </div>
          {revealed && state?.note && (
            <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-950/40">
              <div className="mb-1 text-xs font-semibold text-sky-700 dark:text-sky-300">Deine Notiz</div>
              <Markdown>{state.note}</Markdown>
            </div>
          )}
        </Panel>
      </div>

      {revealed && (
        <div className="pb-safe sticky bottom-0 -mx-4 mt-4 bg-slate-50/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 dark:bg-slate-950/95 lg:dark:bg-transparent">
          {suggest && (
            <p className="mb-2 text-center text-xs text-slate-500">
              {suggest === 3 ? 'Richtig beantwortet' : 'Leider nicht ganz richtig'} – Vorschlag: <b>{RATING_LABELS[suggest]}</b>
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as AppRating[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => rate(r)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-white ${RATING_STYLE[r]} ${suggest === r ? 'ring-4 ring-offset-2 ring-sky-300 dark:ring-offset-slate-950' : ''}`}
              >
                <span className="text-sm font-semibold">{RATING_LABELS[r]}</span>
                <span className="text-[11px] opacity-90">{intervals ? formatInterval(intervals[r]) : <kbd>{r}</kbd>}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 hidden text-center text-xs text-slate-400 sm:block">Tasten 1–4 · am Handy: nach links wischen = Nochmal, nach rechts = Gut</p>
          <p className="mt-2 text-center text-xs text-slate-400 sm:hidden">Wischen: ← Nochmal · Gut →</p>
        </div>
      )}
      {!revealed && (
        <p className="mt-4 text-center text-xs text-slate-400">
          <Button variant="ghost" className="min-h-8 text-xs" onClick={() => { setQueue((q) => (q ? [...q.slice(0, pos), ...q.slice(pos + 1), card] : q)); shownAt.current = Date.now(); }}>
            Karte überspringen
          </Button>
        </p>
      )}
    </>
  );
}
