import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme, getSettings } from './db/settings';
import './index.css';

getSettings().then((s) => applyTheme(s.theme));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  getSettings().then((s) => s.theme === 'system' && applyTheme('system'));
});
// Speicher möglichst dauerhaft anfordern (verhindert Löschen durch den Browser)
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
