import { LinkButton, PageTitle, Panel } from '../components/ui';

export function Placeholder({ title, text, action }: { title: string; text?: string; action?: { to: string; label: string } }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Panel>
        <p className="text-slate-600 dark:text-slate-300">{text ?? 'Diese Seite gibt es nicht.'}</p>
        <LinkButton to={action?.to ?? '/'} variant={action ? 'primary' : 'secondary'} className="mt-4">
          {action?.label ?? 'Zur Startseite'}
        </LinkButton>
      </Panel>
    </>
  );
}

export function AiNotReady() {
  return (
    <Placeholder
      title="KI-Tutor nicht eingerichtet"
      text="Schalte den KI-Tutor in den Einstellungen ein und hinterlege deinen API-Key – der Rest der App funktioniert auch ohne."
      action={{ to: '/einstellungen?ki=1', label: 'Zu den Einstellungen' }}
    />
  );
}
