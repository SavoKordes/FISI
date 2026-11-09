import type { Field, Trainer } from './types';
import { fmt, fmtPlain, round } from './lib/format';

const num = (key: string, label: string, v: number, unit: string, decimals = 2, tol: Field['tolerance'] = { rel: 0.005, abs: 0.01 }): Field => ({
  key,
  label,
  kind: 'number',
  answer: fmtPlain(round(v, decimals), decimals),
  value: v,
  unit,
  tolerance: tol,
});

export const series = (a: number[]) => a.reduce((p, x) => p * x, 1);
export const parallel = (a: number[]) => 1 - a.reduce((p, x) => p * (1 - x), 1);

const HOURS_YEAR = 365 * 24;
const HOURS_MONTH = 30 * 24;

export const availabilityTrainer: Trainer = {
  id: 'verfuegbarkeit',
  title: 'Verfügbarkeit & USV',
  short: 'Verfügbarkeit',
  description: 'Verfügbarkeit ↔ Ausfallzeit, MTBF/MTTR, Reihen- und Parallelschaltung, USV-Leistung und Überbrückungszeit',
  levels: { 1: 'Grundformeln', 2: 'Redundanz, Lastreserve', 3: 'kombinierte Systeme, MTBF/MTTR, Akkulaufzeit' },
  types: [
    {
      id: 'downtime',
      label: 'Verfügbarkeit ↔ Ausfallzeit',
      gen: (rng, level) => {
        if (level === 3) {
          const mtbf = rng.pick([2000, 5000, 8000, 10000, 20000]);
          const mttr = rng.pick([2, 4, 8, 12, 24]);
          const a = mtbf / (mtbf + mttr);
          return {
            title: 'Verfügbarkeit aus MTBF und MTTR',
            prompt: `Ein Switch hat eine **MTBF von ${fmt(mtbf)} h**, die **MTTR** (mittlere Reparaturzeit) beträgt **${mttr} h**.\n\nBerechnen Sie die Verfügbarkeit in % (3 Nachkommastellen) und die zu erwartende Ausfallzeit pro Jahr in Stunden (365 Tage).`,
            fields: [num('a', 'Verfügbarkeit', a * 100, '%', 3, { abs: 0.001 }), num('down', 'Ausfallzeit pro Jahr', (1 - a) * HOURS_YEAR, 'h', 2, { rel: 0.01, abs: 0.05 })],
            solution: [
              '- Formel: **Verfügbarkeit = MTBF ÷ (MTBF + MTTR)**',
              `- ${fmt(mtbf)} ÷ (${fmt(mtbf)} + ${mttr}) = ${fmt(a, 6)} = **${fmt(a * 100, 3)} %**`,
              `- Ausfallzeit: (1 − ${fmt(a, 6)}) × 8.760 h = **${fmt((1 - a) * HOURS_YEAR, 2)} h** pro Jahr`,
            ].join('\n'),
          };
        }
        const reverse = level === 2 && rng.chance(0.4);
        const avail = level === 1 ? rng.pick([95, 98, 99, 99.5, 99.9]) : rng.pick([98.5, 99.8, 99.95, 99.99, 99.999]);
        const yearH = ((100 - avail) / 100) * HOURS_YEAR;
        const monthMin = ((100 - avail) / 100) * HOURS_MONTH * 60;
        if (reverse) {
          const hours = round(yearH, 2);
          return {
            title: 'Verfügbarkeit aus Ausfallzeit',
            prompt: `Ein Webdienst war im letzten Jahr (365 Tage) insgesamt **${fmt(hours, 2)} Stunden** nicht erreichbar. Wie hoch war die Verfügbarkeit in %? (3 Nachkommastellen)`,
            fields: [num('a', 'Verfügbarkeit', (1 - hours / HOURS_YEAR) * 100, '%', 3, { abs: 0.001 })],
            solution: `- Jahresstunden: 365 × 24 = 8.760 h\n- Verfügbarkeit = (8.760 − ${fmt(hours, 2)}) ÷ 8.760 × 100 = **${fmt((1 - hours / HOURS_YEAR) * 100, 3)} %**`,
          };
        }
        return {
          title: 'Erlaubte Ausfallzeit',
          prompt: `Ein SLA garantiert **${fmt(avail, 3)} %** Verfügbarkeit (24/7). Berechnen Sie die maximal zulässige Ausfallzeit **pro Jahr in Stunden** (365 Tage) und **pro Monat in Minuten** (30 Tage).`,
          fields: [num('year', 'Pro Jahr', yearH, 'h', 2, { rel: 0.005, abs: 0.01 }), num('month', 'Pro Monat', monthMin, 'min', 2, { rel: 0.005, abs: 0.1 })],
          solution: [
            `- Ausfallanteil: 100 % − ${fmt(avail, 3)} % = ${fmt(100 - avail, 3)} % = ${fmt((100 - avail) / 100, 5)}`,
            `- Jahr: 8.760 h × ${fmt((100 - avail) / 100, 5)} = **${fmt(yearH, 2)} h**`,
            `- Monat: 30 × 24 × 60 = 43.200 min × ${fmt((100 - avail) / 100, 5)} = **${fmt(monthMin, 2)} min**`,
            '',
            'Merkhilfe: 99,9 % ≈ 8,76 h/Jahr, 99,99 % ≈ 52,6 min/Jahr.',
          ].join('\n'),
        };
      },
    },
    {
      id: 'system',
      label: 'Reihen- und Parallelschaltung',
      gen: (rng, level) => {
        const pick = () => rng.pick([0.95, 0.97, 0.98, 0.99, 0.995, 0.999]);
        const p = (x: number) => fmt(x * 100, 3) + ' %';
        if (level === 1) {
          const comps = ['Router', 'Firewall', 'Switch', 'Server'].slice(0, rng.int(2, 4)).map((name) => ({ name, a: pick() }));
          const a = series(comps.map((c) => c.a));
          return {
            title: 'Verfügbarkeit in Reihe',
            prompt: `Ein Dienst ist nur erreichbar, wenn **alle** folgenden Komponenten funktionieren (Reihenschaltung):\n\n${comps.map((c) => `- ${c.name}: ${p(c.a)}`).join('\n')}\n\nBerechnen Sie die Gesamtverfügbarkeit in % (2 Nachkommastellen).`,
            fields: [num('a', 'Gesamtverfügbarkeit', a * 100, '%', 2, { abs: 0.01 })],
            solution: `- Reihe: **A = A₁ × A₂ × …**\n- ${comps.map((c) => fmt(c.a, 3)).join(' × ')} = ${fmt(a, 5)} = **${fmt(a * 100, 2)} %**\n\nDie Gesamtverfügbarkeit ist immer **kleiner** als die schwächste Komponente.`,
          };
        }
        if (level === 2) {
          const a1 = rng.pick([0.9, 0.95, 0.97, 0.98, 0.99]);
          const n = rng.int(2, 3);
          const a = parallel(Array(n).fill(a1));
          return {
            title: 'Verfügbarkeit parallel (redundant)',
            prompt: `Ein Webcluster besteht aus **${n} gleichen Servern** mit je **${p(a1)}** Verfügbarkeit. Der Dienst läuft, solange **mindestens einer** arbeitet (Parallelschaltung).\n\nBerechnen Sie die Gesamtverfügbarkeit in % (4 Nachkommastellen) und die erwartete Ausfallzeit pro Jahr in Minuten.`,
            fields: [num('a', 'Gesamtverfügbarkeit', a * 100, '%', 4, { abs: 0.0002 }), num('down', 'Ausfallzeit pro Jahr', (1 - a) * HOURS_YEAR * 60, 'min', 2, { rel: 0.01, abs: 0.1 })],
            solution: `- Parallel: **A = 1 − (1 − A₁) × (1 − A₂) × …**\n- Ausfallwahrscheinlichkeit je Server: 1 − ${fmt(a1, 3)} = ${fmt(1 - a1, 3)}\n- 1 − ${fmt(1 - a1, 3)}^${n} = 1 − ${fmt((1 - a1) ** n, 6)} = **${fmt(a * 100, 4)} %**\n- Ausfallzeit: ${fmt((1 - a1) ** n, 6)} × 525.600 min = **${fmt((1 - a) * HOURS_YEAR * 60, 2)} min**`,
          };
        }
        const srv = rng.pick([0.95, 0.97, 0.98, 0.99]);
        const fw = pick();
        const net = pick();
        const par = parallel([srv, srv]);
        const a = series([fw, net, par]);
        const weakest = [
          { name: 'Firewall', a: fw },
          { name: 'Core-Switch', a: net },
          { name: 'Webserver', a: par },
        ].reduce((m, x) => (x.a < m.a ? x : m));
        return {
          title: 'Kombiniertes System',
          prompt: `Ein Onlineshop besteht aus einer **Firewall (${p(fw)})** und einem **Core-Switch (${p(net)})** in Reihe, dahinter **zwei redundante Webserver** mit je **${p(srv)}** (parallel).\n\nBerechnen Sie die Gesamtverfügbarkeit in % (3 Nachkommastellen). Welche Komponente sollte als Nächstes redundant ausgelegt werden?`,
          fields: [
            num('par', 'Verfügbarkeit Serverpaar', par * 100, '%', 4, { abs: 0.0002 }),
            num('a', 'Gesamtverfügbarkeit', a * 100, '%', 3, { abs: 0.002 }),
            { key: 'weak', label: 'Nächste Redundanz für', kind: 'choice', answer: weakest.name, options: ['Firewall', 'Core-Switch', 'Webserver'] },
          ],
          solution: [
            `1. Serverpaar parallel: 1 − (1 − ${fmt(srv, 3)})² = 1 − ${fmt((1 - srv) ** 2, 6)} = **${fmt(par * 100, 4)} %**`,
            `2. Reihe: ${fmt(fw, 3)} × ${fmt(net, 3)} × ${fmt(par, 6)} = **${fmt(a * 100, 3)} %**`,
            `3. Schwächstes Glied (geringste Verfügbarkeit im Reihenpfad): **${weakest.name}** (${fmt(weakest.a * 100, 4)} %)` +
              (weakest.name === 'Webserver' ? ' – hier hilft ein weiterer Server im Cluster.' : ' – ein Single Point of Failure, der redundant ausgelegt werden sollte.'),
            fw === net && weakest.name === 'Firewall' ? '   (Firewall und Switch gleich – Firewall zuerst gewählt.)' : '',
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
    {
      id: 'ups',
      label: 'USV dimensionieren',
      gen: (rng, level) => {
        if (level === 1) {
          const w = rng.pick([300, 450, 600, 800, 1200, 1800]);
          const cos = rng.pick([0.6, 0.7, 0.8, 0.9]);
          return {
            title: 'Scheinleistung',
            prompt: `Ein Server-Rack nimmt **${w} W** Wirkleistung auf, der Leistungsfaktor beträgt **cos φ = ${fmt(cos, 2)}**. Welche Scheinleistung in **VA** muss die USV mindestens liefern?`,
            fields: [num('va', 'Scheinleistung', w / cos, 'VA', 1, { rel: 0.005, abs: 1 })],
            solution: `- **S = P ÷ cos φ** (Scheinleistung in VA, Wirkleistung in W)\n- ${w} W ÷ ${fmt(cos, 2)} = **${fmt(w / cos, 1)} VA**\n\nUSVs werden mit VA **und** W angegeben – beide Werte müssen reichen.`,
          };
        }
        if (level === 2) {
          const devices = rng.sample(
            [
              ['Server', rng.pick([350, 450, 550])],
              ['NAS', rng.pick([60, 90, 120])],
              ['Switch', rng.pick([45, 80, 150])],
              ['Firewall', rng.pick([30, 40, 60])],
              ['Router', rng.pick([20, 25])],
              ['Monitor', rng.pick([25, 30])],
            ] as [string, number][],
            4,
          );
          const reserve = rng.pick([20, 25, 30]);
          const cos = rng.pick([0.7, 0.8, 0.9]);
          const p = devices.reduce((s, d) => s + d[1], 0);
          const pRes = p * (1 + reserve / 100);
          const va = pRes / cos;
          return {
            title: 'USV mit Lastreserve',
            prompt: `An eine USV sollen angeschlossen werden:\n\n| Gerät | Leistung |\n|---|---|\n${devices.map((d) => `| ${d[0]} | ${d[1]} W |`).join('\n')}\n\nGeplant wird mit **${reserve} % Reserve**, cos φ = **${fmt(cos, 1)}**. Berechnen Sie die benötigte Wirkleistung (W) inkl. Reserve und die erforderliche Scheinleistung (VA).`,
            fields: [num('w', 'Wirkleistung inkl. Reserve', pRes, 'W', 1, { rel: 0.005, abs: 1 }), num('va', 'Scheinleistung', va, 'VA', 1, { rel: 0.005, abs: 1 })],
            solution: `- Summe: ${devices.map((d) => d[1]).join(' + ')} = ${p} W\n- mit Reserve: ${p} W × ${fmt(1 + reserve / 100, 2)} = **${fmt(pRes, 1)} W**\n- S = ${fmt(pRes, 1)} W ÷ ${fmt(cos, 1)} = **${fmt(va, 1)} VA** → nächstgrößere USV-Klasse wählen`,
          };
        }
        const batteries = rng.pick([2, 4, 6, 8]);
        const volt = 12;
        const ah = rng.pick([7, 9, 12, 18]);
        const eff = rng.pick([0.85, 0.9, 0.95]);
        const load = rng.pick([250, 400, 500, 650, 800]);
        const wh = batteries * volt * ah;
        const minutes = ((wh * eff) / load) * 60;
        return {
          title: 'Überbrückungszeit',
          prompt: `Eine USV besitzt **${batteries} Akkus à ${volt} V / ${ah} Ah**. Der Wechselrichter hat einen Wirkungsgrad von **${fmt(eff * 100)} %**, die angeschlossene Last beträgt **${load} W**.\n\nBerechnen Sie die gespeicherte Energie (Wh) und die Überbrückungszeit in Minuten (vereinfacht, ohne Entladeverluste).`,
          fields: [num('wh', 'Energie', wh, 'Wh', 0, { abs: 0.5 }), num('min', 'Überbrückungszeit', minutes, 'min', 1, { rel: 0.01, abs: 0.2 })],
          solution: `- Energie: ${batteries} × ${volt} V × ${ah} Ah = **${fmt(wh)} Wh**\n- nutzbar: ${fmt(wh)} Wh × ${fmt(eff, 2)} = ${fmt(wh * eff, 1)} Wh\n- Zeit: ${fmt(wh * eff, 1)} Wh ÷ ${load} W = ${fmt((wh * eff) / load, 3)} h × 60 = **${fmt(minutes, 1)} min**\n\nPraxis: Bei hoher Last ist die reale Laufzeit kürzer (Peukert-Effekt) – Herstellertabellen nutzen.`,
        };
      },
    },
  ],
};
