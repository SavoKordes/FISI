import { useMemo } from 'react';
import { Link } from 'react-router';
import { AREA_META } from '../content/meta';
import { AREAS } from '../content/constants';
import { useSettings } from '../db/settings';
import { useAllCards, useCardStates, useReviewLogs } from '../hooks/data';
import { isDue, isNew } from '../srs/fsrs';
import { buildQueue, dayKey, DAY_MS, estimateMinutes, newIntroducedToday, startOfDay, streak, topicFailRates } from '../srs/queue';
import { IconClock, IconFlame } from '../components/icons';
import { LinkButton, PageTitle, Panel, Stat } from '../components/ui';
import { filterToParams } from '../srs/filterParams';

export function TodayPage() {
  const settings = useSettings();
  const cards = useAllCards();
  const states = useCardStates();
  const now = Date.now();
  const logs = useReviewLogs(startOfDay(now) - 400 * DAY_MS);

  const data = useMemo(() => {
    if (!settings || !states || !logs) return null;
    const remainingNew = Math.max(0, settings.newPerDay - newIntroducedToday(logs, now));
    const q = buildQueue({ cards, states, newLimit: remainingNew, now, examDate: settings.examDate, failRates: topicFailRates(logs) });
    const days = new Set(logs.map((l) => dayKey(l.ts)));
    const todayLogs = logs.filter((l) => l.ts >= startOfDay(now));
    const perArea = AREAS.map((area) => {
      const ac = cards.filter((c) => c.area === area);
      const learned = ac.filter((c) => !isNew(states.get(c.id)?.fsrs)).length;
      const due = ac.filter((c) => isDue(states.get(c.id)?.fsrs, now)).length;
      return { area, total: ac.length, learned, due };
    });
    return { q, remainingNew, streak: streak(days, now), todayCount: todayLogs.length, todayMin: Math.round(todayLogs.reduce((s, l) => s + l.durationMs, 0) / 60000), perArea };
  }, [settings, cards, states, logs]);

  if (!data || !settings) return <div className="p-8 text-center text-slate-500">Lade …</div>;
  const { q } = data;
  const total = q.due.length + q.fresh.length + q.early.length;
  const dateStr = new Date(now).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageTitle sub={dateStr}>Heute</PageTitle>

      {settings.examDate && q.endspurt.daysLeft >= 0 && (
        <Panel className={`mb-4 ${q.endspurt.active ? 'border-amber-400 dark:border-amber-600' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Schriftliche AP2 am {new Date(settings.examDate + 'T00:00:00').toLocaleDateString('de-DE')}</div>
              <div className="text-xl font-bold">
                {q.endspurt.daysLeft === 0 ? 'Heute ist Prüfung – viel Erfolg!' : `noch ${q.endspurt.daysLeft} ${q.endspurt.daysLeft === 1 ? 'Tag' : 'Tage'}`}
              </div>
            </div>
            {q.endspurt.active && (
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Endspurt aktiv
              </span>
            )}
          </div>
          {q.endspurt.active && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Karten mit hoher Prüfungsrelevanz und Themen mit schlechter Quote werden jetzt stärker gewichtet
              {q.endspurt.daysLeft <= 21 && ', wichtige Karten werden vorgezogen'}.
            </p>
          )}
        </Panel>
      )}

      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fällig" value={q.due.length + q.early.length} hint={q.early.length ? `davon ${q.early.length} vorgezogen` : 'Wiederholungen'} />
          <Stat label="Neu" value={q.fresh.length} hint={`Limit ${settings.newPerDay}/Tag`} />
          <Stat label="Lernzeit" value={<span className="flex items-center gap-1"><IconClock className="h-5 w-5" />{estimateMinutes(q.due.length + q.early.length, q.fresh.length)}′</span>} hint="geschätzt" />
          <Stat label="Serie" value={<span className="flex items-center gap-1"><IconFlame className="h-5 w-5 text-orange-500" />{data.streak}</span>} hint={data.streak === 1 ? 'Tag' : 'Tage'} />
        </div>
        <div className="mt-4">
          {total > 0 ? (
            <LinkButton to="/lernen" className="w-full py-3 text-base">
              Lernen starten ({total})
            </LinkButton>
          ) : (
            <div className="space-y-3 text-center">
              <p className="font-medium">Für heute ist alles erledigt. 🎉</p>
              <LinkButton to={`/lernen?${filterToParams({}, { extra: 10 })}`} variant="secondary" className="w-full">
                10 weitere neue Karten lernen
              </LinkButton>
            </div>
          )}
        </div>
        {data.todayCount > 0 && (
          <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
            Heute schon {data.todayCount} Bewertungen in ca. {data.todayMin} Min.
          </p>
        )}
      </Panel>

      <h2 className="mb-2 text-lg font-semibold">Prüfungsbereiche</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.perArea.map(({ area, total, learned, due }) => (
          <Link key={area} to={`/karten?${filterToParams({ areas: [area] })}`} className="block">
            <Panel className="h-full transition-colors hover:border-sky-400">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${AREA_META[area].color}`} />
                <span className="font-semibold">{AREA_META[area].short}</span>
                {due > 0 && <span className="ml-auto text-xs font-medium text-sky-600 dark:text-sky-400">{due} fällig</span>}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{AREA_META[area].label}</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full ${AREA_META[area].color}`} style={{ width: `${total ? (learned / total) * 100 : 0}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {learned} von {total} Karten gelernt
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Prüfung trainieren</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/wiso', title: 'WiSo-Test', text: 'Multiple Choice, 60-Min.-Simulation' },
          { to: '/simulation', title: 'Simulation', text: 'KA/NET mit Timer und Note' },
          { to: '/noten', title: 'Notenrechner', text: 'Bestehen & Ergänzungsprüfung' },
          { to: '/checkliste', title: 'Projekt', text: 'Checkliste Antrag bis Fachgespräch' },
        ].map((t) => (
          <Link key={t.to} to={t.to} className="block">
            <Panel className="h-full p-3 transition-colors hover:border-sky-400">
              <div className="font-semibold">{t.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.text}</div>
            </Panel>
          </Link>
        ))}
      </div>

      {!settings.examDate && (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Tipp: Trag in den <Link to="/einstellungen" className="text-sky-600 underline dark:text-sky-400">Einstellungen</Link> dein
          Prüfungsdatum ein – dann gibt es einen Countdown und den Endspurt-Modus.
        </p>
      )}
    </>
  );
}
