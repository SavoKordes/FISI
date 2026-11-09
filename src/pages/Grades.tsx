import { useEffect, useState } from 'react';
import { AREA_LABELS, evaluate, GRADE_LABEL, gradeFromPoints, supplementOptions, WEIGHTS, type AreaKey, type Scores } from '../grading/ihk';
import { Button, PageTitle, Panel } from '../components/ui';
import { IconCheck, IconX } from '../components/icons';

const KEY = 'fisi-notenrechner';
const EMPTY: Record<keyof Scores, string> = { ap1: '', doku: '', praesentation: '', fachgespraech: '', ka: '', net: '', wiso: '' };

const FIELDS: { key: keyof Scores; label: string; weight: number; group: string }[] = [
  { key: 'ap1', label: 'AP Teil 1 (Einrichten eines IT-gestützten Arbeitsplatzes)', weight: WEIGHTS.ap1, group: 'Teil 1' },
  { key: 'doku', label: 'Projektdokumentation', weight: WEIGHTS.doku, group: 'Projekt' },
  { key: 'praesentation', label: 'Präsentation', weight: WEIGHTS.praesentation, group: 'Projekt' },
  { key: 'fachgespraech', label: 'Fachgespräch', weight: WEIGHTS.fachgespraech, group: 'Projekt' },
  { key: 'ka', label: 'Konzeption und Administration von IT-Systemen', weight: WEIGHTS.ka, group: 'Schriftlich' },
  { key: 'net', label: 'Analyse und Entwicklung von Netzwerken', weight: WEIGHTS.net, group: 'Schriftlich' },
  { key: 'wiso', label: 'Wirtschafts- und Sozialkunde', weight: WEIGHTS.wiso, group: 'Schriftlich' },
];

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

function load(): Record<keyof Scores, string> {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

function GradeBadge({ points }: { points: number }) {
  const g = gradeFromPoints(points);
  const cls = g <= 2 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : g <= 4 ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>Note {g} · {GRADE_LABEL[g]}</span>;
}

export function GradesPage() {
  const [raw, setRaw] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch {
      /* egal */
    }
  }, [raw]);

  const parsed = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? NaN : Math.min(100, Math.max(0, Number(v.replace(',', '.'))))])) as Scores;
  const complete = Object.values(parsed).every((v) => Number.isFinite(v));
  const ev = complete ? evaluate(parsed) : null;
  const options = complete ? supplementOptions(parsed) : [];

  return (
    <>
      <PageTitle sub="Punkte (0–100) je Prüfungsteil eingeben – Gesamtergebnis, Bestehensprüfung und Hinweis zur mündlichen Ergänzungsprüfung.">Notenrechner</PageTitle>
      <Panel className="mb-4">
        <div className="space-y-3">
          {FIELDS.map((f) => {
            const v = parsed[f.key];
            return (
              <div key={f.key} className="flex items-center gap-3">
                <label htmlFor={`n-${f.key}`} className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{f.label}</span>
                  <span className="text-xs text-slate-500">{f.group} · {fmt(f.weight)} % des Gesamtergebnisses</span>
                </label>
                {Number.isFinite(v) && <span className="hidden sm:block"><GradeBadge points={v} /></span>}
                <input
                  id={`n-${f.key}`}
                  inputMode="decimal"
                  value={raw[f.key]}
                  onChange={(e) => setRaw({ ...raw, [f.key]: e.target.value.replace(/[^\d.,]/g, '') })}
                  placeholder="0–100"
                  className="w-20 rounded-xl border border-slate-300 bg-transparent px-2 py-2 text-right text-sm tabular-nums dark:border-slate-700"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={() => setRaw(EMPTY)}>Zurücksetzen</Button>
        </div>
      </Panel>

      {!ev ? (
        <p className="text-center text-sm text-slate-500">Alle sieben Felder ausfüllen, um das Ergebnis zu sehen. (Noch nicht bekannte Werte schätzen – z. B. aus der Prüfungssimulation.)</p>
      ) : (
        <>
          <Panel className={`mb-4 ${ev.passed ? 'border-emerald-400 dark:border-emerald-700' : 'border-rose-400 dark:border-rose-700'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${ev.passed ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
                {ev.passed ? <IconCheck className="h-7 w-7" /> : <IconX className="h-7 w-7" />}
              </div>
              <div>
                <div className="text-xl font-bold">{ev.passed ? 'Bestanden' : 'Nicht bestanden'}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Gesamt {fmt(ev.total)} Punkte · Note {ev.grade} ({GRADE_LABEL[ev.grade]}) · Teil 2: {fmt(ev.ap2)} Punkte
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {ev.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.ok ? <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <IconX className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                  <span>
                    {c.label} – <span className="text-slate-500">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="mb-4 overflow-x-auto">
            <h2 className="mb-2 font-semibold">Prüfungsbereiche Teil 2</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 font-medium">Bereich</th>
                  <th className="py-1 text-right font-medium">Punkte</th>
                  <th className="py-1 pl-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(ev.areas) as AreaKey[]).map((k) => (
                  <tr key={k} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1.5 pr-2">{AREA_LABELS[k]}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(ev.areas[k])}</td>
                    <td className="py-1.5 pl-2"><GradeBadge points={ev.areas[k]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {!ev.passed && (
            <Panel className="mb-4">
              <h2 className="font-semibold">Mündliche Ergänzungsprüfung</h2>
              {options.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Eine Ergänzungsprüfung ist nur in einem <b>schriftlichen</b> Bereich von Teil 2 (KA, NET, WiSo) möglich, der unter 50 Punkten liegt. Hier kommt keiner infrage.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Auf Antrag kann <b>ein</b> schriftlicher Bereich mit weniger als 50 Punkten mündlich ergänzt werden (ca. 15 Minuten), wenn das für das Bestehen den Ausschlag geben kann. Schriftliches und mündliches Ergebnis zählen im Verhältnis <b>2 : 1</b>.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {options.map((o, i) => (
                      <li key={o.area} className={`rounded-xl p-3 ${i === 0 && o.needed !== null ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-100 dark:bg-slate-800/60'}`}>
                        <b>{AREA_LABELS[o.area]}</b> (bisher {fmt(o.current)} Punkte):{' '}
                        {o.needed === null ? (
                          <span className="text-rose-600">reicht allein nicht zum Bestehen.</span>
                        ) : (
                          <>
                            mindestens <b>{o.needed} Punkte</b> mündlich nötig
                            {i === 0 && ' – lohnt sich am meisten'}.
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}
        </>
      )}
      <p className="text-center text-xs text-slate-500">
        Berechnung nach AO 2020 (FISI) mit den oben genannten Gewichten, ohne Zwischenrundung. Maßgeblich sind die Regeln und Rundungen der zuständigen IHK.
      </p>
    </>
  );
}
