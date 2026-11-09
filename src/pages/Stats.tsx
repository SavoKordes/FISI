import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AREAS } from '../content/constants';
import type { Area } from '../content/schema';
import { AREA_META } from '../content/meta';
import { db } from '../db/db';
import { useAllCards, useCardStates } from '../hooks/data';
import { activityByDay, heatmapWeeks, level, quoteBy, topicRows, weakestTopics, type TopicRow } from '../stats/compute';
import { isNew } from '../srs/fsrs';
import { filterToParams } from '../srs/filterParams';
import { gradeFromPoints } from '../grading/ihk';
import { TRAINERS } from '../trainers/registry';
import { DAY_MS } from '../srs/queue';
import { PageTitle, Panel, Stat } from '../components/ui';

// Sequenzielle Skala (eine Farbe, hell → dunkel); im Dark Mode eigene Stufen
const HEAT = [
  'bg-slate-200 dark:bg-slate-800',
  'bg-sky-200 dark:bg-sky-900',
  'bg-sky-400 dark:bg-sky-700',
  'bg-sky-600 dark:bg-sky-500',
  'bg-sky-800 dark:bg-sky-300',
];
const pct = (r: number) => `${Math.round(r * 100)} %`;
const dateDe = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

function Heatmap({ activity }: { activity: Map<string, number> }) {
  const weeks = useMemo(() => heatmapWeeks(26, Date.now()), []);
  const [sel, setSel] = useState<{ ts: number; n: number } | null>(null);
  const total = weeks.flat().reduce((s, d) => s + (activity.get(d.key) ?? 0), 0);
  const days = weeks.flat().filter((d) => (activity.get(d.key) ?? 0) > 0).length;
  return (
    <Panel className="mb-4">
      <h2 className="font-semibold">Lernaktivität (letzte 26 Wochen)</h2>
      <p className="mb-3 text-xs text-slate-500">{total} Aktivitäten (Kartenbewertungen + Rechenaufgaben) an {days} {days === 1 ? 'Tag' : 'Tagen'} · Tippe auf einen Tag für Details</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]" role="grid" aria-label="Kalender der Lernaktivität">
          <div className="mr-1 flex flex-col gap-[3px] text-[10px] leading-[14px] text-slate-500" aria-hidden>
            {['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((d, i) => <span key={i} className="h-3.5">{d}</span>)}
          </div>
          {weeks.map((col, w) => (
            <div key={w} className="flex flex-col gap-[3px]" role="row">
              {col.map((d) => {
                const n = activity.get(d.key) ?? 0;
                const label = `${dateDe(d.ts)}: ${n} ${n === 1 ? 'Aktivität' : 'Aktivitäten'}`;
                return d.future ? (
                  <span key={d.key} className="h-3.5 w-3.5" />
                ) : (
                  <button
                    key={d.key}
                    type="button"
                    role="gridcell"
                    title={label}
                    aria-label={label}
                    onClick={() => setSel({ ts: d.ts, n })}
                    className={`h-3.5 w-3.5 rounded-[3px] ${HEAT[level(n)]} ${sel?.ts === d.ts ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-900' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{sel ? `${dateDe(sel.ts)}: ${sel.n} ${sel.n === 1 ? 'Aktivität' : 'Aktivitäten'}` : ' '}</span>
        <span className="flex items-center gap-1">
          weniger {HEAT.map((c, i) => <span key={i} className={`h-3 w-3 rounded-[3px] ${c}`} />)} mehr
        </span>
      </div>
    </Panel>
  );
}

/** horizontaler Balken: Anteil gewusst (eine Farbe, Wert als Text daneben) */
function Bar({ rate, n }: { rate: number; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {n > 0 && <div className="h-full rounded-full bg-sky-600 dark:bg-sky-400" style={{ width: `${Math.max(2, rate * 100)}%` }} />}
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{n ? `${pct(rate)} (${n})` : '–'}</span>
    </div>
  );
}

type SortKey = 'topic' | 'rate' | 'n' | 'progress';

function TopicTable({ rows }: { rows: TopicRow[] }) {
  const [sort, setSort] = useState<SortKey>('rate');
  const [area, setArea] = useState<Area | 'ALL'>('ALL');
  const sorted = rows
    .filter((r) => area === 'ALL' || r.area === area)
    .sort((a, b) => {
      if (sort === 'topic') return a.topic.localeCompare(b.topic, 'de');
      if (sort === 'n') return b.q.n - a.q.n;
      if (sort === 'progress') return a.learned / a.total - b.learned / b.total;
      return (a.q.n ? a.q.rate : 2) - (b.q.n ? b.q.rate : 2);
    });
  const th = (k: SortKey, label: string, right = false) => (
    <th className={`py-1.5 font-medium ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => setSort(k)} className={sort === k ? 'text-sky-600 dark:text-sky-400' : ''}>
        {label}{sort === k ? ' ↓' : ''}
      </button>
    </th>
  );
  return (
    <Panel className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-semibold">Alle Themen</h2>
        <select value={area} onChange={(e) => setArea(e.target.value as Area | 'ALL')} className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-700" aria-label="Bereich filtern">
          <option value="ALL">alle Bereiche</option>
          {AREAS.map((a) => <option key={a} value={a}>{AREA_META[a].short}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              {th('topic', 'Thema')}
              {th('progress', 'Gelernt', true)}
              {th('n', 'Bew.', true)}
              {th('rate', 'Quote', true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.topic} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-1.5 pr-2">
                  <Link to={`/karten?${filterToParams({ topics: [r.topic] })}`} className="hover:underline">{r.topic}</Link>
                  <span className="ml-1 text-xs text-slate-500">{AREA_META[r.area].short}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.learned}/{r.total}</td>
                <td className="py-1.5 text-right tabular-nums">{r.q.n}</td>
                <td className="py-1.5 text-right tabular-nums">{r.q.n ? pct(r.q.rate) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function StatsPage() {
  const cards = useAllCards();
  const states = useCardStates();
  const logs = useLiveQuery(() => db.reviewLog.toArray(), []);
  const tlogs = useLiveQuery(() => db.trainerLog.toArray(), []);
  const exams = useLiveQuery(() => db.examResults.orderBy('ts').reverse().limit(10).toArray(), []);

  const data = useMemo(() => {
    if (!logs || !tlogs || !states) return null;
    const now = Date.now();
    const last30 = logs.filter((l) => l.ts >= now - 30 * DAY_MS);
    const minutes = Math.round((logs.reduce((s, l) => s + l.durationMs, 0) + tlogs.reduce((s, t) => s + t.durationMs, 0)) / 60000);
    const learned = cards.filter((c) => !isNew(states.get(c.id)?.fsrs)).length;
    const rows = topicRows(cards, states, logs);
    const perTrainer = TRAINERS.map((t) => {
      const l = tlogs.filter((x) => x.trainer === t.id);
      return { t, n: l.length, ok: l.filter((x) => x.correct).length, ms: l.reduce((s, x) => s + x.durationMs, 0) };
    });
    return {
      minutes,
      learned,
      reviews: logs.length,
      q30: quoteBy(last30, () => 'all').get('all'),
      perArea: quoteBy(logs, (l) => l.area),
      rows,
      weak: weakestTopics(rows),
      activity: activityByDay(logs, tlogs),
      perTrainer,
    };
  }, [cards, states, logs, tlogs]);

  if (!data) return <div className="p-8 text-center text-slate-500">Lade …</div>;

  return (
    <>
      <PageTitle sub="Quote = Anteil der Bewertungen mit „Gut“ oder „Einfach“ (inkl. WiSo-Tests und Simulationen).">Statistik</PageTitle>
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Lernzeit gesamt" value={data.minutes >= 120 ? `${(data.minutes / 60).toFixed(1).replace('.', ',')} h` : `${data.minutes} Min`} />
          <Stat label="Karten gelernt" value={data.learned} hint={`von ${cards.length}`} />
          <Stat label="Bewertungen" value={data.reviews} />
          <Stat label="Quote (30 Tage)" value={data.q30 ? pct(data.q30.rate) : '–'} hint={data.q30 ? `${data.q30.n} Bewertungen` : 'noch keine Daten'} />
        </div>
      </Panel>

      <Heatmap activity={data.activity} />

      <Panel className="mb-4">
        <h2 className="mb-3 font-semibold">Quote je Prüfungsbereich</h2>
        <div className="space-y-3">
          {AREAS.map((a) => {
            const q = data.perArea.get(a);
            return (
              <div key={a}>
                <div className="mb-1 text-sm">{AREA_META[a].label}</div>
                <Bar rate={q?.rate ?? 0} n={q?.n ?? 0} />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="mb-4">
        <h2 className="font-semibold">Top 10 schwächste Themen</h2>
        <p className="mb-3 text-xs text-slate-500">Themen mit mindestens 3 Bewertungen, niedrigste Quote zuerst.</p>
        {data.weak.length === 0 ? (
          <p className="text-sm text-slate-500">Noch zu wenige Daten – lerne ein paar Karten, dann erscheinen hier deine Schwachstellen.</p>
        ) : (
          <ol className="space-y-2.5">
            {data.weak.map((r, i) => (
              <li key={r.topic}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-xs tabular-nums text-slate-500">{i + 1}.</span>
                  <span className="flex-1">{r.topic} <span className="text-xs text-slate-500">{AREA_META[r.area].short}</span></span>
                  <Link to={`/lernen?${filterToParams({ topics: [r.topic] }, { cram: true })}`} className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400">üben</Link>
                </div>
                <div className="pl-7"><Bar rate={r.q.rate} n={r.q.n} /></div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <TopicTable rows={data.rows} />

      <Panel className="mb-4">
        <h2 className="mb-2 font-semibold">Rechen-Trainer</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1.5 font-medium">Trainer</th>
                <th className="py-1.5 text-right font-medium">Aufg.</th>
                <th className="py-1.5 text-right font-medium">Quote</th>
                <th className="py-1.5 text-right font-medium">Ø Zeit</th>
              </tr>
            </thead>
            <tbody>
              {data.perTrainer.map(({ t, n, ok, ms }) => (
                <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1.5"><Link to={`/rechnen/${t.id}`} className="hover:underline">{t.title}</Link></td>
                  <td className="py-1.5 text-right tabular-nums">{n}</td>
                  <td className="py-1.5 text-right tabular-nums">{n ? pct(ok / n) : '–'}</td>
                  <td className="py-1.5 text-right tabular-nums">{n ? `${Math.round(ms / n / 1000)} s` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-2 font-semibold">Tests & Simulationen</h2>
        {exams?.length ? (
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {exams.map((r) => {
              const p = (r.points / r.maxPoints) * 100;
              return (
                <li key={r.id} className="flex justify-between gap-2 py-2">
                  <span>{r.kind === 'WISO' ? 'WiSo-Test' : `Simulation ${r.kind}`} · {new Date(r.ts).toLocaleDateString('de-DE')}</span>
                  <span className="tabular-nums">{Math.round(p)} Punkte · Note {gradeFromPoints(p)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Noch keine Ergebnisse. Starte einen <Link to="/wiso" className="text-sky-600 underline dark:text-sky-400">WiSo-Test</Link> oder eine{' '}
            <Link to="/simulation" className="text-sky-600 underline dark:text-sky-400">Prüfungssimulation</Link>.
          </p>
        )}
      </Panel>
    </>
  );
}
