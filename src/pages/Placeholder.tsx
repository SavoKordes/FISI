import { LinkButton, PageTitle, Panel } from '../components/ui';

export function Placeholder({ title, milestone }: { title: string; milestone?: number }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Panel>
        <p className="text-slate-600 dark:text-slate-300">
          {milestone ? `Dieser Bereich folgt in Meilenstein ${milestone}.` : 'Diese Seite gibt es nicht.'}
        </p>
        <LinkButton to="/" variant="secondary" className="mt-4">
          Zur Startseite
        </LinkButton>
      </Panel>
    </>
  );
}
