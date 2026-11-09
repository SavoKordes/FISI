import { setSetting, useSettings, type Theme } from '../db/settings';
import { IconMonitor, IconMoon, IconSun } from './icons';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };

/** Schnellumschalter: System → Hell → Dunkel */
export function ThemeToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const s = useSettings();
  const theme = s?.theme ?? 'system';
  const Icon = theme === 'dark' ? IconMoon : theme === 'light' ? IconSun : IconMonitor;
  return (
    <button
      type="button"
      onClick={() => setSetting('theme', NEXT[theme])}
      aria-label={`Darstellung: ${LABEL[theme]} (wechseln zu ${LABEL[NEXT[theme]]})`}
      title={`Darstellung: ${LABEL[theme]}`}
      className={`flex items-center gap-3 rounded-lg p-2 text-left whitespace-nowrap text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <Icon className="h-5 w-5" />
      {withLabel && <span className="text-sm font-medium">Darstellung: {LABEL[theme]}</span>}
    </button>
  );
}
