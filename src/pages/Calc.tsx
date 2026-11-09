import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { db } from '../db/db';
import { TRAINERS } from '../trainers/registry';
import { PageTitle, Panel } from '../components/ui';
import { IconChevron } from '../components/icons';

export function CalcPage() {
  const logs = useLiveQuery(() => db.trainerLog.toArray(), []);
  const stats = new Map<string, { n: number; ok: number; ms: number }>();
  for (const l of logs ?? []) {
    const s = stats.get(l.trainer) ?? { n: 0, ok: 0, ms: 0 };
    s.n++;
    if (l.correct) s.ok++;
    s.ms += l.durationMs;
    stats.set(l.trainer, s);
  }
  return (
    <>
      <PageTitle sub="Unendlich viele Zufallsaufgaben mit Rechenweg wie auf dem Prüfungspapier. In der Prüfung ist nur ein nicht programmierbarer Taschenrechner erlaubt – rechne mit Papier und einfachem Rechner mit.">
        Rechen-Trainer
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {TRAINERS.map((t) => {
          const s = stats.get(t.id);
          return (
            <Link key={t.id} to={`/rechnen/${t.id}`} className="block">
              <Panel className="h-full transition-colors hover:border-sky-400">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 font-semibold">{t.title}</h2>
                  <IconChevron className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {s ? (
                    <>
                      <span className={`font-semibold ${s.ok / s.n >= 0.8 ? 'text-emerald-600' : s.ok / s.n >= 0.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {Math.round((s.ok / s.n) * 100)} % richtig
                      </span>{' '}
                      · {s.n} Aufgaben · Ø {Math.round(s.ms / s.n / 1000)} s
                    </>
                  ) : (
                    'noch nicht geübt'
                  )}
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </>
  );
}
