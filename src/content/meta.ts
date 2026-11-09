import type { Area } from './schema';

export const AREA_META: Record<Area, { label: string; short: string; color: string }> = {
  KA: { label: 'Konzeption & Administration von IT-Systemen', short: 'KA', color: 'bg-sky-500' },
  NET: { label: 'Analyse & Entwicklung von Netzwerken', short: 'NET', color: 'bg-violet-500' },
  WISO: { label: 'Wirtschafts- und Sozialkunde', short: 'WiSo', color: 'bg-amber-500' },
  PROJ: { label: 'Projektarbeit & Fachgespräch', short: 'Projekt', color: 'bg-emerald-500' },
};
