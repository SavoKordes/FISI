import { useState } from 'react';
import type { Card } from '../content/schema';
import type { CardStateRow } from '../db/db';
import { reportCard, saveNote, toggleStar } from '../srs/actions';
import { IconFlag, IconNote, IconStar } from './icons';
import { Button, Modal } from './ui';

/** Stern, Notiz, Fehler melden – an jeder Karte */
export function CardTools({ card, state }: { card: Card; state?: CardStateRow }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState('');
  const [report, setReport] = useState('');
  const [sent, setSent] = useState(false);

  const btn = 'rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800';
  return (
    <>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => toggleStar(card.id)} aria-label={state?.starred ? 'Markierung entfernen' : 'Karte markieren'} title="Markieren (S)">
          <IconStar filled={state?.starred} className={`h-5 w-5 ${state?.starred ? 'text-amber-500' : ''}`} />
        </button>
        <button type="button" className={btn} onClick={() => { setNote(state?.note ?? ''); setNoteOpen(true); }} aria-label="Notiz" title="Notiz">
          <IconNote className={`h-5 w-5 ${state?.note ? 'text-sky-500' : ''}`} />
        </button>
        <button type="button" className={btn} onClick={() => { setReport(''); setSent(false); setReportOpen(true); }} aria-label="Fehler melden" title="Fehler melden">
          <IconFlag className="h-5 w-5" />
        </button>
      </div>

      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="Eigene Notiz">
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
          placeholder="Eselsbrücke, Ergänzung aus dem Berufsschulunterricht …"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNoteOpen(false)}>Abbrechen</Button>
          <Button onClick={async () => { await saveNote(card.id, note); setNoteOpen(false); }}>Speichern</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Karte als fehlerhaft melden">
        {sent ? (
          <>
            <p className="text-sm">Gespeichert. Die Meldung findest du unter Einstellungen → „Gemeldete Karten“ und kannst sie dort exportieren.</p>
            <div className="mt-3 flex justify-end"><Button onClick={() => setReportOpen(false)}>OK</Button></div>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">Karte {card.id}</p>
            <textarea
              autoFocus
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"
              placeholder="Was ist falsch oder unklar?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReportOpen(false)}>Abbrechen</Button>
              <Button disabled={!report.trim()} onClick={async () => { await reportCard(card.id, report); setSent(true); }}>Melden</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
