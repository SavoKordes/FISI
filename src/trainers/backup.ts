import type { Field, Trainer } from './types';
import { duration, fmt, fmtPlain, round } from './lib/format';

const num = (key: string, label: string, v: number, unit: string, tol: Field['tolerance'] = { rel: 0.005, abs: 0.01 }): Field => ({
  key,
  label,
  kind: 'number',
  answer: fmtPlain(round(v, 2), 2),
  value: v,
  unit,
  tolerance: tol,
});

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Speicherbedarf einer Woche: Vollsicherung + k Teilsicherungen bei täglich d neuen Änderungen */
export function weekStorage(full: number, d: number, days: number) {
  const incr = full + days * d;
  const diff = full + (d * days * (days + 1)) / 2;
  return { incr, diff };
}

export const backupTrainer: Trainer = {
  id: 'backup',
  title: 'Backup',
  short: 'Backup',
  description: 'Voll/differenziell/inkrementell über eine Woche, Generationenprinzip, Sicherungs- und Wiederherstellungsdauer',
  levels: { 1: 'feste Änderungsmengen', 2: 'Änderungen in %, Wiederherstellung', 3: 'Generationen mit Teilsicherungen, RTO-Prüfung' },
  types: [
    {
      id: 'week',
      label: 'Datenvolumen einer Woche',
      gen: (rng, level) => {
        const full = rng.pick([200, 300, 400, 500, 800, 1000, 1200, 2000]);
        const pctChange = rng.pick([2, 3, 4, 5, 8, 10]);
        const d = level === 1 ? rng.pick([10, 15, 20, 25, 40, 50]) : (full * pctChange) / 100;
        const days = level === 1 ? 5 : 6;
        const { incr, diff } = weekStorage(full, d, days);
        const k = rng.int(2, days);
        const fields: Field[] = [num('incr', 'Speicher Woche (Voll + inkrementell)', incr, 'GB'), num('diff', 'Speicher Woche (Voll + differenziell)', diff, 'GB')];
        if (level >= 2) fields.push(num('diffk', `Größe der differenziellen Sicherung am ${DAYS[k - 1]}`, k * d, 'GB'));
        if (level === 3) {
          fields.push(num('ri', `Anzahl Sicherungen für Restore am ${DAYS[k - 1]}abend (inkrementell)`, k + 1, 'Stück', { abs: 0 }));
          fields.push(num('rd', `Anzahl Sicherungen für Restore am ${DAYS[k - 1]}abend (differenziell)`, 2, 'Stück', { abs: 0 }));
        }
        const changeText = level === 1 ? `täglich **${fmt(d)} GB**` : `täglich **${pctChange} %** des Gesamtbestands (${fmt(d)} GB)`;
        return {
          title: 'Backup-Volumen einer Woche',
          prompt: `Ein Dateiserver hat **${fmt(full)} GB** Daten. Am Sonntag läuft eine **Vollsicherung**, von Montag bis ${DAYS[days - 1]} je eine Teilsicherung. Es ändern sich ${changeText} – jeweils **andere** Dateien.\n\nBerechnen Sie den Speicherbedarf für eine Woche bei **inkrementeller** und bei **differenzieller** Sicherung.${level >= 2 ? ` Wie groß ist die differenzielle Sicherung am ${DAYS[k - 1]}?` : ''}${level === 3 ? ` Wie viele Sicherungen müssen jeweils eingespielt werden, wenn der Server am ${DAYS[k - 1]}abend nach der Sicherung ausfällt?` : ''}`,
          fields,
          solution: [
            `**Inkrementell** – jede Sicherung enthält nur die Änderungen seit der **letzten** Sicherung (${fmt(d)} GB):`,
            `${fmt(full)} + ${days} × ${fmt(d)} = **${fmt(incr)} GB**`,
            '',
            `**Differenziell** – jede Sicherung enthält alle Änderungen seit der **letzten Vollsicherung** (wächst täglich):`,
            '',
            '| Tag | ' + DAYS.slice(0, days).join(' | ') + ' |',
            '|---|' + DAYS.slice(0, days).map(() => '---').join('|') + '|',
            '| Größe (GB) | ' + DAYS.slice(0, days).map((_, i) => fmt((i + 1) * d)).join(' | ') + ' |',
            '',
            `${fmt(full)} + ${fmt(d)} × (${Array.from({ length: days }, (_, i) => i + 1).join(' + ')}) = ${fmt(full)} + ${fmt(d)} × ${(days * (days + 1)) / 2} = **${fmt(diff)} GB**`,
            ...(level >= 2 ? ['', `Differenzielle Sicherung am ${DAYS[k - 1]}: ${k} × ${fmt(d)} = **${fmt(k * d)} GB**`] : []),
            ...(level === 3
              ? [
                  '',
                  `**Wiederherstellung** am ${DAYS[k - 1]}abend:`,
                  `- inkrementell: Vollsicherung + alle ${k} Inkremente (${DAYS.slice(0, k).join(', ')}) = **${k + 1} Sicherungen**`,
                  `- differenziell: Vollsicherung + **letzte** differenzielle Sicherung = **2 Sicherungen**`,
                ]
              : []),
          ].join('\n'),
        };
      },
    },
    {
      id: 'gfs',
      label: 'Generationenprinzip',
      gen: (rng, level) => {
        const full = rng.pick([100, 250, 400, 500, 750, 1000]);
        const sons = rng.pick([4, 5, 6]);
        const fathers = rng.pick([4, 5]);
        const grandfathers = rng.pick([12, 6]);
        const d = level >= 2 ? rng.pick([5, 10, 20, 30]) : 0;
        const media = sons + fathers + grandfathers;
        const storage = level === 1 ? media * full : sons * d + (fathers + grandfathers) * full;
        return {
          title: 'Großvater-Vater-Sohn',
          prompt: [
            `Ein Unternehmen sichert **${fmt(full)} GB** nach dem **Generationenprinzip**:`,
            '',
            `- **Söhne:** ${sons} tägliche Sicherungen ${level === 1 ? '(jeweils **Vollsicherung**)' : `(jeweils **inkrementell**, ca. ${d} GB)`}, wöchentlich überschrieben`,
            `- **Väter:** ${fathers} wöchentliche **Vollsicherungen**, monatlich überschrieben`,
            `- **Großväter:** ${grandfathers} monatliche **Vollsicherungen**`,
            '',
            'Wie viele Sicherungsmedien (je Sicherung ein Medium) werden benötigt und wie viel Speicher belegen alle Generationen zusammen?',
          ].join('\n'),
          fields: [num('media', 'Anzahl Medien', media, 'Stück', { abs: 0 }), num('storage', 'Speicherbedarf gesamt', storage, 'GB')],
          solution: [
            `- Medien: ${sons} + ${fathers} + ${grandfathers} = **${media}**`,
            level === 1
              ? `- Speicher: ${media} × ${fmt(full)} GB = **${fmt(storage)} GB**`
              : `- Söhne: ${sons} × ${d} GB = ${fmt(sons * d)} GB\n- Väter + Großväter: (${fathers} + ${grandfathers}) × ${fmt(full)} GB = ${fmt((fathers + grandfathers) * full)} GB\n- Summe: **${fmt(storage)} GB**`,
            '',
            `Ältester wiederherstellbarer Stand: ca. **${grandfathers} Monate** zurück.`,
          ].join('\n'),
        };
      },
    },
    {
      id: 'time',
      label: 'Sicherungs- und Restore-Dauer',
      gen: (rng, level) => {
        const gb = rng.pick([250, 500, 800, 1200, 1500, 2000, 3000]);
        const writeMBs = rng.pick([100, 150, 200, 300, 400]);
        const readMBs = rng.pick([80, 120, 160, 250]);
        let backupRate = writeMBs;
        let note = '';
        let netText = '';
        let netMBs = Infinity;
        if (level >= 2) {
          // Netzwerk als möglicher Engpass
          const netMbit = rng.pick([1000, 2500]);
          netMBs = netMbit / 8;
          note =
            netMBs < writeMBs
              ? `Engpass ist das Netzwerk: ${fmt(netMbit)} Mbit/s ÷ 8 = ${fmt(netMBs)} MB/s < ${writeMBs} MB/s`
              : `Engpass ist das Sicherungsziel: ${writeMBs} MB/s ≤ Netzwerk ${fmt(netMbit)} Mbit/s ÷ 8 = ${fmt(netMBs)} MB/s`;
          backupRate = Math.min(writeMBs, netMBs);
          note += ` → effektiv **${fmt(backupRate)} MB/s**`;
          netText = ` Die Server sind mit **${fmt(netMbit)} Mbit/s** angebunden (Overhead vernachlässigen).`;
        }
        const restoreRate = Math.min(readMBs, netMBs);
        const tb = (gb * 1000) / backupRate / 3600;
        const tr = (gb * 1000) / restoreRate / 3600;
        const rto = level === 3 ? rng.pick([2, 3, 4, 6, 8]) : 0;
        const fields: Field[] = [num('tb', 'Dauer Sicherung', tb, 'h', { rel: 0.01, abs: 0.02 }), num('tr', 'Dauer Wiederherstellung', tr, 'h', { rel: 0.01, abs: 0.02 })];
        if (level === 3) fields.push({ key: 'rto', label: `RTO von ${rto} h eingehalten?`, kind: 'choice', answer: tr <= rto ? 'ja' : 'nein', options: ['ja', 'nein'] });
        return {
          title: 'Zeitbedarf Sicherung und Wiederherstellung',
          prompt:
            `Es sollen **${fmt(gb)} GB** gesichert werden. Das Sicherungsziel schreibt mit **${writeMBs} MB/s**, beim Wiederherstellen werden **${readMBs} MB/s** erreicht.` +
            netText +
            `\n\nBerechnen Sie die Dauer von Sicherung und Wiederherstellung in Stunden (1 GB = 1.000 MB).` +
            (level === 3 ? ` Wird ein RTO von **${rto} Stunden** eingehalten (nur Datenrücksicherung betrachtet)?` : ''),
          fields,
          solution: [
            note ? `- Sicherung: ${note}` : '',
            `- Sicherung: ${fmt(gb * 1000, 0)} MB ÷ ${fmt(backupRate)} MB/s = ${fmt((gb * 1000) / backupRate, 0)} s ÷ 3.600 = **${fmt(tb, 2)} h** (${duration((gb * 1000) / backupRate)})`,
            level >= 2 && restoreRate < readMBs ? `- Wiederherstellung: auch hier begrenzt das Netzwerk auf ${fmt(restoreRate)} MB/s` : '',
            `- Wiederherstellung: ${fmt(gb * 1000, 0)} MB ÷ ${fmt(restoreRate)} MB/s = ${fmt((gb * 1000) / restoreRate, 0)} s ÷ 3.600 = **${fmt(tr, 2)} h** (${duration((gb * 1000) / restoreRate)})`,
            level === 3 ? `- RTO ${rto} h: ${fmt(tr, 2)} h ${tr <= rto ? '≤' : '>'} ${rto} h → **${tr <= rto ? 'ja' : 'nein'}**${tr > rto ? ' – Maßnahmen: schnelleres Medium, Snapshots/Replikation, Wiederherstellung priorisieren' : ''}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        };
      },
    },
  ],
};
