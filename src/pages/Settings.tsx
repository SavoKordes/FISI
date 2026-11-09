import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TABLES } from '../db/db';
import { setSetting, useSettings, type Theme } from '../db/settings';
import { createBackup, downloadJson, parseBackup, restoreBackup } from '../db/backup';
import { Button, PageTitle, Panel } from '../components/ui';

const today = () => new Date().toISOString().slice(0, 10);

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const input = 'rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700';

export function SettingsPage() {
  const s = useSettings();
  const reports = useLiveQuery(() => db.reports.orderBy('ts').reverse().toArray(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');

  if (!s) return null;

  const onImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (mode === 'replace' && !confirm('Alle lokalen Lerndaten werden durch das Backup ersetzt. Fortfahren?')) return;
      await restoreBackup(backup, mode);
      setMsg({ ok: true, text: `Backup vom ${new Date(backup.exportedAt).toLocaleString('de-DE')} eingespielt.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <PageTitle>Einstellungen</PageTitle>

      <Panel className="mb-4 divide-y divide-slate-200 dark:divide-slate-800">
        <h2 className="pb-2 text-lg font-semibold">Lernen</h2>
        <Row label="Neue Karten pro Tag" hint="Standard 20 – bei wenig Zeit bis zur Prüfung gern höher">
          <input
            type="number"
            min={0}
            max={200}
            value={s.newPerDay}
            onChange={(e) => setSetting('newPerDay', Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
            className={`${input} w-24`}
          />
        </Row>
        <Row label="Prüfungsdatum (schriftliche AP2)" hint="Countdown + Endspurt-Modus in den letzten 60 Tagen">
          <div className="flex gap-2">
            <input type="date" min={today()} value={s.examDate ?? ''} onChange={(e) => setSetting('examDate', e.target.value || null)} className={input} />
            {s.examDate && <Button variant="ghost" onClick={() => setSetting('examDate', null)}>Löschen</Button>}
          </div>
        </Row>
        <Row label="Darstellung">
          <select value={s.theme} onChange={(e) => setSetting('theme', e.target.value as Theme)} className={input}>
            <option value="system">wie System</option>
            <option value="light">hell</option>
            <option value="dark">dunkel</option>
          </select>
        </Row>
      </Panel>

      <Panel className="mb-4">
        <h2 className="text-lg font-semibold">Backup & Gerätewechsel</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Alle Daten liegen nur lokal in diesem Browser. Exportiere regelmäßig ein Backup – damit kannst du auch zwischen Handy und PC wechseln.
          Der API-Key wird nicht mit exportiert.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button onClick={async () => downloadJson(await createBackup(), `fisi-trainer-backup-${today()}.json`)}>Backup exportieren</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Backup importieren …</Button>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'merge')} className={input} aria-label="Import-Modus">
            <option value="merge">zusammenführen</option>
            <option value="replace">ersetzen</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
      </Panel>

      <Panel className="mb-4">
        <h2 className="text-lg font-semibold">Gemeldete Karten ({reports?.length ?? 0})</h2>
        {reports?.length ? (
          <>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
              {reports.map((r) => (
                <li key={r.id} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                  <div className="text-xs text-slate-500">{r.cardId} · {new Date(r.ts).toLocaleString('de-DE')}</div>
                  {r.text}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => downloadJson(reports, `fisi-meldungen-${today()}.json`)}>Als JSON exportieren</Button>
              <Button variant="ghost" onClick={() => confirm('Alle Meldungen löschen?') && db.reports.clear()}>Liste leeren</Button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Noch keine Meldungen. Über das Fähnchen an jeder Karte kannst du Fehler notieren.</p>
        )}
      </Panel>

      <Panel className="mb-4">
        <h2 className="text-lg font-semibold">Daten zurücksetzen</h2>
        <p className="mt-1 text-sm text-slate-500">Löscht den gesamten Lernfortschritt auf diesem Gerät (Einstellungen bleiben).</p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={async () => {
            if (!confirm('Wirklich den gesamten Lernfortschritt löschen? Das kann nicht rückgängig gemacht werden.')) return;
            await db.transaction('rw', TABLES.filter((t) => t !== 'settings').map((t) => db.table(t)), async () => {
              for (const t of TABLES) if (t !== 'settings') await db.table(t).clear();
            });
            setMsg({ ok: true, text: 'Lernfortschritt gelöscht.' });
          }}
        >
          Fortschritt löschen
        </Button>
      </Panel>

      <p className="text-center text-xs text-slate-400">
        FISI-Prüfungstrainer · Inhalte ohne Gewähr · Vorgaben deiner IHK haben Vorrang.
      </p>
    </>
  );
}
