import type { Field, Level, Trainer } from './types';
import type { Rng } from './lib/rng';
import { eur, fmt, fmtPlain, round } from './lib/format';
import { criticalPaths, schedule, type Activity } from './lib/netplan';

const num = (key: string, label: string, v: number, unit: string, decimals = 2, tol: Field['tolerance'] = { rel: 0.005, abs: 0.01 }): Field => ({
  key,
  label,
  kind: 'number',
  answer: fmtPlain(round(v, decimals), decimals),
  value: v,
  unit,
  tolerance: tol,
});

const CRITERIA = ['Anschaffungskosten', 'Betriebskosten', 'Funktionsumfang', 'Bedienbarkeit', 'Support/Service', 'Skalierbarkeit', 'Datenschutz', 'Integration in bestehende Umgebung'];
const PRODUCTS = [
  ['Lösung A', 'Lösung B', 'Lösung C'],
  ['On-Premises', 'Cloud', 'Hybrid'],
  ['Hersteller X', 'Hersteller Y', 'Hersteller Z'],
];

function weights(rng: Rng, n: number): number[] {
  // Gewichte in 5-%-Schritten, Summe 100
  for (;;) {
    const w = Array.from({ length: n - 1 }, () => rng.int(2, 8) * 5);
    const last = 100 - w.reduce((a, b) => a + b, 0);
    if (last >= 5 && last <= 50) return rng.shuffle([...w, last]);
  }
}

const TASK_NAMES = [
  'Ist-Analyse',
  'Soll-Konzept',
  'Angebote einholen',
  'Hardware beschaffen',
  'Server installieren',
  'Netzwerk konfigurieren',
  'Software einrichten',
  'Datenmigration',
  'Tests',
  'Schulung',
  'Dokumentation',
  'Abnahme',
];

/** alle (transitiven) Vorgänger eines Vorgangs */
function ancestorsOf(acts: Activity[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [...acts.find((a) => a.id === id)!.preds];
  while (stack.length) {
    const x = stack.pop()!;
    if (!out.has(x)) {
      out.add(x);
      stack.push(...acts.find((a) => a.id === x)!.preds);
    }
  }
  return out;
}

/** entfernt Vorgänger, die schon über einen anderen Vorgänger erreicht werden */
const withoutRedundant = (acts: Activity[], preds: string[]) => preds.filter((p) => !preds.some((q) => q !== p && ancestorsOf(acts, q).has(p)));

/** zufälliger Netzplan mit genau einem kritischen Pfad und mindestens einem Puffer */
export function randomNetplan(rng: Rng, level: Level): Activity[] {
  const count = level === 1 ? 5 : level === 2 ? 7 : 9;
  for (;;) {
    const acts: Activity[] = [];
    for (let i = 0; i < count; i++) {
      const id = String.fromCharCode(65 + i);
      let preds: string[] = [];
      if (i > 0 && !(level === 3 && i === 1)) {
        const k = i >= 2 && rng.chance(level === 1 ? 0.25 : 0.45) ? 2 : 1;
        const pool = acts.slice(Math.max(0, i - 3)).map((a) => a.id);
        preds = rng.sample(pool, Math.min(k, pool.length)).sort();
        preds = withoutRedundant(acts, preds); // z. B. A weglassen, wenn B schon nach A kommt
      }
      acts.push({ id, duration: rng.int(1, level === 1 ? 6 : 9), preds });
    }
    // genau ein Endvorgang: letzter Vorgang hängt von allen Vorgängen ohne Nachfolger ab
    const last = acts[acts.length - 1];
    const hasSucc = new Set(acts.flatMap((a) => a.preds));
    const loose = acts.slice(0, -1).filter((a) => !hasSucc.has(a.id)).map((a) => a.id);
    last.preds = [...new Set([...last.preds, ...loose])].sort();
    last.preds = withoutRedundant(acts, last.preds);
    const { rows, end } = schedule(acts);
    if (criticalPaths(rows, end).length !== 1) continue;
    if (!rows.some((r) => r.gp > 0)) continue;
    if (level >= 2 && !rows.some((r) => r.fp !== r.gp)) continue;
    return acts;
  }
}

export const economicsTrainer: Trainer = {
  id: 'wirtschaftlichkeit',
  title: 'Wirtschaftlichkeit & Projekt',
  short: 'Wirtschaftlichkeit',
  description: 'Nutzwertanalyse, Kostenvergleich, Amortisation, Stromkosten, Netzplan (FAZ/FEZ/SAZ/SEZ, Puffer, kritischer Pfad)',
  levels: { 1: 'kleine Zahlen, 2 Alternativen', 2: 'mehr Kriterien/Vorgänge, Break-even', 3: 'Gewichtungspunkte, PUE, große Netzpläne' },
  types: [
    {
      id: 'nwa',
      label: 'Nutzwertanalyse',
      gen: (rng, level) => {
        const nCrit = level === 1 ? 3 : level === 2 ? 4 : 5;
        const nOpt = level === 1 ? 2 : 3;
        const crits = rng.sample(CRITERIA, nCrit);
        const opts = rng.pick(PRODUCTS).slice(0, nOpt);
        let w: number[] = [];
        let pts: number[][] = [];
        let values: number[] = [];
        let rawW: number[] = [];
        for (;;) {
          w = weights(rng, nCrit);
          rawW = level === 3 ? w.map((x) => x / 5) : w; // Level 3: Gewichtungspunkte statt Prozent
          pts = opts.map(() => crits.map(() => rng.int(level === 1 ? 2 : 1, 10)));
          values = pts.map((p) => p.reduce((s, x, i) => s + (x * w[i]) / 100, 0));
          const sorted = [...values].sort((a, b) => b - a);
          if (round(sorted[0], 2) !== round(sorted[1], 2)) break;
        }
        const best = values.indexOf(Math.max(...values));
        const sumRaw = rawW.reduce((a, b) => a + b, 0);
        return {
          title: 'Nutzwertanalyse',
          prompt: [
            `Für eine Entscheidung werden ${nOpt} Alternativen bewertet (Punkte 1–10, 10 = sehr gut):`,
            '',
            `| Kriterium | ${level === 3 ? 'Gewichtungspunkte' : 'Gewichtung'} | ${opts.join(' | ')} |`,
            `|---|---|${opts.map(() => '---').join('|')}|`,
            ...crits.map((c, i) => `| ${c} | ${level === 3 ? rawW[i] : `${w[i]} %`} | ${pts.map((p) => p[i]).join(' | ')} |`),
            '',
            `Berechnen Sie die Nutzwerte (2 Nachkommastellen) und bestimmen Sie die beste Alternative.${level === 3 ? ' Rechnen Sie die Gewichtungspunkte zuerst in Anteile um.' : ''}`,
          ].join('\n'),
          fields: [
            ...opts.map((o, j) => num(`nw${j}`, `Nutzwert ${o}`, values[j], 'Punkte', 2, { abs: 0.01 })),
            { key: 'best', label: 'Beste Alternative', kind: 'choice', answer: opts[best], options: opts },
          ],
          solution: [
            ...(level === 3 ? [`- Summe Gewichtungspunkte: ${rawW.join(' + ')} = ${sumRaw} → Anteil = Punkte ÷ ${sumRaw}: ${rawW.map((r) => `${r}/${sumRaw} = ${fmt(r / sumRaw, 2)}`).join(', ')}`] : []),
            '- Nutzwert = Σ (Gewichtung × Punkte)',
            '',
            `| Kriterium | Gewicht | ${opts.join(' | ')} |`,
            `|---|---|${opts.map(() => '---').join('|')}|`,
            ...crits.map((c, i) => `| ${c} | ${fmt(w[i] / 100, 2)} | ${pts.map((p) => `${p[i]} × ${fmt(w[i] / 100, 2)} = ${fmt((p[i] * w[i]) / 100, 2)}`).join(' | ')} |`),
            `| **Nutzwert** | 1,00 | ${values.map((v) => `**${fmt(v, 2)}**`).join(' | ')} |`,
            '',
            `→ **${opts[best]}** hat den höchsten Nutzwert.`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'cost',
      label: 'Kostenvergleich / Break-even',
      gen: (rng, level) => {
        const invest = rng.int(4, 30) * 500;
        const runA = rng.int(2, 12) * 10; // monatliche Betriebskosten Eigenbetrieb
        const cloud = runA + rng.int(4, 30) * 10; // monatliche Cloud-Kosten
        const years = rng.pick([3, 4, 5]);
        const months = years * 12;
        const totalA = invest + runA * months;
        const totalB = cloud * months;
        const breakEven = invest / (cloud - runA);
        const fields: Field[] = [num('a', 'Gesamtkosten Kauf', totalA, '€'), num('b', 'Gesamtkosten Cloud', totalB, '€')];
        if (level >= 2) fields.push(num('be', 'Break-even nach', breakEven, 'Monaten', 1, { abs: 0.1 }));
        fields.push({ key: 'cheaper', label: `Günstiger über ${years} Jahre`, kind: 'choice', answer: totalA < totalB ? 'Kauf' : totalA > totalB ? 'Cloud' : 'gleich', options: ['Kauf', 'Cloud', 'gleich'] });
        return {
          title: 'Kostenvergleich Kauf vs. Cloud',
          prompt: `Für einen Dienst gibt es zwei Alternativen:\n\n- **Kauf (On-Premises):** einmalig **${eur(invest)}** + **${eur(runA)}** pro Monat Betriebskosten\n- **Cloud:** **${eur(cloud)}** pro Monat, keine Anschaffungskosten\n\nVergleichen Sie die Gesamtkosten über **${years} Jahre**.${level >= 2 ? ' Ab welchem Monat ist der Kauf günstiger (Break-even)?' : ''}`,
          fields,
          solution: [
            `- Kauf: ${eur(invest)} + ${eur(runA)} × ${months} = **${eur(totalA)}**`,
            `- Cloud: ${eur(cloud)} × ${months} = **${eur(totalB)}**`,
            level >= 2 ? `- Break-even: Investition ÷ monatliche Ersparnis = ${eur(invest)} ÷ (${eur(cloud)} − ${eur(runA)}) = ${eur(invest)} ÷ ${eur(cloud - runA)} = **${fmt(breakEven, 1)} Monate**` : '',
            `- Über ${years} Jahre ist **${totalA < totalB ? 'der Kauf' : totalA > totalB ? 'die Cloud' : 'keine Variante'}** günstiger${totalA !== totalB ? ` (Differenz ${eur(Math.abs(totalA - totalB))})` : ''}.`,
            '',
            'Nicht-monetäre Kriterien (Datenschutz, Know-how, Skalierbarkeit) gehören in die Nutzwertanalyse.',
          ]
            .filter((l, i, a) => l !== '' || a[i - 1] !== '')
            .join('\n'),
        };
      },
    },
    {
      id: 'amort',
      label: 'Amortisationszeit',
      gen: (rng, level) => {
        const invest = rng.int(6, 60) * 500;
        if (level === 1) {
          const saving = rng.int(10, 60) * 100;
          const t = invest / saving;
          return {
            title: 'Amortisationszeit',
            prompt: `Eine Investition kostet **${eur(invest)}** und spart jährlich **${eur(saving)}** ein. Nach wie vielen Jahren hat sie sich amortisiert? (2 Nachkommastellen)`,
            fields: [num('t', 'Amortisationszeit', t, 'Jahre')],
            solution: `- **Amortisationszeit = Investition ÷ jährliche Einsparung**\n- ${eur(invest)} ÷ ${eur(saving)} = **${fmt(t, 2)} Jahre** (≈ ${fmt(t * 12, 1)} Monate)`,
          };
        }
        const savingM = rng.int(5, 60) * 20;
        const extraM = rng.int(1, 10) * 10;
        const net = savingM - extraM;
        const months = invest / net;
        const fields: Field[] = [num('m', 'Amortisationszeit', months, 'Monate', 1, { abs: 0.1 })];
        const horizon = 5;
        const roi = ((net * 12 * horizon - invest) / invest) * 100;
        if (level === 3) fields.push(num('roi', `Rendite (ROI) nach ${horizon} Jahren`, roi, '%', 1, { abs: 0.2 }));
        return {
          title: 'Amortisation mit laufenden Kosten',
          prompt: `Eine Virtualisierungslösung kostet einmalig **${eur(invest)}**. Sie spart monatlich **${eur(savingM)}** an Strom und Wartung, verursacht aber **${eur(extraM)}** pro Monat an Lizenzkosten.\n\nBerechnen Sie die Amortisationszeit in Monaten (1 Nachkommastelle).${level === 3 ? ` Berechnen Sie außerdem den ROI nach ${horizon} Jahren: (Gesamtersparnis − Investition) ÷ Investition.` : ''}`,
          fields,
          solution: [
            `- Netto-Ersparnis pro Monat: ${eur(savingM)} − ${eur(extraM)} = ${eur(net)}`,
            `- Amortisation: ${eur(invest)} ÷ ${eur(net)} = **${fmt(months, 1)} Monate** (≈ ${fmt(months / 12, 2)} Jahre)`,
            level === 3 ? `- Ersparnis in ${horizon} Jahren: ${eur(net)} × ${horizon * 12} = ${eur(net * 12 * horizon)}\n- ROI: (${eur(net * 12 * horizon)} − ${eur(invest)}) ÷ ${eur(invest)} = **${fmt(roi, 1)} %**` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
    {
      id: 'power',
      label: 'Stromkosten',
      gen: (rng, level) => {
        const price = rng.pick([0.25, 0.28, 0.3, 0.32, 0.35]);
        if (level === 1) {
          const w = rng.pick([45, 80, 120, 250, 400, 650]);
          const kwh = (w / 1000) * 24 * 365;
          return {
            title: 'Stromkosten eines Geräts',
            prompt: `Ein Server läuft **24/7** und nimmt durchschnittlich **${w} W** auf. Der Strompreis beträgt **${fmt(price * 100)} ct/kWh**. Berechnen Sie Energiebedarf (kWh) und Stromkosten pro Jahr (365 Tage).`,
            fields: [num('kwh', 'Energie pro Jahr', kwh, 'kWh', 2), num('cost', 'Kosten pro Jahr', kwh * price, '€')],
            solution: `- **Kosten = Leistung (kW) × Zeit (h) × Preis (€/kWh)**\n- ${w} W = ${fmt(w / 1000, 3)} kW; 365 × 24 = 8.760 h\n- ${fmt(w / 1000, 3)} kW × 8.760 h = **${fmt(kwh, 2)} kWh**\n- ${fmt(kwh, 2)} kWh × ${fmt(price, 2)} €/kWh = **${eur(kwh * price)}**`,
          };
        }
        if (level === 2) {
          const n = rng.int(3, 12);
          const w = rng.pick([180, 250, 320, 400]);
          const hours = rng.pick([10, 12, 24]);
          const days = hours === 24 ? 365 : rng.pick([220, 250]);
          const kwh = ((n * w) / 1000) * hours * days;
          return {
            title: 'Stromkosten mehrerer Geräte',
            prompt: `In einem Schulungsraum laufen **${n} PCs** mit je **${w} W**, **${hours} Stunden** am Tag an **${days} Tagen** im Jahr. Strompreis: **${fmt(price * 100)} ct/kWh**. Berechnen Sie die jährlichen Stromkosten.`,
            fields: [num('kwh', 'Energie pro Jahr', kwh, 'kWh', 2), num('cost', 'Kosten pro Jahr', kwh * price, '€')],
            solution: `- Gesamtleistung: ${n} × ${w} W = ${fmt(n * w)} W = ${fmt((n * w) / 1000, 3)} kW\n- Zeit: ${hours} h × ${days} = ${fmt(hours * days)} h\n- Energie: ${fmt((n * w) / 1000, 3)} kW × ${fmt(hours * days)} h = **${fmt(kwh, 2)} kWh**\n- Kosten: × ${fmt(price, 2)} €/kWh = **${eur(kwh * price)}**`,
          };
        }
        const oldN = rng.int(4, 10);
        const oldW = rng.pick([250, 300, 350, 400]);
        const newN = rng.int(1, 2);
        const newW = rng.pick([450, 550, 650]);
        const pue = rng.pick([1.4, 1.6, 1.8, 2]);
        const invest = rng.int(10, 30) * 1000;
        const kwhOld = ((oldN * oldW) / 1000) * 8760 * pue;
        const kwhNew = ((newN * newW) / 1000) * 8760 * pue;
        const saving = (kwhOld - kwhNew) * price;
        return {
          title: 'Serverkonsolidierung: Stromersparnis',
          prompt: `**${oldN} physische Server** à **${oldW} W** werden auf **${newN} Virtualisierungshost${newN > 1 ? 's' : ''}** à **${newW} W** konsolidiert (Betrieb 24/7, 365 Tage). Das Rechenzentrum hat einen **PUE von ${fmt(pue, 1)}** (Kühlung/Infrastruktur). Strompreis **${fmt(price * 100)} ct/kWh**, Investition **${eur(invest)}**.\n\nBerechnen Sie die jährliche Stromkostenersparnis und die Amortisationszeit in Jahren (nur Strom betrachtet).`,
          fields: [num('save', 'Ersparnis pro Jahr', saving, '€'), num('t', 'Amortisationszeit', invest / saving, 'Jahre')],
          solution: [
            `- PUE = Gesamtenergie ÷ IT-Energie → Gesamtverbrauch = IT-Verbrauch × ${fmt(pue, 1)}`,
            `- Alt: ${oldN} × ${oldW} W = ${fmt(oldN * oldW)} W → ${fmt((oldN * oldW) / 1000, 2)} kW × 8.760 h × ${fmt(pue, 1)} = ${fmt(kwhOld, 2)} kWh`,
            `- Neu: ${newN} × ${newW} W = ${fmt(newN * newW)} W → ${fmt((newN * newW) / 1000, 2)} kW × 8.760 h × ${fmt(pue, 1)} = ${fmt(kwhNew, 2)} kWh`,
            `- Ersparnis: (${fmt(kwhOld, 2)} − ${fmt(kwhNew, 2)}) kWh × ${fmt(price, 2)} €/kWh = **${eur(saving)}** pro Jahr`,
            `- Amortisation: ${eur(invest)} ÷ ${eur(saving)} = **${fmt(invest / saving, 2)} Jahre**`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'netplan',
      label: 'Netzplan',
      gen: (rng, level) => {
        const acts = randomNetplan(rng, level);
        const { rows, end } = schedule(acts);
        const path = criticalPaths(rows, end)[0];
        const names = rng.sample(TASK_NAMES, acts.length).sort((a, b) => TASK_NAMES.indexOf(a) - TASK_NAMES.indexOf(b));
        const nonCrit = rows.filter((r) => r.gp > 0);
        const x = rng.pick(level >= 2 ? (nonCrit.some((r) => r.fp !== r.gp) ? nonCrit.filter((r) => r.fp !== r.gp) : nonCrit) : nonCrit);
        const y = rng.pick(rows.filter((r) => r.preds.length));
        const unit = rng.pick(['Tage', 'Stunden']);
        const fields: Field[] = [
          num('end', 'Projektdauer', end, unit, 0, { abs: 0 }),
          { key: 'path', label: 'Kritischer Pfad', kind: 'path', answer: path.join('-'), placeholder: 'z. B. A-C-E' },
          num('gp', `Gesamtpuffer ${x.id}`, x.gp, unit, 0, { abs: 0 }),
        ];
        if (level >= 2) fields.push(num('fp', `Freier Puffer ${x.id}`, x.fp, unit, 0, { abs: 0 }));
        if (level >= 2) fields.push(num('faz', `FAZ ${y.id}`, y.faz, '', 0, { abs: 0 }), num('saz', `SAZ ${y.id}`, y.saz, '', 0, { abs: 0 }));
        return {
          title: 'Netzplan berechnen',
          prompt: [
            `Für Ihr Projekt liegt folgende Vorgangsliste vor (Dauer in ${unit}, Projektstart = 0):`,
            '',
            '| Vorgang | Beschreibung | Dauer | Vorgänger |',
            '|---|---|---|---|',
            ...acts.map((a, i) => `| ${a.id} | ${names[i]} | ${a.duration} | ${a.preds.join(', ') || '–'} |`),
            '',
            `Berechnen Sie die Projektdauer und den kritischen Pfad, den Gesamtpuffer von **${x.id}**${level >= 2 ? `, den freien Puffer von **${x.id}** sowie FAZ und SAZ von **${y.id}**` : ''}.`,
          ].join('\n'),
          fields,
          solution: [
            '- **Vorwärtsrechnung:** FAZ = größter FEZ aller Vorgänger, FEZ = FAZ + Dauer',
            '- **Rückwärtsrechnung:** SEZ = kleinster SAZ aller Nachfolger (Endvorgang: SEZ = Projektende), SAZ = SEZ − Dauer',
            '- **Puffer:** GP = SAZ − FAZ; FP = kleinster FAZ der Nachfolger − FEZ',
            '',
            '| Vorgang | Dauer | FAZ | FEZ | SAZ | SEZ | GP | FP |',
            '|---|---|---|---|---|---|---|---|',
            ...rows.map((r) => {
              const b = (s: string | number) => (r.gp === 0 ? `**${s}**` : String(s));
              return `| ${b(r.id)} | ${r.duration} | ${r.faz} | ${r.fez} | ${r.saz} | ${r.sez} | ${b(r.gp)} | ${r.fp} |`;
            }),
            '',
            `- Projektdauer = größter FEZ = **${end} ${unit}**`,
            `- Kritischer Pfad (alle Vorgänge mit GP = 0): **${path.join(' → ')}**`,
            `- ${x.id}: GP = ${x.saz} − ${x.faz} = **${x.gp}**` + (level >= 2 ? `; FP = ${x.succs.length ? `min(FAZ ${x.succs.join(', ')}) − FEZ = ${x.fez + x.fp} − ${x.fez}` : `Projektende − FEZ = ${end} − ${x.fez}`} = **${x.fp}**` : ''),
          ].join('\n'),
        };
      },
    },
  ],
};
