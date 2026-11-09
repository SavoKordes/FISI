import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { IconCalc, IconCards, IconChart, IconHome, IconSettings, IconSpark } from '../components/icons';
import { Button } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

export const NAV = [
  { to: '/', label: 'Heute', icon: IconHome, end: true },
  { to: '/karten', label: 'Karten', icon: IconCards },
  { to: '/rechnen', label: 'Rechnen', icon: IconCalc },
  { to: '/ki', label: 'KI', icon: IconSpark },
  { to: '/statistik', label: 'Statistik', icon: IconChart },
];

export const MORE_NAV: { to: string; label: string }[] = [];

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  // „offline nutzbar“ ist nur ein Hinweis – nach ein paar Sekunden ausblenden
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 p-3 text-sm text-white shadow-lg lg:top-auto lg:bottom-4 dark:bg-slate-700">
      <span className="flex-1">{needRefresh ? 'Neue Version verfügbar.' : 'App ist jetzt offline nutzbar.'}</span>
      {needRefresh && (
        <Button className="min-h-9 py-1" onClick={() => updateServiceWorker(true)}>
          Aktualisieren
        </Button>
      )}
      <Button
        variant="ghost"
        className="min-h-9 py-1 text-white hover:bg-white/10 dark:text-white"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function Layout() {
  const { pathname } = useLocation();
  const focusMode = pathname.startsWith('/lernen');

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (Desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2 px-2 pt-2">
          <img src="icon.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="font-bold">FISI-Trainer</div>
            <div className="text-xs text-slate-500">AP2 Systemintegration</div>
          </div>
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkCls}>
            <Icon className="h-5 w-5" /> {label}
          </NavLink>
        ))}
        {MORE_NAV.length > 0 && <div className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Mehr</div>}
        {MORE_NAV.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkCls}>
            <span className="w-5" /> {label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <ThemeToggle withLabel className="px-3 py-2.5" />
        <NavLink to="/einstellungen" className={linkCls}>
          <IconSettings className="h-5 w-5" /> Einstellungen
        </NavLink>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Kopfzeile (Mobil) */}
        {!focusMode && (
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
            <img src="icon.svg" alt="" className="h-7 w-7" />
            <span className="flex-1 py-3 font-bold">FISI-Trainer</span>
            <ThemeToggle />
            <NavLink to="/einstellungen" aria-label="Einstellungen" className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
              <IconSettings className="h-5 w-5" />
            </NavLink>
          </header>
        )}

        <main className={`mx-auto w-full max-w-3xl px-4 ${focusMode ? 'pt-[env(safe-area-inset-top)]' : 'pt-4'} pb-28 lg:px-8 lg:pt-8 lg:pb-10`}>
          <Outlet />
        </main>
      </div>

      {/* Bottom-Navigation (Mobil) */}
      {!focusMode && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
          <ul className="mx-auto flex max-w-lg">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                      isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                    }`
                  }
                >
                  <Icon className="h-6 w-6" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <UpdatePrompt />
    </div>
  );
}
