import { useLiveQuery } from 'dexie-react-hooks';
import { CHECKLIST } from '../content/checklist';
import { db } from '../db/db';
import { Button, PageTitle, Panel } from '../components/ui';

export function ChecklistPage() {
  const rows = useLiveQuery(() => db.checklist.toArray(), []);
  const done = new Set(rows?.filter((r) => r.done).map((r) => r.id));
  const total = CHECKLIST.reduce((s, g) => s + g.items.length, 0);
  const toggle = (id: string) => db.checklist.put({ id, done: !done.has(id), ts: Date.now() });

  return (
    <>
      <PageTitle sub="Abhaken, was erledigt ist. Wird lokal gespeichert und ist im Backup enthalten.">Projekt-Checkliste</PageTitle>
      <Panel className="mb-4">
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done.size / total) * 100}%` }} />
          </div>
          <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{done.size}/{total}</span>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <b>Wichtig:</b> Die Vorgaben deiner IHK (Merkblatt, Fristen, Seitenumfang, Formatierung, KI-Kennzeichnung) haben Vorrang vor dieser allgemeinen Liste.
        </p>
      </Panel>
      {CHECKLIST.map((g) => {
        const n = g.items.filter((i) => done.has(i.id)).length;
        return (
          <Panel key={g.id} className="mb-4">
            <h2 className="mb-2 flex items-center justify-between font-semibold">
              {g.title}
              <span className={`text-xs font-medium ${n === g.items.length ? 'text-emerald-600' : 'text-slate-500'}`}>{n}/{g.items.length}</span>
            </h2>
            <ul className="space-y-1">
              {g.items.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <input type="checkbox" checked={done.has(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
                    <span className="text-sm">
                      <span className={done.has(i.id) ? 'text-slate-500 line-through' : ''}>{i.text}</span>
                      {i.hint && <span className="block text-xs text-slate-500">{i.hint}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
      <div className="text-center">
        <Button variant="ghost" onClick={() => confirm('Alle Haken entfernen?') && db.checklist.clear()}>Checkliste zurücksetzen</Button>
      </div>
    </>
  );
}
