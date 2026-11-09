/**
 * IHK-Abschlussprüfung Fachinformatiker/-in Systemintegration (AO 2020)
 * Gewichtung (Anteil am Gesamtergebnis):
 *   AP Teil 1 20 % · Projekt: Dokumentation 25 %, Präsentation 12,5 %, Fachgespräch 12,5 %
 *   Konzeption & Administration (KA) 10 % · Analyse & Entwicklung von Netzwerken (NET) 10 % · WiSo 10 %
 * Die Vorgaben und Rundungsregeln der zuständigen IHK haben Vorrang.
 */

export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export const GRADE_LABEL: Record<Grade, string> = {
  1: 'sehr gut',
  2: 'gut',
  3: 'befriedigend',
  4: 'ausreichend',
  5: 'mangelhaft',
  6: 'ungenügend',
};

/** IHK-Notenschlüssel (100-Punkte-Schema) */
export function gradeFromPoints(p: number): Grade {
  if (p >= 92) return 1;
  if (p >= 81) return 2;
  if (p >= 67) return 3;
  if (p >= 50) return 4;
  if (p >= 30) return 5;
  return 6;
}

export type Scores = {
  ap1: number;
  doku: number;
  praesentation: number;
  fachgespraech: number;
  ka: number;
  net: number;
  wiso: number;
};

export type AreaKey = 'projekt' | 'ka' | 'net' | 'wiso';

export const AREA_LABELS: Record<AreaKey, string> = {
  projekt: 'Planen und Umsetzen eines Projektes (Doku, Präsentation, Fachgespräch)',
  ka: 'Konzeption und Administration von IT-Systemen',
  net: 'Analyse und Entwicklung von Netzwerken',
  wiso: 'Wirtschafts- und Sozialkunde',
};

/** Gewichte am Gesamtergebnis in % */
export const WEIGHTS = { ap1: 20, doku: 25, praesentation: 12.5, fachgespraech: 12.5, ka: 10, net: 10, wiso: 10 } as const;
const AREA_WEIGHT: Record<AreaKey, number> = { projekt: 50, ka: 10, net: 10, wiso: 10 };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Punkte des Prüfungsbereichs „Projekt“ (gewichteter Mittelwert der drei Teile) */
export function projectPoints(s: Pick<Scores, 'doku' | 'praesentation' | 'fachgespraech'>): number {
  return (s.doku * WEIGHTS.doku + s.praesentation * WEIGHTS.praesentation + s.fachgespraech * WEIGHTS.fachgespraech) / 50;
}

export function areaPoints(s: Scores): Record<AreaKey, number> {
  return { projekt: projectPoints(s), ka: s.ka, net: s.net, wiso: s.wiso };
}

export function ap2Points(s: Scores): number {
  const a = areaPoints(s);
  return (Object.keys(a) as AreaKey[]).reduce((sum, k) => sum + a[k] * AREA_WEIGHT[k], 0) / 80;
}

export function totalPoints(s: Scores): number {
  return (s.ap1 * WEIGHTS.ap1 + ap2Points(s) * 80) / 100;
}

export type Check = { id: string; label: string; ok: boolean; detail: string };

export type Evaluation = {
  total: number;
  ap2: number;
  areas: Record<AreaKey, number>;
  checks: Check[];
  passed: boolean;
  grade: Grade;
};

const fmt = (n: number) => round2(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });

export function evaluate(s: Scores): Evaluation {
  const areas = areaPoints(s);
  const ap2 = ap2Points(s);
  const total = totalPoints(s);
  const areaList = Object.values(areas);
  const atLeast50 = areaList.filter((p) => p >= 50).length;
  const below30 = (Object.keys(areas) as AreaKey[]).filter((k) => areas[k] < 30);
  const checks: Check[] = [
    { id: 'total', label: 'Gesamtergebnis (Teil 1 + Teil 2) mindestens 50 Punkte', ok: total >= 50, detail: `${fmt(total)} Punkte` },
    { id: 'ap2', label: 'Ergebnis von Teil 2 mindestens 50 Punkte', ok: ap2 >= 50, detail: `${fmt(ap2)} Punkte` },
    { id: 'three', label: 'In mindestens 3 Prüfungsbereichen von Teil 2 mindestens 50 Punkte', ok: atLeast50 >= 3, detail: `${atLeast50} von 4 Bereichen` },
    {
      id: 'none30',
      label: 'In keinem Prüfungsbereich von Teil 2 unter 30 Punkte (ungenügend)',
      ok: below30.length === 0,
      detail: below30.length ? below30.map((k) => AREA_LABELS[k]).join(', ') : 'erfüllt',
    },
  ];
  const passed = checks.every((c) => c.ok);
  return { total, ap2, areas, checks, passed, grade: gradeFromPoints(total) };
}

export type SupplementOption = {
  area: 'ka' | 'net' | 'wiso';
  current: number;
  /** benötigte Punkte in der mündlichen Ergänzungsprüfung zum Bestehen (null = nicht erreichbar) */
  needed: number | null;
};

/** Punkte nach Ergänzungsprüfung: schriftlich und mündlich im Verhältnis 2:1 */
export function combinedSupplement(written: number, oral: number): number {
  return (2 * written + oral) / 3;
}

/**
 * Mündliche Ergänzungsprüfung (15 Min.): auf Antrag in EINEM schriftlichen Bereich von Teil 2,
 * der schlechter als ausreichend (< 50 Punkte) ist, wenn sie für das Bestehen den Ausschlag geben kann.
 * Liefert für jeden infrage kommenden Bereich die mindestens nötigen mündlichen Punkte.
 */
export function supplementOptions(s: Scores): SupplementOption[] {
  if (evaluate(s).passed) return [];
  const out: SupplementOption[] = [];
  for (const area of ['ka', 'net', 'wiso'] as const) {
    if (s[area] >= 50) continue;
    let needed: number | null = null;
    for (let oral = 0; oral <= 100; oral++) {
      if (evaluate({ ...s, [area]: combinedSupplement(s[area], oral) }).passed) {
        needed = oral;
        break;
      }
    }
    out.push({ area, current: s[area], needed });
  }
  return out.sort((a, b) => (a.needed ?? 999) - (b.needed ?? 999));
}
