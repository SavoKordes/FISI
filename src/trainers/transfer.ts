import type { Field, Trainer } from './types';
import { duration, fmt, fmtPlain, round } from './lib/format';

const num = (key: string, label: string, v: number, unit: string, decimals = 2, tol: Field['tolerance'] = { rel: 0.01, abs: 0.01 }): Field => ({
  key,
  label,
  kind: 'number',
  answer: fmtPlain(round(v, decimals), decimals),
  value: v,
  unit,
  tolerance: tol,
});

const PREFIX: Record<string, { dec: number; bin: number; label: string }> = {
  MB: { dec: 1e6, bin: 0, label: '10⁶' },
  GB: { dec: 1e9, bin: 0, label: '10⁹' },
  MiB: { dec: 0, bin: 2 ** 20, label: '2²⁰' },
  GiB: { dec: 0, bin: 2 ** 30, label: '2³⁰' },
};
const bytesOf = (unit: string) => PREFIX[unit].dec || PREFIX[unit].bin;

export const transferTrainer: Trainer = {
  id: 'uebertragung',
  title: 'Übertragung & Datenmengen',
  short: 'Übertragung',
  description: 'Übertragungsdauer, benötigte Bandbreite, Overhead, Datenmengen von Kameras/Logs/Bildern',
  levels: { 1: 'SI-Einheiten, ohne Overhead', 2: 'mit Protokoll-Overhead', 3: 'Binärpräfixe (GiB), Gbit/s, Overhead' },
  types: [
    {
      id: 'time',
      label: 'Übertragungsdauer',
      gen: (rng, level) => {
        const unit = level === 3 ? rng.pick(['GiB', 'MiB']) : rng.pick(['GB', 'MB']);
        const size = unit.startsWith('G') ? rng.pick([1, 2, 4, 5, 8, 10, 25, 50, 120]) : rng.pick([50, 100, 250, 500, 700, 800]);
        const rateUnit = level === 3 && rng.chance(0.5) ? 'Gbit/s' : 'Mbit/s';
        const rate = rateUnit === 'Gbit/s' ? rng.pick([1, 2.5, 10]) : rng.pick([16, 50, 100, 250, 500, 1000]);
        const oh = level === 1 ? 0 : rng.pick([5, 8, 10, 12, 15, 20]);
        const bits = size * bytesOf(unit) * 8;
        const rateBits = rate * (rateUnit === 'Gbit/s' ? 1e9 : 1e6);
        const eff = rateBits * (1 - oh / 100);
        const sec = bits / eff;
        const askMin = sec > 600;
        return {
          title: 'Übertragungsdauer berechnen',
          prompt:
            `Eine Datei mit **${fmt(size)} ${unit}** soll über eine Leitung mit **${fmt(rate)} ${rateUnit}** übertragen werden.` +
            (oh ? ` Durch Protokoll-Overhead stehen nur **${100 - oh} %** der Bandbreite für Nutzdaten zur Verfügung (${oh} % Overhead).` : '') +
            `\n\nWie lange dauert die Übertragung in **${askMin ? 'Minuten' : 'Sekunden'}**? (Datenraten sind dezimal: 1 Mbit/s = 10⁶ bit/s${unit.includes('i') ? `; 1 ${unit} = ${PREFIX[unit].label} Byte` : `; 1 ${unit} = ${PREFIX[unit].label} Byte`})`,
          fields: [askMin ? num('t', 'Dauer', sec / 60, 'min') : num('t', 'Dauer', sec, 's')],
          solution: [
            `1. Datenmenge in Bit: ${fmt(size)} ${unit} × ${PREFIX[unit].label} Byte × 8 = **${fmt(bits, 0)} bit**`,
            `2. Übertragungsrate in bit/s: ${fmt(rate)} ${rateUnit} = ${fmt(rateBits, 0)} bit/s` + (oh ? `; nutzbar ${100 - oh} % → **${fmt(eff, 0)} bit/s**` : ''),
            `3. Zeit = Datenmenge ÷ Rate = ${fmt(bits, 0)} ÷ ${fmt(eff, 0)} = **${fmt(sec, 2)} s**` + (askMin ? ` = ${fmt(sec, 2)} ÷ 60 = **${fmt(sec / 60, 2)} min**` : ''),
            `   (≈ ${duration(sec)})`,
            '',
            'Typische Falle: **Byte vs. Bit** – Faktor 8 nicht vergessen!',
          ].join('\n'),
        };
      },
    },
    {
      id: 'bandwidth',
      label: 'Benötigte Bandbreite',
      gen: (rng, level) => {
        const gb = rng.pick([5, 10, 20, 30, 40, 60, 90, 120, 200]);
        const minutes = rng.pick([10, 15, 20, 30, 45, 60, 90, 120, 240]);
        const oh = level === 1 ? 0 : rng.pick([5, 10, 15, 20]);
        const unit = level === 3 ? 'GiB' : 'GB';
        const bits = gb * bytesOf(unit) * 8;
        const net = bits / (minutes * 60) / 1e6;
        const gross = net / (1 - oh / 100);
        return {
          title: 'Benötigte Bandbreite',
          prompt:
            `Ein nächtliches Backup von **${gb} ${unit}** soll innerhalb von **${minutes} Minuten** zu einem externen Rechenzentrum übertragen werden.` +
            (oh ? ` Rechnen Sie mit **${oh} % Protokoll-Overhead** (nur ${100 - oh} % der Leitungsrate sind Nutzdaten).` : '') +
            `\n\nWelche Übertragungsrate in **Mbit/s** ist mindestens erforderlich?`,
          fields: [num('rate', 'Erforderliche Rate', gross, 'Mbit/s')],
          solution: [
            `1. Datenmenge: ${gb} ${unit} × ${PREFIX[unit].label} Byte × 8 = ${fmt(bits, 0)} bit`,
            `2. Zeit: ${minutes} min × 60 = ${fmt(minutes * 60, 0)} s`,
            `3. Nutzdatenrate: ${fmt(bits, 0)} bit ÷ ${fmt(minutes * 60, 0)} s = ${fmt(net * 1e6, 0)} bit/s = **${fmt(net, 2)} Mbit/s**`,
            oh ? `4. Leitungsrate mit Overhead: ${fmt(net, 2)} ÷ ${fmt((100 - oh) / 100, 2)} = **${fmt(gross, 2)} Mbit/s**` : '',
            '',
            `In der Praxis würde man die nächstgrößere verfügbare Bandbreite wählen.`,
          ]
            .filter((l, i, a) => l !== '' || a[i - 1] !== '')
            .join('\n'),
        };
      },
    },
    {
      id: 'volume',
      label: 'Datenmengen berechnen',
      gen: (rng, level) => {
        const variant = level === 1 ? 'camera' : level === 2 ? rng.pick(['camera', 'logs']) : rng.pick(['image', 'logs', 'camera']);
        if (variant === 'camera') {
          const cams = level === 1 ? 1 : rng.int(4, 24);
          const mbit = rng.pick([2, 4, 6, 8]);
          const hours = level === 1 ? 24 : rng.pick([12, 24]);
          const days = level === 1 ? 1 : rng.pick([7, 14, 30]);
          const bytes = (cams * mbit * 1e6 * hours * 3600 * days) / 8;
          const inTB = level > 1;
          return {
            title: 'Speicherbedarf Videoüberwachung',
            prompt: `${cams === 1 ? 'Eine IP-Kamera zeichnet' : `**${cams} IP-Kameras** zeichnen`} mit je **${mbit} Mbit/s** auf, **${hours} Stunden** pro Tag. Die Aufnahmen werden **${days} ${days === 1 ? 'Tag' : 'Tage'}** aufbewahrt.\n\nWie viel Speicher wird benötigt (in **${inTB ? 'TB' : 'GB'}**, 1 GB = 10⁹ Byte, 1 TB = 10¹² Byte)?`,
            fields: [num('v', 'Speicherbedarf', bytes / (inTB ? 1e12 : 1e9), inTB ? 'TB' : 'GB')],
            solution: [
              `1. Datenrate gesamt: ${cams} × ${mbit} Mbit/s = ${cams * mbit} Mbit/s = ${fmt((cams * mbit) / 8, 3)} MB/s (÷ 8)`,
              `2. Sekunden: ${hours} h × 3.600 s × ${days} = ${fmt(hours * 3600 * days, 0)} s`,
              `3. Datenmenge: ${fmt((cams * mbit) / 8, 3)} MB/s × ${fmt(hours * 3600 * days, 0)} s = ${fmt(bytes / 1e6, 0)} MB = **${fmt(bytes / (inTB ? 1e12 : 1e9), 2)} ${inTB ? 'TB' : 'GB'}**`,
            ].join('\n'),
          };
        }
        if (variant === 'logs') {
          const perSec = rng.pick([50, 120, 200, 500, 1500]);
          const lineBytes = rng.pick([150, 200, 250, 400]);
          const days = rng.pick([30, 90, 180]);
          const perDay = perSec * lineBytes * 86400;
          const total = perDay * days;
          return {
            title: 'Speicherbedarf für Logdaten',
            prompt: `Ein Syslog-Server empfängt durchschnittlich **${perSec} Meldungen pro Sekunde** mit je **${lineBytes} Byte**. Die Logs müssen **${days} Tage** aufbewahrt werden (unkomprimiert).\n\nBerechnen Sie die Datenmenge pro Tag (GB) und den Gesamtspeicherbedarf (GB). (1 GB = 10⁹ Byte)`,
            fields: [num('day', 'Pro Tag', perDay / 1e9, 'GB'), num('total', 'Gesamt', total / 1e9, 'GB')],
            solution: [
              `1. Pro Sekunde: ${perSec} × ${lineBytes} Byte = ${fmt(perSec * lineBytes, 0)} Byte`,
              `2. Pro Tag: × 86.400 s = ${fmt(perDay, 0)} Byte = **${fmt(perDay / 1e9, 2)} GB**`,
              `3. Gesamt: ${fmt(perDay / 1e9, 2)} GB × ${days} = **${fmt(total / 1e9, 2)} GB**`,
              '',
              'Praxis: Logs werden meist komprimiert (Faktor 5–10) und rotiert (logrotate).',
            ].join('\n'),
          };
        }
        const [w, h] = rng.pick([
          [1920, 1080],
          [2560, 1440],
          [3840, 2160],
          [1280, 720],
        ]);
        const depth = rng.pick([24, 32]);
        const count = rng.pick([100, 250, 500, 1000]);
        const bytes = (w * h * depth) / 8;
        return {
          title: 'Speicherbedarf unkomprimierter Bilder',
          prompt: `Ein Scanner erzeugt unkomprimierte Bilder mit **${w} × ${h} Pixel** und **${depth} Bit Farbtiefe**. Berechnen Sie die Größe eines Bildes in **MiB** und den Speicherbedarf für **${count} Bilder** in **GiB**. (1 MiB = 2²⁰ Byte, 1 GiB = 2³⁰ Byte)`,
          fields: [num('one', 'Ein Bild', bytes / 2 ** 20, 'MiB'), num('all', `${count} Bilder`, (bytes * count) / 2 ** 30, 'GiB')],
          solution: [
            `1. Pixel: ${w} × ${h} = ${fmt(w * h, 0)}`,
            `2. Byte: ${fmt(w * h, 0)} × ${depth} bit ÷ 8 = ${fmt(bytes, 0)} Byte`,
            `3. In MiB: ${fmt(bytes, 0)} ÷ 1.048.576 = **${fmt(bytes / 2 ** 20, 2)} MiB**`,
            `4. ${count} Bilder: ${fmt(bytes * count, 0)} Byte ÷ 1.073.741.824 = **${fmt((bytes * count) / 2 ** 30, 2)} GiB**`,
          ].join('\n'),
        };
      },
    },
  ],
};
