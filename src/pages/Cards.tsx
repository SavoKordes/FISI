import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AREA_META } from '../content/meta';
import { AREAS, RELEVANCE } from '../content/constants';
import type { Area, Card, Relevance } from '../content/schema';
import type { CardStateRow } from '../db/db';
import { useAllCards, useCardStates, useTopics } from '../hooks/data';
import { formatInterval, isDue, isNew, STATE_LABELS } from '../srs/fsrs';
import { filterToParams, paramsToFilter } from '../srs/filterParams';
import { matchesFilter, type CardFilter } from '../srs/queue';
import { resetCard } from '../srs/actions';
import { CardMeta } from '../components/CardView';
import { CardTools } from '../components/CardTools';
import { clozeToMarkdown, Markdown } from '../components/Markdown';
import { Button, Chip, LinkButton, PageTitle, Panel } from '../components/ui';
import { ExplainButton } from '../components/ExplainButton';
import { cardContext } from '../ai/prompts';
import { useAiReady } from '../ai/useAi';
import { db } from '../db/db';
import { IconChevron, IconStar } from '../components/icons';

const toggle = <T,>(list: T[] | undefined, v: T): T[] => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

const plain = (md: string) => md.replace(/```[\s\S]*?```/g, '[Code]').replace(/[*_`#>|]/g, '').replace(/\{\{([^}]+)\}\}/g, '…').replace(/\s+/g, ' ').trim();

function CardRow({ card, state }: { card: Card; state?: CardStateRow }) {
  const [open, setOpen] = useState(false);
  const ai = useAiReady();
  const f = state?.fsrs;
  const status = isNew(f) ? 'neu' : isDue(f) ? 'fällig' : `in ${formatInterval(f!.due - Date.now())}`;
  return (
    <li className="border-b border-slate-200 last:border-0 dark:border-slate-800">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 py-3 text-left">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${AREA_META[card.area].color}`} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm">{plain(card.front)}</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {card.topic} · {status}
            {state?.note ? ' · Notiz' : ''}
          </span>
        </span>
        {state?.starred && <IconStar filled className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
        <IconChevron className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mb-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
          <div className="flex items-start justify-between gap-2">
            <CardMeta card={card} />
            <CardTools card={card} state={state} />
          </div>
          <Markdown>{card.type === 'cloze' ? clozeToMarkdown(card.front, true) : card.front}</Markdown>
          {card.choices && (
            <ol className="list-[lower-alpha] space-y-1 pl-6 text-sm">
              {card.choices.map((c, i) => (
                <li key={i} className={card.type === 'mc' && card.correct?.includes(i) ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}>
                  {c}
                </li>
              ))}
            </ol>
          )}
          <div className="border-t border-dashed border-slate-300 pt-2 dark:border-slate-700">
            {card.explanation && <Markdown>{card.explanation}</Markdown>}
            <Markdown>{card.back}</Markdown>
          </div>
          {state?.note && (
            <div className="rounded-lg bg-sky-50 p-2 text-sm dark:bg-sky-950/40">
              <b className="text-xs text-sky-700 dark:text-sky-300">Notiz:</b> <Markdown>{state.note}</Markdown>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <ExplainButton kind="card" getContext={() => cardContext(card)} />
            {ai && card.area !== 'WISO' && (card.type === 'qa' || card.type === 'compare') && (
              <LinkButton to={`/ki/bewerten?karte=${encodeURIComponent(card.id)}`} variant="secondary" className="min-h-9 py-1">
                Antwort bewerten lassen
              </LinkButton>
            )}
            {card.source !== 'builtin' && (
              <Button variant="ghost" className="min-h-9 py-1 text-rose-600" onClick={() => confirm('Diese eigene/KI-generierte Karte löschen?') && db.customCards.delete(card.id)}>
                Karte löschen
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{card.id}</span>
            {f && !isNew(f) && (
              <>
                <span>· {STATE_LABELS[f.state]} · {f.reps}× wiederholt · {f.lapses}× vergessen</span>
                <Button variant="ghost" className="min-h-8 px-2 py-0 text-xs" onClick={() => confirm('Lernstand dieser Karte zurücksetzen?') && resetCard(card.id)}>
                  Zurücksetzen
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function CardsPage() {
  const [params, setParams] = useSearchParams();
  const filter = useMemo(() => paramsToFilter(params), [params]);
  const setFilter = (f: CardFilter) => setParams(filterToParams(f), { replace: true });
  const cards = useAllCards();
  const states = useCardStates();
  const topics = useTopics(cards);
  const [limit, setLimit] = useState(60);

  const result = useMemo(() => (states ? cards.filter((c) => matchesFilter(c, states.get(c.id), filter)) : []), [cards, states, filter]);
  const counts = useMemo(() => {
    let due = 0;
    let fresh = 0;
    for (const c of result) {
      const f = states?.get(c.id)?.fsrs;
      if (isNew(f)) fresh++;
      else if (isDue(f)) due++;
    }
    return { due, fresh };
  }, [result, states]);

  const visibleTopics = topics.filter((t) => !filter.areas?.length || filter.areas.includes(t.area));
  const query = filterToParams(filter);

  return (
    <>
      <PageTitle sub={`${cards.length} Karten im Pool`}>Karten</PageTitle>

      <Panel className="mb-4 space-y-3">
        <input
          type="search"
          value={filter.search ?? ''}
          onChange={(e) => setFilter({ ...filter, search: e.target.value || undefined })}
          placeholder="Suchen (z. B. DHCP, RAID 5, Probezeit) …"
          className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm dark:border-slate-700"
        />
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a: Area) => (
            <Chip key={a} active={filter.areas?.includes(a)} onClick={() => setFilter({ ...filter, areas: toggle(filter.areas, a), topics: [] })}>
              {AREA_META[a].short}
            </Chip>
          ))}
        </div>
        <details className="group" open={!!filter.topics?.length}>
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
            Themen {filter.topics?.length ? `(${filter.topics.length} gewählt)` : ''}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleTopics.map((t) => (
              <Chip key={t.topic} active={filter.topics?.includes(t.topic)} onClick={() => setFilter({ ...filter, topics: toggle(filter.topics, t.topic) })}>
                {t.topic} <span className="opacity-60">{t.count}</span>
              </Chip>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Schwierigkeit</span>
          {([1, 2, 3] as const).map((d) => (
            <Chip key={d} active={filter.difficulty?.includes(d)} onClick={() => setFilter({ ...filter, difficulty: toggle(filter.difficulty, d) })}>
              {'●'.repeat(d)}
            </Chip>
          ))}
          <span className="ml-2 text-xs text-slate-500">Relevanz</span>
          {RELEVANCE.map((r: Relevance) => (
            <Chip key={r} active={filter.relevance?.includes(r)} onClick={() => setFilter({ ...filter, relevance: toggle(filter.relevance, r) })}>
              {r}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={filter.weakOnly} onClick={() => setFilter({ ...filter, weakOnly: !filter.weakOnly })}>nur schwache Karten</Chip>
          <Chip active={filter.starredOnly} onClick={() => setFilter({ ...filter, starredOnly: !filter.starredOnly })}>★ markiert</Chip>
          {query && <Button variant="ghost" className="min-h-9 py-1 text-sm" onClick={() => setFilter({})}>Filter zurücksetzen</Button>}
        </div>
      </Panel>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <LinkButton to={`/lernen?${query}`} className="flex-1" >
          Lernen: {counts.due} fällig + neue
        </LinkButton>
        <LinkButton to={`/lernen?${filterToParams(filter, { cram: true })}`} variant="secondary" className="flex-1">
          Freies Üben ({Math.min(result.length, 100)}, ohne Planung)
        </LinkButton>
      </div>

      <Panel>
        <div className="mb-1 text-sm text-slate-500">
          {result.length} Treffer · {counts.fresh} neu · {counts.due} fällig
        </div>
        <ul>
          {result.slice(0, limit).map((c) => (
            <CardRow key={c.id} card={c} state={states?.get(c.id)} />
          ))}
        </ul>
        {result.length > limit && (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit(limit + 100)}>
            Weitere anzeigen ({result.length - limit})
          </Button>
        )}
      </Panel>
    </>
  );
}
