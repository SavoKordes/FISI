import { Link } from 'react-router';
import { useAiReady } from '../ai/useAi';
import { IconChevron, IconSpark } from '../components/icons';
import { LinkButton, PageTitle, Panel } from '../components/ui';

const TOOLS = [
  { to: '/ki/bewerten', title: 'Offene Antwort bewerten', text: 'Schreib deine Antwort zu einer KA-/NET-/Projekt-Aufgabe – Claude bewertet wie ein IHK-Prüfer mit Punkten und Verbesserungen.' },
  { to: '/ki/generieren', title: 'Neue Übungsaufgaben', text: 'Aufgaben im IHK-Stil zu einem Thema deiner Wahl erzeugen und als Karte speichern („KI-generiert“).' },
  { to: '/ki/fachgespraech', title: 'Fachgespräch-Simulator', text: 'Claude spielt den Prüfungsausschuss, fragt ca. 15 Minuten zu deinem Projekt und gibt Feedback mit Notentendenz.' },
  { to: '/ki/praesentation', title: 'Präsentations-Coach', text: 'Foliengliederung oder Sprechtext einfügen – Feedback zu Aufbau, Zeit (12–15 Min.) und Zielgruppe.' },
];

export function AiPage() {
  const ready = useAiReady();
  return (
    <>
      <PageTitle sub="Optionaler Lernpartner über die Claude API – die App funktioniert auch ohne.">KI-Tutor</PageTitle>
      {!ready && (
        <Panel className="mb-4">
          <div className="flex items-start gap-3">
            <IconSpark className="mt-0.5 h-6 w-6 shrink-0 text-violet-500" />
            <div>
              <h2 className="font-semibold">KI-Tutor einrichten</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Schalte den KI-Tutor in den Einstellungen ein und hinterlege deinen eigenen Anthropic-API-Key. Der Key bleibt nur auf diesem Gerät. Danach erscheint
                außerdem an jeder Karte und jedem Rechenweg ein Button „Erklär mir das“.
              </p>
              <LinkButton to="/einstellungen?ki=1" className="mt-3">
                Zu den Einstellungen
              </LinkButton>
            </div>
          </div>
        </Panel>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className={`block ${ready ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!ready}>
            <Panel className="h-full transition-colors hover:border-violet-400">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 font-semibold">{t.title}</h2>
                <IconChevron className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.text}</p>
            </Panel>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        KI-Antworten können Fehler enthalten. Für die Bewertung zählen in der Prüfung die IHK-Lösungshinweise – nutze die KI als Übungspartner, nicht als Quelle.
      </p>
    </>
  );
}
